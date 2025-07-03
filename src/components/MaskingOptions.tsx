
import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { ColumnInfo, FileData, MaskingConfig } from '@/types';
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
  const [hybridMode, setHybridMode] = useState(true);
  const [apiKey, setApiKey] = useState('');
  
  // Check if a country column exists in the data
  const hasCountryColumn = columns.some(
    col => col.name.toLowerCase() === 'country'
  );
  
  // Set default use dropdown country preference
  const [useCountryDropdown, setUseCountryDropdown] = useState(hasCountryColumn);
  
  // Selected country for the single-select
  const [selectedCountry, setSelectedCountry] = useState<string>("India");
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
        hybridMode,
        batchSize: 50,
        qualityThreshold: 80
      };
      
      // Process data masking with enhanced options
      const maskedData = await maskDataSet(
        fileData.data,
        columns,
        { 
          useCountryDropdown, 
          selectedCountries: [selectedCountry],
          hybridMode,
          apiKey: apiKey.trim() || undefined
        },
        (progressValue) => setProgress(progressValue)
      );
      
      onDataMasked(maskedData, maskingConfig);
      
      toast({
        title: "Masking Complete",
        description: `Successfully masked ${maskedData.length} rows with enhanced algorithms.`,
      });
      
    } catch (error) {
      console.error('Error during masking:', error);
      toast({
        title: "Masking Error",
        description: "An error occurred while masking the data.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
              {hybridMode ? 'Enhanced AI Masking in progress...' : 'Masking in progress...'}
            </div>
            <div className="text-white text-sm">Please wait while your data is being processed.</div>
            <div className="mt-4 w-48">
              <Progress value={progress} />
              <div className="text-xs text-center mt-1 text-white">{progress}%</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main UI */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium">
            <div className="flex items-center">
              Enhanced Masking Options
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Hybrid Mode Option */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="hybridMode" className="cursor-pointer">
                  AI-Enhanced Masking
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
                        Uses AI for complex text fields like addresses and names, while using optimized algorithms for structured data like phone numbers and emails.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                id="hybridMode"
                checked={hybridMode}
                onCheckedChange={setHybridMode}
              />
            </div>

            {/* API Key Input for AI Mode */}
            {hybridMode && (
              <div className="space-y-2">
                <Label>OpenAI API Key (Optional)</Label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-masking-accent"
                />
                <p className="text-xs text-gray-500">
                  Leave empty to use rule-based masking for all columns
                </p>
              </div>
            )}

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
                  <Check className="mr-2 h-4 w-4" /> Apply Enhanced Masking
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
