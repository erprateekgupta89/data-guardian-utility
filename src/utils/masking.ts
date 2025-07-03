
import { ColumnInfo, DataType } from "@/types";
import { randomString, randomNumber, getUniqueValues, getRandomSample } from "./maskingHelpers";
import { maskPersonalInfo, maskLocationData, maskDateTime } from "./dataTypeMasking";
import { detectColumnDataType } from "./dataDetection";
import { AzureOpenAIMasking, type AzureOpenAIMaskingOptions } from "./azureOpenAIMasking";

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
      return `user_${randomString(5).toLowerCase()}@${randomString(5).toLowerCase()}.${tld}`;
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
    
    case 'Name':
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
    
    case 'Postal Code': {
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
    
    case 'Password':
      return '*'.repeat(value.length);
    
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

// Interface for masking options
interface MaskingOptions {
  useCountryDropdown?: boolean;
  selectedCountries?: string[];
  useAzureOpenAI?: boolean;
  azureOpenAIConfig?: AzureOpenAIMaskingOptions;
}

// Process and mask all data
export const maskDataSet = async (
  data: Record<string, string>[],
  columns: ColumnInfo[],
  options?: MaskingOptions
): Promise<Record<string, string>[]> => {
  // --- Pre-masking: Re-infer and correct column data types ---
  columns.forEach(col => {
    if (
      col.dataType === 'Postal Code' ||
      col.dataType === 'Unknown' ||
      col.dataType === 'String' ||
      col.dataType === 'Int'
    ) {
      const samples = data.map(row => row[col.name]).filter(Boolean).slice(0, 20);
      const inferred = detectColumnDataType(samples, col.name);
      if (inferred === 'Date' || inferred === 'Date of birth' || inferred === 'Date Time') {
        col.dataType = inferred;
      }
    }
  });
  
  // Use all the data instead of just a sample
  const workingData = data;
  
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

  // Initialize Azure OpenAI masking if enabled
  let azureOpenAIMasking: AzureOpenAIMasking | null = null;
  if (options?.useAzureOpenAI && options?.azureOpenAIConfig) {
    console.log('Initializing Enhanced Azure OpenAI masking system...');
    azureOpenAIMasking = new AzureOpenAIMasking(options.azureOpenAIConfig);
    
    // Find country column for proportional masking
    const countryColumn = columns.find(col => col.name.toLowerCase() === 'country');
    
    // Initialize the enhanced system with the dataset
    await azureOpenAIMasking.initializeForDataset(
      workingData,
      countryColumn?.name
    );
    
    console.log('Enhanced Azure OpenAI system initialized with countries:', azureOpenAIMasking.getLoadedCountries());
  }
  
  return Promise.all(workingData.map(async (row, index) => {
    const maskedRow: Record<string, string> = {};
    
    for (const column of columns) {
      if (column.skip) {
        // If skip is true, preserve the original data without any masking
        maskedRow[column.name] = row[column.name];
      } else if (column.name.toLowerCase() === 'country' && !options?.useCountryDropdown) {
        // If it's a country column and useCountryDropdown is false, use the original country data
        maskedRow[column.name] = maskData(
          row[column.name], 
          column.dataType,
          row[column.name], 
          columnUniqueValues[column.name]
        );
      } else if (column.name.toLowerCase() === 'country' && options?.useCountryDropdown && options?.selectedCountries?.length) {
        // If it's a country column and useCountryDropdown is true, use the selected countries
        const randomIndex = Math.floor(Math.random() * options.selectedCountries.length);
        maskedRow[column.name] = options.selectedCountries[randomIndex];
      } else if (azureOpenAIMasking && ['Address', 'City', 'State', 'Postal Code'].includes(column.dataType)) {
        // Use Enhanced Azure OpenAI for location data if enabled
        try {
          // Determine target country for this row
          let targetCountry = options?.selectedCountries?.[0] || 'United States';
          
          // If there's a country column and we're not using dropdown, use original country
          const countryColumn = columns.find(col => col.name.toLowerCase() === 'country');
          if (countryColumn && !options?.useCountryDropdown) {
            targetCountry = row[countryColumn.name];
          }
          
          maskedRow[column.name] = await azureOpenAIMasking.maskData(
            row[column.name], 
            column.dataType,
            targetCountry
          );
        } catch (error) {
          console.error(`Enhanced Azure OpenAI masking failed for ${column.name} at row ${index}:`, error);
          // Fallback to regular masking
          const constantValues = columnUniqueValues[column.name];
          maskedRow[column.name] = maskData(
            row[column.name], 
            column.dataType,
            row[column.name],
            constantValues
          );
        }
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
    }
    
    return maskedRow;
  }));
};
