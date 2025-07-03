import { DataType } from "@/types";

// Regular expressions for data type detection
const regexPatterns = {
  email: /^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$/,
  phoneNumber: /^(\+?\d{1,4}[-\s]?)?\d{10}$/,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/,
  zipCodeIndia: /^\d{6}$/,
  zipCodeUS: /^\d{5}(-\d{4})?$/,
  date1: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  date2: /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
  date3: /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
  date4: /^\d{2}\/\d{2}\/\d{2}$/, // YY/MM/DD or DD/MM/YY
  date5: /^\d{2}-\d{2}-\d{2}$/,   // YY-MM-DD or DD-MM-YY
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  currency: /^[$€£¥₹][\d,.]+$|^[\d,.]+[$€£¥₹]$/,
  bool: /^(true|false|yes|no|0|1)$/i,
  int: /^-?\d+$/,
  float: /^-?\d+\.\d+$/,
  time: /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/,
  dateTime: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/,
  name: /^[A-Za-z]+(?: [A-Za-z]+)*$/,
  gender: /^(male|female|m|f|other)$/i,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  url: /^(https?:\/\/)?[\w-]+(\.[\w-]+)+[/#?]?.*$/,
};

// Check if a value passes Luhn algorithm for credit card validation
const passesLuhnCheck = (value: string): boolean => {
  const sanitized = value.replace(/[\s-]/g, '');
  
  if (!/^\d+$/.test(sanitized)) return false;
  
  let sum = 0;
  let double = false;
  
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i));
    
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    double = !double;
  }
  
  return sum % 10 === 0;
};

// Detect data type from a sample value
export const detectDataType = (value: string): DataType => {
  if (!value || value.trim() === '') return 'Unknown';
  
  const strValue = String(value).trim();
  
  // Numbers - check FIRST to avoid misclassification by other patterns
  if (regexPatterns.int.test(strValue)) return 'Int';
  if (regexPatterns.float.test(strValue)) return 'Float';
  
  // Boolean - check early as it can be confused with numbers
  if (regexPatterns.bool.test(strValue)) return 'Bool';
  
  // Dates (check before postal code!)
  if (
    regexPatterns.date1.test(strValue) ||
    regexPatterns.date2.test(strValue) ||
    regexPatterns.date3.test(strValue) ||
    regexPatterns.date4.test(strValue) ||
    regexPatterns.date5.test(strValue)
  ) return 'Date';
  
  // Email
  if (regexPatterns.email.test(strValue)) return 'Email';
  
  // Phone Number (basic detection)
  if (regexPatterns.phoneNumber.test(strValue) && !strValue.includes('-')) return 'Phone Number';
  
  // Credit Card - changed to String to match DataType
  if (regexPatterns.creditCard.test(strValue) && passesLuhnCheck(strValue)) return 'String';
  
  // URL detection
  if (regexPatterns.url.test(strValue)) return 'String';
  
  // SSN detection
  if (regexPatterns.ssn.test(strValue)) return 'String';
  
  // Zip/Postal Codes
  if (regexPatterns.zipCodeIndia.test(strValue) || regexPatterns.zipCodeUS.test(strValue)) return 'Postal Code';
  
  // Date with Time
  if (regexPatterns.dateTime.test(strValue)) return 'Date Time';
  
  // Time
  if (regexPatterns.time.test(strValue)) return 'Time';
  
  // IP Address
  if (regexPatterns.ipv4.test(strValue)) return 'String';
  
  // Currency - changed to Float to match DataType
  if (regexPatterns.currency.test(strValue)) return 'Float';

  // Name (simple check)
  if (regexPatterns.name.test(strValue) && strValue.length < 40) {
    if (strValue.includes(' ')) return 'Name';
    return 'Name';
  }
  
  // Gender
  if (regexPatterns.gender.test(strValue)) return 'Gender';
  
  // Default to string if no other types match
  return strValue.length > 100 ? 'Text' : 'String';
};

// Enhanced column name based type inference with more patterns
export const inferTypeFromColumnName = (columnName: string): DataType | null => {
  const name = columnName.toLowerCase();
  
  // Username pattern (must be before Name patterns)
  if (/^username$/.test(name)) return 'String';
  
  // Email patterns
  if (/email|e-mail|mail\b|email_?address/.test(name)) return 'Email';
  
  // Phone number patterns
  if (/phone|mobile|contact|cell|tel|fax|tele|number/.test(name)) return 'Phone Number';
  
  // Name patterns (exclude username)
  if (
    /^name$/.test(name) ||
    /full.?name/.test(name) ||
    /customer.?name/.test(name) ||
    /person/.test(name) ||
    /display.?name/.test(name)
  ) return 'Name';
  if (/first.?name|given.?name|fname|forename/.test(name)) return 'Name';
  if (/last.?name|family.?name|surname|lname/.test(name)) return 'Name';
  
  // Location patterns
  if (/address|location|residence|street|addr/.test(name)) return 'Address';
  if (/city|town|municipality/.test(name)) return 'City';
  if (/state|province|region/.test(name)) return 'State';
  if (/country|nation/.test(name)) return 'Country';
  
  // Enhanced postal code patterns - now includes pincode and all variations
  if (/zip|postal|pin.?code|pincode|zipcode|postcode/.test(name)) return 'Postal Code';
  
  // Personal information
  if (/gender|sex/.test(name)) return 'Gender';
  if (/dob|birth|born|birthdate|birthday|age/.test(name)) return 'Date of birth';
  if (/ssn|social.?security|tax.?id|identifier/.test(name)) return 'String';
  if (/marital|relationship/.test(name)) return 'String';
  
  // URL and web related
  if (/url|link|website|web.?site|site|domain/.test(name)) return 'String';
  
  // Date and time patterns
  if (/date$|_date|date_|created|updated|timestamp/.test(name)) return 'Date';
  if (/time$|_time|hour|minute|second/.test(name)) return 'Time';
  if (/datetime|timestamp/.test(name)) return 'Date Time';
  
  // Financial patterns
  if (/credit.?card|debit.?card|card.?number|cc.?number|ccnum|payment.?card/.test(name)) return 'String';
  if (/price|cost|amount|salary|income|pay|fee|charge|money|dollar|euro|rupee|pound|yen/.test(name)) return 'Float';
  
  // Organization patterns
  if (/company|organization|business|employer|corp|firm/.test(name)) return 'Company';
  if (/job|position|title|role|occupation|designation/.test(name)) return 'String';
  
  // Boolean patterns
  if (/active|enabled|status|flag|is.?|has.?|should.?|can.?|allow|approve/.test(name)) return 'Bool';
  
  // Numeric patterns
  if (/count|number|qty|quantity|total|sum|amount|num/.test(name) && !(/phone|contact|cell|tel/.test(name))) return 'Int';
  if (/percent|ratio|rate|average|avg|decimal|float|double/.test(name)) return 'Float';
  
  // Other common patterns
  if (/password|pwd|pass/.test(name)) return 'Password';
  if (/agent|browser|useragent/.test(name)) return 'String';
  if (/year|yyyy/.test(name)) return 'Year';
  if (/timezone|tz/.test(name)) return 'String';
  if (/comment|description|notes|details|text|content|message|feedback|info|about/.test(name)) return 'Text';
  if (/id$|_id|^id_|uuid|guid/.test(name)) return 'String';
  
  return null;
};

// Advanced column data type detection with improved confidence scoring
export const detectColumnDataType = (samples: string[], columnName: string = ''): DataType => {
  // Only consider values up to the last non-empty cell
  let lastNonEmptyIdx = -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i] && samples[i].toString().trim() !== '') {
      lastNonEmptyIdx = i;
      break;
    }
  }
  const consideredSamples = lastNonEmptyIdx >= 0 ? samples.slice(0, lastNonEmptyIdx + 1) : [];

  // Remove empty samples, trim, and deduplicate
  const validSamples = Array.from(new Set(consideredSamples.map(s => (s || '').trim()).filter(Boolean)));
  if (validSamples.length === 0) return 'Unknown';

  // 0. ULTIMATE numeric check - if ALL samples are numeric, classify as numeric type
  const allNumericSamples = validSamples.every(v => !isNaN(Number(v)) && v.trim() !== '');
  if (allNumericSamples) {
    const allIntegerSamples = validSamples.every(v => Number.isInteger(Number(v)));
    if (allIntegerSamples) {
      return 'Int';
    } else {
      return 'Float';
    }
  }

  // 1. Robust Int detection FIRST - improved logic
  const allNumeric = validSamples.every(v => !isNaN(Number(v)));
  const allIntegers = validSamples.every(v => !isNaN(Number(v)) && Number.isInteger(Number(v)));
  
  if (allIntegers) {
    return 'Int';
  }
  
  // 2. Robust Float detection
  if (allNumeric && validSamples.some(v => !Number.isInteger(Number(v)))) {
    return 'Float';
  }

  // 3. Boolean detection
  const boolSet = new Set(['true', 'false', '0', '1']);
  if (validSamples.every(v => boolSet.has(v.toLowerCase()))) {
    return 'Bool';
  }

  // 4. Date detection
  if (validSamples.every(v => !isNaN(Date.parse(v)))) {
    return 'Date';
  }

  // 5. Enhanced numeric detection for mixed content
  const numericCount = validSamples.filter(v => !isNaN(Number(v))).length;
  const integerCount = validSamples.filter(v => !isNaN(Number(v)) && Number.isInteger(Number(v))).length;
  
  // If majority are numeric, prioritize numeric types
  if (numericCount / validSamples.length >= 0.8) {
    if (integerCount / validSamples.length >= 0.8) {
      return 'Int';
    } else {
      return 'Float';
    }
  }

  // 6. Fallback to name-based inference and confidence scoring
  const nameBasedType = inferTypeFromColumnName(columnName);
  if (nameBasedType) {
    // Validate the inferred type with sample data
    const sampleValidation = samples.some(sample => {
      if (!sample || sample.trim() === '') return false;
      switch (nameBasedType) {
        case 'Email':
          return regexPatterns.email.test(sample);
        case 'Phone Number':
          return regexPatterns.phoneNumber.test(sample);
        case 'Date':
        case 'Date of birth':
          return (
            regexPatterns.date1.test(sample) ||
            regexPatterns.date2.test(sample) ||
            regexPatterns.date3.test(sample) ||
            regexPatterns.date4.test(sample) ||
            regexPatterns.date5.test(sample)
          );
        case 'Float':
          return regexPatterns.currency.test(sample) || /^[\d,.]+$/.test(sample);
        case 'Int':
          return regexPatterns.int.test(sample);
        case 'Bool':
          return regexPatterns.bool.test(sample);
        default:
          return true; // For types without specific validation
      }
    });
    if (sampleValidation || samples.length === 0) {
      return nameBasedType;
    }
  }

  // 7. Content-based detection with improved numeric handling
  if (samples.length === 0) return 'Unknown';

  // Count occurrences of each data type with confidence scoring
  const typeCounts: Record<DataType, number> = {} as Record<DataType, number>;
  const typeConfidence: Record<DataType, number> = {} as Record<DataType, number>;
  const typePriority: Record<string, number> = {
    'Email': 1.5,
    'Phone Number': 1.3,  
    'Date': 1.3,
    'Date of birth': 1.3,
    'Date Time': 1.3,
    'Int': 1.2, // Increased priority for Int
    'Float': 1.1, // Increased priority for Float
    'Name': 1.2,
    'Address': 1.2,
    'String': 0.5
  };
  
  validSamples.forEach(sample => {
    const type = detectDataType(sample);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    const priority = typePriority[type] || 1.0;
    typeConfidence[type] = (typeConfidence[type] || 0) + priority;
  });
  
  let maxConfidence = 0;
  let mostConfidentType: DataType = 'Unknown';
  Object.entries(typeConfidence).forEach(([type, confidence]) => {
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      mostConfidentType = type as DataType;
    }
  });
  
  const typePercentage = typeCounts[mostConfidentType] / validSamples.length;
  const allTypes = Object.keys(typeCounts);
  
  // 8. Enhanced numeric type handling
  if (allTypes.length === 1) {
    return allTypes[0] as DataType;
  }
  
  if (allTypes.length === 2 && allTypes.includes('Int') && allTypes.includes('Float')) {
    return 'Float';
  }
  
  if (allTypes.length === 1 && allTypes[0] === 'Bool') {
    return 'Bool';
  }
  
  // 9. Improved numeric detection for mixed content
  if (typePercentage < 0.6 || mostConfidentType === 'Unknown') {
    const numericTypes = ['Int', 'Float'];
    const totalNumeric = numericTypes.reduce((sum, type) => sum + (typeCounts[type as DataType] || 0), 0);
    
    if (totalNumeric / validSamples.length > 0.6) { // Lowered threshold for better detection
      if (typeCounts['Float'] && typeCounts['Int']) {
        return 'Float';
      }
      if (typeCounts['Int'] && !typeCounts['Float']) {
        return 'Int';
      }
      if (typeCounts['Float'] && !typeCounts['Int']) {
        return 'Float';
      }
    }
    
    if ((typeCounts['Bool'] || 0) / validSamples.length > 0.7) {
      return 'Bool';
    }
    
    const dateTypes = ['Date', 'Date Time', 'Time', 'Date of birth'];
    const totalDates = dateTypes.reduce((sum, type) => sum + (typeCounts[type as DataType] || 0), 0);
    if (totalDates / validSamples.length > 0.5) {
      return 'Date';
    }
    
    // 10. Final numeric check before defaulting to String
    const finalNumericCount = validSamples.filter(v => !isNaN(Number(v))).length;
    if (finalNumericCount / validSamples.length > 0.5) {
      const finalIntegerCount = validSamples.filter(v => !isNaN(Number(v)) && Number.isInteger(Number(v))).length;
      if (finalIntegerCount / finalNumericCount > 0.8) {
        return 'Int';
      } else {
        return 'Float';
      }
    }
    
    return 'String';
  }
  
  if (/credit.?card|debit.?card|card.?number|cc.?number|ccnum|payment.?card/i.test(columnName)) {
    return 'String';
  }
  
  // FINAL strict integer check: if all values match integer regex, return 'Int'
  if (validSamples.length > 0 && validSamples.every(v => regexPatterns.int.test(v))) {
    return 'Int';
  }

  return mostConfidentType;
};

// Parse CSV data
export const parseCSV = (csvText: string): { headers: string[], rows: Record<string, string>[] } => {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  const rows = lines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = line.split(',').map(value => value.trim());
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      return row;
    });
  
  return { headers, rows };
};

/**
 * UI-facing data type detection for a column of values.
 * Returns one of: 'Int', 'Float', 'Boolean', 'Date', 'String'.
 * - Trims, removes empty/null, deduplicates values.
 * - Int: all unique values are valid integers (!isNaN(Number(val)) && Number.isInteger(Number(val))).
 * - Float: all unique values are numeric and at least one is not integer.
 * - Boolean: all unique values are one of: 'true', 'false', '0', '1' (case-insensitive).
 * - Date: all unique values pass !isNaN(Date.parse(val)).
 * - String: default if none of the above apply.
 */
export function detectColumnTypeUI(values: string[]): 'Int' | 'Float' | 'Boolean' | 'Date' | 'String' {
  const unique = Array.from(new Set(values.map(v => (v || '').trim()).filter(Boolean)));
  if (unique.length === 0) return 'String';

  if (unique.every(v => !isNaN(Number(v)) && Number.isInteger(Number(v)))) return 'Int';
  if (unique.every(v => !isNaN(Number(v))) && unique.some(v => !Number.isInteger(Number(v)))) return 'Float';
  const boolSet = new Set(['true', 'false', '0', '1']);
  if (unique.every(v => boolSet.has(v.toLowerCase()))) return 'Boolean';
  if (unique.every(v => !isNaN(Date.parse(v)))) return 'Date';
  return 'String';
}
