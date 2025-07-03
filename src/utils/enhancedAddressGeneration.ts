
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
    console.log('=== FIXED: Starting Optimized Batch Address Generation ===');
    console.log(`Total rows in dataset: ${data.length}`);
    console.log(`Country column: ${countryColumnName}`);
    console.log(`Selected countries override: ${selectedCountries?.join(', ') || 'None'}`);
    
    // FIXED: Calculate exact country requirements from actual data
    const countryRequirements = this.calculateExactCountryRequirements(
      data,
      countryColumnName,
      selectedCountries
    );

    console.log('=== FIXED: Exact Country Requirements ===');
    countryRequirements.forEach(req => {
      console.log(`${req.country}: ${req.count} occurrences (rows: ${req.rowIndices.slice(0, 5).join(', ')}${req.rowIndices.length > 5 ? '...' : ''})`);
    });

    // FIXED: Use SINGLE batch API call for ALL countries
    const countryAddressMap = await this.generateSingleBatchCall(countryRequirements);

    console.log('=== FIXED: Final Address Map ===');
    for (const [country, addresses] of countryAddressMap.entries()) {
      console.log(`${country}: Generated ${addresses.length} addresses`);
    }

    return countryAddressMap;
  }

  private calculateExactCountryRequirements(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[]
  ): CountryRequirement[] {
    console.log('=== FIXED: Calculating Exact Country Requirements ===');
    const countryMap = new Map<string, number[]>();

    // FIXED: Count exact occurrences in the actual dataset - no rounding, no proportions
    data.forEach((row, index) => {
      let country = row[countryColumnName]?.trim();
      
      // FIXED: Use selected countries distribution if provided
      if (selectedCountries && selectedCountries.length > 0) {
        // Distribute rows across selected countries in order
        country = selectedCountries[index % selectedCountries.length];
        console.log(`Row ${index}: Original="${row[countryColumnName]?.trim()}" -> Assigned="${country}"`);
      }

      if (country) {
        if (!countryMap.has(country)) {
          countryMap.set(country, []);
        }
        countryMap.get(country)!.push(index);
      }
    });

    const requirements = Array.from(countryMap.entries()).map(([country, rowIndices]) => ({
      country,
      count: rowIndices.length,
      rowIndices
    }));

    console.log('=== FIXED: Country Requirements Summary ===');
    requirements.forEach(req => {
      console.log(`${req.country}: Exactly ${req.count} addresses needed`);
    });

    return requirements;
  }

  private async generateSingleBatchCall(
    countryRequirements: CountryRequirement[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    if (countryRequirements.length === 0) {
      console.log('❌ FIXED: No country requirements - returning empty map');
      return new Map();
    }

    try {
      console.log('=== FIXED: Making SINGLE BATCH API CALL ===');
      
      // FIXED: Create ONE batch request for ALL countries with exact counts
      const batchRequest: BatchAddressGenerationRequest = {
        countries: countryRequirements.map(req => ({
          country: req.country,
          count: req.count
        }))
      };

      console.log('=== FIXED: Single Batch Request ===');
      console.log(JSON.stringify(batchRequest, null, 2));

      // FIXED: ONE API call for everything - this should be the ONLY API call
      console.log('🚀 FIXED: Making the ONE AND ONLY Azure OpenAI API call...');
      const batchResponse = await this.options.azureService.generateBatchAddresses(batchRequest);
      
      console.log(`✅ FIXED: Single batch call completed!`);
      console.log(`Generated addresses for ${batchResponse.addressesByCountry.size} countries`);
      console.log('Batch response metadata:', batchResponse.metadata);

      return batchResponse.addressesByCountry;

    } catch (error) {
      console.error('❌ FIXED: Single batch generation failed:', error);
      // FIXED: Return empty map to prevent fallback API calls
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
