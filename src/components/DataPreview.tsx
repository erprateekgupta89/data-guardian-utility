
import { useState, useEffect } from 'react';
import { Table } from 'lucide-react';
import { ColumnInfo, DataType, FileData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';

interface DataPreviewProps {
  fileData: FileData;
  onColumnsUpdate: (columns: ColumnInfo[]) => void;
}

// Sort data types alphabetically
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
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
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

  // Calculate pagination
  const totalPages = Math.ceil(columns.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedColumns = columns.slice(startIndex, startIndex + rowsPerPage);

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
              {paginatedColumns.map((column) => (
                <TableRow key={column.id}>
                  <TableCell className="font-medium">{column.name}</TableCell>
                  <TableCell>
                    <div className="max-w-[250px] truncate">
                      {column.sampleData}
                    </div>
                  </TableCell>
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
        </ScrollArea>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center py-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                </PaginationItem>
                
                {/* Generate page number links */}
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let pageNum: number;
                  
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pageNum === currentPage}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataPreview;
