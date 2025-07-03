import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { ColumnInfo, FileData, MaskingConfig, AzureOpenAISettings } from '@/types';
import { maskDataSet } from '@/utils/masking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown } from "lucide-react";
import { Progress } from '@/components/ui/progress';
import { GeoColumnDetector } from '@/utils/geoColumnDetection';
import React from 'react';

// List of countries for the multi-select dropdown
const countries = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", 
  "France", "Spain", "Italy", "Japan", "China", "India", "Brazil", 
  "Mexico", "South Africa", "Russia", "South Korea", "Netherlands", 
  "Sweden", "Norway", "Denmark", "Finland", "Switzerland", "Austria", 
  "Belgium", "Portugal", "Greece", "Ireland", "New Zealand", "Singapore", 
  "Malaysia", "Thailand", "Indonesia", "Philippines", "Vietnam", "Turkey"
];

interface MaskingOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  onDataMasked: (maskedData: Record<string, string>[], config: MaskingConfig) => void;
}

const MaskingOptions = ({ fileData, columns, onDataMasked }: MaskingOptionsProps) => {
  const { toast } = useToast();
  const [tableName, setTableName] = useState('masked_data');
  const [preserveFormat, setPreserveFormat] = useState(true);
  const [createTableSQL, setCreateTableSQL] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Check if a country column exists in the data
  const hasCountryColumn = columns.some(
    col => col.name.toLowerCase() === 'country'
  );
  
  // Set default use dropdown country preference
  const [useCountryDropdown, setUseCountryDropdown] = useState(hasCountryColumn);
  
  // Selected country for the single-select
  const [selectedCountry, setSelectedCountry] = useState<string>("India");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Azure OpenAI settings - configured with your provided settings
  const azureOpenAI: AzureOpenAISettings = {
    enabled: true,
    endpoint: 'https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview',
    apiKey: 'AEw7fZ3WwPe6u6Msudlam9bpTz7sSM8JiUhVHIDtpvSHpXn4GDcIJQQJ99BBACYeBjFXJ3w3AAABACOGZap5',
    apiVersion: '2025-01-01-preview',
    deploymentName: 'gpt-4o'
  };

  // Enhanced location column detection using the geo detector
  const geoDetector = new GeoColumnDetector();
  const geoAnalysis = geoDetector.detectGeoColumns(columns);
  const hasLocationColumns = geoAnalysis.hasGeoData;

  const handleApplyMasking = async () => {
    setIsProcessing(true);
    setProgress(0);
    try {
      const maskingConfig: MaskingConfig = {
        preserveFormat,
        createTableSQL,
        tableName,
        useCountryDropdown,
        selectedCountries: [selectedCountry],
        azureOpenAI
      };
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) {
            return prev + Math.random() * 10;
          }
          return prev;
        });
      }, 500);
      
      try {
        console.log('Starting enhanced masking process...');

        const maskedData = await maskDataSet(
          fileData.data,
          columns,
          {
            useCountryDropdown,
            selectedCountries: [selectedCountry],
            useAzureOpenAI: true,
            azureOpenAIConfig: {
              config: {
                endpoint: azureOpenAI.endpoint,
                apiKey: azureOpenAI.apiKey,
                apiVersion: azureOpenAI.apiVersion,
                deploymentName: azureOpenAI.deploymentName
              },
              country: selectedCountry,
              selectedCountries: [selectedCountry],
              preserveDataStructure: true,
              useIntelligentBatching: true
            }
          }
        );
        
        clearInterval(progressInterval);
        setProgress(100);
        
        toast({
          title: "Enhanced Masking Complete",
          description: "Data successfully masked using AI with intelligent geo-masking and pattern preservation.",
        });
        
        onDataMasked(maskedData, maskingConfig);
      } catch (error) {
        clearInterval(progressInterval);
        console.error('Error during masking:', error);
        toast({
          title: "Masking Error",
          description: `An error occurred while masking the data: ${error.message || 'Unknown error'}. Please check the console for details.`,
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error starting masking process:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to start masking process.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Full-screen loading overlay when masking is in progress */}
      {isProcessing && (
        <div
          role="alert"
          aria-busy="true"
          aria-live="assertive"
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition-opacity duration-300"
          style={{ pointerEvents: 'all' }}
        >
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="text-white text-lg font-semibold mb-2">
              Enhanced masking in progress...
            </div>
            <div className="text-white text-sm">
              Applying intelligent pattern preservation and geo-masking...
            </div>
            <div className="mt-4 w-48">
              <Progress value={progress} />
              <div className="text-xs text-center mt-1 text-white">{Math.round(progress)}%</div>
            </div>
          </div>
        </div>
      )}
      {/* Main UI */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium">
            Enhanced Masking Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Features Info */}
            <div className="text-xs text-blue-600 bg-blue-100 p-3 rounded border-l-4 border-blue-400">
              <strong>Enhanced Features:</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>Single optimized API call (reduced from multiple calls)</li>
                <li>Pattern preservation for all column types (e.g., Campaign_1, Campaign_2)</li>
                <li>Enhanced duplicate detection and retry logic</li>
                <li>Intelligent geo-column mapping for location data</li>
                <li>Data structure and format preservation</li>
              </ul>
            </div>

            {/* Country Preference Option */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="countryPreference" className="cursor-pointer">
                  Country Selection
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Info className="h-4 w-4 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        {hasCountryColumn 
                          ? "If enabled, country preference will be applied based on the selected country in the dropdown. If disabled, it uses the column data." 
                          : "Country preference will be applied based on the selected country in the dropdown as no country column is present in the uploaded file."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                id="countryPreference"
                checked={useCountryDropdown}
                onCheckedChange={setUseCountryDropdown}
                disabled={!hasCountryColumn}
              />
            </div>

            {/* Country Selection Dropdown - Show only if country preference is enabled */}
            {useCountryDropdown && (
              <div className="space-y-2">
                <Label>Select Country</Label>
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                      {selectedCountry || "Select country..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80" align="start">
                    <DropdownMenuLabel>Select Country</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="max-h-64 overflow-y-auto">
                      {countries.map((country) => (
                        <DropdownMenuCheckboxItem
                          key={country}
                          checked={selectedCountry === country}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedCountry(country);
                          }}
                        >
                          {country}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedCountry && (
                    <Badge key={selectedCountry} variant="secondary" className="text-xs">
                      {selectedCountry}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-2 flex justify-center">
            <Button 
              className="bg-masking-secondary hover:bg-masking-primary text-white py-1 w-auto max-w-[200px]"
              onClick={handleApplyMasking}
              disabled={isProcessing}
              size="sm"
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center">
                  <Check className="mr-2 h-4 w-4" /> 
                  Apply Enhanced Masking
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default MaskingOptions;
