
import { AzureOpenAIService, type GeneratedAddress, type BatchAddressGenerationRequest } from '@/services/azureOpenAI';
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
      maxRetries: 3,
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
    console.log('=== Starting Optimized Batch Address Generation ===');
    
    // Calculate exact country requirements
    const countryRequirements = this.calculateExactCountryRequirements(
      data,
      countryColumnName,
      selectedCountries
    );

    console.log('Country requirements:', countryRequirements);

    // Use SINGLE batch API call for ALL countries
    const countryAddressMap = await this.generateSingleBatchCall(countryRequirements);

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

    return Array.from(countryMap.entries()).map(([country, rowIndices]) => ({
      country,
      count: rowIndices.length,
      rowIndices
    }));
  }

  private async generateSingleBatchCall(
    countryRequirements: CountryRequirement[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    if (countryRequirements.length === 0) {
      return new Map();
    }

    try {
      console.log('=== SINGLE BATCH API CALL FOR ALL COUNTRIES ===');
      
      // Create ONE batch request for ALL countries
      const batchRequest: BatchAddressGenerationRequest = {
        countries: countryRequirements.map(req => ({
          country: req.country,
          count: req.count
        }))
      };

      console.log('Batch request:', batchRequest);

      // ONE API call for everything
      const batchResponse = await this.options.azureService.generateBatchAddresses(batchRequest);
      
      console.log(`✅ Generated addresses for ${batchResponse.addressesByCountry.size} countries in ONE API call`);
      console.log('Batch response metadata:', batchResponse.metadata);

      return batchResponse.addressesByCountry;

    } catch (error) {
      console.error('❌ Batch generation failed:', error);
      // Return empty map instead of falling back to individual calls
      return new Map();
    }
  }

  async getAddressesForCountry(country: string, count: number): Promise<GeneratedAddress[]> {
    // Check cache first
    const cached = this.getCachedAddresses(country, count);
    if (cached) {
      return cached;
    }

    // Use batch generation for individual country requests too
    const countryRequirements: CountryRequirement[] = [{
      country,
      count,
      rowIndices: Array.from({ length: count }, (_, i) => i)
    }];

    const batchResult = await this.generateSingleBatchCall(countryRequirements);
    const addresses = batchResult.get(country) || [];
    
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

  private cacheAddresses(country: string, addresses: GeneratedAddress[]): void {
    this.addressCache[country] = {
      addresses,
      lastGenerated: new Date(),
      quality: addresses.length > 0 ? 'high' : 'low'
    };
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
