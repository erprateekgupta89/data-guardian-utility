import { ColumnInfo, DataType } from "@/types";
import { randomString, randomNumber, getUniqueValues, getRandomSample } from "./maskingHelpers";
import { maskPersonalInfo, maskLocationData, maskDateTime } from "./dataTypeMasking";

// Mask data based on its type and original format
export const maskData = (value: string, dataType: DataType, originalFormat?: string, constantValues?: string[]): string => {
  if (!value || value.trim() === '') return value;
  
  // If constant values are provided, use them instead of generating new values
  if (constantValues?.length) {
    return constantValues[Math.floor(Math.random() * constantValues.length)];
  }

  switch(dataType) {
    case 'Email': {
      const parts = value.split('@');
      if (parts.length !== 2) return `user_${randomString(5)}@example.com`;
      
      // Preserve domain if possible for more realistic masking
      const domainParts = parts[1].split('.');
      const tld = domainParts.pop() || 'com';
      
      // Generate username part with similar length to original
      const usernameLength = Math.max(5, parts[0].length);
      
      // Check if original has any patterns like dots, underscores, etc.
      const hasDot = parts[0].includes('.');
      const hasUnderscore = parts[0].includes('_');
      
      let maskedUsername = '';
      if (hasDot) {
        // Generate firstname.lastname pattern
        maskedUsername = `${randomString(4)}.${randomString(5)}`;
      } else if (hasUnderscore) {
        // Generate first_last pattern
        maskedUsername = `${randomString(4)}_${randomString(5)}`;
      } else {
        maskedUsername = randomString(usernameLength);
      }
      
      // Keep the original domain structure (company.com, etc.)
      if (domainParts.length > 0) {
        return `${maskedUsername}@${randomString(domainParts.length * 3)}.${tld}`;
      } else {
        return `${maskedUsername}@example.${tld}`;
      }
    }
    
    case 'Phone Number': {
      const digitsOnly = value.replace(/\D/g, '');
      let format = value.replace(/\d/g, '#');
      
      // Check for country code pattern
      if (value.startsWith('+')) {
        const parts = value.split(' ');
        const countryCode = parts[0];
        const remainingDigits = digitsOnly.length - countryCode.replace(/\D/g, '').length;
        
        // Generate random digits matching the length of the original phone number
        const randomDigits = Array(remainingDigits)
          .fill(0)
          .map(() => randomNumber(0, 9))
          .join('');
          
        return `${countryCode} ${randomDigits}`;
      }
      
      // Generate masked value that preserves the exact format of the original
      const randomDigits = Array(digitsOnly.length)
        .fill(0)
        .map(() => randomNumber(0, 9))
        .join('');
      
      let maskedValue = '';
      let digitIndex = 0;
      
      for (let i = 0; i < format.length; i++) {
        if (format[i] === '#') {
          maskedValue += randomDigits[digitIndex++] || randomNumber(0, 9);
        } else {
          maskedValue += format[i];
        }
      }
      
      return maskedValue;
    }

    case 'Credit card number': {
      const digitsOnly = value.replace(/\D/g, '');
      const format = value.replace(/\d/g, '#');
      
      // Generate a valid credit card number
      // First, identify the card type based on first digits
      let prefix = '';
      
      // Common credit card prefixes
      if (digitsOnly.startsWith('4')) {
        prefix = '4'; // Visa
      } else if (digitsOnly.startsWith('5')) {
        prefix = '5' + randomNumber(1, 5); // Mastercard
      } else if (digitsOnly.startsWith('3')) {
        prefix = '3' + (Math.random() > 0.5 ? '4' : '7'); // Amex
      } else if (digitsOnly.startsWith('6')) {
        prefix = '6' + randomNumber(0, 9); // Discover/other
      } else {
        prefix = randomNumber(3, 6).toString(); // Generic
      }
      
      // Generate the rest of the number
      let randomDigits = prefix;
      for (let i = prefix.length; i < digitsOnly.length - 1; i++) {
        randomDigits += randomNumber(0, 9);
      }
      
      // Calculate Luhn checksum for the last digit
      let sum = 0;
      let double = false;
      for (let i = randomDigits.length - 1; i >= 0; i--) {
        let digit = parseInt(randomDigits[i]);
        if (double) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
      }
      
      const checkDigit = (10 - (sum % 10)) % 10;
      randomDigits += checkDigit;
      
      // Format according to original pattern
      let maskedValue = '';
      let digitIndex = 0;
      
      for (let i = 0; i < format.length; i++) {
        if (format[i] === '#') {
          maskedValue += randomDigits[digitIndex++] || randomNumber(0, 9);
        } else {
          maskedValue += format[i];
        }
      }
      
      return maskedValue;
    }
    
    case 'Name':
    case 'First Name':
    case 'Last Name':
      return maskPersonalInfo(value, dataType);
    
    case 'Address':
    case 'City':
    case 'State':
    case 'Country':
      return maskLocationData(value, dataType);
    
    case 'Date':
    case 'Date of birth':
    case 'Time':
    case 'Date Time':
      return maskDateTime(value, dataType);
    
    case 'Postal Code':
    case 'Zipcode': {
      // Detect format and preserve it
      if (/^\d{5}(-\d{4})?$/.test(value)) { // US format
        if (value.includes('-')) {
          return `${randomNumber(10000, 99999)}-${randomNumber(1000, 9999)}`;
        }
        return randomNumber(10000, 99999).toString();
      } else if (/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(value)) { // Canadian format
        // Generate random Canadian postal code
        const letters = 'ABCEGHJKLMNPRSTVXY';
        const letter1 = letters[Math.floor(Math.random() * letters.length)];
        const letter2 = letters[Math.floor(Math.random() * letters.length)];
        const letter3 = letters[Math.floor(Math.random() * letters.length)];
        return `${letter1}${randomNumber(0, 9)}${letter2} ${randomNumber(0, 9)}${letter3}${randomNumber(0, 9)}`;
      } else if (/^\d{6}$/.test(value)) { // 6-digit format (many countries)
        return randomNumber(100000, 999999).toString();
      }
      
      // Fallback: preserve the exact format of the original zipcode
      return value.replace(/\d/g, () => randomNumber(0, 9).toString())
                  .replace(/[a-z]/gi, (c) => {
                    const isUpper = c === c.toUpperCase();
                    const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
                    return isUpper ? randomChar.toUpperCase() : randomChar;
                  });
    }
    
    case 'Currency': {
      // Extract currency symbol and format
      const currencySymbol = value.match(/[$€£¥₹]/)?.[0] || '';
      const hasCommas = value.includes(',');
      const decimalParts = value.replace(/[$€£¥₹,]/g, '').split('.');
      
      // Generate random amount with similar magnitude
      const originalAmount = parseFloat(value.replace(/[$€£¥₹,]/g, ''));
      const magnitude = Math.floor(Math.log10(originalAmount)) - 1;
      const lowerBound = Math.max(1, 10 ** magnitude);
      const upperBound = Math.min(10 ** (magnitude + 2), 1000000);
      let maskedAmount = randomNumber(lowerBound, upperBound);
      
      // Format with same decimal precision
      let formattedAmount = maskedAmount.toString();
      if (decimalParts.length > 1) {
        const decimalPlaces = decimalParts[1].length;
        formattedAmount = maskedAmount.toFixed(decimalPlaces);
      }
      
      // Add commas if original had them
      if (hasCommas) {
        const parts = formattedAmount.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        formattedAmount = parts.join('.');
      }
      
      // Add currency symbol in same position
      if (currencySymbol) {
        if (value.startsWith(currencySymbol)) {
          return `${currencySymbol}${formattedAmount}`;
        } else {
          return `${formattedAmount}${currencySymbol}`;
        }
      }
      
      return formattedAmount;
    }
    
    case 'Int': {
      const num = parseInt(value);
      // Generate random number of similar magnitude
      const magnitude = Math.floor(Math.log10(num));
      const lowerBound = Math.max(1, 10 ** magnitude);
      const upperBound = 10 ** (magnitude + 1);
      
      return randomNumber(lowerBound, upperBound).toString();
    }
    
    case 'Float': {
      const num = parseFloat(value);
      // Get the number of decimal places
      const decimalPlaces = (value.split('.')[1] || '').length;
      
      // Generate random number of similar magnitude
      const magnitude = Math.floor(Math.log10(Math.abs(num)));
      const lowerBound = 10 ** magnitude * 0.5;
      const upperBound = 10 ** (magnitude + 1) * 1.5;
      
      const maskedNum = lowerBound + Math.random() * (upperBound - lowerBound);
      return maskedNum.toFixed(decimalPlaces);
    }
    
    case 'Bool': {
      // Try to preserve the exact format (true/false, yes/no, 0/1, etc.)
      if (/^(true|false)$/i.test(value)) {
        return Math.random() > 0.5 ? 'true' : 'false';
      } else if (/^(yes|no)$/i.test(value)) {
        return Math.random() > 0.5 ? 'yes' : 'no';
      } else if (/^(0|1)$/.test(value)) {
        return Math.random() > 0.5 ? '1' : '0';
      }
      
      return Math.random() > 0.5 ? 'true' : 'false';
    }
    
    case 'Gender': {
      // Preserve the exact format (Male/Female, M/F, etc.)
      if (/^(m|f)$/i.test(value)) {
        return Math.random() > 0.5 ? (value === value.toUpperCase() ? 'M' : 'm') : 
                                     (value === value.toUpperCase() ? 'F' : 'f');
      } else if (/^(male|female)$/i.test(value)) {
        const genderText = Math.random() > 0.5 ? 'male' : 'female';
        return value === value.toUpperCase() ? genderText.toUpperCase() : 
               value[0] === value[0].toUpperCase() ? genderText.charAt(0).toUpperCase() + genderText.slice(1) : 
               genderText;
      } else {
        const genders = ['Male', 'Female', 'Other', 'Non-binary', 'Prefer not to say'];
        return genders[Math.floor(Math.random() * genders.length)];
      }
    }
    
    case 'Company': {
      const companies = [
        'Acme Corp', 'Globex', 'Initech', 'Umbrella Corp', 'Stark Industries',
        'Wayne Enterprises', 'Cyberdyne Systems', 'Soylent Corp', 'Massive Dynamic',
        'Oceanic Airlines', 'Weyland-Yutani', 'Tyrell Corp', 'Rekall', 'Monsters Inc',
        'Dunder Mifflin', 'Sterling Cooper', 'Los Pollos Hermanos', 'InGen'
      ];
      
      // Preserve capitalization pattern
      const company = companies[Math.floor(Math.random() * companies.length)];
      if (value === value.toUpperCase()) {
        return company.toUpperCase();
      } else if (value === value.toLowerCase()) {
        return company.toLowerCase();
      }
      
      return company;
    }
    
    case 'Job': {
      const jobs = [
        'Software Engineer', 'Project Manager', 'Marketing Specialist', 
        'Data Analyst', 'HR Manager', 'Financial Advisor', 'Product Designer',
        'Sales Representative', 'Content Writer', 'Customer Support',
        'Business Analyst', 'DevOps Engineer', 'UX Researcher', 'IT Specialist',
        'Account Executive', 'Operations Manager', 'Quality Assurance Analyst'
      ];
      
      // Preserve capitalization pattern
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      if (value === value.toUpperCase()) {
        return job.toUpperCase();
      } else if (value === value.toLowerCase()) {
        return job.toLowerCase();
      }
      
      return job;
    }
    
    case 'Password':
      return '*'.repeat(value.length);
    
    case 'Timezone': {
      // Try to preserve the format (UTC+x, GMT-x, etc.)
      if (/^(UTC|GMT)[+-]\d+(:?\d+)?$/.test(value)) {
        const prefix = value.startsWith('UTC') ? 'UTC' : 'GMT';
        const sign = Math.random() > 0.5 ? '+' : '-';
        const hours = randomNumber(0, 12);
        const hasMinutes = value.includes(':');
        
        if (hasMinutes) {
          const minutes = [0, 30, 45][Math.floor(Math.random() * 3)];
          return `${prefix}${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
        }
        
        return `${prefix}${sign}${hours}`;
      }
      
      const timezones = [
        'UTC+0', 'UTC-5', 'UTC+1', 'UTC+5:30', 'UTC-8', 'UTC+8', 'UTC+9', 'UTC+10',
        'UTC-3', 'UTC+3', 'GMT+0', 'GMT-5', 'GMT+1', 'GMT+5:30', 'GMT-8'
      ];
      
      return timezones[Math.floor(Math.random() * timezones.length)];
    }
    
    case 'Text':
    case 'String':
    default: {
      // For short strings, generate random string of same length
      if (value.length <= 10) {
        return randomString(value.length);
      }
      
      // For longer text, use lorem ipsum with similar length
      const loremIpsum = [
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
        "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
      ].join(' ');
      
      if (value.length > loremIpsum.length) {
        // For very long text, repeat lorem ipsum
        return loremIpsum.repeat(Math.ceil(value.length / loremIpsum.length)).substring(0, value.length);
      }
      
      return loremIpsum.substring(0, value.length);
    }
  }
};

// Process and mask all data
export const maskDataSet = (
  data: Record<string, string>[],
  columns: ColumnInfo[]
): Record<string, string>[] => {
  // If data has more than 1000 rows, take a random sample of 100 rows
  const workingData = data.length > 1000 ? getRandomSample(data, 100) : data;
  
  // Get unique values for each column
  const columnUniqueValues: Record<string, string[]> = {};
  columns.forEach(column => {
    // Only get unique values if the column has less than 20 unique values
    // This helps identify columns with constant/fixed values
    const uniqueValues = getUniqueValues(workingData, column.name);
    if (uniqueValues.length < 20) {
      columnUniqueValues[column.name] = uniqueValues;
    }
  });
  
  // Create consistent replacements for columns
  // This ensures the same original value always maps to the same masked value within a dataset
  const consistentReplacements: Record<string, Record<string, string>> = {};
  
  columns.forEach(column => {
    if (!column.skip && columnUniqueValues[column.name]) {
      const uniqueValues = columnUniqueValues[column.name];
      consistentReplacements[column.name] = {};
      
      uniqueValues.forEach(value => {
        if (value && value.trim() !== '') {
          consistentReplacements[column.name][value] = maskData(
            value, 
            column.dataType,
            value
          );
        }
      });
    }
  });
  
  return workingData.map(row => {
    const maskedRow: Record<string, string> = {};
    
    columns.forEach(column => {
      if (column.skip) {
        maskedRow[column.name] = row[column.name];
      } else {
        const originalValue = row[column.name];
        
        // If this is a value we've seen before, use the consistent replacement
        if (consistentReplacements[column.name] && consistentReplacements[column.name][originalValue]) {
          maskedRow[column.name] = consistentReplacements[column.name][originalValue];
        } else {
          // Otherwise generate a new masked value
          maskedRow[column.name] = maskData(
            originalValue, 
            column.dataType,
            originalValue,
            columnUniqueValues[column.name]
          );
          
          // Store for future consistency
          if (consistentReplacements[column.name] && originalValue && originalValue.trim() !== '') {
            consistentReplacements[column.name][originalValue] = maskedRow[column.name];
          }
        }
      }
    });
    
    return maskedRow;
  });
};
