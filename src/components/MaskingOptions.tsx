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
        console.log('Starting ENHANCED masking process with perfect country-address alignment...');

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
          title: "Perfect Alignment Masking Complete",
          description: "Data successfully masked with perfect country-address alignment, enhanced uniqueness validation, and original data comparison.",
        });
        
        onDataMasked(maskedData, maskingConfig);
      } catch (error) {
        clearInterval(progressInterval);
        console.error('Error during enhanced masking:', error);
        toast({
          title: "Enhanced Masking Error",
          description: `An error occurred while masking the data: ${error.message || 'Unknown error'}. Please check the console for details.`,
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error starting enhanced masking process:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to start enhanced masking process.",
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
              Perfect alignment masking in progress...
            </div>
            <div className="text-white text-sm">
              Applying perfect country-address alignment with enhanced validation...
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
            Perfect Alignment Masking Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Enhanced Features Info */}
            <div className="text-xs text-green-600 bg-green-100 p-3 rounded border-l-4 border-green-400">
              <strong>✅ ENHANCED FEATURES IMPLEMENTED:</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li><strong>Perfect Country-Address Alignment:</strong> Each row's country perfectly matches its address components</li>
                <li><strong>Enhanced Uniqueness Validation:</strong> Eliminates duplicate addresses with advanced detection</li>
                <li><strong>Smart Retry Logic:</strong> Automatically retries failed addresses with detailed failure analysis</li>
                <li><strong>Original Data Comparison:</strong> Ensures masked data never matches original values</li>
                <li><strong>Row Context Tracking:</strong> Maintains perfect alignment across all address columns</li>
              </ul>
            </div>

            {/* Country Preference Option */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="countryPreference" className="cursor-pointer">
                  Perfect Country Selection
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
                          ? "Enhanced system ensures perfect alignment between selected country and all address components for each row." 
                          : "Perfect country-address alignment will be applied using the selected country as no country column is present."}
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
                <Label>Select Country for Perfect Alignment</Label>
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
                    <DropdownMenuLabel>Select Country for Perfect Alignment</DropdownMenuLabel>
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
                      Perfect Alignment: {selectedCountry}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-2 flex justify-center">
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white py-1 w-auto max-w-[250px]"
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
                  Perfect Alignment Processing...
                </span>
              ) : (
                <span className="flex items-center">
                  <Check className="mr-2 h-4 w-4" /> 
                  Apply Perfect Alignment Masking
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
