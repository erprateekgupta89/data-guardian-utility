
import { ColumnInfo, DataType } from "@/types";
import { randomString, randomNumber, getUniqueValues, getRandomSample } from "./maskingHelpers";
import { maskPersonalInfo, maskLocationData, maskDateTime } from "./dataTypeMasking";
import { detectColumnDataType } from "./dataDetection";
import { AzureOpenAIMasking, type AzureOpenAIMaskingOptions } from "./azureOpenAIMasking";
import { PatternAnalyzer, type PatternAnalysis } from "./patternAnalysis";

// Mask data based on its type and original format
export const maskData = (value: string, dataType: DataType, format?: string, constantValues?: string[], patternAnalysis?: PatternAnalysis, index?: number): string => {
  if (!value || value.trim() === '') return value;
  
  // PRIORITY 1: Check for constant values first - NO sequential numbering for constant data
  if (patternAnalysis?.isConstantValue && patternAnalysis.constantValue) {
    console.log(`Using constant value for ${dataType}: ${patternAnalysis.constantValue}`);
    return patternAnalysis.constantValue;
  }

  // PRIORITY 2: If constant values are provided from unique values, use them instead of generating new values
  if (constantValues?.length) {
    return constantValues[Math.floor(Math.random() * constantValues.length)];
  }
  
  // PRIORITY 3: Use pattern analysis for incremental patterns (e.g., Campaign_1, Campaign_2)
  if (patternAnalysis && patternAnalysis.hasPrefix && typeof index === 'number') {
    const patternAnalyzer = new PatternAnalyzer();
    console.log(`Using pattern analysis for ${dataType}: ${patternAnalysis.prefix} (index: ${index})`);
    return patternAnalyzer.generatePatternBasedValue(patternAnalysis, index);
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

// FIXED: Complete masking solution with perfect country-address alignment AND nationality synchronization
export const maskDataSet = async (
  data: Record<string, string>[],
  columns: ColumnInfo[],
  options?: MaskingOptions
): Promise<Record<string, string>[]> => {
  console.log('=== FIXED: Starting Perfect Country-Address-Nationality Alignment Masking ===');
  console.log(`Data rows: ${data.length}`);
  console.log(`Columns: ${columns.length}`);
  console.log(`Is large dataset (≥100 rows): ${data.length >= 100}`);
  console.log(`Azure OpenAI enabled: ${options?.useAzureOpenAI}`);
  console.log(`Country dropdown enabled: ${options?.useCountryDropdown}`);
  console.log(`Selected countries: ${options?.selectedCountries?.join(', ') || 'None'}`);

  // Dataset size analysis
  const isLargeDataset = data.length >= 100;
  if (isLargeDataset) {
    console.log('🔄 FIXED: Large dataset detected - using enhanced address generation with uniqueness validation');
  }

  // Check if both Country and Nationality columns exist
  const countryColumn = columns.find(col => col.name.toLowerCase() === 'country');
  const nationalityColumn = columns.find(col => col.name.toLowerCase() === 'nationality' || col.dataType === 'Nationality');
  const hasCountryAndNationality = countryColumn && nationalityColumn;
  
  if (hasCountryAndNationality) {
    console.log('🌍 FIXED: Both Country and Nationality columns detected - enabling synchronized nationality derivation');
    console.log(`🔄 FIXED: Country column: "${countryColumn?.name}", Nationality column: "${nationalityColumn?.name}"`);
  }

  // CRITICAL FIX: Ensure proper column processing order for perfect alignment
  const sortedColumns = [...columns];
  
  // Find all geo-related columns
  const geoColumns = sortedColumns.filter(col => 
    ['Address', 'City', 'State', 'Country', 'Postal Code'].includes(col.dataType) ||
    col.name.toLowerCase() === 'country' ||
    col.name.toLowerCase() === 'nationality' ||
    col.dataType === 'Nationality'
  );
  
  // Find non-geo columns
  const nonGeoColumns = sortedColumns.filter(col => !geoColumns.includes(col));
  
  // Sort geo columns in the correct order: Country → Address → City → State → Postal Code → Nationality
  const geoColumnOrder = ['country', 'address', 'city', 'state', 'postal code', 'nationality'];
  const orderedGeoColumns = geoColumns.sort((a, b) => {
    const aOrder = geoColumnOrder.findIndex(type => 
      a.name.toLowerCase().includes(type) || 
      a.dataType.toLowerCase().includes(type) ||
      (type === 'nationality' && a.dataType === 'Nationality')
    );
    const bOrder = geoColumnOrder.findIndex(type => 
      b.name.toLowerCase().includes(type) || 
      b.dataType.toLowerCase().includes(type) ||
      (type === 'nationality' && b.dataType === 'Nationality')
    );
    return aOrder - bOrder;
  });
  
  // Reassemble columns with proper order
  columns.splice(0, columns.length, ...nonGeoColumns, ...orderedGeoColumns);
  
  console.log('✅ FIXED: Column processing order optimized for perfect geo-alignment:');
  columns.forEach((col, idx) => {
    console.log(`  ${idx + 1}. ${col.name} (${col.dataType})`);
  });

  // Re-infer and correct column data types
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
  
  // Get unique values for each column AND analyze patterns for ALL columns
  const columnUniqueValues: Record<string, string[]> = {};
  const columnPatterns: Record<string, PatternAnalysis> = {};
  const patternAnalyzer = new PatternAnalyzer();
  
  columns.forEach(column => {
    // Only get unique values if the column has less than 20 unique values
    const uniqueValues = getUniqueValues(workingData, column.name);
    if (uniqueValues.length < 20) {
      columnUniqueValues[column.name] = uniqueValues;
    }

    // Analyze patterns for ALL columns (including constant value detection)
    const allValues = workingData.map(row => row[column.name]).filter(Boolean);
    columnPatterns[column.name] = patternAnalyzer.analyzeColumnPattern(allValues);
    
    if (columnPatterns[column.name].isConstantValue) {
      console.log(`✅ Constant value detected for ${column.name}: ${columnPatterns[column.name].constantValue}`);
    } else if (columnPatterns[column.name].hasPrefix) {
      console.log(`✅ Pattern detected for ${column.name} (${column.dataType}):`, columnPatterns[column.name]);
    }
  });

  // FIXED: Initialize Enhanced Azure OpenAI masking with perfect alignment
  let azureOpenAIMasking: AzureOpenAIMasking | null = null;
  if (options?.useAzureOpenAI && options?.azureOpenAIConfig) {
    console.log('=== FIXED: Initializing Perfect Country-Address Alignment System ===');
    azureOpenAIMasking = new AzureOpenAIMasking({
      ...options.azureOpenAIConfig,
      preserveDataStructure: true,
      useIntelligentBatching: true,
      useCountryDropdown: options.useCountryDropdown,
      selectedCountries: options.selectedCountries
    });
    
    console.log(`FIXED: Country column found: ${countryColumn?.name || 'None'}`);
    
    // Log Country Selection Logic Decision
    if (options.useCountryDropdown && options.selectedCountries?.length) {
      console.log('=== FIXED: Perfect Country Selection Mode Active ===');
      console.log('FIXED: Will ensure perfect alignment between selected countries and addresses');
    } else if (countryColumn?.name) {
      console.log('=== FIXED: Perfect Geo-Column Mode Active ==='); 
      console.log('FIXED: Will ensure perfect alignment between geo-column values and addresses');
    } else {
      console.log('=== FIXED: Perfect Default Mode Active ===');
      console.log('FIXED: Will use perfect default country-address alignment');
    }
    
    // Initialize the enhanced system with dataset analysis and original data comparison
    console.log('FIXED: Initializing system with uniqueness validation and original data comparison...');
    await azureOpenAIMasking.initializeForDataset(
      workingData,
      columns,
      countryColumn?.name
    );
    
    // Log dataset analysis results
    const analysis = azureOpenAIMasking.getDatasetAnalysis();
    if (analysis) {
      console.log('✅ FIXED: Perfect alignment system initialized:', analysis);
    }
    
    console.log('✅ FIXED: Perfect country-address alignment system ready');
  }
  
  console.log('=== FIXED: Starting perfect row-by-row masking with nationality synchronization ===');
  return Promise.all(workingData.map(async (row, index) => {
    if (index % 50 === 0) {
      console.log(`FIXED: Processing row ${index + 1}/${workingData.length} with perfect alignment and nationality sync`);
    }

    const maskedRow: Record<string, string> = {};
    
    for (const column of columns) {
      if (column.skip) {
        maskedRow[column.name] = row[column.name];
      } else if (column.name.toLowerCase() === 'country') {
        // FIXED: Country column processing with dropdown priority
        if (options?.useCountryDropdown && options?.selectedCountries?.length) {
          // Use dropdown selection with perfect rotation
          const countryIndex = index % options.selectedCountries.length;
          maskedRow[column.name] = options.selectedCountries[countryIndex];
          console.log(`🎯 FIXED: Row ${index} - Dropdown country assignment: ${maskedRow[column.name]}`);
        } else {
          // Use original masking logic for country column
          maskedRow[column.name] = maskData(
            row[column.name], 
            column.dataType,
            row[column.name], 
            columnUniqueValues[column.name],
            columnPatterns[column.name],
            index
          );
          console.log(`🌍 FIXED: Row ${index} - Country masked: ${row[column.name]} → ${maskedRow[column.name]}`);
        }
      } else if (hasCountryAndNationality && (column.name.toLowerCase() === 'nationality' || column.dataType === 'Nationality')) {
        // CRITICAL FIX: Use the ALREADY MASKED country value from the same row
        let maskedCountryValue = '';
        
        if (countryColumn && maskedRow[countryColumn.name]) {
          // CRITICAL: Use the already-masked country value from maskedRow, not original row
          maskedCountryValue = maskedRow[countryColumn.name];
        }
        
        console.log(`🔄 FIXED: Row ${index} - Nationality derivation from MASKED country: ${maskedCountryValue}`);
        
        if (maskedCountryValue && azureOpenAIMasking) {
          console.log(`🌍 FIXED: Row ${index} - Deriving nationality from MASKED country: ${maskedCountryValue}`);
          maskedRow[column.name] = azureOpenAIMasking.deriveNationality(maskedCountryValue);
          console.log(`✅ FIXED: Row ${index} - Synchronized result: Country="${maskedCountryValue}" → Nationality="${maskedRow[column.name]}"`);
        } else {
          // Fallback to regular masking
          console.log(`⚠️ FIXED: Row ${index} - Fallback to regular nationality masking (no masked country available)`);
          maskedRow[column.name] = maskData(
            row[column.name], 
            column.dataType,
            row[column.name],
            columnUniqueValues[column.name],
            columnPatterns[column.name],
            index
          );
        }
      } else if (azureOpenAIMasking && ['Address', 'City', 'State', 'Postal Code'].includes(column.dataType)) {
        // FIXED: Use Perfect Country-Address Alignment System with masked country
        try {
          let targetCountry = options?.selectedCountries?.[0] || 'United States';
          
          if (options?.useCountryDropdown && options?.selectedCountries?.length) {
            // Use dropdown rotation for consistency
            const countryIndex = index % options.selectedCountries.length;
            targetCountry = options.selectedCountries[countryIndex];
          } else if (countryColumn && maskedRow[countryColumn.name]) {
            // CRITICAL FIX: Use the ALREADY MASKED country value
            targetCountry = maskedRow[countryColumn.name];
          }
          
          console.log(`🎯 FIXED: Row ${index} - Using perfect alignment for ${column.dataType} (target: ${targetCountry})`);
          
          // Pass row index for perfect address alignment (CRITICAL)
          maskedRow[column.name] = await azureOpenAIMasking.maskData(
            row[column.name], 
            column.dataType,
            targetCountry,
            index // CRITICAL: Pass row index for perfect alignment
          );
        } catch (error) {
          console.error(`❌ FIXED: Perfect alignment failed for ${column.name} at row ${index}:`, error);
          // Fallback to regular masking (no API calls)
          maskedRow[column.name] = maskData(
            row[column.name], 
            column.dataType,
            row[column.name],
            columnUniqueValues[column.name],
            columnPatterns[column.name],
            index
          );
        }
      } else {
        // Apply enhanced masking with constant value detection and pattern analysis
        maskedRow[column.name] = maskData(
          row[column.name], 
          column.dataType,
          row[column.name],
          columnUniqueValues[column.name],
          columnPatterns[column.name],
          index
        );
      }
    }
    
    return maskedRow;
  }));
};
