
import { useState } from 'react';
import { Download, FileDown, FileUp, Database } from 'lucide-react';
import { ExportFormat, FileData, ColumnInfo, MaskingConfig } from '@/types';
import { downloadFile, exportData } from '@/utils/exportUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExportOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  maskedData: Record<string, string>[];
}

const ExportOptions = ({ fileData, columns, maskedData }: ExportOptionsProps) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  
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
  
  // Show a preview of the masked data
  const previewColumns = columns.filter(col => !col.skip).slice(0, 5);
  const previewRows = maskedData.slice(0, 5);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          <div className="flex items-center">
            <Database className="w-5 h-5 mr-2" /> 
            Masked Data Preview & Export
          </div>
        </CardTitle>
        <CardDescription>
          Preview of masked data. Export in your preferred format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScrollArea className="h-[300px] w-full rounded-md border">
          <Table>
            <TableHeader className="bg-gray-50 sticky top-0">
              <TableRow>
                {previewColumns.map(column => (
                  <TableHead key={column.id}>{column.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, idx) => (
                <TableRow key={idx}>
                  {previewColumns.map(column => (
                    <TableCell key={column.id} className="truncate max-w-[200px]">
                      {row[column.name]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        
        <div>
          <h3 className="font-medium text-sm mb-3">Export Format</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(['CSV', 'Excel', 'JSON', 'SQL', 'XML', 'All'] as ExportFormat[]).map((format) => (
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
