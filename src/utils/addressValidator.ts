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
  duplicatesDetected: number;
  originalDataMatches: number;
}

// Enhanced uniqueness and original data tracking
interface UniquenessTracker {
  globalAddressSet: Set<string>;
  countryAddressSets: Map<string, Set<string>>;
  originalDataSet: Set<string>;
}

// Enhanced smart retry interfaces
interface SmartRetryResult {
  validAddresses: GeneratedAddress[];
  invalidAddresses: GeneratedAddress[];
  retryRequests: Array<{ country: string; count: number; failedIndices: number[]; reason: string }>;
  qualityStats: Record<string, number>;
  successRate: number;
  uniquenessStats: { duplicates: number; originalMatches: number };
}

interface RetryTracker {
  countryRetryAttempts: Map<string, number>;
  maxRetryAttempts: number;
  failedAddressIndices: Map<string, number[]>;
  retryReasons: Map<string, string[]>;
}

class AddressValidator {
  private reuseTracker: AddressReuseTracker;
  private validationStats: ValidationStats = { 
    total: 0, valid: 0, invalid: 0, retries: 0, duplicatesDetected: 0, originalDataMatches: 0 
  };
  private retryTracker: RetryTracker;
  private uniquenessTracker: UniquenessTracker;

  constructor(maxReuses: number = 3) {
    this.reuseTracker = {
      countryAddresses: new Map(),
      usageCounters: new Map(),
      maxReuses
    };

    this.retryTracker = {
      countryRetryAttempts: new Map(),
      maxRetryAttempts: 3,
      failedAddressIndices: new Map(),
      retryReasons: new Map()
    };

    this.uniquenessTracker = {
      globalAddressSet: new Set(),
      countryAddressSets: new Map(),
      originalDataSet: new Set()
    };
  }

  // NEW: Initialize original data for comparison
  initializeOriginalData(originalData: Record<string, string>[]): void {
    console.log('=== UNIQUENESS: Initializing original data for comparison ===');
    
    this.uniquenessTracker.originalDataSet.clear();
    
    originalData.forEach(row => {
      // Create composite keys for different address components
      const addressKey = `${row.Address || ''}|${row.City || ''}|${row.State || ''}|${row['Postal Code'] || ''}`.toLowerCase().trim();
      const streetKey = (row.Address || '').toLowerCase().trim();
      const cityKey = (row.City || '').toLowerCase().trim();
      const stateKey = (row.State || '').toLowerCase().trim();
      const postalKey = (row['Postal Code'] || '').toLowerCase().trim();
      
      if (addressKey !== '|||') this.uniquenessTracker.originalDataSet.add(addressKey);
      if (streetKey) this.uniquenessTracker.originalDataSet.add(streetKey);
      if (cityKey) this.uniquenessTracker.originalDataSet.add(cityKey);
      if (stateKey) this.uniquenessTracker.originalDataSet.add(stateKey);
      if (postalKey) this.uniquenessTracker.originalDataSet.add(postalKey);
    });
    
    console.log(`✅ UNIQUENESS: Loaded ${this.uniquenessTracker.originalDataSet.size} original data points`);
  }

  // Enhanced validation with uniqueness and original data checks
  validateAddress(address: GeneratedAddress, country?: string): AddressValidationResult {
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
      /lorem ipsum/i, /placeholder/i, /example/i, /test/i, /dummy/i, /fake/i,
      /\[.*\]/, /\{.*\}/, /xxx/i, /sample/i
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

    // NEW: Enhanced uniqueness validation
    const uniquenessResult = this.validateUniqueness(address, country);
    if (!uniquenessResult.isUnique) {
      errors.push(...uniquenessResult.errors);
    }

    // NEW: Original data comparison
    const originalDataResult = this.checkAgainstOriginalData(address);
    if (!originalDataResult.isValid) {
      errors.push(...originalDataResult.errors);
      this.validationStats.originalDataMatches++;
    }

    // Determine quality
    let quality: 'high' | 'medium' | 'low' = 'high';
    if (errors.length > 0) {
      quality = errors.length > 2 ? 'low' : 'medium';
    }

    this.validationStats.total++;
    if (errors.length === 0) {
      this.validationStats.valid++;
      // Add to uniqueness tracker if valid
      this.addToUniquenessTracker(address, country);
    } else {
      this.validationStats.invalid++;
    }

    return {
      isValid: errors.length === 0,
      errors,
      quality
    };
  }

  // NEW: Comprehensive uniqueness validation
  private validateUniqueness(address: GeneratedAddress, country?: string): { isUnique: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Create composite address key
    const addressKey = `${address.street}|${address.city}|${address.state}|${address.postalCode}`.toLowerCase().trim();
    
    // Check global uniqueness
    if (this.uniquenessTracker.globalAddressSet.has(addressKey)) {
      errors.push('Duplicate address detected globally');
      this.validationStats.duplicatesDetected++;
    }
    
    // Check country-specific uniqueness if country provided
    if (country) {
      const countrySet = this.uniquenessTracker.countryAddressSets.get(country);
      if (countrySet && countrySet.has(addressKey)) {
        errors.push(`Duplicate address detected within ${country}`);
        this.validationStats.duplicatesDetected++;
      }
    }
    
    // Check individual components for duplicates
    const streetKey = address.street.toLowerCase().trim();
    if (this.uniquenessTracker.globalAddressSet.has(`street:${streetKey}`)) {
      errors.push('Duplicate street address detected');
    }
    
    return {
      isUnique: errors.length === 0,
      errors
    };
  }

  // NEW: Check against original data
  private checkAgainstOriginalData(address: GeneratedAddress): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const addressKey = `${address.street}|${address.city}|${address.state}|${address.postalCode}`.toLowerCase().trim();
    const streetKey = address.street.toLowerCase().trim();
    const cityKey = address.city.toLowerCase().trim();
    const stateKey = address.state.toLowerCase().trim();
    const postalKey = address.postalCode.toLowerCase().trim();
    
    if (this.uniquenessTracker.originalDataSet.has(addressKey)) {
      errors.push('Generated address matches original data exactly');
    }
    
    if (this.uniquenessTracker.originalDataSet.has(streetKey)) {
      errors.push('Generated street matches original data');
    }
    
    if (this.uniquenessTracker.originalDataSet.has(cityKey)) {
      errors.push('Generated city matches original data');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // NEW: Add address to uniqueness tracker
  private addToUniquenessTracker(address: GeneratedAddress, country?: string): void {
    const addressKey = `${address.street}|${address.city}|${address.state}|${address.postalCode}`.toLowerCase().trim();
    const streetKey = `street:${address.street.toLowerCase().trim()}`;
    
    this.uniquenessTracker.globalAddressSet.add(addressKey);
    this.uniquenessTracker.globalAddressSet.add(streetKey);
    
    if (country) {
      if (!this.uniquenessTracker.countryAddressSets.has(country)) {
        this.uniquenessTracker.countryAddressSets.set(country, new Set());
      }
      this.uniquenessTracker.countryAddressSets.get(country)!.add(addressKey);
    }
  }

  // Enhanced smart retry validation with detailed failure reasons
  validateAddressBatchWithSmartRetry(
    addresses: GeneratedAddress[],
    country: string
  ): SmartRetryResult {
    console.log(`=== ENHANCED SMART RETRY: Validating batch of ${addresses.length} addresses for ${country} ===`);
    
    const validAddresses: GeneratedAddress[] = [];
    const invalidAddresses: GeneratedAddress[] = [];
    const qualityStats = { high: 0, medium: 0, low: 0 };
    const failedIndices: number[] = [];
    const retryReasons: string[] = [];
    let duplicates = 0;
    let originalMatches = 0;

    addresses.forEach((address, index) => {
      const validation = this.validateAddress(address, country);
      qualityStats[validation.quality]++;

      if (validation.isValid) {
        validAddresses.push(address);
      } else {
        invalidAddresses.push(address);
        failedIndices.push(index);
        
        // Categorize failure reasons for better retry logic
        const isDuplicate = validation.errors.some(e => e.includes('Duplicate'));
        const isOriginalMatch = validation.errors.some(e => e.includes('original data'));
        const isPlaceholder = validation.errors.some(e => e.includes('placeholder'));
        
        if (isDuplicate) {
          duplicates++;
          retryReasons.push('duplicate');
        } else if (isOriginalMatch) {
          originalMatches++;
          retryReasons.push('original_match');
        } else if (isPlaceholder) {
          retryReasons.push('placeholder');
        } else {
          retryReasons.push('validation_error');
        }
        
        console.log(`❌ ENHANCED RETRY: Invalid address at index ${index} (${country}):`, validation.errors);
      }
    });

    const successRate = addresses.length > 0 ? validAddresses.length / addresses.length : 0;
    
    console.log(`✅ ENHANCED RETRY: ${validAddresses.length}/${addresses.length} addresses valid (${(successRate * 100).toFixed(1)}%)`);
    console.log(`ENHANCED RETRY: Quality - High: ${qualityStats.high}, Medium: ${qualityStats.medium}, Low: ${qualityStats.low}`);
    console.log(`ENHANCED RETRY: Issues - Duplicates: ${duplicates}, Original matches: ${originalMatches}`);

    // Enhanced retry request with detailed reasons
    const retryRequests: Array<{ country: string; count: number; failedIndices: number[]; reason: string }> = [];
    const currentRetryCount = this.retryTracker.countryRetryAttempts.get(country) || 0;

    if (failedIndices.length > 0 && currentRetryCount < this.retryTracker.maxRetryAttempts) {
      const primaryReason = this.getMostCommonReason(retryReasons);
      retryRequests.push({
        country,
        count: failedIndices.length,
        failedIndices,
        reason: primaryReason
      });
      
      // Store retry reasons for analysis
      this.retryTracker.retryReasons.set(country, retryReasons);
      
      console.log(`🚀 ENHANCED RETRY: Will retry ${failedIndices.length} failed addresses for ${country} (attempt ${currentRetryCount + 1}/${this.retryTracker.maxRetryAttempts}) - Primary reason: ${primaryReason}`);
    } else if (failedIndices.length > 0) {
      console.log(`⚠️ ENHANCED RETRY: Max retry attempts reached for ${country}, keeping ${validAddresses.length} valid addresses`);
    }

    return {
      validAddresses,
      invalidAddresses,
      retryRequests,
      qualityStats,
      successRate,
      uniquenessStats: { duplicates, originalMatches }
    };
  }

  private getMostCommonReason(reasons: string[]): string {
    const counts = reasons.reduce((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'unknown');
  }

  incrementRetryAttempt(country: string): void {
    const currentCount = this.retryTracker.countryRetryAttempts.get(country) || 0;
    this.retryTracker.countryRetryAttempts.set(country, currentCount + 1);
    this.validationStats.retries++;
    console.log(`🔄 ENHANCED RETRY: Incremented retry count for ${country} to ${currentCount + 1}`);
  }

  canRetryCountry(country: string): boolean {
    const currentCount = this.retryTracker.countryRetryAttempts.get(country) || 0;
    return currentCount < this.retryTracker.maxRetryAttempts;
  }

  getRetryStats(): Record<string, { attempts: number; maxAttempts: number; canRetry: boolean; reasons?: string[] }> {
    const stats: Record<string, { attempts: number; maxAttempts: number; canRetry: boolean; reasons?: string[] }> = {};
    
    for (const [country, attempts] of this.retryTracker.countryRetryAttempts.entries()) {
      stats[country] = {
        attempts,
        maxAttempts: this.retryTracker.maxRetryAttempts,
        canRetry: attempts < this.retryTracker.maxRetryAttempts,
        reasons: this.retryTracker.retryReasons.get(country)
      };
    }
    
    return stats;
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

  // NEW: Get enhanced statistics
  getEnhancedStats() {
    return {
      validation: this.getValidationStats(),
      uniqueness: {
        globalAddresses: this.uniquenessTracker.globalAddressSet.size,
        countriesTracked: this.uniquenessTracker.countryAddressSets.size,
        originalDataPoints: this.uniquenessTracker.originalDataSet.size
      },
      retry: this.getRetryStats()
    };
  }

  resetValidationStats(): void {
    this.validationStats = { total: 0, valid: 0, invalid: 0, retries: 0, duplicatesDetected: 0, originalDataMatches: 0 };
    this.retryTracker.countryRetryAttempts.clear();
    this.retryTracker.failedAddressIndices.clear();
    this.retryTracker.retryReasons.clear();
    this.uniquenessTracker.globalAddressSet.clear();
    this.uniquenessTracker.countryAddressSets.clear();
  }
}

export { AddressValidator, type AddressValidationResult, type AddressReuseTracker, type ValidationStats, type SmartRetryResult };
