
import { DataType, ColumnInfo } from "@/types";

// Enhanced regex patterns for better detection
const enhancedPatterns = {
  creditCard: {
    visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
    mastercard: /^5[1-5][0-9]{14}$/,
    amex: /^3[47][0-9]{13}$/,
    discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
    generic: /^[0-9]{13,19}$/
  },
  debitCard: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})$/,
  sequential: /^[0-9]+$/,
  geoSpecific: {
    usPostal: /^\d{5}(-\d{4})?$/,
    ukPostal: /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][ABD-HJLNP-UW-Z]{2}$/,
    caPostal: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
    inPostal: /^\d{6}$/
  }
};

// Luhn checksum validation for credit cards
export const validateLuhnChecksum = (cardNumber: string): boolean => {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

// Detect credit card type
export const detectCardType = (cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'discover' | null => {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (enhancedPatterns.creditCard.visa.test(cleanNumber)) return 'visa';
  if (enhancedPatterns.creditCard.mastercard.test(cleanNumber)) return 'mastercard';
  if (enhancedPatterns.creditCard.amex.test(cleanNumber)) return 'amex';
  if (enhancedPatterns.creditCard.discover.test(cleanNumber)) return 'discover';
  
  return null;
};

// Detect sequential patterns
export const detectSequentialPattern = (values: string[]): boolean => {
  if (values.length < 3) return false;
  
  const numericValues = values
    .filter(v => /^\d+$/.test(v))
    .map(Number)
    .sort((a, b) => a - b);
  
  if (numericValues.length < 3) return false;
  
  let sequentialCount = 0;
  for (let i = 1; i < numericValues.length; i++) {
    if (numericValues[i] === numericValues[i - 1] + 1) {
      sequentialCount++;
    }
  }
  
  return sequentialCount / (numericValues.length - 1) > 0.7;
};

// Detect constant values
export const detectConstantValues = (values: string[]): boolean => {
  const uniqueValues = new Set(values.filter(Boolean));
  return uniqueValues.size <= Math.min(3, Math.ceil(values.length * 0.1));
};

// Enhanced data type detection
export const enhancedDetectDataType = (value: string, columnName: string = ''): DataType => {
  if (!value || value.trim() === '') return 'Unknown';
  
  const cleanValue = value.trim();
  
  // Credit card detection with Luhn validation
  if (enhancedPatterns.creditCard.generic.test(cleanValue.replace(/\D/g, ''))) {
    if (validateLuhnChecksum(cleanValue)) {
      const cardType = detectCardType(cleanValue);
      if (cardType) {
        return columnName.toLowerCase().includes('debit') ? 'Debit Card' : 'Credit Card';
      }
    }
  }
  
  // Sequential pattern detection
  if (enhancedPatterns.sequential.test(cleanValue)) {
    return 'Sequential';
  }
  
  // Enhanced geo-specific detection
  if (enhancedPatterns.geoSpecific.usPostal.test(cleanValue)) return 'Postal Code';
  if (enhancedPatterns.geoSpecific.ukPostal.test(cleanValue)) return 'Postal Code';
  if (enhancedPatterns.geoSpecific.caPostal.test(cleanValue)) return 'Postal Code';
  if (enhancedPatterns.geoSpecific.inPostal.test(cleanValue)) return 'Postal Code';
  
  // Fallback to existing detection logic
  return 'String';
};

// Enhanced column analysis
export const analyzeColumn = (values: string[], columnName: string): Partial<ColumnInfo> => {
  const validValues = values.filter(Boolean);
  
  return {
    isConstant: detectConstantValues(validValues),
    isSequential: detectSequentialPattern(validValues),
    geoRegion: detectGeoRegion(validValues),
    preservePattern: shouldPreservePattern(validValues, columnName)
  };
};

// Detect geographical region
const detectGeoRegion = (values: string[]): string | undefined => {
  const usPatternCount = values.filter(v => enhancedPatterns.geoSpecific.usPostal.test(v)).length;
  const ukPatternCount = values.filter(v => enhancedPatterns.geoSpecific.ukPostal.test(v)).length;
  const caPatternCount = values.filter(v => enhancedPatterns.geoSpecific.caPostal.test(v)).length;
  const inPatternCount = values.filter(v => enhancedPatterns.geoSpecific.inPostal.test(v)).length;
  
  const total = values.length;
  
  if (usPatternCount / total > 0.7) return 'US';
  if (ukPatternCount / total > 0.7) return 'UK';  
  if (caPatternCount / total > 0.7) return 'CA';
  if (inPatternCount / total > 0.7) return 'IN';
  
  return undefined;
};

// Determine if pattern should be preserved
const shouldPreservePattern = (values: string[], columnName: string): boolean => {
  const name = columnName.toLowerCase();
  
  // Always preserve patterns for these types
  if (name.includes('phone') || name.includes('card') || name.includes('id')) {
    return true;
  }
  
  // Check for consistent formatting
  const formats = values.map(v => v.replace(/[a-zA-Z0-9]/g, '#'));
  const uniqueFormats = new Set(formats);
  
  return uniqueFormats.size <= 2; // Preserve if most values follow same format
};
