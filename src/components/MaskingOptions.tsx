
import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { ColumnInfo, FileData, MaskingConfig } from '@/types';
import { maskDataSet } from '@/utils/masking';
// import { maskDataWithAI } from '@/utils/aiMasking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Check as CheckIcon, ChevronsUpDown } from "lucide-react";

interface MaskingOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  onDataMasked: (maskedData: Record<string, string>[], config: MaskingConfig) => void;
}

// List of countries for the multi-select dropdown
const countries = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", 
  "France", "Spain", "Italy", "Japan", "China", "India", "Brazil", 
  "Mexico", "South Africa", "Russia", "South Korea", "Netherlands", 
  "Sweden", "Norway", "Denmark", "Finland", "Switzerland", "Austria", 
  "Belgium", "Portugal", "Greece", "Ireland", "New Zealand", "Singapore", 
  "Malaysia", "Thailand", "Indonesia", "Philippines", "Vietnam", "Turkey"
];

const MaskingOptions = ({ fileData, columns, onDataMasked }: MaskingOptionsProps) => {
  const { toast } = useToast();
  const [tableName, setTableName] = useState('masked_data');
  const [preserveFormat, setPreserveFormat] = useState(true);
  const [createTableSQL, setCreateTableSQL] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Check if a country column exists in the data
  const hasCountryColumn = columns.some(
    col => col.name.toLowerCase() === 'country'
  );
  
  // Set default use dropdown country preference
  const [useCountryDropdown, setUseCountryDropdown] = useState(true);
  
  // Selected countries for the multi-select
  const [selectedCountries, setSelectedCountries] = useState<string[]>([
    "United States", "United Kingdom", "Canada", "Australia"
  ]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleApplyMasking = async () => {
    setIsProcessing(true);
    
    try {
      // Create config object
      const maskingConfig: MaskingConfig = {
        preserveFormat,
        createTableSQL,
        tableName,
        useCountryDropdown,
        selectedCountries
      };
      
      // Check if AI masking is enabled
      const useAI = localStorage.getItem('use_ai') === 'true';
      const apiKey = useAI ? localStorage.getItem('azure_openai_api_key') : null;

      if (useAI && !apiKey) {
        toast({
          title: "API Key Required",
          description: "Please enter your OpenAI API key in settings to use AI masking.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Process data masking
      setTimeout(async () => {
        try {
          const maskedData = maskDataSet(fileData.data, columns, { 
                useCountryDropdown, 
                selectedCountries 
              });
            
          onDataMasked(maskedData, maskingConfig);
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
      }, 500);
    } catch (error) {
      console.error('Error during masking:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to start masking process.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium">
          <div className="flex items-center">
            Masking Options
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
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
                        ? "If enabled, country preference will be applied based on the selected countries in the dropdown. If disabled, it uses the column data." 
                        : "Country preference will be applied based on the selected countries in the dropdown as no country column is present in the uploaded file."}
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
              <Label>Select Countries</Label>
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    {selectedCountries.length > 0
                      ? `${selectedCountries.length} countries selected`
                      : "Select countries..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80" align="start">
                  <DropdownMenuLabel>Select Countries</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-64 overflow-y-auto">
                    {countries.map((country) => (
                      <DropdownMenuCheckboxItem
                        key={country}
                        checked={selectedCountries.includes(country)}
                        onCheckedChange={(checked) => {
                          setSelectedCountries(
                            checked
                              ? [...selectedCountries, country]
                              : selectedCountries.filter(c => c !== country)
                          );
                        }}
                      >
                        {country}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedCountries.slice(0, 3).map((country) => (
                  <Badge key={country} variant="secondary" className="text-xs">
                    {country}
                  </Badge>
                ))}
                {selectedCountries.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedCountries.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Preserve Format Option */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Label htmlFor="preserveFormat" className="cursor-pointer">
                Preserve Data Format
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Info className="h-4 w-4 text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>When enabled, masking will maintain the original format of data (e.g., keeping the same number of characters, preserving special characters). Disable for fully randomized data.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="preserveFormat"
              checked={preserveFormat}
              onCheckedChange={setPreserveFormat}
            />
          </div>
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
                <Check className="mr-2 h-4 w-4" /> Apply Masking
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaskingOptions;
