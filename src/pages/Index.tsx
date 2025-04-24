
import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import MaskingOptions from '@/components/MaskingOptions';
import ExportOptions from '@/components/ExportOptions';
import SettingsButton from '@/components/SettingsButton';
import { FileData, ColumnInfo } from '@/types';

const Index = () => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [maskedData, setMaskedData] = useState<Record<string, string>[]>([]);
  const [activeStep, setActiveStep] = useState<'upload' | 'preview' | 'export'>('upload');

  // Handle file upload
  const handleFileLoaded = (data: FileData) => {
    setFileData(data);
    setColumns(data.columns);
    setActiveStep('preview');
  };

  // Handle columns update
  const handleColumnsUpdate = (updatedColumns: ColumnInfo[]) => {
    setColumns(updatedColumns);
  };

  // Handle masked data
  const handleDataMasked = (data: Record<string, string>[]) => {
    setMaskedData(data);
    setActiveStep('export');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-masking-primary">
              DataMaskingUtility
            </h1>
            <SettingsButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-8">
          {/* File Upload Section */}
          <section className={activeStep !== 'upload' ? 'opacity-70' : ''}>
            <h2 className="text-xl font-semibold mb-4">Upload File</h2>
            <FileUpload onFileLoaded={handleFileLoaded} />
          </section>

          {/* Data Preview Section */}
          {fileData && (
            <section className={activeStep === 'export' ? 'opacity-70' : ''}>
              <h2 className="text-xl font-semibold mb-4">Data Type Detection</h2>
              <DataPreview
                fileData={fileData}
                onColumnsUpdate={handleColumnsUpdate}
              />
              
              {/* Masking Options */}
              <div className="mt-6">
                <MaskingOptions 
                  fileData={fileData} 
                  columns={columns}
                  onDataMasked={handleDataMasked}
                />
              </div>
            </section>
          )}

          {/* Masked Data Preview & Export */}
          {maskedData.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Result & Export</h2>
              <ExportOptions 
                fileData={fileData!} 
                columns={columns}
                maskedData={maskedData}
              />
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-gray-500 text-sm">
            DataMaskingUtility - Securely mask your sensitive data
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
