
import { useState, useEffect } from 'react';
import { Check, Table } from 'lucide-react';
import { ColumnInfo, DataType, FileData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface DataPreviewProps {
  fileData: FileData;
  onColumnsUpdate: (columns: ColumnInfo[]) => void;
}

const DATA_TYPES: DataType[] = [
  'Email',
  'Address',
  'Country',
  'Name',
  'First Name',
  'Last Name',
  'Phone Number',
  'Int',
  'Float',
  'String',
  'Bool',
  'Gender',
  'Date',
  'Time',
  'Date Time',
  'City',
  'Currency',
  'State',
  'Zipcode',
  'Credit card number',
  'User agent',
  'Postal Code',
  'Year',
  'Company',
  'Date of birth',
  'Job',
  'Text',
  'Password',
  'Timezone',
];

const DataPreview = ({ fileData, onColumnsUpdate }: DataPreviewProps) => {
  const [columns, setColumns] = useState<ColumnInfo[]>(fileData.columns);
  
  // Update local columns state when fileData changes
  useEffect(() => {
    setColumns(fileData.columns);
  }, [fileData.columns]);
  
  // Handle data type change
  const handleDataTypeChange = (columnId: string, newType: DataType) => {
    const updatedColumns = columns.map(col => {
      if (col.id === columnId) {
        return { ...col, dataType: newType };
      }
      return col;
    });
    
    setColumns(updatedColumns);
    onColumnsUpdate(updatedColumns);
  };
  
  // Handle skip checkbox change
  const handleSkipChange = (columnId: string, checked: boolean) => {
    const updatedColumns = columns.map(col => {
      if (col.id === columnId) {
        return { ...col, skip: checked };
      }
      return col;
    });
    
    setColumns(updatedColumns);
    onColumnsUpdate(updatedColumns);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-medium">
          <div className="flex items-center">
            <Table className="w-5 h-5 mr-2" />
            Data Preview
          </div>
        </CardTitle>
        <Badge variant="outline" className="font-normal">
          {fileData.totalRows} rows
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] rounded-md">
          <UITable>
            <TableHeader className="bg-gray-100 sticky top-0">
              <TableRow>
                <TableHead className="w-[250px]">Column Name</TableHead>
                <TableHead className="w-[250px]">Sample Data</TableHead>
                <TableHead className="w-[200px]">Data Type</TableHead>
                <TableHead className="w-[100px] text-center">Skip Masking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((column) => (
                <TableRow key={column.id}>
                  <TableCell className="font-medium">{column.name}</TableCell>
                  <TableCell>
                    <div className="max-w-[250px] truncate">
                      {column.sampleData}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={column.dataType}
                      onValueChange={(value) => handleDataTypeChange(column.id, value as DataType)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select data type" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="max-h-[200px] overflow-y-auto">
                          {DATA_TYPES.map(type => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        id={`skip-${column.id}`}
                        checked={column.skip}
                        onCheckedChange={(checked) => 
                          handleSkipChange(column.id, checked === true)
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </UITable>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DataPreview;
