
interface CountryRegions {
  [country: string]: {
    regions: string[];
    majorCities: string[];
    postalCodeFormat: string;
    addressFormat: string;
  };
}

interface RegionalRequirements {
  country: string;
  preferredRegions: string[];
  cityDistribution: 'major' | 'mixed' | 'diverse';
  addressTypes: ('residential' | 'commercial' | 'mixed')[];
}

class GeoReferenceSystem {
  private countryData: CountryRegions = {
    'United States': {
      regions: ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West Coast', 'Mountain West'],
      majorCities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'],
      postalCodeFormat: '##### or #####-####',
      addressFormat: 'Street Number Street Name, City, State ZIP'
    },
    'Canada': {
      regions: ['Atlantic', 'Central', 'Prairie', 'West Coast', 'North'],
      majorCities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Winnipeg', 'Quebec City'],
      postalCodeFormat: 'A#A #A#',
      addressFormat: 'Street Number Street Name, City, Province Postal Code'
    },
    'United Kingdom': {
      regions: ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      majorCities: ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Sheffield', 'Edinburgh'],
      postalCodeFormat: 'AA# #AA or A## #AA',
      addressFormat: 'Street Number Street Name, City, County, Postcode'
    },
    'Australia': {
      regions: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Northern Territory', 'Australian Capital Territory'],
      majorCities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra'],
      postalCodeFormat: '####',
      addressFormat: 'Street Number Street Name, Suburb, State ####'
    },
    'Germany': {
      regions: ['Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg', 'Lower Saxony', 'Hesse', 'Saxony', 'Rhineland-Palatinate', 'Berlin'],
      majorCities: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Dortmund'],
      postalCodeFormat: '#####',
      addressFormat: 'Street Name Street Number, ##### City'
    },
    'France': {
      regions: ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Hauts-de-France', 'Nouvelle-Aquitaine', 'Occitanie', 'Grand Est', 'Provence-Alpes-Côte d\'Azur', 'Pays de la Loire'],
      majorCities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg'],
      postalCodeFormat: '#####',
      addressFormat: 'Street Number Street Name, ##### City'
    },
    'Japan': {
      regions: ['Kanto', 'Kansai', 'Chubu', 'Kyushu', 'Tohoku', 'Chugoku', 'Shikoku', 'Hokkaido'],
      majorCities: ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kyoto'],
      postalCodeFormat: '###-####',
      addressFormat: 'Prefecture, City, District, Street Number'
    },
    'India': {
      regions: ['North India', 'South India', 'East India', 'West India', 'Central India', 'Northeast India'],
      majorCities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune'],
      postalCodeFormat: '######',
      addressFormat: 'Street Number Street Name, Area, City, State ######'
    },
    'Brazil': {
      regions: ['Southeast', 'Northeast', 'South', 'North', 'Central-West'],
      majorCities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba'],
      postalCodeFormat: '#####-###',
      addressFormat: 'Street Name, Street Number, Neighborhood, City - State, #####-###'
    },
    'China': {
      regions: ['North China', 'Northeast China', 'East China', 'South Central China', 'Southwest China', 'Northwest China'],
      majorCities: ['Shanghai', 'Beijing', 'Shenzhen', 'Guangzhou', 'Chengdu', 'Tianjin', 'Hangzhou', 'Wuhan'],
      postalCodeFormat: '######',
      addressFormat: 'Province, City, District, Street Name Street Number, ######'
    }
  };

  getCountryInfo(country: string) {
    return this.countryData[country] || {
      regions: ['Central', 'North', 'South', 'East', 'West'],
      majorCities: ['Capital City', 'Major City', 'Commercial Center'],
      postalCodeFormat: '#####',
      addressFormat: 'Street Number Street Name, City, Region'
    };
  }

  generateRegionalRequirements(country: string, distributionType: 'even' | 'major_cities' | 'diverse' = 'diverse'): RegionalRequirements {
    const countryInfo = this.getCountryInfo(country);
    
    let preferredRegions: string[];
    let cityDistribution: 'major' | 'mixed' | 'diverse';
    
    switch (distributionType) {
      case 'major_cities':
        preferredRegions = countryInfo.regions.slice(0, 3); // Top 3 regions
        cityDistribution = 'major';
        break;
      case 'even':
        preferredRegions = countryInfo.regions;
        cityDistribution = 'mixed';
        break;
      default:
        preferredRegions = countryInfo.regions;
        cityDistribution = 'diverse';
    }

    return {
      country,
      preferredRegions,
      cityDistribution,
      addressTypes: ['residential', 'commercial', 'mixed']
    };
  }

  getSpecificRequirements(country: string, regions?: string[]): string {
    const countryInfo = this.getCountryInfo(country);
    let requirements = `Generate addresses following ${country} conventions. `;
    requirements += `Postal code format: ${countryInfo.postalCodeFormat}. `;
    requirements += `Address format: ${countryInfo.addressFormat}. `;
    
    if (regions?.length) {
      requirements += `Focus on these regions: ${regions.join(', ')}. `;
    } else {
      requirements += `Distribute across regions: ${countryInfo.regions.join(', ')}. `;
    }
    
    return requirements;
  }

  validateAddressFormat(address: any, country: string): boolean {
    const countryInfo = this.getCountryInfo(country);
    // Basic validation - can be enhanced based on specific country requirements
    return address.street && address.city && address.state && address.postalCode;
  }
}

export { GeoReferenceSystem, type RegionalRequirements };
