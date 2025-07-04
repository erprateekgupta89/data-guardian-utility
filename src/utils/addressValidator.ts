
import { GeneratedAddress } from '@/services/azureOpenAI';

interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
  quality: 'high' | 'medium' | 'low';
}

interface AddressReuseTracker {
  countryAddresses: Map<string, GeneratedAddress[]>;
  usageCounters: Map<string, number>;
  maxReuses: number;
}

interface ValidationStats {
  total: number;
  valid: number;
  invalid: number;
  retries: number;
}

class AddressValidator {
  private reuseTracker: AddressReuseTracker;
  private validationStats: ValidationStats = { total: 0, valid: 0, invalid: 0, retries: 0 };

  constructor(maxReuses: number = 3) {
    this.reuseTracker = {
      countryAddresses: new Map(),
      usageCounters: new Map(),
      maxReuses
    };
  }

  validateAddress(address: GeneratedAddress): AddressValidationResult {
    const errors: string[] = [];

    // Check required fields
    if (!address.street || address.street.trim() === '') {
      errors.push('Street address is missing or empty');
    }
    if (!address.city || address.city.trim() === '') {
      errors.push('City is missing or empty');
    }
    if (!address.state || address.state.trim() === '') {
      errors.push('State is missing or empty');
    }
    if (!address.postalCode || address.postalCode.trim() === '') {
      errors.push('Postal code is missing or empty');
    }

    // Check for placeholder text
    const placeholderPatterns = [
      /lorem ipsum/i,
      /placeholder/i,
      /example/i,
      /test/i,
      /dummy/i,
      /fake/i,
      /\[.*\]/,  // Check for [brackets]
      /\{.*\}/,  // Check for {braces}
      /xxx/i,
      /sample/i
    ];

    const allFields = [address.street, address.city, address.state, address.postalCode].join(' ');
    placeholderPatterns.forEach(pattern => {
      if (pattern.test(allFields)) {
        errors.push('Address contains placeholder text');
      }
    });

    // Check for unrealistic patterns
    if (address.street && /^(123|111|000)/.test(address.street)) {
      errors.push('Address appears to be a generic example');
    }

    // Determine quality
    let quality: 'high' | 'medium' | 'low' = 'high';
    if (errors.length > 0) {
      quality = errors.length > 2 ? 'low' : 'medium';
    }

    this.validationStats.total++;
    if (errors.length === 0) {
      this.validationStats.valid++;
    } else {
      this.validationStats.invalid++;
    }

    return {
      isValid: errors.length === 0,
      errors,
      quality
    };
  }

  validateAddressBatch(addresses: GeneratedAddress[]): {
    validAddresses: GeneratedAddress[];
    invalidAddresses: GeneratedAddress[];
    qualityStats: Record<string, number>;
    successRate: number;
  } {
    console.log(`=== VALIDATION: Validating batch of ${addresses.length} addresses ===`);
    
    const validAddresses: GeneratedAddress[] = [];
    const invalidAddresses: GeneratedAddress[] = [];
    const qualityStats = { high: 0, medium: 0, low: 0 };

    addresses.forEach((address, index) => {
      const validation = this.validateAddress(address);
      qualityStats[validation.quality]++;

      if (validation.isValid) {
        validAddresses.push(address);
      } else {
        invalidAddresses.push(address);
        console.log(`❌ VALIDATION: Invalid address at index ${index}:`, validation.errors);
      }
    });

    const successRate = addresses.length > 0 ? validAddresses.length / addresses.length : 0;
    
    console.log(`✅ VALIDATION: ${validAddresses.length}/${addresses.length} addresses valid (${(successRate * 100).toFixed(1)}%)`);
    console.log(`VALIDATION: Quality distribution - High: ${qualityStats.high}, Medium: ${qualityStats.medium}, Low: ${qualityStats.low}`);

    return { validAddresses, invalidAddresses, qualityStats, successRate };
  }

  // NEW: Generate incremental addresses for rows 101+
  generateIncrementalAddress(baseAddress: GeneratedAddress, rowIndex: number): GeneratedAddress {
    // Modify house number to create variation
    const baseStreet = baseAddress.street;
    const houseNumberMatch = baseStreet.match(/^(\d+)/);
    
    let newStreet = baseStreet;
    if (houseNumberMatch) {
      const baseNumber = parseInt(houseNumberMatch[1]);
      // Generate a new house number based on row index to ensure uniqueness
      const newNumber = baseNumber + (rowIndex % 9000) + 1; // Keep it realistic
      newStreet = baseStreet.replace(/^\d+/, newNumber.toString());
    } else {
      // If no house number found, prepend one
      const newNumber = 100 + (rowIndex % 9000);
      newStreet = `${newNumber} ${baseStreet}`;
    }

    console.log(`🏠 INCREMENTAL: Row ${rowIndex} - Modified "${baseAddress.street}" → "${newStreet}"`);

    return {
      ...baseAddress,
      street: newStreet
    };
  }

  initializeAddressPool(countryAddresses: Map<string, GeneratedAddress[]>): void {
    console.log('=== VALIDATION: Initializing Address Pool for Reuse ===');
    this.reuseTracker.countryAddresses = new Map(countryAddresses);
    this.reuseTracker.usageCounters.clear();

    // Initialize counters and validate addresses for all countries
    for (const [country, addresses] of countryAddresses.entries()) {
      this.reuseTracker.usageCounters.set(country, 0);
      
      // Validate the address pool
      const validation = this.validateAddressBatch(addresses);
      console.log(`VALIDATION: ${country} - ${validation.validAddresses.length}/${addresses.length} addresses valid`);
      
      // Replace invalid addresses with valid ones if needed
      if (validation.invalidAddresses.length > 0) {
        console.log(`⚠️ VALIDATION: ${country} has ${validation.invalidAddresses.length} invalid addresses - using valid ones only`);
        this.reuseTracker.countryAddresses.set(country, validation.validAddresses);
      }
    }
  }

  getAddressForReuse(country: string, rowIndex: number): GeneratedAddress | null {
    const addresses = this.reuseTracker.countryAddresses.get(country);
    if (!addresses || addresses.length === 0) {
      console.log(`❌ REUSE: No addresses available for reuse in ${country}`);
      return null;
    }

    // Get current usage counter
    let currentUsage = this.reuseTracker.usageCounters.get(country) || 0;
    
    // For rows 101+, use incremental generation
    if (rowIndex >= 100) {
      const baseAddressIndex = rowIndex % addresses.length;
      const baseAddress = addresses[baseAddressIndex];
      const incrementalAddress = this.generateIncrementalAddress(baseAddress, rowIndex);
      
      console.log(`🔄 INCREMENTAL: Row ${rowIndex} - Using incremental address for ${country}`);
      return incrementalAddress;
    }
    
    // For rows 1-100, use sequential access
    const addressIndex = currentUsage % addresses.length;
    const selectedAddress = addresses[addressIndex];

    // Increment usage counter
    this.reuseTracker.usageCounters.set(country, currentUsage + 1);

    console.log(`🔄 REUSE: Row ${rowIndex} - Using address ${addressIndex} for ${country} (usage: ${currentUsage + 1})`);
    
    return selectedAddress;
  }

  getReuseStats(): Record<string, { available: number; used: number; reuseFactor: number }> {
    const stats: Record<string, { available: number; used: number; reuseFactor: number }> = {};

    for (const [country, addresses] of this.reuseTracker.countryAddresses.entries()) {
      const used = this.reuseTracker.usageCounters.get(country) || 0;
      const available = addresses.length;
      const reuseFactor = available > 0 ? used / available : 0;

      stats[country] = {
        available,
        used,
        reuseFactor: Math.round(reuseFactor * 100) / 100
      };
    }

    return stats;
  }

  getValidationStats(): ValidationStats {
    return { ...this.validationStats };
  }

  resetValidationStats(): void {
    this.validationStats = { total: 0, valid: 0, invalid: 0, retries: 0 };
  }
}

export { AddressValidator, type AddressValidationResult, type AddressReuseTracker, type ValidationStats };
