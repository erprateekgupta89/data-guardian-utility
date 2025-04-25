
import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import MaskingOptions from '@/components/MaskingOptions';
import ExportOptions from '@/components/ExportOptions';
import SettingsButton from '@/components/SettingsButton';
import { FileData, ColumnInfo } from '@/types';
import { ResizablePanelGroup, ResizablePanel } from '@/components/ui/resizable';

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

  // Handle reset
  const handleReset = () => {
    setFileData(null);
    setColumns([]);
    setMaskedData([]);
    setActiveStep('upload');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-masking-primary">
              DataMaskingUtility
            </h1>
            <SettingsButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 py-6">
        <ResizablePanelGroup direction="horizontal" className="min-h-[80vh] rounded-lg border">
          {/* File Upload Section */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <div className="h-full p-4 bg-white">
              <h2 className="text-xl font-semibold mb-4">Upload File</h2>
              <FileUpload onFileLoaded={handleFileLoaded} />
            </div>
          </ResizablePanel>

          {/* Data Preview Section */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <div className="h-full p-4 bg-white border-x">
              <h2 className="text-xl font-semibold mb-4">Data Type Detection</h2>
              {fileData && (
                <>
                  <DataPreview
                    fileData={fileData}
                    onColumnsUpdate={handleColumnsUpdate}
                  />
                  <div className="mt-6">
                    <MaskingOptions 
                      fileData={fileData} 
                      columns={columns}
                      onDataMasked={handleDataMasked}
                    />
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          {/* Result & Export Section */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <div className="h-full p-4 bg-white">
              <h2 className="text-xl font-semibold mb-4">Result & Export</h2>
              {maskedData.length > 0 && (
                <ExportOptions 
                  fileData={fileData!} 
                  columns={columns}
                  maskedData={maskedData}
                  onReset={handleReset}
                />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-gray-500 text-sm">
            DataMaskingUtility - Securely mask your sensitive data
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
