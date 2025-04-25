import { utils, write } from 'xlsx';
import { ColumnInfo, ExportFormat, FileData, MaskingConfig } from "@/types";

// Convert JSON to CSV
export const jsonToCSV = (data: Record<string, string>[], columns: ColumnInfo[]): string => {
  // Only use columns that aren't skipped
  const activeColumns = columns.filter(col => !col.skip);
  
  // Create header row
  const header = activeColumns.map(col => col.name).join(',');
  
  // Create data rows
  const rows = data.map(row => {
    return activeColumns.map(col => {
      // Handle values that contain commas by wrapping in quotes
      const value = row[col.name] || '';
      return value.includes(',') ? `"${value}"` : value;
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
};

// Convert JSON to XML
export const jsonToXML = (data: Record<string, string>[], columns: ColumnInfo[], config: MaskingConfig): string => {
  // Only use columns that aren't skipped
  const activeColumns = columns.filter(col => !col.skip);
  
  // Create XML structure
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${config.tableName || 'Data'}>\n`;
  
  data.forEach((row, index) => {
    xml += `  <row id="${index + 1}">\n`;
    
    activeColumns.forEach(col => {
      const value = row[col.name] || '';
      // Escape XML special characters
      const escapedValue = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
      
      xml += `    <${col.name}>${escapedValue}</${col.name}>\n`;
    });
    
    xml += '  </row>\n';
  });
  
  xml += `</${config.tableName || 'Data'}>`;
  
  return xml;
};

// Convert JSON to SQL with conditional CREATE TABLE
export const jsonToSQL = (data: Record<string, string>[], columns: ColumnInfo[], config: MaskingConfig): string => {
  // Only use columns that aren't skipped
  const activeColumns = columns.filter(col => !col.skip);
  const tableName = config.tableName || 'masked_data';
  
  let sql = '';
  
  // Add CREATE TABLE statement only if createTableSQL is true
  if (config.createTableSQL) {
    sql += `CREATE TABLE ${tableName} (\n`;
    
    // Map data types to SQL data types
    const sqlTypeMap: Record<string, string> = {
      'Int': 'INT',
      'Float': 'FLOAT',
      'String': 'VARCHAR(255)',
      'Text': 'TEXT',
      'Bool': 'BOOLEAN',
      'Date': 'DATE',
      'Time': 'TIME',
      'Date Time': 'DATETIME',
      'Email': 'VARCHAR(255)',
      'Phone Number': 'VARCHAR(20)',
      'Name': 'VARCHAR(100)',
      'First Name': 'VARCHAR(50)',
      'Last Name': 'VARCHAR(50)',
      'Address': 'VARCHAR(255)',
      'City': 'VARCHAR(100)',
      'State': 'VARCHAR(100)',
      'Country': 'VARCHAR(100)',
      'Zipcode': 'VARCHAR(20)',
      'Postal Code': 'VARCHAR(20)',
      'Credit card number': 'VARCHAR(25)',
      'Currency': 'DECIMAL(10,2)',
      'Gender': 'VARCHAR(20)',
      'Company': 'VARCHAR(100)',
      'Job': 'VARCHAR(100)',
      'Date of birth': 'DATE',
      'User agent': 'TEXT',
      'Password': 'VARCHAR(255)',
      'Timezone': 'VARCHAR(50)',
      'Year': 'INT'
    };
    
    sql += activeColumns.map(col => {
      const sqlType = sqlTypeMap[col.dataType] || 'VARCHAR(255)';
      return `  ${col.name} ${sqlType}`;
    }).join(',\n');
    
    sql += '\n);\n\n';
  }
  
  // Add INSERT statements
  sql += `INSERT INTO ${tableName} (${activeColumns.map(col => col.name).join(', ')})\nVALUES\n`;
  
  // Add data rows
  sql += data.map(row => {
    return `(${activeColumns.map(col => {
      const value = row[col.name] || '';
      
      // Handle different data types
      if (['Int', 'Float', 'Bool'].includes(col.dataType)) {
        return value === '' ? 'NULL' : value;
      } else {
        // Escape single quotes for string values
        return `'${value.replace(/'/g, "''")}'`;
      }
    }).join(', ')})`;
  }).join(',\n');
  
  sql += ';';
  
  return sql;
};

// Convert JSON to Excel
export const jsonToExcel = (data: Record<string, string>[], columns: ColumnInfo[]): Blob => {
  const activeColumns = columns.filter(col => !col.skip);
  const headers = activeColumns.map(col => col.name);
  
  // Prepare worksheet data
  const wsData = [
    headers,
    ...data.map(row => activeColumns.map(col => row[col.name] || ''))
  ];
  
  // Create worksheet
  const ws = utils.aoa_to_sheet(wsData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Masked Data');
  
  // Generate Excel file
  const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// Export data in the specified format
export const exportData = (
  fileData: FileData,
  format: ExportFormat,
  config: MaskingConfig
): { data: string | Blob, filename: string, mimeType: string } => {
  const { fileName, columns, data } = fileData;
  const baseFileName = fileName.split('.')[0];
  const activeColumns = columns.filter(col => !col.skip);
  
  switch (format) {
    case 'CSV': {
      const csvData = jsonToCSV(data, activeColumns);
      return {
        data: csvData,
        filename: `${baseFileName}_masked.csv`,
        mimeType: 'text/csv'
      };
    }
    
    case 'JSON': {
      // Create a new array with only non-skipped columns
      const jsonData = data.map(row => {
        const filteredRow: Record<string, string> = {};
        activeColumns.forEach(col => {
          filteredRow[col.name] = row[col.name] || '';
        });
        return filteredRow;
      });
      
      return {
        data: JSON.stringify(jsonData, null, 2),
        filename: `${baseFileName}_masked.json`,
        mimeType: 'application/json'
      };
    }
    
    case 'XML': {
      const xmlData = jsonToXML(data, activeColumns, config);
      return {
        data: xmlData,
        filename: `${baseFileName}_masked.xml`,
        mimeType: 'application/xml'
      };
    }
    
    case 'SQL': {
      const sqlData = jsonToSQL(data, activeColumns, config);
      return {
        data: sqlData,
        filename: `${baseFileName}_masked.sql`,
        mimeType: 'text/plain'
      };
    }
    
    case 'Excel': {
      return {
        data: jsonToExcel(data, activeColumns),
        filename: `${baseFileName}_masked.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    }
    
    default: {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }
};

// Download the exported data
export const downloadFile = (
  data: string | Blob, 
  filename: string, 
  mimeType: string
): void => {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};
