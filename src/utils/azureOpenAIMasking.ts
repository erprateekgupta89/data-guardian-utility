import { AzureOpenAIService, GeneratedAddress, type AzureOpenAIConfig, type BatchAddressGenerationRequest } from '@/services/azureOpenAI';
import { EnhancedAddressGenerator, type EnhancedMaskingOptions, type DatasetAnalysis } from './enhancedAddressGeneration';
import { GeoColumnDetector, type GeoColumnMapping } from './geoColumnDetection';
import { DataPreservationEngine, type PreservationRule } from './dataPreservation';
import { NationalityDerivationEngine, type NationalityDerivationResult } from './nationalityDerivation';
import { AddressValidator } from './addressValidator';
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
  enableNationalityDerivation?: boolean;
}

// FIXED: Enhanced row context for perfect country-address alignment
interface RowContext {
  index: number;
  country: string;
  nationality: string; // FIXED: Add nationality tracking
  addressComponents: Map<string, string>;
}

class AzureOpenAIMasking {
  private service: AzureOpenAIService;
  private enhancedGenerator: EnhancedAddressGenerator;
  private geoDetector: GeoColumnDetector;
  private preservationEngine: DataPreservationEngine;
  private nationalityEngine: NationalityDerivationEngine;
  private addressValidator: AddressValidator;
  private countryAddressMap: Map<string, GeneratedAddress[]> = new Map();
  private countryIndexMap: Map<string, number> = new Map();
  private rowContextMap: Map<number, RowContext> = new Map(); // FIXED: Track row contexts with nationality
  private nationalityCache: Map<string, NationalityDerivationResult> = new Map();
  private preservationRules: PreservationRule[] = [];
  private geoMapping: GeoColumnMapping = {};
  private options: AzureOpenAIMaskingOptions;
  private datasetAnalysis: DatasetAnalysis | null = null;

  constructor(options: AzureOpenAIMaskingOptions) {
    console.log('=== FIXED: Initializing AzureOpenAIMasking with Perfect Country-Address-Nationality Alignment ===');
    
    this.options = {
      batchSize: 50,
      maxRetries: 3,
      preserveDataStructure: true,
      useIntelligentBatching: true,
      useCountryDropdown: false,
      enableNationalityDerivation: true,
      ...options
    };
    
    console.log(`FIXED: Country dropdown enabled: ${this.options.useCountryDropdown}`);
    console.log(`FIXED: Selected countries: ${this.options.selectedCountries?.join(', ') || 'None'}`);
    console.log(`FIXED: Nationality derivation enabled: ${this.options.enableNationalityDerivation}`);
    
    this.service = new AzureOpenAIService(options.config);
    this.addressValidator = new AddressValidator();
    
    this.enhancedGenerator = new EnhancedAddressGenerator({
      azureService: this.service,
      batchSize: this.options.batchSize!,
      cacheExpiration: 30 * 60 * 1000,
      maxRetries: this.options.maxRetries!,
      qualityThreshold: 0.8
    });

    this.geoDetector = new GeoColumnDetector();
    this.preservationEngine = new DataPreservationEngine();
    this.nationalityEngine = new NationalityDerivationEngine();
  }

  async initializeForDataset(
    data: Record<string, string>[],
    columns: any[],
    countryColumnName?: string
  ): Promise<void> {
    console.log('=== FIXED: Dataset Initialization with Perfect Country-Address-Nationality Alignment ===');
    
    // Initialize original data comparison
    this.addressValidator.initializeOriginalData(data);
    
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
    
    // FIXED: Pre-calculate row contexts for perfect country-address-nationality alignment
    await this.preCalculateRowContexts(data, countryColumnName);
    
    // Handle Country Selection Toggle Logic
    if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
      console.log('=== FIXED: Country Selection Mode Enabled ===');
      console.log(`FIXED: Using selected countries: ${this.options.selectedCountries.join(', ')}`);
      console.log('FIXED: Will ignore original country column values');
    } else if (countryColumnName) {
      console.log('=== FIXED: Geo-Column Mode Enabled ===');
      console.log(`FIXED: Using country column: ${countryColumnName}`);
      console.log('FIXED: Will use original country values from dataset');
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

    // Pre-calculate nationality mappings if enabled
    if (this.options.enableNationalityDerivation && countryColumnName) {
      await this.preCalculateNationalities(data, countryColumnName);
    }

    // Generate addresses using enhanced system with proper country logic
    await this.preGenerateAddresses(data, countryColumnName);

    console.log('FIXED: Initialization complete with perfect country-address-nationality alignment');
  }

  // FIXED: Pre-calculate row contexts for perfect country-address-nationality alignment
  private async preCalculateRowContexts(
    data: Record<string, string>[],
    countryColumnName?: string
  ): Promise<void> {
    console.log('=== FIXED: Pre-calculating row contexts for perfect country-address-nationality alignment ===');
    
    this.rowContextMap.clear();
    
    data.forEach((row, index) => {
      let targetCountry: string;
      
      // FIXED: Correct country assignment logic with dropdown priority
      if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
        // CRITICAL FIX: Use selected countries in rotation (dropdown takes priority)
        const countryIndex = index % this.options.selectedCountries.length;
        targetCountry = this.options.selectedCountries[countryIndex];
        console.log(`🎯 FIXED: Row ${index} - Dropdown priority: ${targetCountry}`);
      } else if (countryColumnName && row[countryColumnName]) {
        // Use original country column value
        targetCountry = row[countryColumnName].trim();
        console.log(`🌍 FIXED: Row ${index} - Geo-column: ${targetCountry}`);
      } else {
        // Default fallback
        targetCountry = this.options.country || 'United States';
        console.log(`⚠️ FIXED: Row ${index} - Default fallback: ${targetCountry}`);
      }
      
      // FIXED: Derive nationality synchronously for this country
      const nationalityResult = this.nationalityEngine.deriveNationality(targetCountry);
      
      const context: RowContext = {
        index,
        country: targetCountry,
        nationality: nationalityResult.nationality, // FIXED: Store derived nationality
        addressComponents: new Map()
      };
      
      this.rowContextMap.set(index, context);
      
      if (index < 10) { // Log first 10 for verification
        console.log(`🎯 FIXED: Row ${index} → Country: ${targetCountry} → Nationality: ${nationalityResult.nationality}`);
      }
    });
    
    console.log(`✅ FIXED: Pre-calculated contexts for ${this.rowContextMap.size} rows with synchronized nationality`);
  }

  private async preCalculateNationalities(
    data: Record<string, string>[],
    countryColumnName: string
  ): Promise<void> {
    console.log('=== NATIONALITY: Pre-calculating nationality mappings ===');
    
    // Extract unique country values from the dataset
    const countryValues = [...new Set(
      data.map(row => row[countryColumnName])
        .filter(Boolean)
        .map(country => country.trim())
    )];

    console.log(`NATIONALITY: Found ${countryValues.length} unique countries in dataset`);

    // Derive nationalities for all unique countries
    const nationalityResults = this.nationalityEngine.deriveNationalityBatch(countryValues);
    
    // Cache the results
    for (const [country, result] of nationalityResults.entries()) {
      this.nationalityCache.set(country, result);
      console.log(`NATIONALITY: Cached ${country} → ${result.nationality} (confidence: ${result.confidence})`);
    }

    console.log(`✅ NATIONALITY: Pre-calculated nationalities for ${this.nationalityCache.size} countries`);
  }

  private async preGenerateAddresses(
    data: Record<string, string>[],
    countryColumnName?: string
  ): Promise<void> {
    try {
      console.log('=== FIXED: Pre-generating addresses with Perfect Alignment ===');
      
      // FIXED: Handle different country selection scenarios with dropdown priority
      if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
        console.log('FIXED: SCENARIO 1 - Country Selection Mode (Dropdown Priority)');
        await this.generateForSelectedCountries(data);
        
      } else if (countryColumnName && !this.options.useCountryDropdown) {
        console.log('FIXED: SCENARIO 2 - Geo-Column Mode');
        await this.generateForGeoColumn(data, countryColumnName);
        
      } else {
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
    console.log('FIXED: Generating for selected countries (dropdown priority - ignoring geo-column)');
    
    const countries = this.options.selectedCountries!;
    const totalRows = data.length;
    
    // For large datasets, generate fewer unique addresses per country
    const addressesPerCountry = this.datasetAnalysis?.isLargeDataset
      ? Math.min(100, Math.ceil(totalRows / countries.length))
      : Math.ceil(totalRows / countries.length);
    
    console.log(`FIXED: Large dataset mode - generating ${addressesPerCountry} addresses per country`);
    
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
    console.log('PLAN: Generating using geo-column values');
    
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
      console.log(`PLAN: Initialized counter for ${country}: ${optimizedAddresses.get(country)?.length} addresses available`);
    }
  }

  private async generateForDefaultCountries(data: Record<string, string>[]): Promise<void> {
    console.log('PLAN: Generating for default countries');
    
    const countries = this.options.selectedCountries || ['United States'];
    const totalRows = data.length;
    
    // For large datasets, generate fewer unique addresses
    const addressesPerCountry = this.datasetAnalysis?.isLargeDataset
      ? Math.max(1, Math.ceil(totalRows / countries.length * 0.3))
      : Math.ceil(totalRows / countries.length);
    
    console.log(`PLAN: Default mode - generating ${addressesPerCountry} addresses per country`);
    
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

  // FIXED: Perfect country-address-nationality alignment using row context
  async maskData(value: string, dataType: DataType, targetCountry?: string, rowIndex?: number): Promise<string> {
    if (!value || value.trim() === '') return value;

    // FIXED: Enhanced nationality derivation using row context
    if (dataType === 'Nationality' || (dataType === 'String' && value.toLowerCase().includes('nationality'))) {
      if (typeof rowIndex === 'number') {
        const context = this.rowContextMap.get(rowIndex);
        if (context) {
          console.log(`🎯 FIXED: Row ${rowIndex} - Using pre-calculated nationality: ${context.nationality}`);
          return context.nationality;
        }
      }
      // Fallback to standard nationality derivation
      return this.deriveNationality(targetCountry || 'Unknown');
    }

    // FIXED: Use row context for perfect alignment with enhanced debugging
    let country: string;
    let addressContext: RowContext | undefined;
    
    if (typeof rowIndex === 'number') {
      addressContext = this.rowContextMap.get(rowIndex);
      if (addressContext) {
        country = addressContext.country;
        console.log(`🎯 FIXED: Row ${rowIndex} - Using pre-calculated country: ${country} (nationality: ${addressContext.nationality})`);
      } else {
        // FIXED: Improved fallback logic with debugging
        if (this.options.useCountryDropdown && this.options.selectedCountries?.length) {
          const countryIndex = rowIndex % this.options.selectedCountries.length;
          country = this.options.selectedCountries[countryIndex];
          console.log(`⚠️ FIXED: Row ${rowIndex} - Using dropdown fallback country: ${country}`);
        } else {
          country = targetCountry || this.options.country || 'United States';
          console.log(`⚠️ FIXED: Row ${rowIndex} - Using target fallback country: ${country}`);
        }
      }
    } else {
      country = targetCountry || this.options.country || 'United States';
      console.log(`FIXED: No row index - using target country: ${country}`);
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
    
    // FIXED: Enhanced address selection with consistent row context caching
    if (addressContext && addressContext.addressComponents.has('_selectedAddress')) {
      // Use cached address for this row to ensure all components align
      const cachedAddressIndex = parseInt(addressContext.addressComponents.get('_selectedAddress')!);
      address = addresses[cachedAddressIndex % addresses.length];
      console.log(`🎯 FIXED: Row ${rowIndex} - Using cached address index ${cachedAddressIndex} for ${country}`);
    } else {
      // Select new address and cache it
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
      
      // Cache the selected address index for this row
      if (addressContext) {
        const selectedIndex = typeof rowIndex === 'number' ? rowIndex % addresses.length : 0;
        addressContext.addressComponents.set('_selectedAddress', selectedIndex.toString());
        console.log(`🎯 FIXED: Cached address index ${selectedIndex} for row ${rowIndex}`);
      }
    }

    let maskedValue = '';
    switch (dataType) {
      case 'Address':
        maskedValue = address.street;
        if (addressContext) addressContext.addressComponents.set('Address', maskedValue);
        break;
      case 'City':
        maskedValue = address.city;
        if (addressContext) addressContext.addressComponents.set('City', maskedValue);
        break;
      case 'State':
        maskedValue = address.state;
        if (addressContext) addressContext.addressComponents.set('State', maskedValue);
        break;
      case 'Postal Code':
        maskedValue = address.postalCode;
        if (addressContext) addressContext.addressComponents.set('Postal Code', maskedValue);
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

    console.log(`✅ FIXED: Row ${rowIndex} - ${dataType} masked as "${maskedValue}" (${country})`);
    return maskedValue;
  }

  deriveNationality(countryValue: string): string {
    if (!this.options.enableNationalityDerivation) {
      return countryValue;
    }

    // Check cache first
    const cached = this.nationalityCache.get(countryValue);
    if (cached) {
      console.log(`🎯 FIXED: Using cached nationality - ${countryValue} → ${cached.nationality}`);
      return cached.nationality;
    }

    // Derive nationality on-the-fly
    const derivationResult = this.nationalityEngine.deriveNationality(countryValue);
    
    // Cache the result
    this.nationalityCache.set(countryValue, derivationResult);
    
    console.log(`🌍 FIXED: Derived nationality - ${countryValue} → ${derivationResult.nationality} (confidence: ${derivationResult.confidence})`);
    
    return derivationResult.nationality;
  }

  async testConnection(): Promise<boolean> {
    return await this.service.testConnection();
  }

  clearCache(): void {
    this.enhancedGenerator.clearCache();
    this.countryAddressMap.clear();
    this.countryIndexMap.clear();
    this.rowContextMap.clear();
    this.nationalityCache.clear();
    this.preservationRules = [];
    this.geoMapping = {};
    this.addressValidator.resetValidationStats();
  }

  getCacheStats() {
    return {
      enhancedGenerator: this.enhancedGenerator.getCacheStats(),
      loadedCountries: this.getLoadedCountries(),
      preservationRules: this.preservationRules.length,
      validationStats: this.enhancedGenerator.getValidationStats(),
      smartRetryStats: this.enhancedGenerator.getSmartRetryStats(),
      nationalityCache: this.nationalityCache.size,
      rowContexts: this.rowContextMap.size,
      addressValidator: this.addressValidator.getEnhancedStats()
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

  getNationalityStats(): {
    cacheSize: number;
    derivationEngineStats: any;
    cachedNationalities: Array<{ country: string; nationality: string; confidence: string }>;
  } {
    const cachedNationalities = Array.from(this.nationalityCache.entries()).map(([country, result]) => ({
      country,
      nationality: result.nationality,
      confidence: result.confidence
    }));

    return {
      cacheSize: this.nationalityCache.size,
      derivationEngineStats: this.nationalityEngine.getDerivationStats(),
      cachedNationalities
    };
  }

  // PLAN: Enhanced alignment statistics with nationality tracking
  getAlignmentStats() {
    const countryDistribution: Record<string, number> = {};
    const nationalityDistribution: Record<string, number> = {};
    const addressComponentAlignment: Record<string, number> = {};
    
    for (const [rowIndex, context] of this.rowContextMap.entries()) {
      countryDistribution[context.country] = (countryDistribution[context.country] || 0) + 1;
      nationalityDistribution[context.nationality] = (nationalityDistribution[context.nationality] || 0) + 1;
      
      for (const [component, value] of context.addressComponents.entries()) {
        if (component !== '_selectedAddress') {
          addressComponentAlignment[component] = (addressComponentAlignment[component] || 0) + 1;
        }
      }
    }
    
    return {
      totalRows: this.rowContextMap.size,
      countryDistribution,
      nationalityDistribution,
      addressComponentAlignment,
      alignmentRate: this.rowContextMap.size > 0 ? 
        Object.values(addressComponentAlignment).reduce((a, b) => a + b, 0) / (this.rowContextMap.size * 4) : 0,
      countryNationalityPairs: Array.from(this.rowContextMap.values()).slice(0, 10).map(ctx => ({
        country: ctx.country,
        nationality: ctx.nationality
      }))
    };
  }
}

export { AzureOpenAIMasking, type AzureOpenAIMaskingOptions };
