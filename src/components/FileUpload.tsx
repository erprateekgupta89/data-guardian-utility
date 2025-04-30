
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { FileData } from '@/types';
import { parseCSV, detectColumnDataType } from '@/utils/dataDetection';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { read, utils } from 'xlsx';

interface FileUploadProps {
  onFileLoaded: (fileData: FileData) => void;
}

const FileUpload = ({ onFileLoaded }: FileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const processExcel = async (file: File): Promise<{ headers: string[], rows: Record<string, string>[] }> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json<any>(firstSheet, { header: 1 });
    
    if (data.length < 2) {
      throw new Error('Excel file is empty or has no data');
    }

    // Ensure the headers are strings
    const headers = data[0].map((header: any) => String(header));
    
    // Create rows as objects with header keys
    const rows = data.slice(1).map((row: any) => {
      const rowData: Record<string, string> = {};
      headers.forEach((header: string, index: number) => {
        rowData[header] = row[index] !== undefined ? String(row[index]) : '';
      });
      return rowData;
    });

    return { headers, rows };
  };

  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      const isExcel = file.name.toLowerCase().match(/\.(xlsx|xls)$/);

      if (!isCSV && !isExcel) {
        toast.error('Only CSV and Excel files are supported');
        setSelectedFile(null);
        setIsUploading(false);
        return;
      }

      let headers: string[];
      let rows: Record<string, string>[];

      if (isCSV) {
        const text = await file.text();
        const result = parseCSV(text);
        headers = result.headers;
        rows = result.rows;
      } else {
        const result = await processExcel(file);
        headers = result.headers;
        rows = result.rows;
      }

      // Enhanced sampling for data type detection
      // For larger datasets, take a strategic sample that includes 
      // data from beginning, middle, and end
      const totalRows = rows.length;
      let sampleRows: Record<string, string>[] = rows;
      
      if (totalRows > 100) {
        const sampleSize = Math.min(100, Math.ceil(totalRows * 0.1));
        const startSample = rows.slice(0, Math.floor(sampleSize / 3));
        const middleSample = rows.slice(
          Math.floor(totalRows / 2) - Math.floor(sampleSize / 6), 
          Math.floor(totalRows / 2) + Math.floor(sampleSize / 6)
        );
        const endSample = rows.slice(totalRows - Math.floor(sampleSize / 3));
        
        sampleRows = [...startSample, ...middleSample, ...endSample];
      }

      // Detect column data types with improved algorithm
      const columns = headers.map(header => {
        const samples = sampleRows.map(row => row[header]).filter(Boolean);
        const dataType = detectColumnDataType(samples, header);
        return {
          id: header.replace(/\s+/g, '_').toLowerCase(),
          name: header,
          dataType,
          sampleData: samples[0] || '',
          skip: false
        };
      });

      const fileData: FileData = {
        fileName: file.name,
        fileType: isCSV ? 'csv' : 'excel',
        columns,
        data: [...rows],
        originalData: rows,
        totalRows: rows.length
      };

      onFileLoaded(fileData);
      toast.success(`Successfully loaded ${file.name}`);
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process file. Please check the format and try again.');
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  }, [onFileLoaded]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      processFile(file);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all
            ${isDragActive 
              ? 'border-masking-accent bg-masking-light' 
              : 'border-gray-300 hover:border-masking-accent hover:bg-gray-50'
            }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="bg-masking-light p-3 rounded-full">
              <Upload className="h-8 w-8 text-masking-secondary" />
            </div>
            <div>
              <p className="font-medium text-gray-700">
                {isUploading ? 'Processing file...' : 'Drag & drop your file here, or click to select'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Only CSV and Excel (.xlsx, .xls) files are supported
              </p>
            </div>
            <Button variant="outline" className="mt-2">
              Browse Files
            </Button>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <div className="flex items-center">
              <div className="bg-masking-light p-2 rounded-md mr-3">
                <FileText className="h-5 w-5 text-masking-secondary" />
              </div>
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;
