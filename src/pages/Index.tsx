
import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import MaskingOptions from '@/components/MaskingOptions';
import ExportOptions from '@/components/ExportOptions';
import SettingsButton from '@/components/SettingsButton';
import { FileData, ColumnInfo, MaskingConfig } from '@/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [maskedData, setMaskedData] = useState<Record<string, string>[]>([]);
  const [maskingConfig, setMaskingConfig] = useState<MaskingConfig>({
    preserveFormat: true,
    createTableSQL: true,
    tableName: 'masked_data'
  });
  const [activeStep, setActiveStep] = useState<'upload' | 'preview' | 'result' | 'export'>('upload');

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
  const handleDataMasked = (data: Record<string, string>[], config: MaskingConfig) => {
    setMaskedData(data);
    setMaskingConfig(config);
    setActiveStep('result');
  };

  // Handle reset
  const handleReset = () => {
    setFileData(null);
    setColumns([]);
    setMaskedData([]);
    setActiveStep('upload');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Data Masker
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Securely mask sensitive data in your files
              </p>
            </div>
            <SettingsButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-full mx-auto px-4 sm:px-6 py-6">
        <Tabs 
          value={activeStep}
          onValueChange={(value) => setActiveStep(value as typeof activeStep)}
          className="w-full"
        >
          <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
            <TabsTrigger
              value="upload"
              className="h-12 px-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Upload File
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-12 px-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              disabled={!fileData}
            >
              Preview & Configure
            </TabsTrigger>
            <TabsTrigger
              value="result"
              className="h-12 px-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              disabled={!maskedData.length}
            >
              Result
            </TabsTrigger>
            <TabsTrigger
              value="export"
              className="h-12 px-8 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              disabled={!maskedData.length}
            >
              Export
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="upload" className="mt-0">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-semibold mb-4">Upload File</h2>
                <p className="text-gray-600 mb-6">
                  Upload a CSV or Excel file to begin. The application will automatically detect data types and suggest masking options.
                </p>
                <FileUpload onFileLoaded={handleFileLoaded} />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
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
            </TabsContent>

            <TabsContent value="result" className="mt-0">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                {maskedData.length > 0 && (
                  <>
                    <ExportOptions 
                      fileData={fileData!} 
                      columns={columns}
                      maskedData={maskedData}
                      maskingConfig={maskingConfig}
                      onReset={handleReset}
                      displayExportControls={false}
                      onNext={() => setActiveStep('export')}
                    />
                    <div className="flex justify-end mt-4">
                      <Button 
                        onClick={() => setActiveStep('export')} 
                        className="bg-primary"
                      >
                        Proceed to Export
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="export" className="mt-0">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                {maskedData.length > 0 && (
                  <ExportOptions 
                    fileData={fileData!} 
                    columns={columns}
                    maskedData={maskedData}
                    maskingConfig={maskingConfig}
                    onReset={handleReset}
                    displayExportControls={true}
                  />
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-full mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-gray-500 text-sm">
            Data Masker
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
