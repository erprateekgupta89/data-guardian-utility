import { useState } from 'react';
import { Table, Info } from 'lucide-react';
import { ColumnInfo, DataType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DataPreviewProps {
  columns: ColumnInfo[];
  onColumnsUpdate: (columns: ColumnInfo[]) => void;
}

const DATA_TYPES: DataType[] = [
  'Address',
  'Bool',
  'City',
  'Company',
  'Country',
  'Date',
  'Date Time',
  'Date of birth',
  'Email',
  // 'First Name',
  'Float',
  'Gender',
  'Int',
  // 'Last Name',
  'Name',
  'Password',
  'Phone Number',
  'Postal Code',
  'State',
  'String',
  'Text',
  'Time',
  'Year',
];

const DataPreview = ({ columns: initialColumns, onColumnsUpdate }: DataPreviewProps) => {
  const [columns, setColumns] = useState<ColumnInfo[]>(initialColumns);
  const [userSelectedTypes, setUserSelectedTypes] = useState<Set<string>>(new Set());
  const [automaticInference, setAutomaticInference] = useState(true);

  const handleDataTypeChange = (columnId: string, newType: DataType) => {
    const updatedColumns = columns.map(col => {
      if (col.id === columnId) {
        return { ...col, dataType: newType, userModified: true };
      }
      return col;
    });
    setColumns(updatedColumns);
    setUserSelectedTypes(prev => new Set([...prev, columnId]));
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

  // Helper function to determine badge color and get tooltip text based on data type
  const getDataTypeBadgeColor = (dataType: DataType, columnId: string) => {
    if (dataType === 'Unknown') return 'bg-gray-200 text-gray-800';
    
    const sensitiveTypes = ['Email', 'Phone Number', 'Name', 'Address'];
    if (sensitiveTypes.includes(dataType)) return 'bg-amber-100 text-amber-800';
    
    return 'bg-emerald-100 text-emerald-800';
  };
  
  // Helper function to get tooltip content based on badge color
  const getTooltipContent = (dataType: DataType, columnId: string) => {
    if (dataType === 'Unknown') {
      return "Data type could not be automatically determined";
    }
    
    const sensitiveTypes = ['Email', 'Phone Number', 'Name', 'Address'];
    if (sensitiveTypes.includes(dataType)) {
      return `Detection uncertain: Please review and confirm if "${dataType}" is the correct type for this data`;
    }
    
    return `Detected ${dataType} format based on content pattern`;
  };

  // Helper function to get badge text
  const getBadgeText = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    return column?.userModified ? 'User-selected' : 'Auto-detected';
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
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>The system automatically detects data types based on column names and content patterns. You can manually adjust if needed.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Badge variant="outline" className="font-normal">
            {columns.length} columns
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] rounded-md">
          <div className="overflow-x-auto">
            <UITable>
              <TableHeader className="bg-gray-100 sticky top-0">
                <TableRow>
                  <TableHead className="w-[250px]">Exported Column Name</TableHead>
                  <TableHead className="w-[200px]">Expected Field Type</TableHead>
                  <TableHead className="w-[100px] text-center">Skip Masking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => (
                  <TableRow key={column.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{column.name}</span>
                        {column.sampleData && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Sample: {column.sampleData}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge 
                            className={`${getDataTypeBadgeColor(column.dataType, column.id)} px-2 py-0.5 text-xs font-normal`}
                          >
                            {getBadgeText(column.id)}
                          </Badge>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Info className="h-4 w-4 text-gray-400" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {getTooltipContent(column.dataType, column.id)}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
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
                      </div>
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
