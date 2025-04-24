
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

// Detect data type from a column of data
export const detectColumnDataType = (samples: string[]): DataType => {
  if (samples.length === 0) return 'Unknown';
  
  // Count occurrences of each data type
  const typeCounts: Record<DataType, number> = {} as Record<DataType, number>;
  
  samples.forEach(sample => {
    const type = detectDataType(sample);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  // Find the most common data type
  let maxCount = 0;
  let mostCommonType: DataType = 'Unknown';
  
  Object.entries(typeCounts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonType = type as DataType;
    }
  });
  
  // If most values are unknown, try to infer from column name
  return mostCommonType;
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
