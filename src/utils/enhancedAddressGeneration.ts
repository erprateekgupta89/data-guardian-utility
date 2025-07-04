import { AzureOpenAIService, type GeneratedAddress, type BatchAddressGenerationRequest } from '@/services/azureOpenAI';
import { GeoReferenceSystem } from './geoReference';
import { CountryProportionCalculator, type ProportionalMaskingPlan } from './countryProportions';
import { AddressValidator } from './addressValidator';

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

interface DatasetAnalysis {
  totalRows: number;
  isLargeDataset: boolean; // ≥100 rows
  requiresProportionalLogic: boolean;
  estimatedAddressesNeeded: number;
  maxAddressesPerCountry: number; // NEW: Cap for large datasets
}

class EnhancedAddressGenerator {
  private addressCache: AddressCache = {};
  private geoReference: GeoReferenceSystem;
  private proportionCalculator: CountryProportionCalculator;
  private addressValidator: AddressValidator;
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
    this.addressValidator = new AddressValidator();
  }

  private analyzeDataset(
    data: Record<string, string>[],
    countryColumnName?: string
  ): DatasetAnalysis {
    const totalRows = data.length;
    const isLargeDataset = totalRows >= 100;

    console.log('=== FIXED: Dataset Analysis ===');
    console.log(`Total rows: ${totalRows}`);
    console.log(`Is large dataset (≥100 rows): ${isLargeDataset}`);

    // FIXED: For large datasets, cap addresses per country at 100
    const maxAddressesPerCountry = isLargeDataset ? 100 : totalRows;
    const estimatedAddressesNeeded = isLargeDataset 
      ? Math.min(totalRows, maxAddressesPerCountry) // Cap at 100 for large datasets
      : totalRows;

    const analysis: DatasetAnalysis = {
      totalRows,
      isLargeDataset,
      requiresProportionalLogic: isLargeDataset && !!countryColumnName,
      estimatedAddressesNeeded,
      maxAddressesPerCountry
    };

    console.log(`FIXED: Max addresses per country: ${maxAddressesPerCountry}`);
    console.log(`FIXED: Estimated addresses needed: ${estimatedAddressesNeeded}`);
    console.log(`FIXED: Requires proportional logic: ${analysis.requiresProportionalLogic}`);

    return analysis;
  }

  async generateOptimizedAddresses(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    console.log('=== FIXED: Starting Optimized Batch Address Generation ===');
    
    // STEP 1: Analyze dataset size and requirements
    const datasetAnalysis = this.analyzeDataset(data, countryColumnName);
    
    // STEP 2: Calculate requirements with proper size limits
    const countryRequirements = datasetAnalysis.isLargeDataset
      ? this.calculateLargeDatasetRequirements(data, countryColumnName, selectedCountries, datasetAnalysis)
      : this.calculateExactCountryRequirements(data, countryColumnName, selectedCountries);

    console.log('=== FIXED: Country Requirements ===');
    countryRequirements.forEach(req => {
      console.log(`${req.country}: ${req.count} addresses needed (for ${req.rowIndices.length} rows)`);
    });

    // STEP 3: Generate addresses with validation and retry logic
    const countryAddressMap = await this.generateWithValidationAndRetry(countryRequirements);

    // STEP 4: Initialize address validator for reuse (important for large datasets)
    if (datasetAnalysis.isLargeDataset) {
      this.addressValidator.initializeAddressPool(countryAddressMap);
      console.log('✅ FIXED: Address reuse system initialized for large dataset');
    }

    console.log('=== FIXED: Final Address Map ===');
    for (const [country, addresses] of countryAddressMap.entries()) {
      console.log(`${country}: Generated ${addresses.length} unique addresses`);
    }

    return countryAddressMap;
  }

  // NEW: Separate method for large dataset requirements calculation
  private calculateLargeDatasetRequirements(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[],
    analysis: DatasetAnalysis
  ): CountryRequirement[] {
    console.log('=== FIXED: Calculating Large Dataset Requirements (≥100 rows) ===');
    console.log(`FIXED: Capping addresses per country at ${analysis.maxAddressesPerCountry}`);
    
    const countryMap = new Map<string, number[]>();

    // Count exact occurrences in the actual dataset
    data.forEach((row, index) => {
      let country = row[countryColumnName]?.trim();
      
      // Use selected countries distribution if provided
      if (selectedCountries && selectedCountries.length > 0) {
        // Distribute rows across selected countries in order
        country = selectedCountries[index % selectedCountries.length];
      }

      if (country) {
        if (!countryMap.has(country)) {
          countryMap.set(country, []);
        }
        countryMap.get(country)!.push(index);
      }
    });

    const requirements = Array.from(countryMap.entries()).map(([country, rowIndices]) => {
      // FIXED: For large datasets, cap at maxAddressesPerCountry (100)
      const cappedCount = Math.min(rowIndices.length, analysis.maxAddressesPerCountry);
      
      console.log(`FIXED: ${country} - ${rowIndices.length} total rows, generating ${cappedCount} unique addresses (capped at ${analysis.maxAddressesPerCountry})`);
      
      return {
        country,
        count: cappedCount,
        rowIndices
      };
    });

    return requirements;
  }

  private calculateExactCountryRequirements(
    data: Record<string, string>[],
    countryColumnName: string,
    selectedCountries?: string[]
  ): CountryRequirement[] {
    console.log('=== FIXED: Calculating Exact Country Requirements ===');
    const countryMap = new Map<string, number[]>();

    // Count exact occurrences in the actual dataset
    data.forEach((row, index) => {
      let country = row[countryColumnName]?.trim();
      
      // Use selected countries distribution if provided
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

  // NEW: Generate addresses with validation and retry logic
  private async generateWithValidationAndRetry(
    countryRequirements: CountryRequirement[]
  ): Promise<Map<string, GeneratedAddress[]>> {
    if (countryRequirements.length === 0) {
      console.log('❌ FIXED: No country requirements - returning empty map');
      return new Map();
    }

    let attempt = 0;
    const maxAttempts = this.options.maxRetries;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`=== VALIDATION: Attempt ${attempt}/${maxAttempts} ===`);
      
      try {
        // Make the API call
        const batchRequest: BatchAddressGenerationRequest = {
          countries: countryRequirements.map(req => ({
            country: req.country,
            count: req.count
          }))
        };

        console.log('VALIDATION: Making Azure OpenAI API call...');
        console.log('VALIDATION: Batch request:', JSON.stringify(batchRequest, null, 2));
        
        const batchResponse = await this.options.azureService.generateBatchAddresses(batchRequest);
        
        console.log(`✅ VALIDATION: API call completed on attempt ${attempt}`);
        console.log(`VALIDATION: Generated addresses for ${batchResponse.addressesByCountry.size} countries`);

        // Validate the results
        const validatedResults = new Map<string, GeneratedAddress[]>();
        let overallSuccessRate = 0;
        let totalAddresses = 0;
        let validAddresses = 0;

        for (const [country, addresses] of batchResponse.addressesByCountry.entries()) {
          const validation = this.addressValidator.validateAddressBatch(addresses);
          validatedResults.set(country, validation.validAddresses);
          
          totalAddresses += addresses.length;
          validAddresses += validation.validAddresses.length;
          
          console.log(`VALIDATION: ${country} - ${validation.validAddresses.length}/${addresses.length} valid (${(validation.successRate * 100).toFixed(1)}%)`);
        }

        overallSuccessRate = totalAddresses > 0 ? validAddresses / totalAddresses : 0;
        console.log(`VALIDATION: Overall success rate: ${(overallSuccessRate * 100).toFixed(1)}%`);

        // Check if quality meets threshold
        if (overallSuccessRate >= this.options.qualityThreshold) {
          console.log(`✅ VALIDATION: Quality threshold met (${(overallSuccessRate * 100).toFixed(1)}% >= ${(this.options.qualityThreshold * 100).toFixed(1)}%)`);
          return validatedResults;
        } else {
          console.log(`⚠️ VALIDATION: Quality below threshold (${(overallSuccessRate * 100).toFixed(1)}% < ${(this.options.qualityThreshold * 100).toFixed(1)}%)`);
          
          if (attempt < maxAttempts) {
            console.log(`VALIDATION: Retrying in attempt ${attempt + 1}...`);
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }

      } catch (error) {
        console.error(`❌ VALIDATION: Attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          console.log(`VALIDATION: Retrying in attempt ${attempt + 1}...`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
    }

    console.error(`❌ VALIDATION: All ${maxAttempts} attempts failed or quality too low`);
    return new Map();
  }

  getAddressForRow(country: string, rowIndex: number, isLargeDataset: boolean): GeneratedAddress | null {
    if (isLargeDataset) {
      // For large datasets, use address reuse system with incremental generation
      return this.addressValidator.getAddressForReuse(country, rowIndex);
    } else {
      // For small datasets, use sequential access
      const addresses = this.addressCache[country]?.addresses || [];
      if (addresses.length === 0) return null;
      
      return addresses[rowIndex % addresses.length];
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

    const batchResult = await this.generateWithValidationAndRetry(countryRequirements);
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

  getAddressReuseStats(): Record<string, { available: number; used: number; reuseFactor: number }> {
    return this.addressValidator.getReuseStats();
  }

  getValidationStats() {
    return this.addressValidator.getValidationStats();
  }
}

export { EnhancedAddressGenerator, type EnhancedMaskingOptions, type CountryRequirement, type DatasetAnalysis };
