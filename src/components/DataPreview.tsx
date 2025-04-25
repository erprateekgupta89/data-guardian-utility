import { useState, useEffect } from 'react';
import { Table } from 'lucide-react';
import { ColumnInfo, DataType, FileData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const DATA_TYPES: DataType[] = [
  'Address',
  'Bool',
  'City',
  'Company',
  'Country',
  'Credit card number',
  'Currency',
  'Date',
  'Date Time',
  'Date of birth',
  'Email',
  'First Name',
  'Float',
  'Gender',
  'Int',
  'Job',
  'Last Name',
  'Name',
  'Password',
  'Phone Number',
  'Postal Code',
  'State',
  'String',
  'Text',
  'Time',
  'Timezone',
  'User agent',
  'Year',
  'Zipcode',
];

const DataPreview = ({ fileData, onColumnsUpdate }: DataPreviewProps) => {
  const [columns, setColumns] = useState<ColumnInfo[]>(fileData.columns);
  
  useEffect(() => {
    setColumns(fileData.columns);
  }, [fileData.columns]);
  
  const inferDataTypeFromName = (columnName: string): DataType => {
    const name = columnName.toLowerCase();
    
    if (/email|e-mail/.test(name)) return 'Email';
    if (/phone|mobile|contact|cell/.test(name)) return 'Phone Number';
    if (/^name$|full.?name|customer.?name/.test(name)) return 'Name';
    if (/first.?name|given.?name/.test(name)) return 'First Name';
    if (/last.?name|family.?name|sur.?name/.test(name)) return 'Last Name';
    if (/address|location|residence/.test(name)) return 'Address';
    if (/city|town|municipality/.test(name)) return 'City';
    if (/state|province|region/.test(name)) return 'State';
    if (/country|nation/.test(name)) return 'Country';
    if (/zip|postal|pin.?code/.test(name)) return 'Postal Code';
    if (/gender|sex/.test(name)) return 'Gender';
    if (/dob|birth|born/.test(name)) return 'Date of birth';
    if (/date/.test(name)) return 'Date';
    if (/time/.test(name)) return 'Time';
    if (/datetime|timestamp/.test(name)) return 'Date Time';
    if (/credit.?card|card.?number|cc.?number/.test(name)) return 'Credit card number';
    if (/company|organization|business/.test(name)) return 'Company';
    if (/job|position|title|role|occupation/.test(name)) return 'Job';
    if (/price|cost|amount|salary|income|pay/.test(name)) return 'Currency';
    if (/password|pwd|pass/.test(name)) return 'Password';
    if (/agent|browser|useragent/.test(name)) return 'User agent';
    if (/zip|postal/.test(name)) return 'Zipcode';
    
    return 'Unknown';
  };

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
          <div className="overflow-x-auto">
            <UITable>
              <TableHeader className="bg-gray-100 sticky top-0">
                <TableRow>
                  <TableHead className="w-[250px]">Column Name</TableHead>
                  <TableHead className="w-[200px]">Data Type</TableHead>
                  <TableHead className="w-[100px] text-center">Skip Masking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => (
                  <TableRow key={column.id}>
                    <TableCell className="font-medium">{column.name}</TableCell>
                    <TableCell>
                      <Select
                        value={column.dataType !== 'Unknown' ? column.dataType : ''}
                        onValueChange={(value) => handleDataTypeChange(column.id, value as DataType)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select data type" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-[200px]">
                            {DATA_TYPES.map(type => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </ScrollArea>
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
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default DataPreview;
