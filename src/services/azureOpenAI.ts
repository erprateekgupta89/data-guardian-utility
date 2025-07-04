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
        await this.delay(1000 * attempt);
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

  private parseAddressStringEnhanced(addressString: string, expectedCountry: string): GeneratedAddress {
    console.log(`🔧 CLEAN: Parsing address for ${expectedCountry}:`, addressString);
    
    // Clean the address string - remove extra spaces and normalize commas
    const cleanAddress = addressString.trim().replace(/\s+/g, ' ').replace(/,\s*,/g, ',');
    
    // Split by commas and clean up parts
    const parts = cleanAddress.split(',').map(part => part.trim()).filter(part => part.length > 0);
    console.log(`🔧 CLEAN: Address parts for ${expectedCountry}:`, parts);
    
    let street = '';
    let city = '';
    let state = '';
    let postalCode = '';
    
    try {
      if (parts.length >= 2) {
        street = parts[0];
        
        if (parts.length === 2) {
          // Simple format: "Street, City"
          city = parts[1];
          state = this.getCountrySpecificStateDefault(expectedCountry);
          postalCode = this.getCountrySpecificPostalDefault(expectedCountry);
        } else if (parts.length === 3) {
          // Format: "Street, City, State/Postal" or "Street, City, Country"
          city = parts[1];
          const lastPart = parts[2];
          
          // Check if last part contains postal code pattern
          if (/\d/.test(lastPart)) {
            // Extract state and postal code
            const statePostal = lastPart.split(' ');
            if (statePostal.length >= 2) {
              state = statePostal[0];
              postalCode = statePostal.slice(1).join(' ');
            } else {
              postalCode = lastPart;
              state = this.getCountrySpecificStateDefault(expectedCountry);
            }
          } else {
            // Probably just state or country
            state = lastPart;
            postalCode = this.getCountrySpecificPostalDefault(expectedCountry);
          }
        } else {
          // Format: "Street, City, State, Postal" or similar
          city = parts[1];
          
          // Find the part with postal code (contains digits)
          const postalIndex = parts.findIndex((part, idx) => idx > 1 && /\d/.test(part));
          
          if (postalIndex > -1) {
            // Extract state (part before postal) and postal code
            if (postalIndex > 2) {
              state = parts[2];
            }
            postalCode = parts[postalIndex].replace(/[^\w\s-]/g, '').trim();
          } else {
            // No clear postal code found
            state = parts[2] || this.getCountrySpecificStateDefault(expectedCountry);
            postalCode = this.getCountrySpecificPostalDefault(expectedCountry);
          }
        }
      } else {
        // Fallback for malformed addresses
        street = cleanAddress;
        city = this.getCountrySpecificCityDefault(expectedCountry);
        state = this.getCountrySpecificStateDefault(expectedCountry);
        postalCode = this.getCountrySpecificPostalDefault(expectedCountry);
      }
      
      // Clean up components - remove extra punctuation and spaces
      street = street.replace(/[,;]+$/, '').trim();
      city = city.replace(/[,;]+$/, '').trim();
      state = state.replace(/[,;]+$/, '').trim();
      postalCode = postalCode.replace(/[,;]+$/, '').trim();
      
    } catch (error) {
      console.error(`🔧 CLEAN: Error parsing address for ${expectedCountry}:`, error);
      // Use fallbacks
      street = cleanAddress.length > 50 ? cleanAddress.substring(0, 50) : cleanAddress;
      city = this.getCountrySpecificCityDefault(expectedCountry);
      state = this.getCountrySpecificStateDefault(expectedCountry);
      postalCode = this.getCountrySpecificPostalDefault(expectedCountry);
    }

    const result = {
      street: street || this.getCountrySpecificStreetDefault(expectedCountry),
      city: city || this.getCountrySpecificCityDefault(expectedCountry),
      state: state || this.getCountrySpecificStateDefault(expectedCountry),
      postalCode: postalCode || this.getCountrySpecificPostalDefault(expectedCountry),
      country: expectedCountry
    };

    console.log(`✅ CLEAN: Parsed result for ${expectedCountry}:`, result);
    return result;
  }

  private parseBatchAddressResponse(
    content: string, 
    requestedCountries: { country: string; count: number }[]
  ): BatchAddressGenerationResponse {
    try {
      console.log('=== CLEAN: Enhanced Batch Response Parsing ===');
      console.log('Raw batch content:', content);
      
      const cleanedContent = this.cleanAndExtractJSON(content);
      console.log('CLEAN: Cleaned content for parsing:', cleanedContent);
      
      if (!cleanedContent) {
        throw new Error('No valid JSON content found after cleaning');
      }

      const addressData = JSON.parse(cleanedContent);
      console.log('CLEAN: Successfully parsed address data:', addressData);

      if (!addressData || typeof addressData !== 'object') {
        throw new Error('Parsed data is not a valid object');
      }

      const addressesByCountry = new Map<string, GeneratedAddress[]>();
      let totalGenerated = 0;
      const totalRequested = requestedCountries.reduce((sum, c) => sum + c.count, 0);

      for (const { country, count } of requestedCountries) {
        console.log(`CLEAN: Processing addresses for ${country} (requested: ${count})`);
        
        const countryAddresses = addressData[country] || [];
        console.log(`CLEAN: Raw addresses for ${country}:`, countryAddresses);
        
        if (Array.isArray(countryAddresses)) {
          const validAddressStrings = countryAddresses.filter((addr: any) => {
            if (typeof addr !== 'string') return false;
            if (addr.includes('...') || addr.includes('more addresses')) return false;
            if (addr.trim().length < 10) return false;
            return true;
          });
          
          console.log(`CLEAN: Valid address strings for ${country}:`, validAddressStrings);
          
          const structuredAddresses = validAddressStrings
            .slice(0, count)
            .map((addr: string) => this.parseAddressStringEnhanced(addr, country))
            .filter(addr => this.isValidAddress(addr));
          
          console.log(`CLEAN: Structured addresses for ${country}:`, structuredAddresses);
          
          if (structuredAddresses.length > 0) {
            addressesByCountry.set(country, structuredAddresses);
            totalGenerated += structuredAddresses.length;
            console.log(`✅ CLEAN: Successfully processed ${structuredAddresses.length} addresses for ${country}`);
          } else {
            console.warn(`⚠️ CLEAN: No valid addresses generated for ${country}`);
          }
        } else {
          console.warn(`⚠️ CLEAN: Invalid address data structure for ${country}`);
        }
      }

      console.log(`CLEAN: Final batch processing complete. Total generated: ${totalGenerated}/${totalRequested}`);

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
      console.error('CLEAN: Error parsing batch address response:', error);
      console.error('CLEAN: Content that failed to parse:', content);
      throw new Error('Failed to parse batch address response from Azure OpenAI');
    }
  }

  private cleanAndExtractJSON(content: string): string | null {
    console.log('CLEAN: Starting JSON cleaning and extraction');
    
    let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    cleaned = cleaned.trim();
    
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
      console.error('CLEAN: No valid JSON object boundaries found');
      return null;
    }
    
    const jsonContent = cleaned.substring(jsonStart, jsonEnd + 1);
    console.log('CLEAN: Extracted JSON content:', jsonContent);
    
    let finalContent = jsonContent
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/\n\s*\.\.\.\s*/g, '')
      .replace(/"\s*\.\.\.\s*"/g, '');
    
    try {
      JSON.parse(finalContent);
      console.log('✅ CLEAN: JSON content validated successfully');
      return finalContent;
    } catch (error) {
      console.error('CLEAN: JSON validation failed:', error);
      return null;
    }
  }

  private parseAndValidateAddresses(content: string, expectedCountry: string): GeneratedAddress[] {
    try {
      console.log('=== CLEAN: Enhanced Parsing Response ===');
      console.log('Raw content:', content);
      
      let jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
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

  private getCountrySpecificCityDefault(country: string): string {
    const lowerCountry = country.toLowerCase();
    if (lowerCountry.includes('brazil')) return 'São Paulo';
    if (lowerCountry.includes('japan')) return 'Tokyo';
    if (lowerCountry.includes('germany')) return 'Berlin';
    if (lowerCountry.includes('france')) return 'Paris';
    if (lowerCountry.includes('india')) return 'Mumbai';
    if (lowerCountry.includes('mexico')) return 'Mexico City';
    if (lowerCountry.includes('australia')) return 'Sydney';
    if (lowerCountry.includes('canada')) return 'Toronto';
    if (lowerCountry.includes('united kingdom')) return 'London';
    return 'Test City';
  }

  private getCountrySpecificStateDefault(country: string): string {
    const lowerCountry = country.toLowerCase();
    if (lowerCountry.includes('brazil')) return 'SP';
    if (lowerCountry.includes('japan')) return '';
    if (lowerCountry.includes('germany')) return '';
    if (lowerCountry.includes('france')) return '';
    if (lowerCountry.includes('india')) return 'MH';
    if (lowerCountry.includes('mexico')) return 'CDMX';
    if (lowerCountry.includes('australia')) return 'NSW';
    if (lowerCountry.includes('canada')) return 'ON';
    if (lowerCountry.includes('united kingdom')) return '';
    if (lowerCountry.includes('united states')) return 'NY';
    return '';
  }

  private getCountrySpecificPostalDefault(country: string): string {
    const lowerCountry = country.toLowerCase();
    if (lowerCountry.includes('brazil')) return '01000-000';
    if (lowerCountry.includes('japan')) return '100-0001';
    if (lowerCountry.includes('germany')) return '10115';
    if (lowerCountry.includes('france')) return '75001';
    if (lowerCountry.includes('india')) return '400001';
    if (lowerCountry.includes('mexico')) return '01000';
    if (lowerCountry.includes('australia')) return '2000';
    if (lowerCountry.includes('canada')) return 'M5H 2N2';
    if (lowerCountry.includes('united kingdom')) return 'SW1A 1AA';
    if (lowerCountry.includes('united states')) return '10001';
    return '12345';
  }

  private getCountrySpecificStreetDefault(country: string): string {
    const lowerCountry = country.toLowerCase();
    if (lowerCountry.includes('brazil')) return 'Rua Principal, 123';
    if (lowerCountry.includes('japan')) return '1-2-3 Main Street';
    if (lowerCountry.includes('germany')) return 'Hauptstraße 123';
    if (lowerCountry.includes('france')) return '123 Rue Principale';
    return '123 Main Street';
  }

  private isValidAddress(addr: any): boolean {
    const isValid = addr && 
           typeof addr.street === 'string' && addr.street.trim() &&
           typeof addr.city === 'string' && addr.city.trim() &&
           typeof addr.state === 'string' &&
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
