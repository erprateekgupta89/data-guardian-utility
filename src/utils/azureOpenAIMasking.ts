import { AzureOpenAIService, GeneratedAddress, type AzureOpenAIConfig } from '@/services/azureOpenAI';
import { EnhancedAddressGenerator, type EnhancedMaskingOptions } from './enhancedAddressGeneration';
import { GeoColumnDetector, type GeoColumnMapping } from './geoColumnDetection';
import { DataPreservationEngine, type PreservationRule } from './dataPreservation';
import { ReferenceBatchCreator, type BatchCreationStrategy } from './referenceBatchCreator';
import { IntelligentBatchStrategy, type BatchingDecision } from './intelligentBatchStrategy';
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
  private batchCreator: ReferenceBatchCreator;
  private batchStrategy: IntelligentBatchStrategy;
  private countryAddressMap: Map<string, GeneratedAddress[]> = new Map();
  private countryIndexMap: Map<string, number> = new Map();
  private preservationRules: PreservationRule[] = [];
  private geoMapping: GeoColumnMapping = {};
  private options: AzureOpenAIMaskingOptions;

  constructor(options: AzureOpenAIMaskingOptions) {
    console.log('=== Initializing Enhanced AzureOpenAIMasking ===');
    console.log('Options:', JSON.stringify(options, null, 2));
    
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
      cacheExpiration: 30 * 60 * 1000, // 30 minutes
      maxRetries: this.options.maxRetries!,
      qualityThreshold: 0.8
    });

    this.geoDetector = new GeoColumnDetector();
    this.preservationEngine = new DataPreservationEngine();
    this.batchCreator = new ReferenceBatchCreator();
    this.batchStrategy = new IntelligentBatchStrategy();
  }

  async initializeForDataset(
    data: Record<string, string>[],
    columns: any[],
    countryColumnName?: string
  ): Promise<void> {
    console.log('=== Enhanced Dataset Initialization ===');
    
    // Detect geo columns
    this.geoMapping = this.geoDetector.detectGeoColumns(columns);
    console.log('Detected geo mapping:', this.geoMapping);

    // Create preservation rules if enabled
    if (this.options.preserveDataStructure) {
      const geoColumnNames = Object.values(this.geoMapping).filter(Boolean) as string[];
      this.preservationRules = this.preservationEngine.createPreservationPlan(data, geoColumnNames);
      console.log('Created preservation rules:', this.preservationRules.length);
    }

    // Use intelligent batching strategy
    if (this.options.useIntelligentBatching) {
      const batchingDecision = this.batchStrategy.analyzeBatchingNeeds(
        data,
        this.geoMapping,
        this.options.selectedCountries
      );
      console.log('Batching decision:', batchingDecision);

      // Create optimized strategies
      const strategies = this.batchStrategy.createOptimizedStrategies(
        batchingDecision,
        data,
        this.geoMapping
      );

      // Pre-generate batches for high-priority countries
      for (const strategy of strategies.filter(s => s.priority === 'high')) {
        await this.preGenerateBatch(strategy);
      }
    } else {
      // Fallback to original initialization
      await this.initializeOriginalMethod(data, countryColumnName);
    }

    console.log('Enhanced initialization complete');
  }

  private async preGenerateBatch(strategy: BatchCreationStrategy): Promise<void> {
    try {
      console.log(`Pre-generating batch for ${strategy.country}...`);
      
      const addresses = await this.enhancedGenerator.getAddressesForCountry(
        strategy.country,
        strategy.requiredCount
      );

      const batch = this.batchCreator.createReferenceBatch(strategy, addresses);
      console.log(`Created batch for ${strategy.country}: ${batch.addresses.length} addresses, quality: ${batch.quality}`);

      // Store in country address map for compatibility
      this.countryAddressMap.set(strategy.country, batch.addresses);
      this.countryIndexMap.set(strategy.country, 0);
      
    } catch (error) {
      console.error(`Failed to pre-generate batch for ${strategy.country}:`, error);
    }
  }

  private async initializeOriginalMethod(
    data: Record<string, string>[],
    countryColumnName?: string
  ): Promise<void> {
    if (!countryColumnName) {
      // If no country column, use selected countries or default
      const countries = this.options.selectedCountries || ['United States'];
      const addressesPerCountry = Math.ceil(data.length / countries.length);
      
      for (const country of countries) {
        const addresses = await this.enhancedGenerator.getAddressesForCountry(
          country, 
          addressesPerCountry
        );
        this.countryAddressMap.set(country, addresses);
        this.countryIndexMap.set(country, 0);
      }
    } else {
      // Generate proportional addresses based on original country distribution
      const proportionalAddresses = await this.enhancedGenerator.generateProportionalAddresses(
        data,
        countryColumnName,
        this.options.selectedCountries
      );
      
      this.countryAddressMap = proportionalAddresses;
      
      // Initialize index counters
      for (const country of proportionalAddresses.keys()) {
        this.countryIndexMap.set(country, 0);
      }
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
      // Fallback to original value if no addresses available
      return value;
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
    this.batchCreator.clearBatches();
    this.countryAddressMap.clear();
    this.countryIndexMap.clear();
    this.preservationRules = [];
    this.geoMapping = {};
  }

  getCacheStats() {
    return {
      enhancedGenerator: this.enhancedGenerator.getCacheStats(),
      batchCreator: this.batchCreator.getBatchStats(),
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
