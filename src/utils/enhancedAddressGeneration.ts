
import { AzureOpenAIService, type GeneratedAddress } from '@/services/azureOpenAI';
import { GeoReferenceSystem } from './geoReference';
import { CountryProportionCalculator, type ProportionalMaskingPlan } from './countryProportions';

interface AddressCache {
  [country: string]: {
    addresses: GeneratedAddress[];
    lastGenerated: Date;
    quality: 'high' | 'medium' | 'low';
  };
}

interface CountryRequirement {
  country: string;
  count: number;
  rowIndices: number[];
}

interface EnhancedMaskingOptions {
  azureService: AzureOpenAIService;
  batchSize: number;
  cacheExpiration: number; // milliseconds
  maxRetries: number;
  qualityThreshold: number; // minimum success rate
}

class EnhancedAddressGenerator {
  private addressCache: AddressCache = {};
  private geoReference: GeoReferenceSystem;
  private proportionCalculator: CountryProportionCalculator;
  private options: EnhancedMaskingOptions;

  constructor(options: EnhancedMaskingOptions) {
    this.options = {
      batchSize: 50,
      cacheExpiration: 30 * 60 * 1000, // 30 minutes
      maxRetries: 5, // Increased from 3 to 5
      qualityThreshold: 0.8,
      ...options
    };
    this.geoReference = new GeoReferenceSystem();
    this.proportionCalculator = new CountryProportionCalculator();
  }

  async generateOptimizedAddresses(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    console.log('=== Starting Optimized Address Generation ===');
    
    // Calculate exact country requirements by iterating through entire dataset
    const countryRequirements = this.calculateExactCountryRequirements(
      data,
      countryColumnName,
      selectedCountries
    );

    console.log('Country requirements:', countryRequirements);

    // Make single optimized API call for all countries
    const countryAddressMap = await this.generateSingleOptimizedCall(countryRequirements);

    return countryAddressMap;
  }

  private calculateExactCountryRequirements(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[]
  ): CountryRequirement[] {
    const countryMap = new Map<string, number[]>();

    // Iterate through entire dataset to count exact occurrences
    data.forEach((row, index) => {
      let country = row[countryColumnName]?.trim();
      
      // Use selected countries if country dropdown is enabled
      if (selectedCountries && selectedCountries.length > 0) {
        country = selectedCountries[Math.floor(Math.random() * selectedCountries.length)];
      }

      if (country) {
        if (!countryMap.has(country)) {
          countryMap.set(country, []);
        }
        countryMap.get(country)!.push(index);
      }
    });

    // Convert to CountryRequirement format
    return Array.from(countryMap.entries()).map(([country, rowIndices]) => ({
      country,
      count: rowIndices.length,
      rowIndices
    }));
  }

  private async generateSingleOptimizedCall(
    countryRequirements: CountryRequirement[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    const countryAddressMap = new Map<string, GeneratedAddress[]>();

    // Enhanced retry logic with duplicate detection
    for (const requirement of countryRequirements) {
      let attempt = 1;
      let allAddresses: GeneratedAddress[] = [];
      const seenAddresses = new Set<string>();

      while (allAddresses.length < requirement.count && attempt <= this.options.maxRetries) {
        try {
          console.log(`Generating ${requirement.count} addresses for ${requirement.country} (attempt ${attempt})`);
          
          const batchSize = Math.min(requirement.count, this.options.batchSize);
          const addresses = await this.options.azureService.generateAddresses({
            country: requirement.country,
            count: batchSize,
            addressType: 'mixed'
          });

          // Duplicate detection and validation
          const uniqueAddresses = addresses.filter(addr => {
            const addressKey = `${addr.street}-${addr.city}-${addr.state}-${addr.postalCode}`;
            if (seenAddresses.has(addressKey)) {
              return false;
            }
            seenAddresses.add(addressKey);
            return this.geoReference.validateAddressFormat(addr, requirement.country);
          });

          allAddresses.push(...uniqueAddresses);
          
          const successRate = uniqueAddresses.length / batchSize;
          console.log(`Generated ${uniqueAddresses.length}/${batchSize} unique valid addresses (${(successRate * 100).toFixed(1)}% success rate)`);

          if (uniqueAddresses.length > 0 || attempt === this.options.maxRetries) {
            break;
          }

        } catch (error) {
          console.error(`Attempt ${attempt} failed for ${requirement.country}:`, error);
          if (attempt === this.options.maxRetries) {
            console.error(`Failed to generate addresses for ${requirement.country} after ${this.options.maxRetries} attempts`);
          }
        }

        attempt++;
        // Progressive delay between retries
        await this.delay(1000 * attempt);
      }

      // Store addresses even if we didn't get the exact count
      if (allAddresses.length > 0) {
        countryAddressMap.set(requirement.country, allAddresses);
      }
    }

    return countryAddressMap;
  }

  async getAddressesForCountry(country: string, count: number): Promise<GeneratedAddress[]> {
    // Check cache first
    const cached = this.getCachedAddresses(country, count);
    if (cached) {
      return cached;
    }

    // Generate new addresses with smart retry
    const addresses = await this.generateWithSmartRetry(country, count);
    
    // Cache the results
    this.cacheAddresses(country, addresses);
    
    return addresses;
  }

  private getCachedAddresses(country: string, count: number): GeneratedAddress[] | null {
    const cached = this.addressCache[country];
    if (!cached) return null;

    // Check if cache is expired
    const now = new Date();
    if (now.getTime() - cached.lastGenerated.getTime() > this.options.cacheExpiration) {
      delete this.addressCache[country];
      return null;
    }

    // Check if we have enough addresses
    if (cached.addresses.length >= count) {
      return cached.addresses.slice(0, count);
    }

    return null;
  }

  private async generateWithSmartRetry(country: string, count: number): Promise<GeneratedAddress[]> {
    const allAddresses: GeneratedAddress[] = [];
    let remainingCount = count;
    let attempt = 1;

    while (remainingCount > 0 && attempt <= this.options.maxRetries) {
      try {
        console.log(`Generating ${remainingCount} addresses for ${country} (attempt ${attempt})`);
        
        // Get regional requirements
        const requirements = this.geoReference.generateRegionalRequirements(country);
        const specificRequirements = this.geoReference.getSpecificRequirements(
          country, 
          requirements.preferredRegions
        );

        // Generate batch
        const batchSize = Math.min(remainingCount, this.options.batchSize);
        const addresses = await this.options.azureService.generateAddresses({
          country,
          count: batchSize,
          addressType: 'mixed',
          regions: requirements.preferredRegions,
          specificRequirements
        });

        // Validate addresses
        const validAddresses = addresses.filter(addr => 
          this.geoReference.validateAddressFormat(addr, country)
        );

        allAddresses.push(...validAddresses);
        remainingCount -= validAddresses.length;

        // Calculate success rate
        const successRate = validAddresses.length / batchSize;
        console.log(`Generated ${validAddresses.length}/${batchSize} valid addresses (${(successRate * 100).toFixed(1)}% success rate)`);

        // If success rate is too low, try different approach
        if (successRate < this.options.qualityThreshold && attempt < this.options.maxRetries) {
          console.log(`Low success rate, retrying with different parameters...`);
          attempt++;
          continue;
        }

        // Break if we got some addresses or if this is the last attempt
        if (validAddresses.length > 0 || attempt === this.options.maxRetries) {
          break;
        }

      } catch (error) {
        console.error(`Attempt ${attempt} failed for ${country}:`, error);
        if (attempt === this.options.maxRetries) {
          throw error;
        }
      }

      attempt++;
      // Progressive delay between retries
      await this.delay(1000 * attempt);
    }

    console.log(`Generated ${allAddresses.length} total addresses for ${country}`);
    return allAddresses;
  }

  private cacheAddresses(country: string, addresses: GeneratedAddress[]): void {
    this.addressCache[country] = {
      addresses,
      lastGenerated: new Date(),
      quality: addresses.length > 0 ? 'high' : 'low'
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache(): void {
    this.addressCache = {};
  }

  getCacheStats(): Record<string, { count: number; age: number; quality: string }> {
    const stats: Record<string, { count: number; age: number; quality: string }> = {};
    const now = new Date();

    Object.entries(this.addressCache).forEach(([country, cache]) => {
      stats[country] = {
        count: cache.addresses.length,
        age: now.getTime() - cache.lastGenerated.getTime(),
        quality: cache.quality
      };
    });

    return stats;
  }
}

export { EnhancedAddressGenerator, type EnhancedMaskingOptions, type CountryRequirement };
