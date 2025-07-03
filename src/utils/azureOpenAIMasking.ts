
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
    console.log('=== Simplified Dataset Initialization ===');
    
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

    // Use enhanced address generation with SINGLE batch call
    await this.preGenerateAddresses(data, countryColumnName);

    console.log('Simplified initialization complete');
  }

  private async preGenerateAddresses(
    data: Record<string, string>[],
    countryColumnName?: string
  ): Promise<void> {
    try {
      console.log('=== Pre-generating addresses with SINGLE batch call ===');
      
      if (!countryColumnName) {
        // If no country column, use selected countries
        const countries = this.options.selectedCountries || ['United States'];
        const addressesPerCountry = Math.ceil(data.length / countries.length);
        
        const batchRequest: BatchAddressGenerationRequest = {
          countries: countries.map(country => ({
            country,
            count: addressesPerCountry
          }))
        };

        const batchResponse = await this.service.generateBatchAddresses(batchRequest);
        this.countryAddressMap = batchResponse.addressesByCountry;
        
        // Initialize index counters
        for (const country of countries) {
          this.countryIndexMap.set(country, 0);
        }
      } else {
        // Use enhanced generator for optimized addresses
        const optimizedAddresses = await this.enhancedGenerator.generateOptimizedAddresses(
          data,
          countryColumnName,
          this.options.selectedCountries
        );
        
        this.countryAddressMap = optimizedAddresses;
        
        // Initialize index counters
        for (const country of optimizedAddresses.keys()) {
          this.countryIndexMap.set(country, 0);
        }
      }
      
      console.log(`✅ Pre-generated addresses for ${this.countryAddressMap.size} countries`);
      for (const [country, addresses] of this.countryAddressMap.entries()) {
        console.log(`- ${country}: ${addresses.length} addresses`);
      }
      
    } catch (error) {
      console.error('❌ Pre-generation failed:', error);
    }
  }

  async maskData(value: string, dataType: DataType, targetCountry?: string): Promise<string> {
    if (!value || value.trim() === '') return value;

    const country = targetCountry || this.options.country || 'United States';
    
    // Ensure we have addresses for this country
    if (!this.countryAddressMap.has(country)) {
      const addresses = await this.enhancedGenerator.getAddressesForCountry(country, 10);
      this.countryAddressMap.set(country, addresses);
      this.countryIndexMap.set(country, 0);
    }

    const addresses = this.countryAddressMap.get(country)!;
    if (addresses.length === 0) {
      return value; // Fallback to original value
    }

    // Get current index and increment (with wrapping)
    let currentIndex = this.countryIndexMap.get(country) || 0;
    const address = addresses[currentIndex % addresses.length];
    this.countryIndexMap.set(country, currentIndex + 1);

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
