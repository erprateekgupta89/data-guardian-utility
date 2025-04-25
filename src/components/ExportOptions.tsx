
import { useState } from 'react';
import { Download, FileDown, Database, RotateCcw } from 'lucide-react';
import { ExportFormat, FileData, ColumnInfo, MaskingConfig } from '@/types';
import { downloadFile, exportData } from '@/utils/exportUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface ExportOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  maskedData: Record<string, string>[];
  onReset: () => void;
}

const ExportOptions = ({ fileData, columns, maskedData, onReset }: ExportOptionsProps) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25; // Increased from 10 to 25
  
  const handleExport = (format: ExportFormat) => {
    setExportFormat(format);
    setIsExporting(true);
    
    try {
      // Create config for export
      const config: MaskingConfig = {
        preserveFormat: true,
        createTableSQL: true,
        tableName: 'masked_data'
      };
      
      // Create updated file data with masked data
      const updatedFileData: FileData = {
        ...fileData,
        data: maskedData
      };
      
      // Export the data
      const { data, filename, mimeType } = exportData(updatedFileData, format, config);
      
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['CSV', 'Excel', 'JSON', 'SQL', 'XML'] as ExportFormat[]).map((format) => (
              <Button
                key={format}
                variant={exportFormat === format ? "default" : "outline"}
                className={exportFormat === format ? "bg-masking-secondary hover:bg-masking-primary" : ""}
                onClick={() => handleExport(format)}
                disabled={isExporting}
              >
                <FileDown className="mr-2 h-4 w-4" />
                {format}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="text-center text-gray-500 text-sm pt-2">
          {isExporting ? 'Exporting...' : 'Click on a format above to export'}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExportOptions;
