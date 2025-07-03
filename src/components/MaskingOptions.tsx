import { useState } from 'react';
import { Check, Info, Settings, Eye, EyeOff } from 'lucide-react';
import { ColumnInfo, FileData, MaskingConfig, AzureOpenAISettings } from '@/types';
import { maskDataSet } from '@/utils/masking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown } from "lucide-react";
import { Progress } from '@/components/ui/progress';
import { AzureOpenAIMasking } from '@/utils/azureOpenAIMasking';
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
  
  // Azure OpenAI settings
  const [azureOpenAI, setAzureOpenAI] = useState<AzureOpenAISettings>({
    enabled: false,
    endpoint: '',
    apiKey: '',
    apiVersion: '2024-02-01',
    deploymentName: 'gpt-4'
  });
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [azureDialogOpen, setAzureDialogOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Check if location columns exist that would benefit from Azure OpenAI
  const hasLocationColumns = columns.some(
    col => ['Address', 'City', 'State', 'Postal Code'].includes(col.dataType)
  );

  const handleTestAzureConnection = async () => {
    if (!azureOpenAI.endpoint || !azureOpenAI.apiKey || !azureOpenAI.deploymentName) {
      toast({
        title: "Missing Configuration",
        description: "Please fill in all Azure OpenAI settings before testing.",
        variant: "destructive",
      });
      return;
    }

    setTestingConnection(true);
    try {
      console.log('=== Testing Azure OpenAI Connection ===');
      console.log('Configuration:', {
        endpoint: azureOpenAI.endpoint,
        apiVersion: azureOpenAI.apiVersion,
        deploymentName: azureOpenAI.deploymentName,
        hasApiKey: !!azureOpenAI.apiKey
      });

      // Construct the full endpoint URL if needed
      let fullEndpoint = azureOpenAI.endpoint;
      if (!fullEndpoint.includes('/chat/completions')) {
        const baseUrl = fullEndpoint.split('/openai/deployments/')[0];
        fullEndpoint = `${baseUrl}/openai/deployments/${azureOpenAI.deploymentName}/chat/completions?api-version=${azureOpenAI.apiVersion}`;
      }

      const azureMasking = new AzureOpenAIMasking({
        config: {
          endpoint: fullEndpoint,
          apiKey: azureOpenAI.apiKey,
          apiVersion: azureOpenAI.apiVersion,
          deploymentName: azureOpenAI.deploymentName
        }
      });

      const isConnected = await azureMasking.testConnection();
      
      if (isConnected) {
        toast({
          title: "Connection Successful",
          description: "Enhanced Azure OpenAI connection is working properly with geographic accuracy features.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect to Azure OpenAI. Please check your settings and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Error",
        description: `An error occurred while testing the connection: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

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
        console.log('Azure OpenAI Config:', {
          enabled: azureOpenAI.enabled,
          endpoint: azureOpenAI.endpoint,
          deploymentName: azureOpenAI.deploymentName,
          apiVersion: azureOpenAI.apiVersion,
          hasApiKey: !!azureOpenAI.apiKey
        });

        // Construct the full endpoint URL if needed
        let fullEndpoint = azureOpenAI.endpoint;
        if (azureOpenAI.enabled && !fullEndpoint.includes('/chat/completions')) {
          const baseUrl = fullEndpoint.split('/openai/deployments/')[0];
          fullEndpoint = `${baseUrl}/openai/deployments/${azureOpenAI.deploymentName}/chat/completions?api-version=${azureOpenAI.apiVersion}`;
        }

        const maskedData = await maskDataSet(
          fileData.data,
          columns,
          {
            useCountryDropdown,
            selectedCountries: [selectedCountry],
            useAzureOpenAI: azureOpenAI.enabled,
            azureOpenAIConfig: azureOpenAI.enabled ? {
              config: {
                endpoint: fullEndpoint,
                apiKey: azureOpenAI.apiKey,
                apiVersion: azureOpenAI.apiVersion,
                deploymentName: azureOpenAI.deploymentName
              },
              country: selectedCountry,
              selectedCountries: [selectedCountry]
            } : undefined
          }
        );
        
        clearInterval(progressInterval);
        setProgress(100);
        
        toast({
          title: "Masking Complete",
          description: azureOpenAI.enabled 
            ? "Data successfully masked using enhanced AI with geographic accuracy."
            : "Data successfully masked using standard methods.",
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
              {azureOpenAI.enabled ? 'Enhanced AI Masking in progress...' : 'Masking in progress...'}
            </div>
            <div className="text-white text-sm">
              {azureOpenAI.enabled 
                ? 'Generating geographically accurate addresses using AI...' 
                : 'Please wait while your data is being masked.'}
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
            <div className="flex items-center">
              Masking Options
              {azureOpenAI.enabled && hasLocationColumns && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Enhanced AI Enabled
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Azure OpenAI Enhanced Masking */}
            {hasLocationColumns && (
              <div className="space-y-3 border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="azureOpenAI" className="cursor-pointer font-medium">
                      Enhanced AI Masking
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Info className="h-4 w-4 text-blue-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            Use Azure OpenAI to generate realistic, geographically accurate addresses with intelligent country distribution, regional diversity, and format validation.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="azureOpenAI"
                    checked={azureOpenAI.enabled}
                    onCheckedChange={(checked) => setAzureOpenAI(prev => ({ ...prev, enabled: checked }))}
                  />
                </div>
                
                {azureOpenAI.enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Dialog open={azureDialogOpen} onOpenChange={setAzureDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            Configure Azure OpenAI
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Enhanced Azure OpenAI Configuration</DialogTitle>
                            <DialogDescription>
                              Configure your Azure OpenAI settings for enhanced geographic data masking with intelligent address generation
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="endpoint">Endpoint URL</Label>
                              <Input
                                id="endpoint"
                                placeholder="https://your-resource.openai.azure.com"
                                value={azureOpenAI.endpoint}
                                onChange={(e) => setAzureOpenAI(prev => ({ ...prev, endpoint: e.target.value }))}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="apiKey">API Key</Label>
                              <div className="relative">
                                <Input
                                  id="apiKey"
                                  type={showApiKey ? "text" : "password"}
                                  placeholder="Enter your Azure OpenAI API key"
                                  value={azureOpenAI.apiKey}
                                  onChange={(e) => setAzureOpenAI(prev => ({ ...prev, apiKey: e.target.value }))}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                >
                                  {showApiKey ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="apiVersion">API Version</Label>
                              <Input
                                id="apiVersion"
                                placeholder="2024-02-01"
                                value={azureOpenAI.apiVersion}
                                onChange={(e) => setAzureOpenAI(prev => ({ ...prev, apiVersion: e.target.value }))}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="deploymentName">Deployment Name</Label>
                              <Input
                                id="deploymentName"
                                placeholder="gpt-4"
                                value={azureOpenAI.deploymentName}
                                onChange={(e) => setAzureOpenAI(prev => ({ ...prev, deploymentName: e.target.value }))}
                              />
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                onClick={handleTestAzureConnection}
                                disabled={testingConnection}
                                className="flex-1"
                              >
                                {testingConnection ? 'Testing...' : 'Test Connection'}
                              </Button>
                              <Button onClick={() => setAzureDialogOpen(false)} className="flex-1">
                                Save Settings
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {azureOpenAI.endpoint && azureOpenAI.apiKey && (
                        <Badge variant="secondary" className="text-xs">
                          Configured
                        </Badge>
                      )}
                    </div>
                    
                    {azureOpenAI.enabled && (
                      <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                        <strong>Enhanced Features:</strong> Geographic accuracy, regional diversity, country proportion preservation, intelligent caching, and format validation.
                      </div>
                    )}
                  </div>
                )}
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
                  <Check className="mr-2 h-4 w-4" /> 
                  {azureOpenAI.enabled && hasLocationColumns ? 'Apply Enhanced Masking' : 'Apply Masking'}
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
