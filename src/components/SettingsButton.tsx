
import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

const SettingsButton = () => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [useAI, setUseAI] = useState(false);
  
  // Load saved settings
  useEffect(() => {
    const savedApiKey = localStorage.getItem('azure_openai_api_key') || '';
    const savedUseAI = localStorage.getItem('use_ai') === 'true';
    setApiKey(savedApiKey);
    setUseAI(savedUseAI);
  }, []);

  // Save settings when they change
  const handleUseAIChange = (checked: boolean) => {
    setUseAI(checked);
    localStorage.setItem('use_ai', checked.toString());
    
    if (checked && !apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenAI API key to use AI-enhanced masking.",
      });
    }
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('azure_openai_api_key', newKey);
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure AI-assisted data masking options
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-ai" className="cursor-pointer">
              Use AI for enhanced masking
            </Label>
            <Switch
              id="use-ai"
              checked={useAI}
              onCheckedChange={handleUseAIChange}
            />
          </div>
          
          {useAI && (
            <div className="space-y-2">
              <Label htmlFor="api-key">OpenAI API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={handleApiKeyChange}
              />
              <p className="text-xs text-gray-500">
                Your API key is stored locally and never sent to our servers.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsButton;
