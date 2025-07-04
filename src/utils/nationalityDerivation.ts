
interface NationalityMapping {
  country: string;
  nationality: string;
  region: string;
  continent: string;
}

interface NationalityDerivationResult {
  nationality: string;
  confidence: 'high' | 'medium' | 'low';
  region: string;
  continent: string;
  alternativeNationalities?: string[];
}

class NationalityDerivationEngine {
  private nationalityMap: Map<string, NationalityMapping> = new Map();
  private fuzzyMatchCache: Map<string, NationalityMapping> = new Map();

  constructor() {
    this.initializeNationalityMappings();
  }

  private initializeNationalityMappings(): void {
    console.log('=== NATIONALITY: Initializing nationality mappings ===');

    const mappings: NationalityMapping[] = [
      // North America
      { country: 'United States', nationality: 'American', region: 'North America', continent: 'North America' },
      { country: 'USA', nationality: 'American', region: 'North America', continent: 'North America' },
      { country: 'US', nationality: 'American', region: 'North America', continent: 'North America' },
      { country: 'Canada', nationality: 'Canadian', region: 'North America', continent: 'North America' },
      { country: 'Mexico', nationality: 'Mexican', region: 'North America', continent: 'North America' },

      // Europe
      { country: 'United Kingdom', nationality: 'British', region: 'Western Europe', continent: 'Europe' },
      { country: 'UK', nationality: 'British', region: 'Western Europe', continent: 'Europe' },
      { country: 'England', nationality: 'English', region: 'Western Europe', continent: 'Europe' },
      { country: 'Scotland', nationality: 'Scottish', region: 'Western Europe', continent: 'Europe' },
      { country: 'Wales', nationality: 'Welsh', region: 'Western Europe', continent: 'Europe' },
      { country: 'Germany', nationality: 'German', region: 'Western Europe', continent: 'Europe' },
      { country: 'France', nationality: 'French', region: 'Western Europe', continent: 'Europe' },
      { country: 'Spain', nationality: 'Spanish', region: 'Southern Europe', continent: 'Europe' },
      { country: 'Italy', nationality: 'Italian', region: 'Southern Europe', continent: 'Europe' },
      { country: 'Netherlands', nationality: 'Dutch', region: 'Western Europe', continent: 'Europe' },
      { country: 'Sweden', nationality: 'Swedish', region: 'Northern Europe', continent: 'Europe' },
      { country: 'Norway', nationality: 'Norwegian', region: 'Northern Europe', continent: 'Europe' },
      { country: 'Denmark', nationality: 'Danish', region: 'Northern Europe', continent: 'Europe' },
      { country: 'Finland', nationality: 'Finnish', region: 'Northern Europe', continent: 'Europe' },
      { country: 'Switzerland', nationality: 'Swiss', region: 'Western Europe', continent: 'Europe' },
      { country: 'Austria', nationality: 'Austrian', region: 'Western Europe', continent: 'Europe' },
      { country: 'Belgium', nationality: 'Belgian', region: 'Western Europe', continent: 'Europe' },
      { country: 'Portugal', nationality: 'Portuguese', region: 'Southern Europe', continent: 'Europe' },
      { country: 'Greece', nationality: 'Greek', region: 'Southern Europe', continent: 'Europe' },
      { country: 'Ireland', nationality: 'Irish', region: 'Western Europe', continent: 'Europe' },
      { country: 'Russia', nationality: 'Russian', region: 'Eastern Europe', continent: 'Europe' },

      // Asia
      { country: 'China', nationality: 'Chinese', region: 'East Asia', continent: 'Asia' },
      { country: 'Japan', nationality: 'Japanese', region: 'East Asia', continent: 'Asia' },
      { country: 'India', nationality: 'Indian', region: 'South Asia', continent: 'Asia' },
      { country: 'South Korea', nationality: 'South Korean', region: 'East Asia', continent: 'Asia' },
      { country: 'Korea', nationality: 'Korean', region: 'East Asia', continent: 'Asia' },
      { country: 'Singapore', nationality: 'Singaporean', region: 'Southeast Asia', continent: 'Asia' },
      { country: 'Malaysia', nationality: 'Malaysian', region: 'Southeast Asia', continent: 'Asia' },
      { country: 'Thailand', nationality: 'Thai', region: 'Southeast Asia', continent: 'Asia' },
      { country: 'Indonesia', nationality: 'Indonesian', region: 'Southeast Asia', continent: 'Asia' },
      { country: 'Philippines', nationality: 'Filipino', region: 'Southeast Asia', continent: 'Asia' },
      { country: 'Vietnam', nationality: 'Vietnamese', region: 'Southeast Asia', continent: 'Asia' },
      { country: 'Turkey', nationality: 'Turkish', region: 'Western Asia', continent: 'Asia' },

      // Oceania
      { country: 'Australia', nationality: 'Australian', region: 'Oceania', continent: 'Oceania' },
      { country: 'New Zealand', nationality: 'New Zealander', region: 'Oceania', continent: 'Oceania' },

      // South America
      { country: 'Brazil', nationality: 'Brazilian', region: 'South America', continent: 'South America' },
      { country: 'Argentina', nationality: 'Argentinian', region: 'South America', continent: 'South America' },
      { country: 'Chile', nationality: 'Chilean', region: 'South America', continent: 'South America' },
      { country: 'Peru', nationality: 'Peruvian', region: 'South America', continent: 'South America' },
      { country: 'Colombia', nationality: 'Colombian', region: 'South America', continent: 'South America' },

      // Africa
      { country: 'South Africa', nationality: 'South African', region: 'Southern Africa', continent: 'Africa' },
      { country: 'Nigeria', nationality: 'Nigerian', region: 'West Africa', continent: 'Africa' },
      { country: 'Egypt', nationality: 'Egyptian', region: 'North Africa', continent: 'Africa' },
      { country: 'Kenya', nationality: 'Kenyan', region: 'East Africa', continent: 'Africa' },
      { country: 'Morocco', nationality: 'Moroccan', region: 'North Africa', continent: 'Africa' }
    ];

    // Initialize the main map
    mappings.forEach(mapping => {
      const key = mapping.country.toLowerCase().trim();
      this.nationalityMap.set(key, mapping);
    });

    console.log(`✅ NATIONALITY: Initialized ${this.nationalityMap.size} nationality mappings`);
  }

  deriveNationality(countryValue: string): NationalityDerivationResult {
    if (!countryValue || countryValue.trim() === '') {
      return {
        nationality: 'Unknown',
        confidence: 'low',
        region: 'Unknown',
        continent: 'Unknown'
      };
    }

    const cleanCountry = countryValue.trim();
    const searchKey = cleanCountry.toLowerCase();

    console.log(`🌍 NATIONALITY: Deriving nationality for: "${cleanCountry}"`);

    // Step 1: Direct exact match
    const exactMatch = this.nationalityMap.get(searchKey);
    if (exactMatch) {
      console.log(`✅ NATIONALITY: Exact match found - ${cleanCountry} → ${exactMatch.nationality}`);
      return {
        nationality: exactMatch.nationality,
        confidence: 'high',
        region: exactMatch.region,
        continent: exactMatch.continent
      };
    }

    // Step 2: Fuzzy matching
    const fuzzyMatch = this.findFuzzyMatch(cleanCountry);
    if (fuzzyMatch) {
      console.log(`🎯 NATIONALITY: Fuzzy match found - ${cleanCountry} → ${fuzzyMatch.nationality} (confidence: medium)`);
      return {
        nationality: fuzzyMatch.nationality,
        confidence: 'medium',
        region: fuzzyMatch.region,
        continent: fuzzyMatch.continent
      };
    }

    // Step 3: Partial matching for compound country names
    const partialMatch = this.findPartialMatch(cleanCountry);
    if (partialMatch) {
      console.log(`🔍 NATIONALITY: Partial match found - ${cleanCountry} → ${partialMatch.nationality} (confidence: medium)`);
      return {
        nationality: partialMatch.nationality,
        confidence: 'medium',
        region: partialMatch.region,
        continent: partialMatch.continent
      };
    }

    // Step 4: Generate nationality from country name as fallback
    const generatedNationality = this.generateNationalityFromCountryName(cleanCountry);
    console.log(`🤖 NATIONALITY: Generated nationality - ${cleanCountry} → ${generatedNationality} (confidence: low)`);

    return {
      nationality: generatedNationality,
      confidence: 'low',
      region: 'Unknown',
      continent: 'Unknown'
    };
  }

  private findFuzzyMatch(country: string): NationalityMapping | null {
    // Check cache first
    const cacheKey = country.toLowerCase();
    if (this.fuzzyMatchCache.has(cacheKey)) {
      return this.fuzzyMatchCache.get(cacheKey) || null;
    }

    const searchTerm = country.toLowerCase();
    let bestMatch: NationalityMapping | null = null;
    let bestScore = 0;

    for (const [key, mapping] of this.nationalityMap.entries()) {
      const similarity = this.calculateSimilarity(searchTerm, key);
      if (similarity > bestScore && similarity >= 0.7) { // 70% similarity threshold
        bestScore = similarity;
        bestMatch = mapping;
      }
    }

    // Cache the result
    if (bestMatch) {
      this.fuzzyMatchCache.set(cacheKey, bestMatch);
    }

    return bestMatch;
  }

  private findPartialMatch(country: string): NationalityMapping | null {
    const searchTerms = country.toLowerCase().split(/[\s,-]+/);
    
    for (const term of searchTerms) {
      if (term.length < 3) continue; // Skip very short terms
      
      for (const [key, mapping] of this.nationalityMap.entries()) {
        if (key.includes(term) || term.includes(key)) {
          return mapping;
        }
      }
    }
    
    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private generateNationalityFromCountryName(country: string): string {
    // Simple rules for generating nationality from country name
    const cleanCountry = country.trim();
    
    // Handle some common patterns
    if (cleanCountry.endsWith('land')) {
      return `${cleanCountry}er`;
    }
    if (cleanCountry.endsWith('ia') || cleanCountry.endsWith('ya')) {
      return `${cleanCountry}n`;
    }
    if (cleanCountry.endsWith('stan')) {
      return `${cleanCountry}i`;
    }
    
    // Default: add 'ian' or 'an' suffix
    const lastChar = cleanCountry.charAt(cleanCountry.length - 1).toLowerCase();
    if (lastChar === 'a' || lastChar === 'e' || lastChar === 'i' || lastChar === 'o' || lastChar === 'u') {
      return `${cleanCountry}n`;
    } else {
      return `${cleanCountry}ian`;
    }
  }

  // Method to derive nationality for a batch of countries
  deriveNationalityBatch(countries: string[]): Map<string, NationalityDerivationResult> {
    console.log(`=== NATIONALITY: Processing batch of ${countries.length} countries ===`);
    
    const results = new Map<string, NationalityDerivationResult>();
    const uniqueCountries = [...new Set(countries)];
    
    uniqueCountries.forEach(country => {
      const result = this.deriveNationality(country);
      results.set(country, result);
    });
    
    console.log(`✅ NATIONALITY: Processed ${results.size} unique countries`);
    return results;
  }

  // Get statistics about nationality derivation
  getDerivationStats(): {
    totalMappings: number;
    cacheSize: number;
    supportedRegions: string[];
    supportedContinents: string[];
  } {
    const regions = new Set<string>();
    const continents = new Set<string>();
    
    for (const mapping of this.nationalityMap.values()) {
      regions.add(mapping.region);
      continents.add(mapping.continent);
    }
    
    return {
      totalMappings: this.nationalityMap.size,
      cacheSize: this.fuzzyMatchCache.size,
      supportedRegions: Array.from(regions),
      supportedContinents: Array.from(continents)
    };
  }

  // Clear cache
  clearCache(): void {
    this.fuzzyMatchCache.clear();
    console.log('🧹 NATIONALITY: Cache cleared');
  }
}

export { NationalityDerivationEngine, type NationalityMapping, type NationalityDerivationResult };
