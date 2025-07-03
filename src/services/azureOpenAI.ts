
interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deploymentName: string;
}

interface AddressGenerationRequest {
  country: string;
  count: number;
  addressType?: 'residential' | 'commercial' | 'mixed';
  regions?: string[];
  specificRequirements?: string;
}

interface GeneratedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  region?: string;
}

interface AddressGenerationResponse {
  addresses: GeneratedAddress[];
  metadata: {
    country: string;
    generatedCount: number;
    requestedCount: number;
    quality: 'high' | 'medium' | 'low';
  };
}

class AzureOpenAIService {
  private config: AzureOpenAIConfig;
  private retryCount: number = 3;

  constructor(config: AzureOpenAIConfig) {
    this.config = config;
  }

  async generateAddresses(request: AddressGenerationRequest): Promise<GeneratedAddress[]> {
    const prompt = this.createEnhancedAddressPrompt(request);
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.makeAPICall(prompt, attempt);
        const addresses = this.parseAndValidateAddresses(response, request.country);
        
        if (addresses.length >= Math.min(request.count, 1)) {
          return addresses.slice(0, request.count);
        }
        
        if (attempt === this.retryCount) {
          console.warn(`Failed to generate sufficient addresses after ${this.retryCount} attempts`);
          return addresses;
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt === this.retryCount) {
          throw error;
        }
        await this.delay(1000 * attempt); // Progressive delay
      }
    }
    
    return [];
  }

  private async makeAPICall(prompt: string, attempt: number): Promise<string> {
    const temperature = Math.max(0.3, 0.7 - (attempt - 1) * 0.2); // Reduce randomness on retries
    
    const response = await fetch(`${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from Azure OpenAI');
    }

    return content;
  }

  private getSystemPrompt(): string {
    return `You are an expert geographic data specialist responsible for generating realistic addresses for data masking purposes. 

Key Requirements:
1. Generate addresses that are geographically accurate and realistic for the specified country
2. Use authentic street names, city names, and postal codes that follow local conventions
3. Ensure addresses represent diverse regions within the country
4. Maintain consistency in formatting according to local postal standards
5. Return only valid JSON arrays without any explanatory text
6. Each address must include all required fields: street, city, state, postalCode, country

Quality Standards:
- Street names should reflect local naming conventions
- Cities should be real or realistic for the region
- States/provinces should be accurate administrative divisions
- Postal codes must follow the correct format for the country
- Addresses should be distributed across different regions when possible`;
  }

  private createEnhancedAddressPrompt(request: AddressGenerationRequest): string {
    const basePrompt = `Generate ${request.count} realistic ${request.addressType || 'mixed'} addresses for ${request.country}.`;
    
    let additionalRequirements = '';
    if (request.regions?.length) {
      additionalRequirements += `\nFocus on these regions: ${request.regions.join(', ')}.`;
    }
    if (request.specificRequirements) {
      additionalRequirements += `\nSpecial requirements: ${request.specificRequirements}`;
    }

    return `${basePrompt}${additionalRequirements}

Requirements:
- Return as a JSON array of address objects
- Each object must have: street, city, state, postalCode, country
- Use realistic and geographically accurate data for ${request.country}
- Follow local address formatting conventions
- Distribute addresses across different regions within the country
- Ensure postal codes are valid for their respective cities/regions

Example format for ${request.country}:
[
  {
    "street": "123 Main Street",
    "city": "Springfield", 
    "state": "Illinois",
    "postalCode": "62701",
    "country": "${request.country}"
  }
]

Generate exactly ${request.count} addresses in this format:`;
  }

  private parseAndValidateAddresses(content: string, expectedCountry: string): GeneratedAddress[] {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const addresses = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(addresses)) {
        throw new Error('Response is not an array');
      }

      // Validate and clean addresses
      return addresses
        .filter(addr => this.isValidAddress(addr))
        .map(addr => this.normalizeAddress(addr, expectedCountry));
    } catch (error) {
      console.error('Error parsing address response:', error);
      throw new Error('Failed to parse address response from Azure OpenAI');
    }
  }

  private isValidAddress(addr: any): boolean {
    return addr && 
           typeof addr.street === 'string' && addr.street.trim() &&
           typeof addr.city === 'string' && addr.city.trim() &&
           typeof addr.state === 'string' && addr.state.trim() &&
           typeof addr.postalCode === 'string' && addr.postalCode.trim() &&
           typeof addr.country === 'string' && addr.country.trim();
  }

  private normalizeAddress(addr: any, expectedCountry: string): GeneratedAddress {
    return {
      street: addr.street.trim(),
      city: addr.city.trim(),
      state: addr.state.trim(),
      postalCode: addr.postalCode.trim(),
      country: expectedCountry, // Ensure consistency
      region: addr.region?.trim()
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testConnection(): Promise<boolean> {
    try {
      const testResponse = await this.generateAddresses({
        country: 'United States',
        count: 1
      });
      return testResponse.length > 0;
    } catch (error) {
      console.error('Azure OpenAI connection test failed:', error);
      return false;
    }
  }
}

export { AzureOpenAIService, type AzureOpenAIConfig, type GeneratedAddress, type AddressGenerationRequest };
