import { ColumnInfo } from '../types';
import { getUniqueValues } from './maskingHelpers';
import { PatternAnalyzer, type PatternAnalysis } from './patternAnalysis';
import FakerMasking from './fakerMasking';

// Interface for Faker masking options
interface FakerMaskingOptions {
  preserveFormat?: boolean;
  useCountryLocale?: boolean;
  selectedCountries?: string[];
  onProgress?: (progress: number) => void;
}

export async function maskDataSetWithFaker(
  data: Record<string, string>[],
  columns: ColumnInfo[],
  options: FakerMaskingOptions = {}
): Promise<Record<string, string>[]> {
  console.log('=== FAKER: Starting Faker.js masking process ===');
  console.log(`Data rows: ${data.length}`);
  console.log(`Columns: ${columns.length}`);
  console.log(`Options:`, options);

  // Initialize Faker masking service
  const fakerService = new FakerMasking({
    preserveFormat: options.preserveFormat ?? true,
    useCountryLocale: options.useCountryLocale ?? true,
    selectedCountries: options.selectedCountries
  });

  // Find country and nationality columns for proper synchronization
  const countryColumn = columns.find(col => 
    col.name.toLowerCase() === 'country' || col.dataType === 'Country'
  );
  const nationalityColumn = columns.find(col => 
    col.name.toLowerCase() === 'nationality' || col.dataType === 'Nationality'
  );
  
  const hasCountryAndNationality = countryColumn && nationalityColumn;
  
  if (hasCountryAndNationality) {
    console.log('🌍 FAKER: Country-Nationality synchronization enabled');
    console.log(`Country column: "${countryColumn?.name}", Nationality column: "${nationalityColumn?.name}"`);
  }

  // Analyze patterns and get unique values for each column
  const columnUniqueValues: Record<string, string[]> = {};
  const columnPatterns: Record<string, PatternAnalysis> = {};
  const patternAnalyzer = new PatternAnalyzer();
  
  columns.forEach(column => {
    // Get unique values for small sets
    const uniqueValues = getUniqueValues(data, column.name);
    if (uniqueValues.length < 20) {
      columnUniqueValues[column.name] = uniqueValues;
    }

    // Analyze patterns for all columns
    const allValues = data.map(row => row[column.name]).filter(Boolean);
    columnPatterns[column.name] = patternAnalyzer.analyzeColumnPattern(allValues);
    
    if (columnPatterns[column.name].isConstantValue) {
      console.log(`✅ FAKER: Constant value detected for ${column.name}: ${columnPatterns[column.name].constantValue}`);
    } else if (columnPatterns[column.name].hasPrefix) {
      console.log(`✅ FAKER: Pattern detected for ${column.name}:`, columnPatterns[column.name]);
    }
  });

  // Process data row by row
  const maskedData: Record<string, string>[] = [];
  const totalRows = data.length;
  
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const row = data[rowIndex];
    const maskedRow: Record<string, string> = {};
    
    // Report progress
    if (rowIndex % 50 === 0 && options.onProgress) {
      const progress = Math.round((rowIndex / totalRows) * 100);
      options.onProgress(progress);
    }

    // First pass: Handle non-nationality columns
    for (const column of columns) {
      if (column.skip) {
        maskedRow[column.name] = row[column.name];
        continue;
      }

      // Skip nationality column for now if we have country-nationality sync
      if (hasCountryAndNationality && 
          (column.name.toLowerCase() === 'nationality' || column.dataType === 'Nationality')) {
        continue;
      }

      // Handle country column with dropdown selection
      if (column.name.toLowerCase() === 'country' || column.dataType === 'Country') {
        if (options.selectedCountries?.length) {
          const selectedCountry = options.selectedCountries[rowIndex % options.selectedCountries.length];
          maskedRow[column.name] = selectedCountry;
          fakerService.setCountryForRow(rowIndex, selectedCountry);
          console.log(`🎯 FAKER: Row ${rowIndex} - Country set to: ${selectedCountry}`);
        } else {
          maskedRow[column.name] = fakerService.maskData(
            row[column.name],
            column.dataType,
            rowIndex,
            column.name,
            columnPatterns[column.name],
            columnUniqueValues[column.name]
          );
          fakerService.setCountryForRow(rowIndex, maskedRow[column.name]);
        }
      } else {
        // Handle all other columns
        maskedRow[column.name] = fakerService.maskData(
          row[column.name],
          column.dataType,
          rowIndex,
          column.name,
          columnPatterns[column.name],
          columnUniqueValues[column.name]
        );
      }
    }

    // Second pass: Handle nationality column with country synchronization
    if (hasCountryAndNationality && nationalityColumn) {
      const maskedCountryValue = maskedRow[countryColumn!.name];
      
      if (maskedCountryValue) {
        // Set the country context for this row
        fakerService.setCountryForRow(rowIndex, maskedCountryValue);
        
        // Generate nationality based on the masked country
        maskedRow[nationalityColumn.name] = fakerService.maskData(
          row[nationalityColumn.name],
          'Nationality',
          rowIndex,
          nationalityColumn.name,
          columnPatterns[nationalityColumn.name],
          columnUniqueValues[nationalityColumn.name]
        );
        
        console.log(`✅ FAKER: Row ${rowIndex} - Country-Nationality sync: ${maskedCountryValue} → ${maskedRow[nationalityColumn.name]}`);
      } else {
        // Fallback to regular masking
        maskedRow[nationalityColumn.name] = fakerService.maskData(
          row[nationalityColumn.name],
          nationalityColumn.dataType,
          rowIndex,
          nationalityColumn.name,
          columnPatterns[nationalityColumn.name],
          columnUniqueValues[nationalityColumn.name]
        );
      }
    }

    maskedData.push(maskedRow);
  }

  // Final progress update
  if (options.onProgress) {
    options.onProgress(100);
  }

  // Log statistics
  const stats = fakerService.getStats();
  console.log('=== FAKER: Masking completed ===');
  console.log(`Rows processed: ${stats.rowsProcessed}`);
  console.log(`Countries used: ${stats.countriesUsed.join(', ')}`);
  console.log(`Current locale: ${stats.currentLocale}`);

  return maskedData;
}