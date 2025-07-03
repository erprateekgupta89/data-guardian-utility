
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
    console.log('=== Azure OpenAI Address Generation Started ===');
    console.log('Request:', JSON.stringify(request, null, 2));
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${this.retryCount}`);
        
        const response = await this.makeAPICall(request);
        console.log('Raw API Response:', response);
        
        const addresses = this.parseAndValidateAddresses(response, request.country);
        console.log('Parsed addresses:', addresses);
        
        if (addresses.length >= Math.min(request.count, 1)) {
          console.log(`✅ Successfully generated ${addresses.length} addresses`);
          return addresses.slice(0, request.count);
        }
        
        console.log(`⚠️ Only generated ${addresses.length} addresses, need ${request.count}`);
        
        if (attempt === this.retryCount) {
          console.warn(`❌ Failed to generate sufficient addresses after ${this.retryCount} attempts`);
          return addresses;
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        if (attempt === this.retryCount) {
          throw error;
        }
        await this.delay(1000 * attempt); // Progressive delay
      }
    }
    
    return [];
  }

  private async makeAPICall(request: AddressGenerationRequest): Promise<string> {
    const systemPrompt = `
You are a synthetic test data generator for software development purposes.
Generate fictional, non-sensitive test data only.
Return data as a JSON array of strings with no additional text.
    `.trim();

    const userPrompt = `
Generate ${request.count} unique, realistic, and complete fictional postal addresses for software testing in ${request.country}.
Each address must include: street, city, region/state (if applicable), postal code, and country — all in the correct local format.
Ensure that postal codes correspond correctly to their respective city and state.

Return only a valid JSON array of exactly ${request.count} address strings, with no extra explanation, headers, or metadata — just the array.

Example format:
[
  "123 Main Street, New York, NY 10001, United States",
  "45 Baker Street, London SW1A 1AA, United Kingdom",
  "Rua das Flores, 123, São Paulo, SP 01001-000, Brazil"
]
    `.trim();

    console.log('=== API Call Details ===');
    console.log('Endpoint:', this.config.endpoint);
    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt);

    const requestBody = {
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    };

    console.log('Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response Status:', response.status, response.statusText);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Full API Response:', JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in response:', data);
      throw new Error('No content received from Azure OpenAI');
    }

    console.log('Extracted Content:', content);
    return content;
  }

  private parseAndValidateAddresses(content: string, expectedCountry: string): GeneratedAddress[] {
    try {
      console.log('=== Parsing Response ===');
      console.log('Raw content:', content);
      
      // Try to extract JSON array from response
      let jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // Try to find array without brackets if it's just strings
        console.log('No JSON array found, trying to parse as lines...');
        const lines = content.split('\n').filter(line => line.trim() && !line.includes('```'));
        if (lines.length > 0) {
          jsonMatch = [`[${lines.map(line => `"${line.trim().replace(/^["']|["']$/g, '')}"`).join(',')}]`];
        }
      }
      
      if (!jsonMatch) {
        console.error('No valid array format found in response');
        throw new Error('No JSON array found in response');
      }

      console.log('JSON to parse:', jsonMatch[0]);
      const addressStrings = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(addressStrings)) {
        console.error('Response is not an array:', addressStrings);
        throw new Error('Response is not an array');
      }

      console.log('Parsed address strings:', addressStrings);

      // Convert address strings to structured addresses
      const addresses = addressStrings
        .filter(addr => typeof addr === 'string' && addr.trim())
        .map(addr => this.parseAddressString(addr.trim(), expectedCountry))
        .filter(addr => this.isValidAddress(addr));

      console.log('Final structured addresses:', addresses);
      return addresses;
    } catch (error) {
      console.error('Error parsing address response:', error);
      console.error('Content that failed to parse:', content);
      throw new Error('Failed to parse address response from Azure OpenAI');
    }
  }

  private parseAddressString(addressString: string, expectedCountry: string): GeneratedAddress {
    console.log('Parsing address string:', addressString);
    
    // Split by commas and clean up parts
    const parts = addressString.split(',').map(part => part.trim());
    
    // Default structure
    let street = '';
    let city = '';
    let state = '';
    let postalCode = '';
    let country = expectedCountry;

    try {
      if (parts.length >= 4) {
        // Format: "123 Main Street, New York, NY 10001, United States"
        street = parts[0];
        city = parts[1];
        
        // Handle "NY 10001" format
        const stateAndZip = parts[2].split(' ');
        if (stateAndZip.length >= 2) {
          state = stateAndZip[0];
          postalCode = stateAndZip.slice(1).join(' ');
        } else {
          state = parts[2];
          postalCode = parts[3].split(' ')[0];
        }
        
        country = parts[parts.length - 1];
      } else if (parts.length === 3) {
        // Format: "123 Main Street, City, State/Zip"
        street = parts[0];
        city = parts[1];
        const stateAndZip = parts[2].split(' ');
        if (stateAndZip.length >= 2) {
          state = stateAndZip[0];
          postalCode = stateAndZip.slice(1).join(' ');
        } else {
          state = parts[2];
        }
      } else {
        // Fallback: use the whole string as street
        street = addressString;
        city = 'Test City';
        state = 'Test State';
        postalCode = '12345';
      }

      // Clean up postal code (remove extra characters)
      postalCode = postalCode.replace(/[^\w\s-]/g, '').trim();
      
    } catch (error) {
      console.error('Error parsing individual address:', error);
      // Fallback values
      street = addressString.length > 50 ? addressString.substring(0, 50) : addressString;
      city = 'Test City';
      state = 'Test State';
      postalCode = '12345';
    }

    const result = {
      street: street || 'Test Street',
      city: city || 'Test City',
      state: state || 'Test State',
      postalCode: postalCode || '12345',
      country: expectedCountry
    };

    console.log('Parsed result:', result);
    return result;
  }

  private isValidAddress(addr: any): boolean {
    const isValid = addr && 
           typeof addr.street === 'string' && addr.street.trim() &&
           typeof addr.city === 'string' && addr.city.trim() &&
           typeof addr.state === 'string' && addr.state.trim() &&
           typeof addr.postalCode === 'string' && addr.postalCode.trim() &&
           typeof addr.country === 'string' && addr.country.trim();
    
    console.log('Address validation:', addr, 'Valid:', isValid);
    return isValid;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('=== Testing Azure OpenAI Connection ===');
      const testResponse = await this.generateAddresses({
        country: 'United States',
        count: 1
      });
      const success = testResponse.length > 0;
      console.log('Connection test result:', success ? '✅ Success' : '❌ Failed');
      return success;
    } catch (error) {
      console.error('❌ Azure OpenAI connection test failed:', error);
      return false;
    }
  }
}

export { AzureOpenAIService, type AzureOpenAIConfig, type GeneratedAddress, type AddressGenerationRequest };
