
import { useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { ColumnInfo, FileData, MaskingConfig } from '@/types';
import { maskDataSet } from '@/utils/masking';
import { maskDataWithAI } from '@/utils/aiMasking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

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

  const handleApplyMasking = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    try {
      // Create config object
      const maskingConfig: MaskingConfig = {
        preserveFormat,
        createTableSQL,
        tableName
      };
      
      // Check if AI masking is enabled
      const useAI = localStorage.getItem('use_ai') === 'true';
      const apiKey = useAI ? localStorage.getItem('azure_openai_api_key') : null;

      if (useAI && !apiKey) {
        toast({
          title: "API Key Required",
          description: "Please enter your Azure OpenAI API key in settings to use AI masking.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Start progress animation
      let progressInterval: NodeJS.Timeout;
      
      if (useAI) {
        // For AI masking, we'll use a smoother progress animation
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            // Progress more slowly for AI operations
            const increment = prev < 60 ? 1 : prev < 80 ? 0.5 : 0.3;
            const nextProgress = prev + increment;
            return nextProgress >= 95 ? 95 : nextProgress;
          });
        }, 300);
      } else {
        // For regular masking, we'll make progress faster
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            const nextProgress = prev + 3;
            return nextProgress >= 95 ? 95 : nextProgress;
          });
        }, 100);
      }

      // Process data masking
      setTimeout(async () => {
        try {
          const maskedData = useAI 
            ? await maskDataWithAI(fileData, columns)
            : maskDataSet(fileData.data, columns);
          
          clearInterval(progressInterval);
          setProgress(100);
          
          setTimeout(() => {
            onDataMasked(maskedData, maskingConfig);
          }, 500); // Short delay to show 100% completion
        } catch (error) {
          clearInterval(progressInterval);
          console.error('Error during masking:', error);
          toast({
            title: "Masking Error",
            description: "An error occurred while masking the data.",
            variant: "destructive",
          });
          setIsProcessing(false);
        }
      }, 500);
    } catch (error) {
      console.error('Error during masking:', error);
      setIsProcessing(false);
      setProgress(0);
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
              disabled={isProcessing}
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
                disabled={isProcessing}
              />
            </div>
            
            <div className="space-y-2 mt-4">
              <Label className="text-sm font-medium">SQL Export Options</Label>
              <RadioGroup 
                value={createTableSQL ? "create" : "update"} 
                onValueChange={(value) => setCreateTableSQL(value === "create")}
                className="grid gap-2 mt-2"
                disabled={isProcessing}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create" id="create-table" disabled={isProcessing} />
                  <Label htmlFor="create-table" className="cursor-pointer">Include CREATE TABLE</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="update" id="update-only" disabled={isProcessing} />
                  <Label htmlFor="update-only" className="cursor-pointer">Update Data Schema Only</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>
        
        {isProcessing && (
          <div className="space-y-2 py-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm">Processing...</Label>
              <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 italic text-center">
              {progress < 40 ? "Analyzing data..." : 
               progress < 70 ? "Generating masked values..." : 
               progress < 95 ? "Finalizing results..." : 
               "Complete!"}
            </p>
          </div>
        )}
        
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
