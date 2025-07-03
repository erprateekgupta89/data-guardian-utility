
import { ColumnInfo, DataType, MaskingConfig, MaskingStats } from "@/types";
import { hybridMaskDataSet } from "./hybridMasking";
import { detectColumnDataType, analyzeColumn } from "./enhancedDataDetection";
import { smartMaskData } from "./intelligentMasking";

// Calculate country proportions for large datasets
export const calculateCountryProportions = (
  data: Record<string, string>[],
  countryColumn?: string
): Record<string, number> => {
  if (!countryColumn || data.length < 100) return {};
  
  const countryCounts: Record<string, number> = {};
  let totalRows = 0;
  
  data.forEach(row => {
    const country = row[countryColumn];
    if (country && country.trim()) {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
      totalRows++;
    }
  });
  
  const proportions: Record<string, number> = {};
  Object.entries(countryCounts).forEach(([country, count]) => {
    proportions[country] = count / totalRows;
  });
  
  return proportions;
};

// Enhanced column analysis and type detection
export const enhanceColumnInfo = (
  data: Record<string, string>[],
  columns: ColumnInfo[]
): ColumnInfo[] => {
  return columns.map(col => {
    const values = data.map(row => row[col.name]).filter(Boolean);
    const analysis = analyzeColumn(values, col.name);
    
    // Re-detect data type with enhanced detection
    const enhancedType = detectColumnDataType(values, col.name);
    
    return {
      ...col,
      dataType: col.userModified ? col.dataType : enhancedType,
      ...analysis
    };
  });
};

// Main masking function with hybrid approach
export const maskDataSet = async (
  data: Record<string, string>[],
  columns: ColumnInfo[],
  options?: {
    useCountryDropdown?: boolean;
    selectedCountries?: string[];
    hybridMode?: boolean;
    apiKey?: string;
  },
  onProgress?: (progress: number) => void
): Promise<Record<string, string>[]> => {
  console.log('Starting enhanced masking process', {
    rows: data.length,
    columns: columns.length,
    hybridMode: options?.hybridMode
  });
  
  // Enhance column information with intelligent analysis
  const enhancedColumns = enhanceColumnInfo(data, columns);
  
  // Calculate country proportions for large datasets
  const countryColumn = enhancedColumns.find(col => 
    col.name.toLowerCase() === 'country' || 
    col.dataType === 'Country'
  );
  
  const countryProportions = countryColumn 
    ? calculateCountryProportions(data, countryColumn.name)
    : {};
  
  const config: MaskingConfig = {
    preserveFormat: true,
    createTableSQL: false,
    tableName: 'masked_data',
    useCountryDropdown: options?.useCountryDropdown,
    selectedCountries: options?.selectedCountries,
    hybridMode: options?.hybridMode ?? true,
    batchSize: 50,
    qualityThreshold: 80
  };
  
  // Use hybrid masking if enabled and API key is available
  if (config.hybridMode && options?.apiKey) {
    try {
      const result = await hybridMaskDataSet(
        data,
        enhancedColumns,
        config,
        options.apiKey,
        onProgress
      );
      
      console.log('Hybrid masking completed:', result.stats);
      return result.maskedData;
    } catch (error) {
      console.error('Hybrid masking failed, falling back to rule-based:', error);
    }
  }
  
  // Fallback to rule-based masking
  return processRuleBasedMasking(data, enhancedColumns, config, onProgress);
};

// Rule-based masking implementation
const processRuleBasedMasking = (
  data: Record<string, string>[],
  columns: ColumnInfo[],
  config: MaskingConfig,
  onProgress?: (progress: number) => void
): Record<string, string>[] => {
  console.log('Processing with rule-based masking');
  
  const batchSize = config.batchSize || 100;
  const maskedData: Record<string, string>[] = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const maskedBatch = batch.map(row => {
      const maskedRow: Record<string, string> = {};
      
      columns.forEach(column => {
        if (column.skip) {
          maskedRow[column.name] = row[column.name];
          return;
        }
        
        const originalValue = row[column.name];
        if (!originalValue) {
          maskedRow[column.name] = originalValue;
          return;
        }
        
        // Handle country column with dropdown preference
        if (column.name.toLowerCase() === 'country') {
          if (config.useCountryDropdown && config.selectedCountries?.length) {
            const randomIndex = Math.floor(Math.random() * config.selectedCountries.length);
            maskedRow[column.name] = config.selectedCountries[randomIndex];
          } else {
            maskedRow[column.name] = smartMaskData(originalValue, column.dataType, column);
          }
          return;
        }
        
        // Use intelligent masking for other columns
        maskedRow[column.name] = smartMaskData(
          originalValue,
          column.dataType,
          column,
          column.geoRegion
        );
      });
      
      return maskedRow;
    });
    
    maskedData.push(...maskedBatch);
    
    // Update progress
    const progress = Math.round(((i + batch.length) / data.length) * 100);
    onProgress?.(progress);
  }
  
  return maskedData;
};

// Legacy export for backward compatibility
export const maskData = (value: string, dataType: DataType): string => {
  // Create a minimal column info for compatibility
  const columnInfo: ColumnInfo = {
    id: 'legacy',
    name: 'legacy',
    dataType,
    sampleData: value,
    skip: false
  };
  
  return smartMaskData(value, dataType, columnInfo);
};
