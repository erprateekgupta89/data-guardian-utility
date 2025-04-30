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
  
  // Email
  if (regexPatterns.email.test(strValue)) return 'Email';
  
  // Phone Number (basic detection)
  if (regexPatterns.phoneNumber.test(strValue) && !strValue.includes('-')) return 'Phone Number';
  
  // Credit Card
  if (regexPatterns.creditCard.test(strValue) && passesLuhnCheck(strValue)) return 'Credit card number';
  
  // URL detection
  if (regexPatterns.url.test(strValue)) return 'String';
  
  // SSN detection
  if (regexPatterns.ssn.test(strValue)) return 'String';
  
  // Zip/Postal Codes
  if (regexPatterns.zipCodeIndia.test(strValue) || regexPatterns.zipCodeUS.test(strValue)) return 'Postal Code';
  
  // Dates
  if (
    regexPatterns.date1.test(strValue) || 
    regexPatterns.date2.test(strValue) || 
    regexPatterns.date3.test(strValue)
  ) return 'Date';
  
  // Date with Time
  if (regexPatterns.dateTime.test(strValue)) return 'Date Time';
  
  // Time
  if (regexPatterns.time.test(strValue)) return 'Time';
  
  // IP Address
  if (regexPatterns.ipv4.test(strValue)) return 'String';
  
  // Currency
  if (regexPatterns.currency.test(strValue)) return 'Currency';

  // Boolean
  if (regexPatterns.bool.test(strValue)) return 'Bool';
  
  // Numbers
  if (regexPatterns.int.test(strValue)) return 'Int';
  if (regexPatterns.float.test(strValue)) return 'Float';
  
  // Name (simple check)
  if (regexPatterns.name.test(strValue) && strValue.length < 40) {
    if (strValue.includes(' ')) return 'Name';
    return 'First Name';
  }
  
  // Gender
  if (regexPatterns.gender.test(strValue)) return 'Gender';
  
  // Default to string if no other types match
  return strValue.length > 100 ? 'Text' : 'String';
};

// Enhanced column name based type inference with more patterns
export const inferTypeFromColumnName = (columnName: string): DataType | null => {
  const name = columnName.toLowerCase();
  
  // Email patterns
  if (/email|e-mail|mail\b|email_?address/.test(name)) return 'Email';
  
  // Phone number patterns
  if (/phone|mobile|contact|cell|tel|fax|tele|number/.test(name)) return 'Phone Number';
  
  // Name patterns
  if (/^name$|full.?name|customer.?name|person|name.?|display.?name|user.?name/.test(name)) return 'Name';
  if (/first.?name|given.?name|fname|forename/.test(name)) return 'First Name';
  if (/last.?name|family.?name|surname|lname/.test(name)) return 'Last Name';
  
  // Location patterns
  if (/address|location|residence|street|addr/.test(name)) return 'Address';
  if (/city|town|municipality/.test(name)) return 'City';
  if (/state|province|region/.test(name)) return 'State';
  if (/country|nation/.test(name)) return 'Country';
  if (/zip|postal|pin.?code/.test(name)) return 'Postal Code';
  
  // Personal information
  if (/gender|sex/.test(name)) return 'Gender';
  if (/dob|birth|born|birthdate|birthday|age/.test(name)) return 'Date of birth';
  if (/ssn|social.?security|tax.?id|identifier/.test(name)) return 'String';
  
  // URL and web related
  if (/url|link|website|web.?site|site|domain/.test(name)) return 'String';
  
  // Date and time patterns
  if (/date$|_date|date_|created|updated|timestamp/.test(name)) return 'Date';
  if (/time$|_time|hour|minute|second/.test(name)) return 'Time';
  if (/datetime|timestamp/.test(name)) return 'Date Time';
  
  // Financial patterns
  if (/credit.?card|card.?number|cc.?number|ccnum|payment.?card/.test(name)) return 'Credit card number';
  if (/price|cost|amount|salary|income|pay|fee|charge|money|dollar|euro|rupee|pound|yen/.test(name)) return 'Currency';
  
  // Organization patterns
  if (/company|organization|business|employer|corp|firm/.test(name)) return 'Company';
  if (/job|position|title|role|occupation|designation/.test(name)) return 'Job';
  
  // Boolean patterns
  if (/active|enabled|status|flag|is.?|has.?|should.?|can.?|allow|approve/.test(name)) return 'Bool';
  
  // Numeric patterns
  if (/count|number|qty|quantity|total|sum|amount|num/.test(name) && !(/phone|contact|cell|tel/.test(name))) return 'Int';
  if (/percent|ratio|rate|average|avg|decimal|float|double/.test(name)) return 'Float';
  
  // Other common patterns
  if (/password|pwd|pass/.test(name)) return 'Password';
  if (/agent|browser|useragent/.test(name)) return 'User agent';
  if (/year|yyyy/.test(name)) return 'Year';
  if (/timezone|tz/.test(name)) return 'Timezone';
  if (/comment|description|notes|details|text|content|message|feedback|info|about/.test(name)) return 'Text';
  if (/id$|_id|^id_|uuid|guid/.test(name)) return 'String';
  
  return null;
};

// Advanced column data type detection with improved confidence scoring
export const detectColumnDataType = (samples: string[], columnName: string = ''): DataType => {
  // First try to infer from column name
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
          return regexPatterns.date1.test(sample) || 
                 regexPatterns.date2.test(sample) || 
                 regexPatterns.date3.test(sample);
        case 'Currency':
          return regexPatterns.currency.test(sample) || /^[\d,.]+$/.test(sample);
        case 'Int':
          return regexPatterns.int.test(sample);
        case 'Float':
          return regexPatterns.float.test(sample);
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

  // If name-based inference fails or validation fails, fall back to content-based detection
  if (samples.length === 0) return 'Unknown';
  
  // Remove empty samples
  const validSamples = samples.filter(s => s && s.trim() !== '');
  if (validSamples.length === 0) return 'Unknown';
  
  // Count occurrences of each data type with confidence scoring
  const typeCounts: Record<DataType, number> = {} as Record<DataType, number>;
  const typeConfidence: Record<DataType, number> = {} as Record<DataType, number>;
  
  // Priority weights for different data types
  const typePriority = {
    'Email': 1.5,
    'Credit card number': 1.5,
    'Phone Number': 1.3,
    'Date': 1.3,
    'Date of birth': 1.3,
    'Date Time': 1.3,
    'Currency': 1.2,
    'Name': 1.2,
    'Address': 1.2,
    'Int': 0.7,
    'Float': 0.8,
    'String': 0.5
  };
  
  validSamples.forEach(sample => {
    const type = detectDataType(sample);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    
    // Apply priority weights
    const priority = (typePriority as any)[type] || 1.0;
    typeConfidence[type] = (typeConfidence[type] || 0) + priority;
  });
  
  // Find the most confident data type
  let maxConfidence = 0;
  let mostConfidentType: DataType = 'Unknown';
  
  Object.entries(typeConfidence).forEach(([type, confidence]) => {
    if (confidence > maxConfidence) {
      maxConfidence = confidence;
      mostConfidentType = type as DataType;
    }
  });
  
  // Calculate percentage of samples matching the most confident type
  const typePercentage = typeCounts[mostConfidentType] / validSamples.length;
  
  // If the confidence is low, fall back to more general types based on data pattern
  if (typePercentage < 0.6 || mostConfidentType === 'Unknown') {
    // Check if numeric values are predominant
    const numericTypes = ['Int', 'Float', 'Currency'];
    const totalNumeric = numericTypes.reduce((sum, type) => sum + (typeCounts[type as DataType] || 0), 0);
    
    if (totalNumeric / validSamples.length > 0.7) {
      return 'Float'; // Default to Float for mixed numeric data
    }
    
    // Check if date-like values are predominant
    const dateTypes = ['Date', 'Date Time', 'Time', 'Date of birth'];
    const totalDates = dateTypes.reduce((sum, type) => sum + (typeCounts[type as DataType] || 0), 0);
    
    if (totalDates / validSamples.length > 0.5) {
      return 'Date'; // Default to Date for mixed date-like data
    }
    
    // Default to String for mixed data
    return 'String';
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
