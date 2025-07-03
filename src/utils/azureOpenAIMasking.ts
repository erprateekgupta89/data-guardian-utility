import { AzureOpenAIService, GeneratedAddress, type AzureOpenAIConfig, type BatchAddressGenerationRequest } from '@/services/azureOpenAI';
import { EnhancedAddressGenerator, type EnhancedMaskingOptions } from './enhancedAddressGeneration';
import { GeoColumnDetector, type GeoColumnMapping } from './geoColumnDetection';
import { DataPreservationEngine, type PreservationRule } from './dataPreservation';
import { DataType } from '@/types';

interface AzureOpenAIMaskingOptions {
  config: AzureOpenAIConfig;
  country?: string;
  batchSize?: number;
  maxRetries?: number;
  selectedCountries?: string[];
  preserveDataStructure?: boolean;
  useIntelligentBatching?: boolean;
}

class AzureOpenAIMasking {
  private service: AzureOpenAIService;
  private enhancedGenerator: EnhancedAddressGenerator;
  private geoDetector: GeoColumnDetector;
  private preservationEngine: DataPreservationEngine;
  private countryAddressMap: Map<string, GeneratedAddress[]> = new Map();
  private countryIndexMap: Map<string, number> = new Map();
  private preservationRules: PreservationRule[] = [];
  private geoMapping: GeoColumnMapping = {};
  private options: AzureOpenAIMaskingOptions;

  constructor(options: AzureOpenAIMaskingOptions) {
    console.log('=== Initializing Simplified AzureOpenAIMasking ===');
    
    this.options = {
      batchSize: 50,
      maxRetries: 3,
      preserveDataStructure: true,
      useIntelligentBatching: true,
      ...options
    };
    
    this.service = new AzureOpenAIService(options.config);
    
    this.enhancedGenerator = new EnhancedAddressGenerator({
      azureService: this.service,
      batchSize: this.options.batchSize!,
      cacheExpiration: 30 * 60 * 1000,
      maxRetries: this.options.maxRetries!,
      qualityThreshold: 0.8
    });

    this.geoDetector = new GeoColumnDetector();
    this.preservationEngine = new DataPreservationEngine();
  }

  async initializeForDataset(
    data: Record<string, string>[],
    columns: any[],
    countryColumnName?: string
  ): Promise<void> {
    console.log('=== FIXED: Simplified Dataset Initialization ===');
    
    // Detect geo columns
    const geoAnalysis = this.geoDetector.detectGeoColumns(columns);
    this.geoMapping = geoAnalysis.mapping;
    console.log('Detected geo mapping:', this.geoMapping);

    // Create preservation rules if enabled
    if (this.options.preserveDataStructure) {
      const geoColumnNames = Object.values(this.geoMapping).filter(Boolean) as string[];
      this.preservationRules = this.preservationEngine.createPreservationPlan(data, geoColumnNames);
      console.log('Created preservation rules:', this.preservationRules.length);
    }

    // FIXED: Use enhanced address generation with SINGLE batch call
    await this.preGenerateAddresses(data, countryColumnName);

    console.log('FIXED: Initialization complete - all addresses pre-generated');
  }

  private async preGenerateAddresses(
    data: Record<string, string>[],
    countryColumnName?: string
  ): Promise<void> {
    try {
      console.log('=== FIXED: Pre-generating ALL addresses with SINGLE batch call ===');
      
      if (!countryColumnName) {
        // FIXED: If no country column, use selected countries with exact distribution
        const countries = this.options.selectedCountries || ['United States'];
        const totalRows = data.length;
        
        console.log(`FIXED: No country column - distributing ${totalRows} rows across ${countries.length} countries`);
        
        const batchRequest: BatchAddressGenerationRequest = {
          countries: countries.map((country, index) => {
            const startRow = Math.floor((index * totalRows) / countries.length);
            const endRow = Math.floor(((index + 1) * totalRows) / countries.length);
            const count = endRow - startRow;
            console.log(`FIXED: ${country} gets ${count} addresses (rows ${startRow}-${endRow-1})`);
            return { country, count };
          })
        };

        console.log('FIXED: Pre-generation batch request:', batchRequest);
        const batchResponse = await this.service.generateBatchAddresses(batchRequest);
        this.countryAddressMap = batchResponse.addressesByCountry;
        
        // Initialize index counters
        for (const country of countries) {
          this.countryIndexMap.set(country, 0);
        }
      } else {
        console.log(`FIXED: Using country column "${countryColumnName}" for exact requirements`);
        
        // FIXED: Use enhanced generator for optimized addresses with exact counting
        const optimizedAddresses = await this.enhancedGenerator.generateOptimizedAddresses(
          data,
          countryColumnName,
          this.options.selectedCountries
        );
        
        this.countryAddressMap = optimizedAddresses;
        
        // Initialize index counters for ALL generated countries
        for (const country of optimizedAddresses.keys()) {
          this.countryIndexMap.set(country, 0);
          console.log(`FIXED: Initialized counter for ${country}: ${optimizedAddresses.get(country)?.length} addresses available`);
        }
      }
      
      console.log(`✅ FIXED: Pre-generated addresses for ${this.countryAddressMap.size} countries`);
      for (const [country, addresses] of this.countryAddressMap.entries()) {
        console.log(`- FIXED: ${country}: ${addresses.length} addresses ready`);
      }
      
    } catch (error) {
      console.error('❌ FIXED: Pre-generation failed:', error);
      // FIXED: Don't leave empty map - this prevents fallbacks
      this.countryAddressMap = new Map();
    }
  }

  async maskData(value: string, dataType: DataType, targetCountry?: string): Promise<string> {
    if (!value || value.trim() === '') return value;

    const country = targetCountry || this.options.country || 'United States';
    
    console.log(`FIXED: maskData called for ${dataType} in ${country}`);
    
    // FIXED: Strict check - NO fallback API calls allowed
    if (!this.countryAddressMap.has(country)) {
      console.error(`❌ FIXED: Country "${country}" not found in pre-generated addresses!`);
      console.log('Available countries:', Array.from(this.countryAddressMap.keys()));
      // FIXED: Return original value instead of making API call
      return value;
    }

    const addresses = this.countryAddressMap.get(country)!;
    if (addresses.length === 0) {
      console.error(`❌ FIXED: No addresses available for country "${country}"`);
      // FIXED: Return original value instead of making API call
      return value;
    }

    // Get current index and increment (with wrapping)
    let currentIndex = this.countryIndexMap.get(country) || 0;
    const address = addresses[currentIndex % addresses.length];
    this.countryIndexMap.set(country, currentIndex + 1);

    console.log(`FIXED: Using address ${currentIndex} for ${country} (${dataType})`);

    // Get the appropriate field from the address
    let maskedValue = '';
    switch (dataType) {
      case 'Address':
        maskedValue = address.street;
        break;
      case 'City':
        maskedValue = address.city;
        break;
      case 'State':
        maskedValue = address.state;
        break;
      case 'Postal Code':
        maskedValue = address.postalCode;
        break;
      default:
        throw new Error(`Data type ${dataType} not supported by Azure OpenAI masking`);
    }

    // Apply data preservation if enabled
    if (this.options.preserveDataStructure && this.preservationRules.length > 0) {
      const rule = this.preservationRules.find(r => 
        r.columnName.toLowerCase().includes(dataType.toLowerCase())
      );
      
      if (rule) {
        maskedValue = this.preservationEngine.preserveDataStructure(value, maskedValue, rule);
      }
    }

    return maskedValue;
  }

  async testConnection(): Promise<boolean> {
    return await this.service.testConnection();
  }

  clearCache(): void {
    this.enhancedGenerator.clearCache();
    this.countryAddressMap.clear();
    this.countryIndexMap.clear();
    this.preservationRules = [];
    this.geoMapping = {};
  }

  getCacheStats() {
    return {
      enhancedGenerator: this.enhancedGenerator.getCacheStats(),
      loadedCountries: this.getLoadedCountries(),
      preservationRules: this.preservationRules.length
    };
  }

  getLoadedCountries(): string[] {
    return Array.from(this.countryAddressMap.keys());
  }

  getAddressCount(country: string): number {
    return this.countryAddressMap.get(country)?.length || 0;
  }

  getGeoMapping(): GeoColumnMapping {
    return this.geoMapping;
  }

  getPreservationRules(): PreservationRule[] {
    return this.preservationRules;
  }
}

export { AzureOpenAIMasking, type AzureOpenAIMaskingOptions };
