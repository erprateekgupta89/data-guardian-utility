import { faker } from '@faker-js/faker';
import { ColumnInfo, DataType } from '../types';
import { PatternAnalysis } from './patternAnalysis';

// Configuration for deterministic masking per row
interface FakerMaskingOptions {
  preserveFormat: boolean;
  useCountryLocale: boolean;
  selectedCountries?: string[];
  seed?: number;
}

// Map country names to Faker locale codes
const COUNTRY_LOCALE_MAP: Record<string, string> = {
  'United States': 'en_US',
  'Canada': 'en_CA',
  'United Kingdom': 'en_GB',
  'Australia': 'en_AU',
  'Germany': 'de',
  'France': 'fr',
  'Spain': 'es',
  'Italy': 'it',
  'Japan': 'ja',
  'China': 'zh_CN',
  'India': 'en_IN',
  'Brazil': 'pt_BR',
  'Mexico': 'es_MX',
  'South Africa': 'en_ZA',
  'Russia': 'ru',
  'South Korea': 'ko',
  'Netherlands': 'nl',
  'Sweden': 'sv',
  'Norway': 'nb_NO',
  'Denmark': 'da',
  'Finland': 'fi',
  'Switzerland': 'de_CH',
  'Austria': 'de_AT',
  'Belgium': 'nl_BE',
  'Portugal': 'pt_PT',
  'Greece': 'el',
  'Ireland': 'en_IE',
  'New Zealand': 'en_NZ',
  'Singapore': 'en_SG',
  'Malaysia': 'en_MY',
  'Thailand': 'th',
  'Indonesia': 'id_ID',
  'Philippines': 'en_PH',
  'Vietnam': 'vi',
  'Turkey': 'tr'
};

export class FakerMasking {
  private options: FakerMaskingOptions;
  private currentCountry: string = 'United States';
  private rowCountryMap: Map<number, string> = new Map();

  constructor(options: FakerMaskingOptions = { preserveFormat: true, useCountryLocale: true }) {
    this.options = options;
  }

  // Set locale based on country for geographic consistency
  private setLocaleForCountry(country: string): void {
    // For now, we'll use the default locale and implement country-specific logic later
    this.currentCountry = country;
    console.log(`Setting country context to: ${country}`);
  }

  // Initialize country for a specific row index
  public setCountryForRow(rowIndex: number, country: string): void {
    this.rowCountryMap.set(rowIndex, country);
    if (this.options.useCountryLocale) {
      this.setLocaleForCountry(country);
    }
  }

  // Get deterministic seed for a specific row and column
  private getRowColumnSeed(rowIndex: number, columnName: string): number {
    const baseStr = `${rowIndex}-${columnName}-${this.currentCountry}`;
    let hash = 0;
    for (let i = 0; i < baseStr.length; i++) {
      const char = baseStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Generate masked data using Faker.js
  public maskData(
    value: string,
    dataType: DataType,
    rowIndex: number,
    columnName: string,
    patternAnalysis?: PatternAnalysis,
    constantValues?: string[]
  ): string {
    if (!value || value.trim() === '') return value;

    // Set deterministic seed for this specific row and column
    const seed = this.getRowColumnSeed(rowIndex, columnName);
    faker.seed(seed);

    // Handle constant values first
    if (patternAnalysis?.isConstantValue && patternAnalysis.constantValue) {
      return patternAnalysis.constantValue;
    }

    if (constantValues?.length) {
      return constantValues[Math.floor(Math.random() * constantValues.length)];
    }

    // Handle incremental patterns
    if (patternAnalysis?.hasPrefix && typeof rowIndex === 'number') {
      return `${patternAnalysis.prefix}${rowIndex + 1}`;
    }

    // Get country for this row
    const rowCountry = this.rowCountryMap.get(rowIndex) || this.currentCountry;
    if (this.options.useCountryLocale) {
      this.setLocaleForCountry(rowCountry);
    }

    switch (dataType) {
      case 'Name':
        return faker.person.fullName();

      case 'Email': {
        if (this.options.preserveFormat) {
          const originalParts = value.split('@');
          if (originalParts.length === 2) {
            const domain = originalParts[1];
            const username = faker.internet.userName().toLowerCase().replace(/[^a-z0-9]/g, '');
            return `${username}@${domain}`;
          }
        }
        return faker.internet.email();
      }

      case 'Phone Number': {
        if (this.options.preserveFormat) {
          // Preserve the format of the original phone number
          const digitsOnly = value.replace(/\D/g, '');
          const format = value.replace(/\d/g, '#');
          
          let maskedValue = '';
          let digitIndex = 0;
          const fakePhone = faker.phone.number().replace(/\D/g, '');
          
          for (let i = 0; i < format.length; i++) {
            if (format[i] === '#') {
              maskedValue += fakePhone[digitIndex % fakePhone.length] || Math.floor(Math.random() * 10);
              digitIndex++;
            } else {
              maskedValue += format[i];
            }
          }
          return maskedValue;
        }
        return faker.phone.number();
      }

      case 'Address':
        return faker.location.streetAddress();

      case 'City':
        return faker.location.city();

      case 'State':
        return faker.location.state();

      case 'Country':
        // If specific countries are selected, rotate through them
        if (this.options.selectedCountries?.length) {
          return this.options.selectedCountries[rowIndex % this.options.selectedCountries.length];
        }
        return faker.location.country();

      case 'Postal Code': {
        if (this.options.preserveFormat) {
          // Preserve format for different postal code patterns
          if (/^\d{5}(-\d{4})?$/.test(value)) {
            // US format: 12345 or 12345-6789
            if (value.includes('-')) {
              return `${faker.location.zipCode('#####')}-${faker.location.zipCode('####')}`;
            }
            return faker.location.zipCode('#####');
          } else if (/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(value)) {
            // Canadian format: K1A 0A6
            return faker.location.zipCode('A#A #A#');
          } else if (/^\d{6}$/.test(value)) {
            // 6-digit format
            return faker.location.zipCode('######');
          }
        }
        return faker.location.zipCode();
      }

      case 'Company':
        return faker.company.name();

      case 'Date': {
        if (this.options.preserveFormat) {
          const originalDate = new Date(value);
          if (!isNaN(originalDate.getTime())) {
            // Generate a date within +/- 5 years of original
            const minDate = new Date(originalDate);
            minDate.setFullYear(originalDate.getFullYear() - 5);
            const maxDate = new Date(originalDate);
            maxDate.setFullYear(originalDate.getFullYear() + 5);
            
            const fakeDate = faker.date.between({ from: minDate, to: maxDate });
            return fakeDate.toISOString().split('T')[0]; // Return in YYYY-MM-DD format
          }
        }
        return faker.date.past().toISOString().split('T')[0];
      }

      case 'Date of birth': {
        const age = faker.number.int({ min: 18, max: 80 });
        const birthDate = faker.date.birthdate({ min: age, max: age, mode: 'age' });
        return birthDate.toISOString().split('T')[0];
      }

      case 'Time': {
        const time = faker.date.recent();
        return time.toTimeString().split(' ')[0]; // HH:MM:SS format
      }

      case 'Date Time': {
        if (this.options.preserveFormat) {
          const originalDate = new Date(value);
          if (!isNaN(originalDate.getTime())) {
            const minDate = new Date(originalDate);
            minDate.setFullYear(originalDate.getFullYear() - 2);
            const maxDate = new Date(originalDate);
            maxDate.setFullYear(originalDate.getFullYear() + 2);
            
            return faker.date.between({ from: minDate, to: maxDate }).toISOString();
          }
        }
        return faker.date.recent().toISOString();
      }

      case 'Int': {
        const originalNum = parseInt(value);
        if (!isNaN(originalNum)) {
          // Generate within 50% range of original
          const min = Math.floor(originalNum * 0.5);
          const max = Math.ceil(originalNum * 1.5);
          return faker.number.int({ min, max }).toString();
        }
        return faker.number.int({ min: 1, max: 1000 }).toString();
      }

      case 'Float': {
        const originalNum = parseFloat(value);
        if (!isNaN(originalNum)) {
          const min = originalNum * 0.5;
          const max = originalNum * 1.5;
          const fractionDigits = (value.split('.')[1] || '').length || 2;
          return faker.number.float({ min, max, fractionDigits }).toString();
        }
        return faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }).toString();
      }

      case 'Bool':
        return faker.datatype.boolean().toString();

      case 'Gender': {
        const genders = ['Male', 'Female', 'Other', 'Non-binary'];
        return faker.helpers.arrayElement(genders);
      }

      case 'Nationality':
        return this.deriveNationality(rowCountry);

      case 'Password':
        return '*'.repeat(value.length);

      case 'Year': {
        const currentYear = new Date().getFullYear();
        return faker.number.int({ min: currentYear - 50, max: currentYear }).toString();
      }

      case 'Text':
      case 'String':
      default: {
        if (value.length <= 10) {
          return faker.lorem.word({ length: { min: Math.max(1, value.length - 2), max: value.length + 2 } });
        }
        return faker.lorem.words(Math.ceil(value.length / 6)).substring(0, value.length);
      }
    }
  }

  // Derive nationality from country name
  private deriveNationality(country: string): string {
    const nationalityMap: Record<string, string> = {
      'United States': 'American',
      'Canada': 'Canadian',
      'United Kingdom': 'British',
      'Australia': 'Australian',
      'Germany': 'German',
      'France': 'French',
      'Spain': 'Spanish',
      'Italy': 'Italian',
      'Japan': 'Japanese',
      'China': 'Chinese',
      'India': 'Indian',
      'Brazil': 'Brazilian',
      'Mexico': 'Mexican',
      'South Africa': 'South African',
      'Russia': 'Russian',
      'South Korea': 'South Korean',
      'Netherlands': 'Dutch',
      'Sweden': 'Swedish',
      'Norway': 'Norwegian',
      'Denmark': 'Danish',
      'Finland': 'Finnish',
      'Switzerland': 'Swiss',
      'Austria': 'Austrian',
      'Belgium': 'Belgian',
      'Portugal': 'Portuguese',
      'Greece': 'Greek',
      'Ireland': 'Irish',
      'New Zealand': 'New Zealander',
      'Singapore': 'Singaporean',
      'Malaysia': 'Malaysian',
      'Thailand': 'Thai',
      'Indonesia': 'Indonesian',
      'Philippines': 'Filipino',
      'Vietnam': 'Vietnamese',
      'Turkey': 'Turkish'
    };

    return nationalityMap[country] || 'International';
  }

  // Generate batch of addresses for specific country
  public generateAddressesForCountry(country: string, count: number): Array<{
    address: string;
    city: string;
    state: string;
    postalCode: string;
  }> {
    if (this.options.useCountryLocale) {
      this.setLocaleForCountry(country);
    }

    const addresses = [];
    for (let i = 0; i < count; i++) {
      faker.seed(this.getRowColumnSeed(i, `address-${country}`));
      addresses.push({
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode()
      });
    }

    return addresses;
  }

  // Clear row mappings (useful for new datasets)
  public clearRowMappings(): void {
    this.rowCountryMap.clear();
  }

  // Get statistics about masking operations
  public getStats(): {
    rowsProcessed: number;
    countriesUsed: string[];
    currentLocale: string;
  } {
    return {
      rowsProcessed: this.rowCountryMap.size,
      countriesUsed: Array.from(new Set(this.rowCountryMap.values())),
      currentLocale: this.currentCountry
    };
  }
}

export default FakerMasking;