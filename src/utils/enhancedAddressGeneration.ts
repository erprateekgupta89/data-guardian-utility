
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
      maxRetries: 3,
      qualityThreshold: 0.8,
      ...options
    };
    this.geoReference = new GeoReferenceSystem();
    this.proportionCalculator = new CountryProportionCalculator();
  }

  async generateProportionalAddresses(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    // Calculate country proportions
    const proportionPlan = this.proportionCalculator.calculateProportions(
      data, 
      countryColumnName, 
      selectedCountries
    );

    // Generate masking sequence
    const maskingSequence = this.proportionCalculator.generateMaskingSequence(proportionPlan);

    // Pre-generate addresses for each country based on their needs
    const countryAddressMap = new Map<string, GeneratedAddress[]>();

    for (const distribution of proportionPlan.countryDistributions) {
      const addresses = await this.getAddressesForCountry(
        distribution.country, 
        distribution.count
      );
      countryAddressMap.set(distribution.country, addresses);
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

export { EnhancedAddressGenerator, type EnhancedMaskingOptions };
