
import { ColumnInfo, DataType, GeoReference } from "@/types";
import { validateLuhnChecksum, detectCardType } from "./enhancedDataDetection";

// Generate Luhn-valid credit card numbers
export const generateCreditCard = (type: 'visa' | 'mastercard' | 'amex' | 'discover' = 'visa'): string => {
  const prefixes = {
    visa: ['4'],
    mastercard: ['51', '52', '53', '54', '55'],
    amex: ['34', '37'],
    discover: ['6011', '65']
  };
  
  const lengths = {
    visa: [13, 16, 19],
    mastercard: [16],
    amex: [15],
    discover: [16]
  };
  
  const prefix = prefixes[type][Math.floor(Math.random() * prefixes[type].length)];
  const length = lengths[type][Math.floor(Math.random() * lengths[type].length)];
  
  // Generate remaining digits
  let cardNumber = prefix;
  while (cardNumber.length < length - 1) {
    cardNumber += Math.floor(Math.random() * 10);
  }
  
  // Calculate Luhn check digit
  let sum = 0;
  let isEven = true;
  
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return cardNumber + checkDigit;
};

// Geo-specific reference data
export const geoReferences: Record<string, GeoReference> = {
  US: {
    country: 'United States',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'],
    states: ['California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 'Illinois', 'Ohio', 'Georgia'],
    addresses: ['123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm St', '654 Maple Ave'],
    postalCodes: ['10001', '90210', '60601', '77001', '85001']
  },
  UK: {
    country: 'United Kingdom',
    cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Sheffield', 'Bradford', 'Liverpool'],
    states: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    addresses: ['123 High Street', '45 Victoria Road', '78 Church Lane', '12 Kings Road'],
    postalCodes: ['SW1A 1AA', 'M1 1AA', 'B1 1AA', 'LS1 1AA']
  },
  CA: {
    country: 'Canada',
    cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City'],
    states: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan'],
    addresses: ['123 Main Street', '456 Maple Avenue', '789 Oak Drive', '321 Pine Street'],
    postalCodes: ['M5V 3A8', 'H3H 2Y7', 'V6B 4Y8', 'T2P 2M5']
  },
  IN: {
    country: 'India',
    cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad'],
    states: ['Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu', 'West Bengal', 'Gujarat', 'Rajasthan'],
    addresses: ['123 MG Road', '456 Park Street', '789 Brigade Road', '321 Commercial Street'],
    postalCodes: ['400001', '110001', '560001', '500001']
  }
};

// Smart masking with geo-awareness
export const smartMaskData = (
  value: string, 
  dataType: DataType, 
  columnInfo: ColumnInfo,
  geoRegion?: string
): string => {
  if (!value || value.trim() === '') return value;
  
  // Handle constant values
  if (columnInfo.isConstant) {
    const constantOptions = getConstantOptions(dataType, geoRegion);
    return constantOptions[Math.floor(Math.random() * constantOptions.length)];
  }
  
  // Handle sequential values
  if (columnInfo.isSequential && dataType === 'Sequential') {
    return generateSequentialValue(value);
  }
  
  // Handle credit/debit cards
  if (dataType === 'Credit Card' || dataType === 'Debit Card') {
    const cardType = columnInfo.cardType || 'visa';
    const generatedCard = generateCreditCard(cardType);
    
    // Preserve original formatting
    if (columnInfo.preservePattern) {
      return applyOriginalFormat(generatedCard, value);
    }
    return generatedCard;
  }
  
  // Handle geo-specific data
  if (geoRegion && (dataType === 'Address' || dataType === 'City' || dataType === 'State' || dataType === 'Postal Code')) {
    return generateGeoSpecificData(dataType, geoRegion);
  }
  
  // Default masking logic
  return maskWithPattern(value, dataType, columnInfo.preservePattern);
};

// Generate sequential values
const generateSequentialValue = (originalValue: string): string => {
  const num = parseInt(originalValue);
  if (isNaN(num)) return originalValue;
  
  // Generate a number in similar range but not sequential
  const range = Math.max(1000, Math.floor(num * 0.1));
  const randomOffset = Math.floor(Math.random() * range) - Math.floor(range / 2);
  return Math.max(1, num + randomOffset).toString();
};

// Get constant value options
const getConstantOptions = (dataType: DataType, geoRegion?: string): string[] => {
  switch (dataType) {
    case 'Country':
      return geoRegion ? [geoReferences[geoRegion]?.country || 'United States'] : ['United States', 'Canada', 'United Kingdom'];
    case 'Gender':
      return ['Male', 'Female', 'Other'];
    case 'Bool':
      return ['true', 'false'];
    default:
      return ['Sample Value 1', 'Sample Value 2', 'Sample Value 3'];
  }
};

// Generate geo-specific data
const generateGeoSpecificData = (dataType: DataType, geoRegion: string): string => {
  const reference = geoReferences[geoRegion];
  if (!reference) return '';
  
  switch (dataType) {
    case 'Address':
      return reference.addresses[Math.floor(Math.random() * reference.addresses.length)];
    case 'City':
      return reference.cities[Math.floor(Math.random() * reference.cities.length)];
    case 'State':
      return reference.states[Math.floor(Math.random() * reference.states.length)];
    case 'Postal Code':
      return reference.postalCodes[Math.floor(Math.random() * reference.postalCodes.length)];
    default:
      return '';
  }
};

// Apply original formatting to new value
const applyOriginalFormat = (newValue: string, originalValue: string): string => {
  if (originalValue.includes('-')) {
    // Apply dash formatting for credit cards
    if (newValue.length === 16) {
      return `${newValue.slice(0, 4)}-${newValue.slice(4, 8)}-${newValue.slice(8, 12)}-${newValue.slice(12)}`;
    }
  }
  if (originalValue.includes(' ')) {
    // Apply space formatting
    return newValue.replace(/(.{4})/g, '$1 ').trim();
  }
  return newValue;
};

// Mask with pattern preservation
const maskWithPattern = (value: string, dataType: DataType, preservePattern?: boolean): string => {
  if (!preservePattern) {
    return generateBasicMaskedValue(dataType, value.length);
  }
  
  // Preserve the pattern of the original value
  return value.replace(/[a-zA-Z]/g, () => String.fromCharCode(65 + Math.floor(Math.random() * 26)))
              .replace(/[0-9]/g, () => Math.floor(Math.random() * 10).toString());
};

// Generate basic masked value
const generateBasicMaskedValue = (dataType: DataType, length: number): string => {
  switch (dataType) {
    case 'Email':
      return `user${Math.floor(Math.random() * 1000)}@example.com`;
    case 'Name':
      const names = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson'];
      return names[Math.floor(Math.random() * names.length)];
    case 'Phone Number':
      return `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    default:
      return 'X'.repeat(Math.min(length, 10));
  }
};
