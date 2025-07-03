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

interface BatchAddressGenerationRequest {
  countries: { country: string; count: number }[];
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

interface BatchAddressGenerationResponse {
  addressesByCountry: Map<string, GeneratedAddress[]>;
  metadata: {
    totalGenerated: number;
    totalRequested: number;
    countries: string[];
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

  async generateBatchAddresses(request: BatchAddressGenerationRequest): Promise<BatchAddressGenerationResponse> {
    console.log('=== Azure OpenAI Batch Address Generation Started ===');
    console.log('Batch Request:', JSON.stringify(request, null, 2));
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        console.log(`Batch attempt ${attempt} of ${this.retryCount}`);
        
        const response = await this.makeBatchAPICall(request);
        console.log('Raw Batch API Response:', response);
        
        const result = this.parseBatchAddressResponse(response, request.countries);
        console.log('Parsed batch result:', result);
        
        if (result.addressesByCountry.size > 0) {
          console.log(`✅ Successfully generated batch addresses for ${result.addressesByCountry.size} countries`);
          return result;
        }
        
        if (attempt === this.retryCount) {
          console.warn(`❌ Failed to generate batch addresses after ${this.retryCount} attempts`);
          return result;
        }
      } catch (error) {
        console.error(`❌ Batch attempt ${attempt} failed:`, error);
        if (attempt === this.retryCount) {
          throw error;
        }
        await this.delay(1000 * attempt);
      }
    }
    
    return {
      addressesByCountry: new Map(),
      metadata: {
        totalGenerated: 0,
        totalRequested: request.countries.reduce((sum, c) => sum + c.count, 0),
        countries: request.countries.map(c => c.country),
        quality: 'low'
      }
    };
  }

  private async makeBatchAPICall(request: BatchAddressGenerationRequest): Promise<string> {
    const totalCount = request.countries.reduce((sum, c) => sum + c.count, 0);
    const countryBreakdown = request.countries
      .map(c => `${c.country}: ${c.count} addresses`)
      .join(', ');

    const systemPrompt = `
You are a synthetic test data generator for software development purposes.
Generate fictional, non-sensitive test data only.
Return data as a JSON object with country names as keys and arrays of address strings as values.
    `.trim();

    const userPrompt = `
Generate ${totalCount} unique, realistic, and complete fictional postal addresses for software testing across multiple countries.
Generate exactly the following distribution: ${countryBreakdown}

Each address must include: street, city, region/state (if applicable), postal code, and country — all in the correct local format.
Ensure that postal codes correspond correctly to their respective city and state.

Return only a valid JSON object with country names as keys and arrays of address strings as values, with no extra explanation, headers, or metadata.

Example format:
{
  "United States": [
    "123 Main Street, New York, NY 10001, United States",
    "456 Oak Avenue, Los Angeles, CA 90210, United States"
  ],
  "Canada": [
    "789 Maple Street, Toronto, ON M5H 2N2, Canada"
  ],
  "United Kingdom": [
    "45 Baker Street, London SW1A 1AA, United Kingdom"
  ]
}
    `.trim();

    console.log('=== Batch API Call Details ===');
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
      max_tokens: 4000,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    };

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Batch Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Batch API Error Response:', errorText);
      throw new Error(`Azure OpenAI Batch API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Full Batch API Response:', JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in batch response:', data);
      throw new Error('No content received from Azure OpenAI batch call');
    }

    return content;
  }

  private parseBatchAddressResponse(
    content: string, 
    requestedCountries: { country: string; count: number }[]
  ): BatchAddressGenerationResponse {
    try {
      console.log('=== Parsing Batch Response ===');
      console.log('Raw batch content:', content);
      
      // Extract JSON object from response
      let jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON object found in batch response');
        throw new Error('No JSON object found in batch response');
      }

      const addressData = JSON.parse(jsonMatch[0]);
      console.log('Parsed address data:', addressData);

      const addressesByCountry = new Map<string, GeneratedAddress[]>();
      let totalGenerated = 0;
      const totalRequested = requestedCountries.reduce((sum, c) => sum + c.count, 0);

      // Process each country's addresses with improved parsing
      for (const { country, count } of requestedCountries) {
        const countryAddresses = addressData[country] || [];
        if (Array.isArray(countryAddresses)) {
          const structuredAddresses = countryAddresses
            .slice(0, count) // Take only the requested count
            .map((addr: string) => this.parseAddressStringEnhanced(addr, country))
            .filter(addr => this.isValidAddress(addr));
          
          if (structuredAddresses.length > 0) {
            addressesByCountry.set(country, structuredAddresses);
            totalGenerated += structuredAddresses.length;
          }
        }
      }

      return {
        addressesByCountry,
        metadata: {
          totalGenerated,
          totalRequested,
          countries: requestedCountries.map(c => c.country),
          quality: totalGenerated >= totalRequested * 0.8 ? 'high' : 
                   totalGenerated >= totalRequested * 0.5 ? 'medium' : 'low'
        }
      };
    } catch (error) {
      console.error('Error parsing batch address response:', error);
      throw new Error('Failed to parse batch address response from Azure OpenAI');
    }
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

      // Convert address strings to structured addresses with enhanced parsing
      const addresses = addressStrings
        .filter(addr => typeof addr === 'string' && addr.trim())
        .map(addr => this.parseAddressStringEnhanced(addr.trim(), expectedCountry))
        .filter(addr => this.isValidAddress(addr));

      console.log('Final structured addresses:', addresses);
      return addresses;
    } catch (error) {
      console.error('Error parsing address response:', error);
      console.error('Content that failed to parse:', content);
      throw new Error('Failed to parse address response from Azure OpenAI');
    }
  }

  private parseAddressStringEnhanced(addressString: string, expectedCountry: string): GeneratedAddress {
    console.log('Enhanced parsing address string:', addressString);
    
    // Split by commas and clean up parts
    const parts = addressString.split(',').map(part => part.trim());
    
    // Default structure
    let street = '';
    let city = '';
    let state = '';
    let postalCode = '';
    let country = expectedCountry;

    try {
      // Detect address format based on country and structure
      const format = this.detectAddressFormat(addressString, expectedCountry);
      
      switch (format) {
        case 'US_FORMAT':
          // Format: "123 Main Street, New York, NY 10001, United States"
          if (parts.length >= 4) {
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
          }
          break;
          
        case 'UK_FORMAT':
          // Format: "45 Baker Street, London SW1A 1AA, United Kingdom"
          if (parts.length >= 3) {
            street = parts[0];
            // UK format often has city and postcode together
            const cityAndPostcode = parts[1].split(' ');
            if (cityAndPostcode.length >= 2) {
              city = cityAndPostcode.slice(0, -2).join(' ');
              postalCode = cityAndPostcode.slice(-2).join(' ');
            } else {
              city = parts[1];
            }
            state = ''; // UK doesn't use states
            country = parts[parts.length - 1];
          }
          break;
          
        case 'CANADA_FORMAT':
          // Format: "789 Maple Street, Toronto, ON M5H 2N2, Canada"
          if (parts.length >= 4) {
            street = parts[0];
            city = parts[1];
            const provinceAndPostal = parts[2].split(' ');
            if (provinceAndPostal.length >= 3) {
              state = provinceAndPostal[0];
              postalCode = provinceAndPostal.slice(1).join(' ');
            } else {
              state = parts[2];
              postalCode = parts[3].split(' ')[0];
            }
            country = parts[parts.length - 1];
          }
          break;
          
        case 'BRAZIL_FORMAT':
          // Format: "Rua das Flores, 123, São Paulo, SP 01001-000, Brazil"
          if (parts.length >= 4) {
            street = parts.slice(0, 2).join(', '); // Include street number
            city = parts[2];
            const stateAndZip = parts[3].split(' ');
            if (stateAndZip.length >= 2) {
              state = stateAndZip[0];
              postalCode = stateAndZip.slice(1).join(' ');
            }
            country = parts[parts.length - 1];
          }
          break;
          
        default:
          // Generic fallback format
          if (parts.length >= 3) {
            street = parts[0];
            city = parts[1];
            
            if (parts.length >= 4) {
              const stateAndZip = parts[2].split(' ');
              if (stateAndZip.length >= 2) {
                state = stateAndZip[0];
                postalCode = stateAndZip.slice(1).join(' ');
              } else {
                state = parts[2];
                postalCode = parts[3];
              }
              country = parts[parts.length - 1];
            } else {
              state = parts[2];
              country = expectedCountry;
            }
          } else {
            // Fallback: use the whole string as street
            street = addressString;
            city = 'Test City';
            state = 'Test State';
            postalCode = '12345';
          }
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

    console.log('Enhanced parsed result:', result);
    return result;
  }

  private detectAddressFormat(addressString: string, country: string): string {
    // Detect format based on country and address structure patterns
    const lowerAddress = addressString.toLowerCase();
    const lowerCountry = country.toLowerCase();
    
    if (lowerCountry.includes('united states') || lowerCountry.includes('usa')) {
      return 'US_FORMAT';
    } else if (lowerCountry.includes('united kingdom') || lowerCountry.includes('uk')) {
      return 'UK_FORMAT';
    } else if (lowerCountry.includes('canada')) {
      return 'CANADA_FORMAT';
    } else if (lowerCountry.includes('brazil')) {
      return 'BRAZIL_FORMAT';
    }
    
    // Pattern-based detection as fallback
    if (/\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(addressString)) {
      return 'US_FORMAT'; // US state code + ZIP pattern
    } else if (/\b[A-Z]\d[A-Z]\s+\d[A-Z]\d\b/.test(addressString)) {
      return 'CANADA_FORMAT'; // Canadian postal code pattern
    } else if (/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}\b/.test(addressString)) {
      return 'UK_FORMAT'; // UK postal code pattern
    }
    
    return 'GENERIC_FORMAT';
  }

  private parseAddressString(addressString: string, expectedCountry: string): GeneratedAddress {
    // Keep existing method for backward compatibility
    return this.parseAddressStringEnhanced(addressString, expectedCountry);
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

export { AzureOpenAIService, type AzureOpenAIConfig, type GeneratedAddress, type AddressGenerationRequest, type BatchAddressGenerationRequest, type BatchAddressGenerationResponse };
