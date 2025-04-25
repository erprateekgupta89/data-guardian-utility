
import { useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { ColumnInfo, FileData } from '@/types';
import { maskDataSet } from '@/utils/maskingLogic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface MaskingOptionsProps {
  fileData: FileData;
  columns: ColumnInfo[];
  onDataMasked: (maskedData: Record<string, string>[], config: MaskingConfig) => void;
}

// Import MaskingConfig type directly in the component
import { MaskingConfig } from "@/types";

const MaskingOptions = ({ fileData, columns, onDataMasked }: MaskingOptionsProps) => {
  const [tableName, setTableName] = useState('masked_data');
  const [preserveFormat, setPreserveFormat] = useState(true);
  const [createTableSQL, setCreateTableSQL] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApplyMasking = () => {
    setIsProcessing(true);
    
    try {
      // Create config object
      const maskingConfig: MaskingConfig = {
        preserveFormat,
        createTableSQL,
        tableName
      };
      
      // Process data masking (simulate some delay for UX)
      setTimeout(() => {
        const maskedData = maskDataSet(fileData.data, columns);
        onDataMasked(maskedData, maskingConfig);
        setIsProcessing(false);
      }, 500);
    } catch (error) {
      console.error('Error during masking:', error);
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium">
          <div className="flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Masking Options
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tableName">SQL Table Name</Label>
            <Input
              id="tableName"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Enter table name for SQL export"
            />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="preserveFormat" className="cursor-pointer">
                Preserve Data Format
              </Label>
              <Switch
                id="preserveFormat"
                checked={preserveFormat}
                onCheckedChange={setPreserveFormat}
              />
            </div>
            
            <div className="space-y-2 mt-4">
              <Label className="text-sm font-medium">SQL Export Options</Label>
              <RadioGroup 
                value={createTableSQL ? "create" : "update"} 
                onValueChange={(value) => setCreateTableSQL(value === "create")}
                className="grid gap-2 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create" id="create-table" />
                  <Label htmlFor="create-table" className="cursor-pointer">Include CREATE TABLE</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id="update-only" />
                  <Label htmlFor="update-only" className="cursor-pointer">Update Data Schema Only</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
        
        <div className="pt-4">
          <Button 
            className="w-full bg-masking-secondary hover:bg-masking-primary text-white"
            onClick={handleApplyMasking}
            disabled={isProcessing}
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
