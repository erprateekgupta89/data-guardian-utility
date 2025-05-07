
export type DataType = 
  | 'Email'
  | 'Address'
  | 'Country'
  | 'Name'
  | 'First Name'
  | 'Last Name'
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
  | 'Unknown';

export interface ColumnInfo {
  id: string;
  name: string;
  dataType: DataType;
  sampleData: string;
  skip: boolean;
}

export interface FileData {
  fileName: string;
  fileType: 'csv' | 'excel';
  columns: ColumnInfo[];
  data: Record<string, string>[];
  originalData: Record<string, string>[];
  totalRows: number;
}

export type ExportFormat = 'CSV' | 'Excel' | 'SQL' | 'XML' | 'JSON';

export interface MaskingConfig {
  preserveFormat: boolean;
  createTableSQL: boolean;
  tableName: string;
}
