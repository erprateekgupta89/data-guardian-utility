
import { ReferenceBatch, BatchCreationStrategy } from './referenceBatchCreator';
import { GeoColumnMapping } from './geoColumnDetection';

interface BatchingDecision {
  strategy: 'pregenerate' | 'on-demand' | 'hybrid';
  batchSize: number;
  priorityOrder: string[];
  estimatedTime: number;
  resourceUsage: 'low' | 'medium' | 'high';
}

interface DatasetAnalysis {
  totalRows: number;
  uniqueCountries: number;
  geoColumnCount: number;
  complexityScore: number;
  estimatedApiCalls: number;
}

class IntelligentBatchStrategy {
  private readonly COMPLEXITY_THRESHOLDS = {
    simple: 50,
    moderate: 200,
    complex: 1000
  };

  private readonly BATCH_SIZE_LIMITS = {
    min: 10,
    max: 100,
    optimal: 50
  };

  analyzeBatchingNeeds(
    data: Record<string, string>[],
    geoMapping: GeoColumnMapping,
    selectedCountries?: string[]
  ): BatchingDecision {
    const analysis = this.analyzeDataset(data, geoMapping, selectedCountries);
    
    // Determine strategy based on complexity
    let strategy: 'pregenerate' | 'on-demand' | 'hybrid';
    if (analysis.complexityScore < this.COMPLEXITY_THRESHOLDS.simple) {
      strategy = 'on-demand';
    } else if (analysis.complexityScore < this.COMPLEXITY_THRESHOLDS.moderate) {
      strategy = 'hybrid';
    } else {
      strategy = 'pregenerate';
    }

    // Calculate optimal batch size
    const batchSize = this.calculateOptimalBatchSize(analysis);
    
    // Determine priority order
    const priorityOrder = this.determinePriorityOrder(data, geoMapping, selectedCountries);
    
    // Estimate processing time
    const estimatedTime = this.estimateProcessingTime(analysis, batchSize);
    
    // Assess resource usage
    const resourceUsage = this.assessResourceUsage(analysis);

    return {
      strategy,
      batchSize,
      priorityOrder,
      estimatedTime,
      resourceUsage
    };
  }

  private analyzeDataset(
    data: Record<string, string>[],
    geoMapping: GeoColumnMapping,
    selectedCountries?: string[]
  ): DatasetAnalysis {
    const totalRows = data.length;
    
    // Count unique countries
    let uniqueCountries = 1; // Default
    if (geoMapping.country) {
      const countries = new Set(data.map(row => row[geoMapping.country!]).filter(Boolean));
      uniqueCountries = countries.size;
    } else if (selectedCountries?.length) {
      uniqueCountries = selectedCountries.length;
    }

    // Count geo columns
    const geoColumnCount = Object.keys(geoMapping).filter(key => geoMapping[key as keyof GeoColumnMapping]).length;

    // Calculate complexity score
    const complexityScore = this.calculateComplexityScore(totalRows, uniqueCountries, geoColumnCount);

    // Estimate API calls needed
    const estimatedApiCalls = this.estimateApiCalls(totalRows, uniqueCountries, geoColumnCount);

    return {
      totalRows,
      uniqueCountries,
      geoColumnCount,
      complexityScore,
      estimatedApiCalls
    };
  }

  private calculateComplexityScore(totalRows: number, uniqueCountries: number, geoColumnCount: number): number {
    // Weight factors for different aspects of complexity
    const rowWeight = 0.4;
    const countryWeight = 0.3;
    const columnWeight = 0.3;

    return (totalRows * rowWeight) + (uniqueCountries * 10 * countryWeight) + (geoColumnCount * 5 * columnWeight);
  }

  private calculateOptimalBatchSize(analysis: DatasetAnalysis): number {
    // Base batch size on complexity and API efficiency
    let batchSize = this.BATCH_SIZE_LIMITS.optimal;

    if (analysis.complexityScore < this.COMPLEXITY_THRESHOLDS.simple) {
      batchSize = Math.min(analysis.totalRows, this.BATCH_SIZE_LIMITS.min * 2);
    } else if (analysis.complexityScore > this.COMPLEXITY_THRESHOLDS.complex) {
      batchSize = this.BATCH_SIZE_LIMITS.max;
    }

    // Adjust based on unique countries
    if (analysis.uniqueCountries > 5) {
      batchSize = Math.min(batchSize * 1.5, this.BATCH_SIZE_LIMITS.max);
    }

    return Math.max(this.BATCH_SIZE_LIMITS.min, Math.min(batchSize, this.BATCH_SIZE_LIMITS.max));
  }

  private determinePriorityOrder(
    data: Record<string, string>[],
    geoMapping: GeoColumnMapping,
    selectedCountries?: string[]
  ): string[] {
    if (selectedCountries?.length) {
      // Use selected countries in order
      return [...selectedCountries];
    }

    if (geoMapping.country) {
      // Analyze country frequency and prioritize by usage
      const countryFrequency: Record<string, number> = {};
      data.forEach(row => {
        const country = row[geoMapping.country!];
        if (country) {
          countryFrequency[country] = (countryFrequency[country] || 0) + 1;
        }
      });

      return Object.entries(countryFrequency)
        .sort(([, a], [, b]) => b - a)
        .map(([country]) => country);
    }

    // Default priority order
    return ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany'];
  }

  private estimateApiCalls(totalRows: number, uniqueCountries: number, geoColumnCount: number): number {
    // Estimate based on batching efficiency
    const addressesPerCountry = Math.ceil(totalRows / uniqueCountries);
    const batchesPerCountry = Math.ceil(addressesPerCountry / this.BATCH_SIZE_LIMITS.optimal);
    return uniqueCountries * batchesPerCountry;
  }

  private estimateProcessingTime(analysis: DatasetAnalysis, batchSize: number): number {
    // Estimate in seconds
    const apiCallTime = 3; // Average seconds per API call
    const processingTime = 0.1; // Seconds per row processing
    
    const totalApiTime = analysis.estimatedApiCalls * apiCallTime;
    const totalProcessingTime = analysis.totalRows * processingTime;
    
    return totalApiTime + totalProcessingTime;
  }

  private assessResourceUsage(analysis: DatasetAnalysis): 'low' | 'medium' | 'high' {
    if (analysis.estimatedApiCalls < 5) return 'low';
    if (analysis.estimatedApiCalls < 20) return 'medium';
    return 'high';
  }

  createOptimizedStrategies(
    decision: BatchingDecision,
    data: Record<string, string>[],
    geoMapping: GeoColumnMapping
  ): BatchCreationStrategy[] {
    const strategies: BatchCreationStrategy[] = [];
    
    decision.priorityOrder.forEach((country, index) => {
      const countryData = geoMapping.country 
        ? data.filter(row => row[geoMapping.country!] === country)
        : data;
      
      const requiredCount = Math.max(
        countryData.length,
        decision.batchSize
      );

      strategies.push({
        country,
        requiredCount,
        priority: index < 3 ? 'high' : index < 6 ? 'medium' : 'low',
        regions: this.getRegionsForCountry(country),
        addressTypes: ['residential', 'commercial', 'mixed']
      });
    });

    return strategies;
  }

  private getRegionsForCountry(country: string): string[] {
    const regionMap: Record<string, string[]> = {
      'United States': ['Northeast', 'Southeast', 'Midwest', 'West Coast'],
      'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
      'United Kingdom': ['England', 'Scotland', 'Wales'],
      'Australia': ['New South Wales', 'Victoria', 'Queensland'],
      'Germany': ['Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg']
    };
    
    return regionMap[country] || ['Central', 'North', 'South'];
  }
}

export { IntelligentBatchStrategy, type BatchingDecision, type DatasetAnalysis };
