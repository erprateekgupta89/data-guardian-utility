import { SemanticConstantMasking, ConstantValueMetadata } from './semanticConstantMasking';

interface PatternAnalysis {
  hasPrefix: boolean;
  prefix: string;
  basePattern: string;
  incrementalNumbers: number[];
  sampleSize: number;
  isConstantValue: boolean;
  constantValue?: string;
  constantMetadata?: ConstantValueMetadata; // New field for semantic metadata
}

class PatternAnalyzer {
  private semanticMasking = new SemanticConstantMasking();

  analyzeColumnPattern(values: string[]): PatternAnalysis {
    const nonEmptyValues = values.filter(v => v && v.trim()).slice(0, 50); // Analyze up to 50 samples
    
    if (nonEmptyValues.length === 0) {
      return {
        hasPrefix: false,
        prefix: '',
        basePattern: '',
        incrementalNumbers: [],
        sampleSize: 0,
        isConstantValue: false
      };
    }

    // Check for constant values first (PRIORITY 1)
    const constantCheck = this.detectConstantValue(nonEmptyValues);
    if (constantCheck.isConstant && constantCheck.value) {
      console.log(`✅ Constant value detected for column: ${constantCheck.value}`);
      
      // Generate semantic metadata for the constant value
      const constantMetadata = this.semanticMasking.analyzeConstantValue(constantCheck.value);
      console.log(`🔍 Semantic analysis:`, constantMetadata);
      
      return {
        hasPrefix: false,
        prefix: '',
        basePattern: '',
        incrementalNumbers: [],
        sampleSize: nonEmptyValues.length,
        isConstantValue: true,
        constantValue: constantCheck.value,
        constantMetadata // Store semantic metadata
      };
    }

    // Look for common prefix pattern (e.g., "Campaign_1", "Campaign_2", "TestCampaign1", "TestCampaign2") only if not constant
    const prefixPattern = this.detectCommonPrefix(nonEmptyValues);
    
    if (prefixPattern.hasPrefix) {
      const numbers = this.extractNumbers(nonEmptyValues, prefixPattern.prefix);
      console.log(`✅ Pattern detected - Prefix: "${prefixPattern.prefix}", Numbers: [${numbers.slice(0, 5).join(', ')}${numbers.length > 5 ? '...' : ''}]`);
      return {
        hasPrefix: true,
        prefix: prefixPattern.prefix,
        basePattern: prefixPattern.basePattern,
        incrementalNumbers: numbers,
        sampleSize: nonEmptyValues.length,
        isConstantValue: false
      };
    }

    console.log(`❌ No pattern detected for values: [${nonEmptyValues.slice(0, 3).join(', ')}${nonEmptyValues.length > 3 ? '...' : ''}]`);
    return {
      hasPrefix: false,
      prefix: '',
      basePattern: '',
      incrementalNumbers: [],
      sampleSize: nonEmptyValues.length,
      isConstantValue: false
    };
  }

  private detectConstantValue(values: string[]): { isConstant: boolean; value?: string } {
    if (values.length === 0) return { isConstant: false };

    // Get the first non-empty value as reference
    const referenceValue = values[0];
    
    // Check if all values are identical (allowing for minor variations in whitespace)
    const normalizedReference = referenceValue.trim().toLowerCase();
    const allIdentical = values.every(value => 
      value.trim().toLowerCase() === normalizedReference
    );

    if (allIdentical) {
      return { isConstant: true, value: referenceValue.trim() };
    }

    // Check if at least 95% of values are the same (to handle minor data inconsistencies)
    const valueCounts = new Map<string, number>();
    values.forEach(value => {
      const normalized = value.trim().toLowerCase();
      valueCounts.set(normalized, (valueCounts.get(normalized) || 0) + 1);
    });

    const maxCount = Math.max(...valueCounts.values());
    const dominantPercentage = maxCount / values.length;

    if (dominantPercentage >= 0.95) {
      // Find the most common value (preserving original case)
      let dominantValue = '';
      let maxCountActual = 0;
      
      for (const value of values) {
        const normalized = value.trim().toLowerCase();
        const count = valueCounts.get(normalized) || 0;
        if (count > maxCountActual) {
          maxCountActual = count;
          dominantValue = value.trim();
        }
      }
      
      return { isConstant: true, value: dominantValue };
    }

    return { isConstant: false };
  }

  private detectCommonPrefix(values: string[]): { hasPrefix: boolean; prefix: string; basePattern: string } {
    if (values.length < 2) return { hasPrefix: false, prefix: '', basePattern: '' };

    console.log(`🔍 Analyzing prefix patterns for ${values.length} values:`, values.slice(0, 3));

    // Strategy 1: Find longest common prefix among all values
    let commonPrefix = values[0];
    for (let i = 1; i < values.length; i++) {
      const current = values[i];
      let j = 0;
      while (j < Math.min(commonPrefix.length, current.length) && commonPrefix[j] === current[j]) {
        j++;
      }
      commonPrefix = commonPrefix.substring(0, j);
      
      // If common prefix becomes too short, break early
      if (commonPrefix.length < 2) break;
    }

    console.log(`🔍 Initial common prefix: "${commonPrefix}"`);

    // Strategy 2: If we have a common prefix, check if it forms a valid pattern
    if (commonPrefix.length >= 2) {
      // Check if all values follow the pattern: prefix + number
      const patternMatches = values.filter(value => {
        if (!value.startsWith(commonPrefix)) return false;
        const suffix = value.substring(commonPrefix.length);
        return /^\d+$/.test(suffix); // Suffix must be purely numeric
      });

      const matchPercentage = patternMatches.length / values.length;
      console.log(`🔍 Pattern matches: ${patternMatches.length}/${values.length} (${(matchPercentage * 100).toFixed(1)}%)`);

      if (matchPercentage >= 0.7) {
        console.log(`✅ Direct number pattern detected: "${commonPrefix}" + numbers`);
        return {
          hasPrefix: true,
          prefix: commonPrefix,
          basePattern: commonPrefix // No separator needed
        };
      }
    }

    // Strategy 3: Look for prefix with separators (original logic)
    // Find common prefix by comparing first two values
    const first = values[0];
    const second = values[1];
    
    let prefixWithSeparator = '';
    for (let i = 0; i < Math.min(first.length, second.length); i++) {
      if (first[i] === second[i]) {
        prefixWithSeparator += first[i];
      } else {
        break;
      }
    }

    console.log(`🔍 Prefix with separator attempt: "${prefixWithSeparator}"`);

    // Check if this prefix pattern holds for most values (at least 70%)
    if (prefixWithSeparator.length > 0) {
      const matchingCount = values.filter(v => v.startsWith(prefixWithSeparator)).length;
      const matchPercentage = matchingCount / values.length;
      
      console.log(`🔍 Separator pattern matches: ${matchingCount}/${values.length} (${(matchPercentage * 100).toFixed(1)}%)`);
      
      if (matchPercentage >= 0.7) {
        // Look for common separators after prefix
        const separatorPattern = /[_\-\s]+\d+$/;
        const basePattern = prefixWithSeparator + (separatorPattern.test(first) ? '_' : '');
        
        console.log(`✅ Separator pattern detected: "${basePattern}"`);
        return {
          hasPrefix: true,
          prefix: prefixWithSeparator,
          basePattern
        };
      }
    }

    console.log(`❌ No valid prefix pattern found`);
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

    const sortedNumbers = numbers.sort((a, b) => a - b);
    console.log(`🔢 Extracted numbers: [${sortedNumbers.slice(0, 10).join(', ')}${sortedNumbers.length > 10 ? '...' : ''}]`);
    return sortedNumbers;
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
    const generatedValue = `${pattern.basePattern}${newNumber}`;
    
    console.log(`🎯 Generated pattern value: "${generatedValue}" (index: ${index}, max: ${maxNumber})`);
    return generatedValue;
  }
}

export { PatternAnalyzer, type PatternAnalysis };
