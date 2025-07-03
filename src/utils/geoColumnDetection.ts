
import { ColumnInfo, DataType } from '@/types';

interface GeoColumnMapping {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

interface GeoColumnAnalysis {
  mapping: GeoColumnMapping;
  hasGeoData: boolean;
  geoColumnCount: number;
  coverage: number; // percentage of geo columns present
}

class GeoColumnDetector {
  private readonly geoPatterns = {
    address: /^(address|addr|street|location|residence|home_address|mailing_address|physical_address)$/i,
    city: /^(city|town|municipality|locality|urban_area)$/i,
    state: /^(state|province|region|territory|administrative_area|prefecture)$/i,
    country: /^(country|nation|nationality|country_code|country_name)$/i,
    postalCode: /^(zip|postal_code|postcode|zip_code|pincode|pin_code|pin|zipcode|postal)$/i
  };

  detectGeoColumns(columns: ColumnInfo[]): GeoColumnAnalysis {
    const mapping: GeoColumnMapping = {};
    let geoColumnCount = 0;

    columns.forEach(column => {
      const columnName = column.name.toLowerCase().trim();
      
      // Check for address patterns
      if (this.geoPatterns.address.test(columnName) || column.dataType === 'Address') {
        mapping.address = column.name;
        geoColumnCount++;
      }
      
      // Check for city patterns
      if (this.geoPatterns.city.test(columnName) || column.dataType === 'City') {
        mapping.city = column.name;
        geoColumnCount++;
      }
      
      // Check for state patterns
      if (this.geoPatterns.state.test(columnName) || column.dataType === 'State') {
        mapping.state = column.name;
        geoColumnCount++;
      }
      
      // Check for country patterns
      if (this.geoPatterns.country.test(columnName) || column.dataType === 'Country') {
        mapping.country = column.name;
        geoColumnCount++;
      }
      
      // Enhanced postal code patterns - now includes pincode variations
      if (this.geoPatterns.postalCode.test(columnName) || column.dataType === 'Postal Code') {
        mapping.postalCode = column.name;
        geoColumnCount++;
      }
    });

    const coverage = (geoColumnCount / 5) * 100; // 5 possible geo columns
    const hasGeoData = geoColumnCount > 0;

    return {
      mapping,
      hasGeoData,
      geoColumnCount,
      coverage
    };
  }

  isGeoColumn(columnName: string, dataType: DataType): boolean {
    const name = columnName.toLowerCase().trim();
    return Object.values(this.geoPatterns).some(pattern => pattern.test(name)) ||
           ['Address', 'City', 'State', 'Country', 'Postal Code'].includes(dataType);
  }

  getGeoColumnType(columnName: string, dataType: DataType): keyof GeoColumnMapping | null {
    const name = columnName.toLowerCase().trim();
    
    if (this.geoPatterns.address.test(name) || dataType === 'Address') return 'address';
    if (this.geoPatterns.city.test(name) || dataType === 'City') return 'city';
    if (this.geoPatterns.state.test(name) || dataType === 'State') return 'state';
    if (this.geoPatterns.country.test(name) || dataType === 'Country') return 'country';
    if (this.geoPatterns.postalCode.test(name) || dataType === 'Postal Code') return 'postalCode';
    
    return null;
  }
}

export { GeoColumnDetector, type GeoColumnMapping, type GeoColumnAnalysis };
