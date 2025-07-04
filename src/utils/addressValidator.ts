
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

class AddressValidator {
  private reuseTracker: AddressReuseTracker;

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
      /fake/i
    ];

    const allFields = [address.street, address.city, address.state, address.postalCode].join(' ');
    placeholderPatterns.forEach(pattern => {
      if (pattern.test(allFields)) {
        errors.push('Address contains placeholder text');
      }
    });

    // Determine quality
    let quality: 'high' | 'medium' | 'low' = 'high';
    if (errors.length > 0) {
      quality = errors.length > 2 ? 'low' : 'medium';
    }

    return {
      isValid: errors.length === 0,
      errors,
      quality
    };
  }

  initializeAddressPool(countryAddresses: Map<string, GeneratedAddress[]>): void {
    console.log('=== Initializing Address Pool for Reuse ===');
    this.reuseTracker.countryAddresses = new Map(countryAddresses);
    this.reuseTracker.usageCounters.clear();

    // Initialize counters for all countries
    for (const country of countryAddresses.keys()) {
      this.reuseTracker.usageCounters.set(country, 0);
      console.log(`Initialized reuse tracker for ${country}: ${countryAddresses.get(country)?.length} addresses available`);
    }
  }

  getAddressForReuse(country: string, rowIndex: number): GeneratedAddress | null {
    const addresses = this.reuseTracker.countryAddresses.get(country);
    if (!addresses || addresses.length === 0) {
      console.log(`❌ No addresses available for reuse in ${country}`);
      return null;
    }

    // Get current usage counter
    let currentUsage = this.reuseTracker.usageCounters.get(country) || 0;
    
    // Calculate which address to use (cycle through available addresses)
    const addressIndex = currentUsage % addresses.length;
    const selectedAddress = addresses[addressIndex];

    // Increment usage counter
    this.reuseTracker.usageCounters.set(country, currentUsage + 1);

    console.log(`🔄 Reusing address ${addressIndex} for ${country} (usage: ${currentUsage + 1}, row: ${rowIndex})`);
    
    return selectedAddress;
  }

  validateAddressBatch(addresses: GeneratedAddress[]): {
    validAddresses: GeneratedAddress[];
    invalidAddresses: GeneratedAddress[];
    qualityStats: Record<string, number>;
  } {
    const validAddresses: GeneratedAddress[] = [];
    const invalidAddresses: GeneratedAddress[] = [];
    const qualityStats = { high: 0, medium: 0, low: 0 };

    addresses.forEach(address => {
      const validation = this.validateAddress(address);
      qualityStats[validation.quality]++;

      if (validation.isValid) {
        validAddresses.push(address);
      } else {
        invalidAddresses.push(address);
        console.log(`❌ Invalid address detected:`, validation.errors);
      }
    });

    return { validAddresses, invalidAddresses, qualityStats };
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
}

export { AddressValidator, type AddressValidationResult, type AddressReuseTracker };
