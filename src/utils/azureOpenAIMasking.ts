import { AzureOpenAIService, GeneratedAddress, type AzureOpenAIConfig, type BatchAddressGenerationRequest } from '@/services/azureOpenAI';
import { EnhancedAddressGenerator, type EnhancedMaskingOptions, type DatasetAnalysis } from './enhancedAddressGeneration';
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
  useCountryDropdown?: boolean;
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
  private datasetAnalysis: DatasetAnalysis | null = null;

  constructor(options: AzureOpenAIMaskingOptions) {
    console.log('=== FIXED: Initializing Enhanced AzureOpenAIMasking ===');
    
    this.options = {
      batchSize: 50,
      maxRetries: 3,
      preserveDataStructure: true,
      useIntelligentBatching: true,
      useCountryDropdown: false,
      ...options
    };
    
    console.log(`FIXED: Country dropdown enabled: ${this.options.useCountryDropdown}`);
    console.log(`FIXED: Selected countries: ${this.options.selectedCountries?.join(', ') || 'None'}`);
    
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
    console.log('=== FIXED: Dataset Initialization with Country Selection Logic ===');
    
    // Store dataset analysis for later use
    this.datasetAnalysis = {
      totalRows: data.length,
      isLargeDataset: data.length >= 100,
      requiresProportionalLogic: data.length >= 100 && !!countryColumnName,
      estimatedAddressesNeeded: data.length >= 100 
        ? Math.min(data.length, 100)
        : data.length,
      maxAddressesPerCountry: data.length >= 100 ? 100 : data.length
    };

    console.log('FIXED: Dataset Analysis:', this.datasetAnalysis);
    
    // FIXED: Handle Country Selection Toggle Logic
    if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
      console.log('=== FIXED: Country Selection Mode Enabled ===');
      console.log(`FIXED: Using selected countries: ${this.options.selectedCountries.join(', ')}`);
      console.log('FIXED: Will ignore original country column values');
    } else if (countryColumnName) {
      console.log('=== FIXED: Geo-Column Mode Enabled ===');
      console.log(`FIXED: Using country column: ${countryColumnName}`);
      console.log('FIXED: Will use original country values from dataset');
    } else {
      console.log('=== FIXED: Default Mode ===');
      console.log('FIXED: No country column or selection - will use default countries');
    }
    
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

    // Generate addresses using enhanced system with proper country logic
    await this.preGenerateAddresses(data, countryColumnName);

    console.log('FIXED: Initialization complete with country selection logic');
  }

  private async preGenerateAddresses(
    data: Record<string, string>[],
    countryColumnName?: string
  ): Promise<void> {
    try {
      console.log('=== FIXED: Pre-generating addresses with Country Selection Logic ===');
      
      // FIXED: Handle different country selection scenarios
      if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
        // SCENARIO 1: Country Selection Toggle is ON - use selected countries
        console.log('FIXED: SCENARIO 1 - Country Selection Mode');
        await this.generateForSelectedCountries(data);
        
      } else if (countryColumnName && !this.options.useCountryDropdown) {
        // SCENARIO 2: Geo-column exists and Country Selection Toggle is OFF
        console.log('FIXED: SCENARIO 2 - Geo-Column Mode');
        await this.generateForGeoColumn(data, countryColumnName);
        
      } else {
        // SCENARIO 3: Default mode - no geo-column or country selection
        console.log('FIXED: SCENARIO 3 - Default Mode');
        await this.generateForDefaultCountries(data);
      }
      
      console.log(`✅ FIXED: Pre-generated addresses for ${this.countryAddressMap.size} countries`);
      for (const [country, addresses] of this.countryAddressMap.entries()) {
        console.log(`- FIXED: ${country}: ${addresses.length} unique addresses ready`);
      }
      
    } catch (error) {
      console.error('❌ FIXED: Pre-generation failed:', error);
      this.countryAddressMap = new Map();
    }
  }

  private async generateForSelectedCountries(data: Record<string, string>[]): Promise<void> {
    console.log('FIXED: Generating for selected countries (ignoring geo-column)');
    
    const countries = this.options.selectedCountries!;
    const totalRows = data.length;
    
    // For large datasets, generate fewer unique addresses per country
    const addressesPerCountry = this.datasetAnalysis?.isLargeDataset
      ? Math.min(100, Math.ceil(totalRows / countries.length))
      : Math.ceil(totalRows / countries.length);
    
    console.log(`FIXED: Large dataset mode - generating ${addressesPerCountry} addresses per country`);
    
    const batchRequest: BatchAddressGenerationRequest = {
      countries: countries.map(country => ({
        country,
        count: addressesPerCountry
      }))
    };

    const batchResponse = await this.enhancedGenerator['generateWithValidationAndRetry']([
      ...countries.map(country => ({
        country,
        count: addressesPerCountry,
        rowIndices: Array.from({ length: addressesPerCountry }, (_, i) => i)
      }))
    ]);

    this.countryAddressMap = batchResponse;
    
    // Initialize index counters
    for (const country of countries) {
      this.countryIndexMap.set(country, 0);
    }
  }

  private async generateForGeoColumn(data: Record<string, string>[], countryColumnName: string): Promise<void> {
    console.log('FIXED: Generating using geo-column values');
    
    // Use enhanced generator with dataset analysis
    const optimizedAddresses = await this.enhancedGenerator.generateOptimizedAddresses(
      data,
      countryColumnName,
      undefined
    );
    
    this.countryAddressMap = optimizedAddresses;
    
    // Initialize index counters for ALL generated countries
    for (const country of optimizedAddresses.keys()) {
      this.countryIndexMap.set(country, 0);
      console.log(`FIXED: Initialized counter for ${country}: ${optimizedAddresses.get(country)?.length} addresses available`);
    }
  }

  private async generateForDefaultCountries(data: Record<string, string>[]): Promise<void> {
    console.log('FIXED: Generating for default countries');
    
    const countries = this.options.selectedCountries || ['United States'];
    const totalRows = data.length;
    
    // For large datasets, generate fewer unique addresses
    const addressesPerCountry = this.datasetAnalysis?.isLargeDataset
      ? Math.max(1, Math.ceil(totalRows / countries.length * 0.3))
      : Math.ceil(totalRows / countries.length);
    
    console.log(`FIXED: Default mode - generating ${addressesPerCountry} addresses per country`);
    
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
  }

  async maskData(value: string, dataType: DataType, targetCountry?: string, rowIndex?: number): Promise<string> {
    if (!value || value.trim() === '') return value;

    let country: string;
    
    if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
      const countryIndex = (rowIndex || 0) % this.options.selectedCountries.length;
      country = this.options.selectedCountries[countryIndex];
      console.log(`FIXED: Row ${rowIndex} - Using selected country: ${country}`);
    } else {
      country = targetCountry || this.options.country || 'United States';
      console.log(`FIXED: Row ${rowIndex} - Using geo-column country: ${country}`);
    }
    
    // Check if country exists in pre-generated addresses
    if (!this.countryAddressMap.has(country)) {
      console.error(`❌ FIXED: Country "${country}" not found in pre-generated addresses!`);
      console.log('Available countries:', Array.from(this.countryAddressMap.keys()));
      return value;
    }

    const addresses = this.countryAddressMap.get(country)!;
    if (addresses.length === 0) {
      console.error(`❌ FIXED: No addresses available for country "${country}"`);
      return value;
    }

    let address: GeneratedAddress;
    
    if (this.datasetAnalysis?.isLargeDataset && typeof rowIndex === 'number') {
      const reuseAddress = this.enhancedGenerator.getAddressForRow(country, rowIndex, true);
      address = reuseAddress || addresses[rowIndex % addresses.length];
      console.log(`FIXED: Large dataset - using address reuse with incremental generation for row ${rowIndex}`);
    } else {
      let currentIndex = this.countryIndexMap.get(country) || 0;
      address = addresses[currentIndex % addresses.length];
      this.countryIndexMap.set(country, currentIndex + 1);
      console.log(`FIXED: Small dataset - using sequential access (index: ${currentIndex})`);
    }

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
      preservationRules: this.preservationRules.length,
      validationStats: this.enhancedGenerator.getValidationStats()
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

  getDatasetAnalysis(): DatasetAnalysis | null {
    return this.datasetAnalysis;
  }

  getAddressReuseStats(): Record<string, { available: number; used: number; reuseFactor: number }> {
    return this.enhancedGenerator.getAddressReuseStats();
  }
}

export { AzureOpenAIMasking, type AzureOpenAIMaskingOptions };
