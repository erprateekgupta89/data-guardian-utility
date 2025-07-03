
export type DataType = 
  | 'Email'
  | 'Address'
  | 'Country'
  | 'Name'
  | 'Phone Number'
  | 'Int'
  | 'Float'
  | 'String'
  | 'Bool'
  | 'Gender'
  | 'Date'
  | 'Time'
  | 'Date Time'
  | 'City'
  | 'State'
  | 'Postal Code'
  | 'Year'
  | 'Company'
  | 'Date of birth'
  | 'Text'
  | 'Password'
  | 'Nationality'
  | 'Credit Card'
  | 'Debit Card'
  | 'Sequential'
  | 'Unknown';

export interface ColumnInfo {
  id: string;
  name: string;
  dataType: DataType;
  sampleData: string;
  skip: boolean;
  userModified?: boolean;
  isConstant?: boolean;
  isSequential?: boolean;
  cardType?: 'visa' | 'mastercard' | 'amex' | 'discover';
  geoRegion?: string;
  preservePattern?: boolean;
}

export interface FileData {
  fileName: string;
  fileType: 'csv' | 'excel';
  columns: ColumnInfo[];
  data: Record<string, string>[];
  originalData: Record<string, string>[];
  totalRows: number;
  countryProportions?: Record<string, number>;
}

export type ExportFormat = 'CSV' | 'Excel' | 'SQL' | 'XML' | 'JSON';

export interface MaskingConfig {
  preserveFormat: boolean;
  createTableSQL: boolean;
  tableName: string;
  useCountryDropdown?: boolean;
  selectedCountries?: string[];
  hybridMode?: boolean;
  aiOptimization?: boolean;
  batchSize?: number;
  qualityThreshold?: number;
}

export interface MaskingStats {
  totalRows: number;
  processedRows: number;
  aiProcessedRows: number;
  ruleBasedRows: number;
  processingTime: number;
  qualityScore: number;
}

export interface GeoReference {
  country: string;
  cities: string[];
  states: string[];
  addresses: string[];
  postalCodes: string[];
}
