
import { GeneratedAddress } from '@/services/azureOpenAI';
import { GeoColumnMapping } from './geoColumnDetection';

interface ReferenceBatch {
  id: string;
  country: string;
  addresses: GeneratedAddress[];
  createdAt: Date;
  quality: 'high' | 'medium' | 'low';
  usage: number;
  maxUsage: number;
}

interface BatchCreationStrategy {
  country: string;
  requiredCount: number;
  priority: 'high' | 'medium' | 'low';
  regions?: string[];
  addressTypes?: string[];
}

class ReferenceBatchCreator {
  private batches: Map<string, ReferenceBatch> = new Map();
  private creationQueue: BatchCreationStrategy[] = [];

  createBatchStrategy(
    data: Record<string, string>[],
    geoMapping: GeoColumnMapping,
    selectedCountries?: string[]
  ): BatchCreationStrategy[] {
    const strategies: BatchCreationStrategy[] = [];
    
    // If specific countries are selected
    if (selectedCountries?.length) {
      const totalRows = data.length;
      const addressesPerCountry = Math.ceil(totalRows / selectedCountries.length);
      
      selectedCountries.forEach(country => {
        strategies.push({
          country,
          requiredCount: addressesPerCountry,
          priority: 'high',
          regions: this.getPreferredRegions(country),
          addressTypes: ['residential', 'commercial', 'mixed']
        });
      });
    } else if (geoMapping.country) {
      // Use country distribution from data
      const countryDistribution = this.analyzeCountryDistribution(data, geoMapping.country);
      
      Object.entries(countryDistribution).forEach(([country, count]) => {
        strategies.push({
          country,
          requiredCount: Math.ceil(count * 1.2), // 20% buffer
          priority: count > data.length * 0.1 ? 'high' : 'medium',
          regions: this.getPreferredRegions(country),
          addressTypes: ['residential', 'commercial']
        });
      });
    } else {
      // Default strategy
      strategies.push({
        country: 'United States',
        requiredCount: Math.ceil(data.length * 0.8),
        priority: 'high',
        regions: ['Northeast', 'Southeast', 'West Coast'],
        addressTypes: ['residential', 'commercial', 'mixed']
      });
    }

    return strategies;
  }

  private analyzeCountryDistribution(data: Record<string, string>[], countryColumn: string): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    data.forEach(row => {
      const country = row[countryColumn]?.trim();
      if (country) {
        distribution[country] = (distribution[country] || 0) + 1;
      }
    });
    
    return distribution;
  }

  private getPreferredRegions(country: string): string[] {
    const regionMap: Record<string, string[]> = {
      'United States': ['Northeast', 'Southeast', 'Midwest', 'West Coast', 'Southwest'],
      'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
      'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia'],
      'Germany': ['Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg', 'Berlin'],
      'India': ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat']
    };
    
    return regionMap[country] || ['Central', 'North', 'South'];
  }

  createReferenceBatch(
    strategy: BatchCreationStrategy,
    addresses: GeneratedAddress[]
  ): ReferenceBatch {
    const batchId = `${strategy.country.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    
    const batch: ReferenceBatch = {
      id: batchId,
      country: strategy.country,
      addresses: addresses,
      createdAt: new Date(),
      quality: this.assessBatchQuality(addresses, strategy),
      usage: 0,
      maxUsage: Math.max(addresses.length * 2, 100) // Allow reuse
    };
    
    this.batches.set(batchId, batch);
    return batch;
  }

  private assessBatchQuality(addresses: GeneratedAddress[], strategy: BatchCreationStrategy): 'high' | 'medium' | 'low' {
    if (addresses.length === 0) return 'low';
    
    const completionRate = addresses.length / strategy.requiredCount;
    const validityRate = addresses.filter(addr => this.isValidAddress(addr)).length / addresses.length;
    
    if (completionRate >= 0.9 && validityRate >= 0.95) return 'high';
    if (completionRate >= 0.7 && validityRate >= 0.8) return 'medium';
    return 'low';
  }

  private isValidAddress(address: GeneratedAddress): boolean {
    return !!(
      address.street?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      address.postalCode?.trim() &&
      address.country?.trim()
    );
  }

  getBatch(country: string): ReferenceBatch | null {
    // Find the best available batch for the country
    const countryBatches = Array.from(this.batches.values())
      .filter(batch => batch.country === country && batch.usage < batch.maxUsage)
      .sort((a, b) => {
        // Sort by quality first, then by remaining usage
        const qualityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const qualityDiff = qualityOrder[b.quality] - qualityOrder[a.quality];
        if (qualityDiff !== 0) return qualityDiff;
        
        const remainingA = a.maxUsage - a.usage;
        const remainingB = b.maxUsage - b.usage;
        return remainingB - remainingA;
      });
    
    return countryBatches[0] || null;
  }

  useFromBatch(batchId: string, count: number): GeneratedAddress[] {
    const batch = this.batches.get(batchId);
    if (!batch || batch.usage >= batch.maxUsage) return [];
    
    const startIndex = batch.usage % batch.addresses.length;
    const selectedAddresses: GeneratedAddress[] = [];
    
    for (let i = 0; i < count; i++) {
      const index = (startIndex + i) % batch.addresses.length;
      selectedAddresses.push(batch.addresses[index]);
    }
    
    batch.usage += count;
    return selectedAddresses;
  }

  getBatchStats(): Record<string, { total: number; used: number; quality: string }> {
    const stats: Record<string, { total: number; used: number; quality: string }> = {};
    
    this.batches.forEach(batch => {
      stats[batch.country] = {
        total: batch.addresses.length,
        used: batch.usage,
        quality: batch.quality
      };
    });
    
    return stats;
  }

  clearBatches(): void {
    this.batches.clear();
  }
}

export { ReferenceBatchCreator, type ReferenceBatch, type BatchCreationStrategy };
