
import { AzureOpenAIService, GeneratedAddress, type AzureOpenAIConfig } from '@/services/azureOpenAI';
import { EnhancedAddressGenerator, type EnhancedMaskingOptions } from './enhancedAddressGeneration';
import { DataType } from '@/types';

interface AzureOpenAIMaskingOptions {
  config: AzureOpenAIConfig;
  country?: string;
  batchSize?: number;
  maxRetries?: number;
  selectedCountries?: string[];
}

class AzureOpenAIMasking {
  private service: AzureOpenAIService;
  private enhancedGenerator: EnhancedAddressGenerator;
  private countryAddressMap: Map<string, GeneratedAddress[]> = new Map();
  private countryIndexMap: Map<string, number> = new Map();
  private options: AzureOpenAIMaskingOptions;

  constructor(options: AzureOpenAIMaskingOptions) {
    console.log('=== Initializing AzureOpenAIMasking ===');
    console.log('Options:', JSON.stringify(options, null, 2));
    
    this.options = {
      batchSize: 50,
      maxRetries: 3,
      ...options
    };
    
    // Ensure the endpoint is properly formatted
    let endpoint = options.config.endpoint;
    
    // If endpoint doesn't contain the full chat completions path, construct it
    if (!endpoint.includes('/chat/completions')) {
      // Extract base URL if it contains deployment info
      const baseUrl = endpoint.split('/openai/deployments/')[0];
      const deploymentName = options.config.deploymentName;
      const apiVersion = options.config.apiVersion;
      
      endpoint = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
    }
    
    console.log('Final endpoint:', endpoint);
    
    const serviceConfig = {
      ...options.config,
      endpoint
    };
    
    this.service = new AzureOpenAIService(serviceConfig);
    
    this.enhancedGenerator = new EnhancedAddressGenerator({
      azureService: this.service,
      batchSize: this.options.batchSize!,
      cacheExpiration: 30 * 60 * 1000, // 30 minutes
      maxRetries: this.options.maxRetries!,
      qualityThreshold: 0.8
    });
  }

  async initializeForDataset(
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

    switch (dataType) {
      case 'Address':
        return address.street;
      case 'City':
        return address.city;
      case 'State':
        return address.state;
      case 'Postal Code':
        return address.postalCode;
      default:
        throw new Error(`Data type ${dataType} not supported by Azure OpenAI masking`);
    }
  }

  async testConnection(): Promise<boolean> {
    return await this.service.testConnection();
  }

  clearCache(): void {
    this.enhancedGenerator.clearCache();
    this.countryAddressMap.clear();
    this.countryIndexMap.clear();
  }

  getCacheStats() {
    return this.enhancedGenerator.getCacheStats();
  }

  getLoadedCountries(): string[] {
    return Array.from(this.countryAddressMap.keys());
  }

  getAddressCount(country: string): number {
    return this.countryAddressMap.get(country)?.length || 0;
  }
}

export { AzureOpenAIMasking, type AzureOpenAIMaskingOptions };
