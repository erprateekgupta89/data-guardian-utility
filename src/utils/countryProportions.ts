
interface CountryDistribution {
  country: string;
  count: number;
  percentage: number;
}

interface ProportionalMaskingPlan {
  totalRows: number;
  countryDistributions: CountryDistribution[];
  fallbackCountry: string;
}

class CountryProportionCalculator {
  calculateProportions(
    data: Record<string, string>[], 
    countryColumnName: string,
    selectedCountries?: string[]
  ): ProportionalMaskingPlan {
    const totalRows = data.length;
    const countryCount: Record<string, number> = {};
    
    // Count occurrences of each country in the original data
    data.forEach(row => {
      const country = row[countryColumnName]?.trim();
      if (country) {
        countryCount[country] = (countryCount[country] || 0) + 1;
      }
    });

    // Convert to distribution array
    let distributions: CountryDistribution[] = Object.entries(countryCount)
      .map(([country, count]) => ({
        country,
        count,
        percentage: (count / totalRows) * 100
      }))
      .sort((a, b) => b.count - a.count); // Sort by frequency

    // If specific countries are selected, map original countries to selected ones
    if (selectedCountries?.length) {
      distributions = this.mapToSelectedCountries(distributions, selectedCountries);
    }

    // Determine fallback country (most common or first selected)
    const fallbackCountry = selectedCountries?.length 
      ? selectedCountries[0] 
      : distributions[0]?.country || 'United States';

    return {
      totalRows,
      countryDistributions: distributions,
      fallbackCountry
    };
  }

  private mapToSelectedCountries(
    originalDistributions: CountryDistribution[],
    selectedCountries: string[]
  ): CountryDistribution[] {
    const totalOriginalCount = originalDistributions.reduce((sum, dist) => sum + dist.count, 0);
    
    // If only one country selected, map everything to it
    if (selectedCountries.length === 1) {
      return [{
        country: selectedCountries[0],
        count: totalOriginalCount,
        percentage: 100
      }];
    }

    // Map original distributions to selected countries proportionally
    const mappedDistributions: CountryDistribution[] = [];
    const countryMappingRatio = selectedCountries.length / originalDistributions.length;
    
    selectedCountries.forEach((selectedCountry, index) => {
      // Calculate proportional count based on original distribution pattern
      const baseIndex = Math.floor(index / countryMappingRatio);
      const originalDist = originalDistributions[baseIndex] || originalDistributions[0];
      
      // Adjust count to maintain original proportions but use selected countries
      const adjustedCount = Math.max(1, Math.round(originalDist.count * (1 / selectedCountries.length)));
      
      mappedDistributions.push({
        country: selectedCountry,
        count: adjustedCount,
        percentage: (adjustedCount / totalOriginalCount) * 100
      });
    });

    // Ensure total counts match
    const totalMappedCount = mappedDistributions.reduce((sum, dist) => sum + dist.count, 0);
    if (totalMappedCount !== totalOriginalCount) {
      const difference = totalOriginalCount - totalMappedCount;
      mappedDistributions[0].count += difference;
      mappedDistributions[0].percentage = (mappedDistributions[0].count / totalOriginalCount) * 100;
    }

    return mappedDistributions.sort((a, b) => b.count - a.count);
  }

  generateMaskingSequence(plan: ProportionalMaskingPlan): string[] {
    const sequence: string[] = [];
    
    plan.countryDistributions.forEach(distribution => {
      for (let i = 0; i < distribution.count; i++) {
        sequence.push(distribution.country);
      }
    });

    // Shuffle the sequence to avoid clustering
    return this.shuffleArray(sequence);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getCountryForRow(
    rowIndex: number, 
    maskingSequence: string[], 
    fallbackCountry: string
  ): string {
    if (rowIndex < maskingSequence.length) {
      return maskingSequence[rowIndex];
    }
    return fallbackCountry;
  }
}

export { CountryProportionCalculator, type CountryDistribution, type ProportionalMaskingPlan };
