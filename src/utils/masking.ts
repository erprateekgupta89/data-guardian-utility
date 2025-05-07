
import { ColumnInfo, DataType } from "@/types";
import { randomString, randomNumber, getUniqueValues, getRandomSample } from "./maskingHelpers";
import { maskPersonalInfo, maskLocationData, maskDateTime } from "./dataTypeMasking";

// Mask data based on its type and original format
export const maskData = (value: string, dataType: DataType, format?: string, constantValues?: string[]): string => {
  if (!value || value.trim() === '') return value;
  
  // If constant values are provided, use them instead of generating new values
  if (constantValues?.length) {
    return constantValues[Math.floor(Math.random() * constantValues.length)];
  }

  switch(dataType) {
    case 'Email': {
      const parts = value.split('@');
      if (parts.length !== 2) return `user_${randomString(5)}@example.com`;
      const domainParts = parts[1].split('.');
      const tld = domainParts.pop();
      return `user_${randomString(5)}@${randomString(5)}.${tld}`;
    }
    
    case 'Phone Number': {
      const digitsOnly = value.replace(/\D/g, '');
      let format = value.replace(/\d/g, '#');
      
      if (value.startsWith('+')) {
        const countryCode = value.split(' ')[0];
        const randomDigits = Array(digitsOnly.length - countryCode.replace(/\D/g, '').length)
          .fill(0)
          .map(() => randomNumber(0, 9))
          .join('');
        return `${countryCode} ${randomDigits}`;
      }
      
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
      
      let randomDigits = '';
      for (let i = 0; i < digitsOnly.length - 1; i++) {
        randomDigits += randomNumber(0, 9);
      }
      
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
      if (/^\d{5}(-\d{4})?$/.test(value)) {
        if (value.includes('-')) {
          return `${randomNumber(10000, 99999)}-${randomNumber(1000, 9999)}`;
        }
        return randomNumber(10000, 99999).toString();
      } else if (/^\d{6}$/.test(value)) {
        return randomNumber(100000, 999999).toString();
      }
      
      return Array(value.length)
        .fill(0)
        .map(() => randomNumber(0, 9))
        .join('');
    }
    
    case 'Currency': {
      const currencySymbol = value.match(/[$€£¥₹]/)?.[0] || '';
      const amount = parseFloat(value.replace(/[$€£¥₹,]/g, ''));
      const maskedAmount = randomNumber(
        Math.floor(amount * 0.5),
        Math.ceil(amount * 1.5)
      );
      
      if (currencySymbol) {
        if (value.startsWith(currencySymbol)) {
          return `${currencySymbol}${maskedAmount.toLocaleString()}`;
        } else {
          return `${maskedAmount.toLocaleString()}${currencySymbol}`;
        }
      }
      
      return maskedAmount.toLocaleString();
    }
    
    case 'Int': {
      const num = parseInt(value);
      return randomNumber(
        Math.floor(num * 0.5),
        Math.ceil(num * 1.5)
      ).toString();
    }
    
    case 'Float': {
      const num = parseFloat(value);
      const maskedNum = Math.random() * (num * 1.5 - num * 0.5) + num * 0.5;
      const decimalPlaces = (value.split('.')[1] || '').length;
      return maskedNum.toFixed(decimalPlaces);
    }
    
    case 'Bool':
      return Math.random() > 0.5 ? 'true' : 'false';
    
    case 'Gender': {
      const genders = ['Male', 'Female', 'Other'];
      return genders[Math.floor(Math.random() * genders.length)];
    }
    
    case 'Company': {
      const companies = [
        'Acme Corp', 'Globex', 'Initech', 'Umbrella Corp', 'Stark Industries',
        'Wayne Enterprises', 'Cyberdyne Systems', 'Soylent Corp', 'Massive Dynamic'
      ];
      return companies[Math.floor(Math.random() * companies.length)];
    }
    
    case 'Job': {
      const jobs = [
        'Software Engineer', 'Project Manager', 'Marketing Specialist', 
        'Data Analyst', 'HR Manager', 'Financial Advisor', 'Product Designer',
        'Sales Representative', 'Content Writer', 'Customer Support'
      ];
      return jobs[Math.floor(Math.random() * jobs.length)];
    }
    
    case 'Password':
      return '*'.repeat(value.length);
    
    case 'Timezone': {
      const timezones = [
        'UTC+0', 'UTC-5', 'UTC+1', 'UTC+5:30', 'UTC-8', 'UTC+8', 'UTC+9', 'UTC+10',
        'UTC-3', 'UTC+3'
      ];
      return timezones[Math.floor(Math.random() * timezones.length)];
    }
    
    case 'Text':
    case 'String':
    default: {
      if (value.length <= 10) {
        return randomString(value.length);
      }
      
      const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";
      return lorem.substring(0, Math.min(value.length, lorem.length));
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
  
  return workingData.map(row => {
    const maskedRow: Record<string, string> = {};
    
    columns.forEach(column => {
      if (column.skip) {
        // If skip is true, preserve the original data without masking
        maskedRow[column.name] = row[column.name];
      } else {
        // Pass constant values if they exist for this column
        const constantValues = columnUniqueValues[column.name];
        maskedRow[column.name] = maskData(
          row[column.name], 
          column.dataType,
          row[column.name], // Pass original value as format
          constantValues
        );
      }
    });
    
    return maskedRow;
  });
};
