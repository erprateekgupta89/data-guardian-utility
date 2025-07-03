
interface PreservationRule {
  columnName: string;
  preservePattern: boolean;
  preserveLength: boolean;
  preserveFormat: boolean;
  preserveCase: boolean;
}

interface PreservationConfig {
  rules: PreservationRule[];
  globalPreservation: {
    patterns: boolean;
    lengths: boolean;
    formats: boolean;
    casing: boolean;
  };
}

class DataPreservationEngine {
  private config: PreservationConfig;

  constructor(config?: Partial<PreservationConfig>) {
    this.config = {
      rules: [],
      globalPreservation: {
        patterns: true,
        lengths: true,
        formats: true,
        casing: false
      },
      ...config
    };
  }

  analyzeColumn(values: string[], columnName: string): PreservationRule {
    const nonEmptyValues = values.filter(v => v && v.trim());
    
    if (nonEmptyValues.length === 0) {
      return {
        columnName,
        preservePattern: false,
        preserveLength: false,
        preserveFormat: false,
        preserveCase: false
      };
    }

    // Analyze patterns
    const patterns = nonEmptyValues.map(v => this.extractPattern(v));
    const uniquePatterns = new Set(patterns);
    const preservePattern = uniquePatterns.size <= 3; // Few distinct patterns

    // Analyze lengths
    const lengths = nonEmptyValues.map(v => v.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const lengthVariance = lengths.reduce((acc, len) => acc + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const preserveLength = lengthVariance < 10; // Low variance in lengths

    // Analyze formats (check for consistent formatting)
    const formats = nonEmptyValues.map(v => this.extractFormat(v));
    const uniqueFormats = new Set(formats);
    const preserveFormat = uniqueFormats.size <= 2;

    // Analyze case patterns
    const casings = nonEmptyValues.map(v => this.analyzeCasing(v));
    const uniqueCasings = new Set(casings);
    const preserveCase = uniqueCasings.size <= 2;

    return {
      columnName,
      preservePattern,
      preserveLength,
      preserveFormat,
      preserveCase
    };
  }

  private extractPattern(value: string): string {
    return value.replace(/[a-zA-Z]/g, 'A').replace(/[0-9]/g, '0').replace(/[^A-Za-z0-9]/g, 'X');
  }

  private extractFormat(value: string): string {
    // Extract format indicators like spaces, dashes, parentheses
    return value.replace(/[a-zA-Z0-9]/g, '').trim();
  }

  private analyzeCasing(value: string): string {
    if (value === value.toUpperCase()) return 'UPPER';
    if (value === value.toLowerCase()) return 'lower';
    if (value.charAt(0) === value.charAt(0).toUpperCase()) return 'Title';
    return 'mixed';
  }

  preserveDataStructure(originalValue: string, newValue: string, rule: PreservationRule): string {
    if (!originalValue || !newValue) return newValue;

    let result = newValue;

    // Preserve length
    if (rule.preserveLength && this.config.globalPreservation.lengths) {
      if (result.length > originalValue.length) {
        result = result.substring(0, originalValue.length);
      } else if (result.length < originalValue.length) {
        result = result.padEnd(originalValue.length, ' ');
      }
    }

    // Preserve format
    if (rule.preserveFormat && this.config.globalPreservation.formats) {
      result = this.applyFormat(result, originalValue);
    }

    // Preserve case
    if (rule.preserveCase && this.config.globalPreservation.casing) {
      result = this.applyCasing(result, originalValue);
    }

    return result;
  }

  private applyFormat(newValue: string, originalValue: string): string {
    // Apply formatting from original to new value
    let result = '';
    let newIndex = 0;
    
    for (let i = 0; i < originalValue.length && newIndex < newValue.length; i++) {
      const originalChar = originalValue[i];
      
      if (/[a-zA-Z0-9]/.test(originalChar)) {
        // Alphanumeric character - use from new value
        result += newValue[newIndex++];
      } else {
        // Non-alphanumeric character - preserve from original
        result += originalChar;
      }
    }
    
    // Add remaining characters from new value
    result += newValue.substring(newIndex);
    
    return result;
  }

  private applyCasing(newValue: string, originalValue: string): string {
    let result = '';
    
    for (let i = 0; i < newValue.length; i++) {
      const newChar = newValue[i];
      const originalChar = originalValue[i] || newValue[i];
      
      if (/[a-zA-Z]/.test(newChar)) {
        if (/[A-Z]/.test(originalChar)) {
          result += newChar.toUpperCase();
        } else {
          result += newChar.toLowerCase();
        }
      } else {
        result += newChar;
      }
    }
    
    return result;
  }

  createPreservationPlan(data: Record<string, string>[], columnNames: string[]): PreservationRule[] {
    return columnNames.map(columnName => {
      const columnValues = data.map(row => row[columnName] || '');
      return this.analyzeColumn(columnValues, columnName);
    });
  }
}

export { DataPreservationEngine, type PreservationRule, type PreservationConfig };
