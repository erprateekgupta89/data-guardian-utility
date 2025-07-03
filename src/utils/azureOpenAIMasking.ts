
import { AzureOpenAIService, GeneratedAddress, type AzureOpenAIConfig } from '@/services/azureOpenAI';
import { DataType } from '@/types';

interface AzureOpenAIMaskingOptions {
  config: AzureOpenAIConfig;
  country?: string;
  batchSize?: number;
  maxRetries?: number;
}

class AzureOpenAIMasking {
  private service: AzureOpenAIService;
  private addressCache: Map<string, GeneratedAddress[]> = new Map();
  private options: AzureOpenAIMaskingOptions;

  constructor(options: AzureOpenAIMaskingOptions) {
    this.options = {
      batchSize: 50,
      maxRetries: 3,
      ...options
    };
    this.service = new AzureOpenAIService(options.config);
  }

  async maskData(value: string, dataType: DataType, country?: string): Promise<string> {
    if (!value || value.trim() === '') return value;

    const targetCountry = country || this.options.country || 'United States';

    switch (dataType) {
      case 'Address':
        return await this.maskAddress(value, targetCountry);
      case 'City':
        return await this.maskCity(value, targetCountry);
      case 'State':
        return await this.maskState(value, targetCountry);
      case 'Postal Code':
        return await this.maskPostalCode(value, targetCountry);
      default:
        throw new Error(`Data type ${dataType} not supported by Azure OpenAI masking`);
    }
  }

  private async maskAddress(value: string, country: string): Promise<string> {
    const addresses = await this.getAddressesForCountry(country, 1);
    if (addresses.length > 0) {
      return addresses[0].street;
    }
    return value; // Fallback to original value
  }

  private async maskCity(value: string, country: string): Promise<string> {
    const addresses = await this.getAddressesForCountry(country, 1);
    if (addresses.length > 0) {
      return addresses[0].city;
    }
    return value;
  }

  private async maskState(value: string, country: string): Promise<string> {
    const addresses = await this.getAddressesForCountry(country, 1);
    if (addresses.length > 0) {
      return addresses[0].state;
    }
    return value;
  }

  private async maskPostalCode(value: string, country: string): Promise<string> {
    const addresses = await this.getAddressesForCountry(country, 1);
    if (addresses.length > 0) {
      return addresses[0].postalCode;
    }
    return value;
  }

  private async getAddressesForCountry(country: string, count: number): Promise<GeneratedAddress[]> {
    const cacheKey = `${country}-${count}`;
    
    if (this.addressCache.has(cacheKey)) {
      const cached = this.addressCache.get(cacheKey)!;
      if (cached.length >= count) {
        return cached.slice(0, count);
      }
    }

    try {
      const addresses = await this.service.generateAddresses({
        country,
        count: Math.max(count, this.options.batchSize!),
        addressType: 'mixed'
      });

      this.addressCache.set(cacheKey, addresses);
      return addresses.slice(0, count);
    } catch (error) {
      console.error(`Failed to generate addresses for ${country}:`, error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    return await this.service.testConnection();
  }

  clearCache(): void {
    this.addressCache.clear();
  }
}

export { AzureOpenAIMasking, type AzureOpenAIMaskingOptions };
