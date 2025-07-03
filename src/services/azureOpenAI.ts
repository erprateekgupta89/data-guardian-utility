
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
}

interface GeneratedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

class AzureOpenAIService {
  private config: AzureOpenAIConfig;

  constructor(config: AzureOpenAIConfig) {
    this.config = config;
  }

  async generateAddresses(request: AddressGenerationRequest): Promise<GeneratedAddress[]> {
    const prompt = this.createAddressPrompt(request);
    
    try {
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
              content: 'You are an expert in generating realistic addresses for data masking purposes. Always return valid JSON arrays with complete address information.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
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

      return this.parseAddressResponse(content);
    } catch (error) {
      console.error('Azure OpenAI API error:', error);
      throw error;
    }
  }

  private createAddressPrompt(request: AddressGenerationRequest): string {
    return `Generate ${request.count} realistic ${request.addressType || 'mixed'} addresses for ${request.country}. 
    
Requirements:
- Return as a JSON array of objects
- Each object must have: street, city, state, postalCode, country
- Use realistic street names, city names, and postal codes for ${request.country}
- Ensure addresses follow the formatting conventions of ${request.country}
- Make addresses diverse across different regions within the country
- Do not include any explanatory text, only the JSON array

Example format:
[
  {
    "street": "123 Main Street",
    "city": "Springfield",
    "state": "Illinois",
    "postalCode": "62701",
    "country": "${request.country}"
  }
]`;
  }

  private parseAddressResponse(content: string): GeneratedAddress[] {
    try {
      // Clean the response to extract JSON
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const addresses = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(addresses)) {
        throw new Error('Response is not an array');
      }

      // Validate each address has required fields
      return addresses.filter(addr => 
        addr.street && addr.city && addr.state && addr.postalCode && addr.country
      );
    } catch (error) {
      console.error('Error parsing address response:', error);
      throw new Error('Failed to parse address response from Azure OpenAI');
    }
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
