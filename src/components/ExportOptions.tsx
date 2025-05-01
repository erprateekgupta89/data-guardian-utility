
import { useState } from 'react';
import { Download, FileDown, Database, RotateCcw } from 'lucide-react';
import { ExportFormat, FileData, ColumnInfo, MaskingConfig } from '@/types';
import { downloadFile, exportData } from '@/utils/exportUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface ExportOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  maskedData: Record<string, string>[];
  maskingConfig: MaskingConfig;
  onReset: () => void;
}

const ExportOptions = ({ fileData, columns, maskedData, maskingConfig, onReset }: ExportOptionsProps) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tableName, setTableName] = useState(maskingConfig.tableName || 'masked_data');
  const [createTableSQL, setCreateTableSQL] = useState(maskingConfig.createTableSQL);
  const rowsPerPage = 25;
  
  const handleExport = (format: ExportFormat) => {
    setExportFormat(format);
    setIsExporting(true);
    
    try {
      // Update the maskingConfig with current SQL settings if SQL is selected
      const updatedConfig: MaskingConfig = {
        ...maskingConfig,
        ...(format === 'SQL' && {
          tableName,
          createTableSQL
        })
      };
      
      // Create updated file data with masked data
      const updatedFileData: FileData = {
        ...fileData,
        data: maskedData
      };
      
      // Export the data using the updated maskingConfig
      const { data, filename, mimeType } = exportData(updatedFileData, format, updatedConfig);
      
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
        
        <div>
          <h3 className="font-medium text-sm mb-3">Export Format</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['CSV', 'Excel', 'JSON', 'SQL', 'XML'] as ExportFormat[]).map((format) => (
              <Button
                key={format}
                variant="outline"
                className={`${exportFormat === format ? "bg-masking-secondary text-white hover:bg-masking-primary" : ""}`}
                onClick={() => setExportFormat(format)}
                disabled={isExporting}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {format}
              </Button>
            ))}
          </div>
        </div>
        
        {/* SQL-specific options only shown when SQL is selected */}
        {exportFormat === 'SQL' && (
          <div className="space-y-4 p-4 border rounded-md bg-gray-50">
            <div className="space-y-2">
              <Label htmlFor="tableName">SQL Table Name</Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Enter table name for SQL export"
              />
            </div>
            
            <div className="space-y-2 mt-4">
              <Label className="text-sm font-medium">SQL Export Options</Label>
              <RadioGroup 
                value={createTableSQL ? "create" : "update"} 
                onValueChange={(value) => setCreateTableSQL(value === "create")}
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
        )}
        
        <Button
          className="w-full bg-masking-secondary hover:bg-masking-primary text-white"
          onClick={() => handleExport(exportFormat)}
          disabled={isExporting}
        >
          {isExporting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </span>
          ) : (
            <span className="flex items-center">
              <Download className="mr-2 h-4 w-4" /> Export as {exportFormat}
            </span>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ExportOptions;
