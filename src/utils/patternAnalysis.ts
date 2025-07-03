
interface PatternAnalysis {
  hasPrefix: boolean;
  prefix: string;
  basePattern: string;
  incrementalNumbers: number[];
  sampleSize: number;
}

class PatternAnalyzer {
  analyzeColumnPattern(values: string[]): PatternAnalysis {
    const nonEmptyValues = values.filter(v => v && v.trim()).slice(0, 50); // Analyze up to 50 samples
    
    if (nonEmptyValues.length === 0) {
      return {
        hasPrefix: false,
        prefix: '',
        basePattern: '',
        incrementalNumbers: [],
        sampleSize: 0
      };
    }

    // Look for common prefix pattern (e.g., "Campaign_1", "Campaign_2")
    const prefixPattern = this.detectCommonPrefix(nonEmptyValues);
    
    if (prefixPattern.hasPrefix) {
      const numbers = this.extractNumbers(nonEmptyValues, prefixPattern.prefix);
      return {
        hasPrefix: true,
        prefix: prefixPattern.prefix,
        basePattern: prefixPattern.basePattern,
        incrementalNumbers: numbers,
        sampleSize: nonEmptyValues.length
      };
    }

    return {
      hasPrefix: false,
      prefix: '',
      basePattern: '',
      incrementalNumbers: [],
      sampleSize: nonEmptyValues.length
    };
  }

  private detectCommonPrefix(values: string[]): { hasPrefix: boolean; prefix: string; basePattern: string } {
    if (values.length < 2) return { hasPrefix: false, prefix: '', basePattern: '' };

    // Find common prefix by comparing first two values
    const first = values[0];
    const second = values[1];
    
    let commonPrefix = '';
    for (let i = 0; i < Math.min(first.length, second.length); i++) {
      if (first[i] === second[i]) {
        commonPrefix += first[i];
      } else {
        break;
      }
    }

    // Check if this prefix pattern holds for most values (at least 70%)
    if (commonPrefix.length > 0) {
      const matchingCount = values.filter(v => v.startsWith(commonPrefix)).length;
      const matchPercentage = matchingCount / values.length;
      
      if (matchPercentage >= 0.7) {
        // Look for common separators after prefix
        const separatorPattern = /[_\-\s]+\d+$/;
        const basePattern = commonPrefix + (separatorPattern.test(first) ? '_' : '');
        
        return {
          hasPrefix: true,
          prefix: commonPrefix,
          basePattern
        };
      }
    }

    return { hasPrefix: false, prefix: '', basePattern: '' };
  }

  private extractNumbers(values: string[], prefix: string): number[] {
    const numbers: number[] = [];
    
    values.forEach(value => {
      if (value.startsWith(prefix)) {
        const suffix = value.substring(prefix.length);
        const numberMatch = suffix.match(/\d+/);
        if (numberMatch) {
          numbers.push(parseInt(numberMatch[0]));
        }
      }
    });

    return numbers.sort((a, b) => a - b);
  }

  generatePatternBasedValue(pattern: PatternAnalysis, index: number): string {
    if (!pattern.hasPrefix) {
      return `Generated_${index + 1}`;
    }

    // Use incremental numbering starting from max existing number + 1
    const maxNumber = pattern.incrementalNumbers.length > 0 
      ? Math.max(...pattern.incrementalNumbers) 
      : 0;
    
    const newNumber = maxNumber + index + 1;
    return `${pattern.basePattern}${newNumber}`;
  }
}

export { PatternAnalyzer, type PatternAnalysis };
