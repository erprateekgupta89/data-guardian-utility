
import { ColumnInfo, DataType, MaskingConfig } from "@/types";
import { smartMaskData } from "./intelligentMasking";
import { maskDataWithAI } from "./aiMasking";

export interface HybridMaskingResult {
  maskedData: Record<string, string>[];
  stats: {
    totalRows: number;
    aiProcessedRows: number;
    ruleBasedRows: number;
    processingTime: number;
    qualityScore: number;
  };
}

// Determine which columns should use AI vs rule-based masking
export const analyzeColumnsForMasking = (
  columns: ColumnInfo[],
  data: Record<string, string>[]
): { aiColumns: ColumnInfo[]; ruleBasedColumns: ColumnInfo[] } => {
  const aiColumns: ColumnInfo[] = [];
  const ruleBasedColumns: ColumnInfo[] = [];
  
  columns.forEach(column => {
    if (column.skip) return;
    
    const shouldUseAI = shouldColumnUseAI(column, data);
    
    if (shouldUseAI) {
      aiColumns.push(column);
    } else {
      ruleBasedColumns.push(column);
    }
  });
  
  return { aiColumns, ruleBasedColumns };
};

// Determine if a column should use AI masking
const shouldColumnUseAI = (column: ColumnInfo, data: Record<string, string>[]): boolean => {
  // Use rule-based for these types as they have well-defined patterns
  const ruleBasedTypes: DataType[] = [
    'Credit Card', 'Debit Card', 'Phone Number', 'Email', 
    'Sequential', 'Int', 'Float', 'Bool', 'Date', 'Time'
  ];
  
  if (ruleBasedTypes.includes(column.dataType)) {
    return false;
  }
  
  // Use rule-based for constant values
  if (column.isConstant) {
    return false;
  }
  
  // Use AI for complex text fields and addresses
  const aiPreferredTypes: DataType[] = [
    'Address', 'Name', 'Company', 'Text', 'String'
  ];
  
  if (aiPreferredTypes.includes(column.dataType)) {
    // Check data complexity
    const sampleValues = data.slice(0, 10).map(row => row[column.name]).filter(Boolean);
    const avgLength = sampleValues.reduce((sum, val) => sum + val.length, 0) / sampleValues.length;
    
    // Use AI for longer, more complex text
    return avgLength > 10;
  }
  
  return false;
};

// Hybrid masking implementation
export const hybridMaskDataSet = async (
  data: Record<string, string>[],
  columns: ColumnInfo[],
  config: MaskingConfig,
  apiKey?: string,
  onProgress?: (progress: number) => void
): Promise<HybridMaskingResult> => {
  const startTime = Date.now();
  
  // Analyze columns for AI vs rule-based masking
  const { aiColumns, ruleBasedColumns } = analyzeColumnsForMasking(columns, data);
  
  console.log('Hybrid masking analysis:', {
    aiColumns: aiColumns.map(c => c.name),
    ruleBasedColumns: ruleBasedColumns.map(c => c.name)
  });
  
  // Process rule-based columns first (faster)
  let maskedData = data.map(row => ({ ...row }));
  
  // Rule-based masking
  if (ruleBasedColumns.length > 0) {
    maskedData = processRuleBasedMasking(maskedData, ruleBasedColumns, config);
    onProgress?.(40);
  }
  
  // AI-based masking for complex columns
  let aiProcessedRows = 0;
  if (aiColumns.length > 0 && apiKey) {
    try {
      const aiMaskedData = await maskDataWithAI(
        maskedData,
        aiColumns,
        apiKey,
        (progress) => onProgress?.(40 + (progress * 0.6))
      );
      maskedData = aiMaskedData;
      aiProcessedRows = data.length;
    } catch (error) {
      console.warn('AI masking failed, falling back to rule-based:', error);
      maskedData = processRuleBasedMasking(maskedData, aiColumns, config);
    }
  } else if (aiColumns.length > 0) {
    // Fallback to rule-based if no API key
    maskedData = processRuleBasedMasking(maskedData, aiColumns, config);
  }
  
  const processingTime = Date.now() - startTime;
  const qualityScore = calculateQualityScore(maskedData, data, columns);
  
  onProgress?.(100);
  
  return {
    maskedData,
    stats: {
      totalRows: data.length,
      aiProcessedRows,
      ruleBasedRows: data.length - aiProcessedRows,
      processingTime,
      qualityScore
    }
  };
};

// Process rule-based masking
const processRuleBasedMasking = (
  data: Record<string, string>[],
  columns: ColumnInfo[],
  config: MaskingConfig
): Record<string, string>[] => {
  return data.map(row => {
    const maskedRow = { ...row };
    
    columns.forEach(column => {
      if (column.skip) return;
      
      const originalValue = row[column.name];
      if (!originalValue) return;
      
      // Use intelligent masking
      maskedRow[column.name] = smartMaskData(
        originalValue,
        column.dataType,
        column,
        column.geoRegion
      );
    });
    
    return maskedRow;
  });
};

// Calculate quality score based on data diversity and format preservation
const calculateQualityScore = (
  maskedData: Record<string, string>[],
  originalData: Record<string, string>[],
  columns: ColumnInfo[]
): number => {
  let totalScore = 0;
  let columnCount = 0;
  
  columns.forEach(column => {
    if (column.skip) return;
    
    const originalValues = originalData.map(row => row[column.name]).filter(Boolean);
    const maskedValues = maskedData.map(row => row[column.name]).filter(Boolean);
    
    if (originalValues.length === 0) return;
    
    // Check format preservation
    const formatScore = calculateFormatPreservationScore(originalValues, maskedValues);
    
    // Check data diversity
    const diversityScore = calculateDiversityScore(maskedValues);
    
    // Check type consistency
    const consistencyScore = calculateTypeConsistencyScore(maskedValues, column.dataType);
    
    const columnScore = (formatScore + diversityScore + consistencyScore) / 3;
    totalScore += columnScore;
    columnCount++;
  });
  
  return columnCount > 0 ? Math.round((totalScore / columnCount) * 100) : 0;
};

// Calculate format preservation score
const calculateFormatPreservationScore = (original: string[], masked: string[]): number => {
  if (original.length === 0 || masked.length === 0) return 0;
  
  let matches = 0;
  const sampleSize = Math.min(10, original.length, masked.length);
  
  for (let i = 0; i < sampleSize; i++) {
    const origPattern = original[i].replace(/[a-zA-Z0-9]/g, '#');
    const maskPattern = masked[i]?.replace(/[a-zA-Z0-9]/g, '#') || '';
    
    if (origPattern === maskPattern) {
      matches++;
    }
  }
  
  return matches / sampleSize;
};

// Calculate diversity score
const calculateDiversityScore = (values: string[]): number => {
  const uniqueValues = new Set(values);
  return Math.min(1, uniqueValues.size / Math.max(1, values.length * 0.8));
};

// Calculate type consistency score
const calculateTypeConsistencyScore = (values: string[], expectedType: DataType): number => {
  // Simple validation based on type
  let validCount = 0;
  
  values.forEach(value => {
    switch (expectedType) {
      case 'Email':
        if (value.includes('@')) validCount++;
        break;
      case 'Phone Number':
        if (/[\d\-\+\(\)\s]/.test(value)) validCount++;
        break;
      case 'Int':
        if (!isNaN(parseInt(value))) validCount++;
        break;
      case 'Float':
        if (!isNaN(parseFloat(value))) validCount++;
        break;
      default:
        validCount++; // Assume valid for other types
    }
  });
  
  return values.length > 0 ? validCount / values.length : 0;
};
