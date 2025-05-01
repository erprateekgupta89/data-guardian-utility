
import { useState } from 'react';
import { FileDown, Database, RotateCcw, Check } from 'lucide-react';
import { ExportFormat, FileData, ColumnInfo, MaskingConfig } from '@/types';
import { downloadFile, exportData } from '@/utils/exportUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ExportOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  maskedData: Record<string, string>[];
  maskingConfig: MaskingConfig;
  onReset: () => void;
}

interface SqlOptions {
  createTableSQL: boolean;
  updateSchemaOnly: boolean;
  tableName: string;
}

const ExportOptions = ({ fileData, columns, maskedData, maskingConfig, onReset }: ExportOptionsProps) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sqlOptions, setSqlOptions] = useState<SqlOptions>({
    createTableSQL: maskingConfig.createTableSQL || true,
    updateSchemaOnly: false,
    tableName: maskingConfig.tableName || 'masked_data'
  });
  const rowsPerPage = 25;

  const handleExport = (format: ExportFormat) => {
    setExportFormat(format);
    setIsExporting(true);
    
    try {
      // Update SQL options in maskingConfig if SQL format is selected
      let updatedMaskingConfig = { ...maskingConfig };
      if (format === 'SQL') {
        updatedMaskingConfig = {
          ...maskingConfig,
          createTableSQL: sqlOptions.createTableSQL,
          tableName: sqlOptions.tableName,
        };
      }
      
      // Create updated file data with masked data
      const updatedFileData: FileData = {
        ...fileData,
        data: maskedData
      };
      
      // Export the data using the passed maskingConfig
      const { data, filename, mimeType } = exportData(updatedFileData, format, updatedMaskingConfig);
      
      // Download the file
      downloadFile(data, filename, mimeType);
      
      toast.success(`Successfully exported as ${format}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export as ${format}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Show a preview of the masked data with pagination
  const filteredColumns = columns.filter(col => !col.skip);
  const totalPages = Math.ceil(maskedData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = maskedData.slice(startIndex, startIndex + rowsPerPage);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset? This will clear all current data.')) {
      onReset();
      toast.success('Data has been reset successfully');
    }
  };

  // Handle SQL options change
  const handleSqlOptionChange = (option: keyof SqlOptions, value: any) => {
    setSqlOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const exportFormats: ExportFormat[] = ['CSV', 'Excel', 'JSON', 'SQL', 'XML'];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Database className="w-5 h-5 mr-2" /> 
              Masked Data Preview & Export
            </div>
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Data
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Preview of masked data. Export in your preferred format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border">
          <ScrollArea className="h-[400px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    {filteredColumns.map(column => (
                      <TableHead key={column.id} className="min-w-[150px]">{column.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {filteredColumns.map(column => (
                        <TableCell key={column.id} className="min-w-[150px] whitespace-nowrap">
                          {row[column.name]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
        
        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
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
                      <Button
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
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

        <div className="space-y-4">
          <h3 className="font-medium text-sm mb-3">Export Format</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {exportFormats.map((format) => (
              <Button
                key={format}
                variant={exportFormat === format ? "default" : "outline"}
                className={exportFormat === format ? "bg-masking-secondary hover:bg-masking-primary" : ""}
                onClick={() => setExportFormat(format)}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {format}
              </Button>
            ))}
          </div>

          {/* SQL-specific options - only shown when SQL is selected */}
          {exportFormat === 'SQL' && (
            <div className="p-4 border rounded-md mt-4 bg-gray-50">
              <h4 className="font-medium mb-3">SQL Export Options</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tableName">Table Name</Label>
                    <Input
                      id="tableName"
                      value={sqlOptions.tableName}
                      onChange={(e) => handleSqlOptionChange('tableName', e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Export Type</Label>
                    <RadioGroup 
                      value={sqlOptions.createTableSQL ? "create" : "update"} 
                      onValueChange={(value) => handleSqlOptionChange('createTableSQL', value === "create")}
                      className="grid gap-2 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="create" id="create-table" />
                        <Label htmlFor="create-table" className="cursor-pointer">Include CREATE TABLE</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="update" id="update-only" />
                        <Label htmlFor="update-only" className="cursor-pointer">Update Data Schema Only</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => handleExport(exportFormat)}
              disabled={isExporting}
              className="bg-masking-primary hover:bg-masking-secondary"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export as {exportFormat}
            </Button>
          </div>
          
          <div className="text-center text-gray-500 text-sm pt-2">
            {isExporting ? 'Exporting...' : 'Selected format: ' + exportFormat}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExportOptions;
