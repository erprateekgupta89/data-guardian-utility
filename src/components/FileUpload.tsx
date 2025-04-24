
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { FileData } from '@/types';
import { parseCSV, detectColumnDataType } from '@/utils/dataDetection';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileLoaded: (fileData: FileData) => void;
}

const FileUpload = ({ onFileLoaded }: FileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      // Check if file is CSV or Excel
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      const isExcel = file.name.toLowerCase().match(/\.(xlsx|xls)$/);

      if (!isCSV && !isExcel) {
        toast.error('Only CSV and Excel files are supported');
        setSelectedFile(null);
        setIsUploading(false);
        return;
      }

      // For now, we'll only handle CSV files in this demo
      if (isCSV) {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);

        // Sample rows for detection
        const sampleSize = rows.length > 1000 ? 50 : rows.length;
        const sampleRows = rows.slice(0, sampleSize);

        // Detect column data types
        const columns = headers.map(header => {
          const samples = sampleRows.map(row => row[header]);
          const dataType = detectColumnDataType(samples);
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
          fileType: 'csv',
          columns,
          data: [...rows], // Copy rows
          originalData: rows,
          totalRows: rows.length
        };

        onFileLoaded(fileData);
        toast.success(`Successfully loaded ${file.name}`);
      } else if (isExcel) {
        // In a real app, you'd use a library like SheetJS to handle Excel files
        toast.error('Excel support is not implemented in this demo');
        setSelectedFile(null);
      }
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
