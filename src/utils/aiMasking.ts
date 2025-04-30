
import { toast } from "sonner";
import { ColumnInfo, DataType, FileData } from '@/types';
import { getRandomSample } from './maskingHelpers';

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = "https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";

// Function to validate the API key (stored in localStorage)
export const validateApiKey = (): string => {
  const apiKey = localStorage.getItem('azure_openai_api_key');
  if (!apiKey) {
    throw new Error('Azure OpenAI API key not found');
  }
  return apiKey;
};

// Function to generate data with OpenAI
export const generateWithOpenAI = async (prompt: string, type: DataType, originalValue: string, count: number = 1): Promise<string[]> => {
  try {
    const apiKey = validateApiKey();
    
    // Enhanced system prompt that emphasizes format preservation
    const systemPrompt = `You are a data masking assistant that ONLY generates realistic replacement data that matches the EXACT FORMAT of the original data.
    Generate ${count} realistic ${type} items that match the format, capitalization, length, and structure of the original value: "${originalValue}".
    Do not include ANY explanation, formatting, or extra information.
    Return ONLY a valid JSON array of strings with EXACTLY ${count} data points.
    Format example: ["item1", "item2", "item3"]
    Each item in the array must be a simple string, not an object.
    The generated items must maintain similar:
    - Capitalization (uppercase, lowercase, title case)
    - Special characters (e.g., hyphens, underscores, periods)
    - Length (approximately the same number of characters)
    - Structure (e.g., if phone number has format XXX-XXX-XXXX, maintain that exact structure)`;
    
    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7 // Balanced between consistency and variety
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure OpenAI API error:", errorText);
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error("Azure OpenAI API error:", data.error);
      throw new Error(data.error.message || "Azure OpenAI API error");
    }

    const content = data.choices[0].message.content.trim();
    
    // Try to extract a JSON array from the response
    try {
      const jsonMatch = content.match(/\[.*\]/s);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      const parsedItems = JSON.parse(jsonContent);
      
      if (Array.isArray(parsedItems)) {
        return parsedItems.slice(0, count);
      }
    } catch (error) {
      console.warn("Failed to parse JSON from API response, using fallback extraction", error);
    }
    
    // Fallback: try to extract values even if the format isn't perfect JSON
    const items = content
      .replace(/[\[\]"']/g, '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
      
    if (items.length > 0) {
      return items.slice(0, count);
    }
    
    // Last resort fallback
    return [content.substring(0, originalValue.length)];
  } catch (error) {
    console.error("Azure OpenAI generation error:", error);
    toast.error("Failed to generate data with Azure OpenAI");
    throw error;
  }
};

// Create a map for consistent replacements
const consistentReplacements = new Map<string, string>();

// Function to mask data using AI
export const maskDataWithAI = async (
  fileData: FileData,
  columns: ColumnInfo[],
  count: number = 1
): Promise<Record<string, string>[]> => {
  try {
    // Step 1: Sample the data if there are more than 1000 rows
    let workingData = fileData.data;
    if (workingData.length > 1000) {
      workingData = getRandomSample(workingData, 100);
    }

    // Step 2: Create a map to store consistent replacements for unique values
    const columnValueMap = new Map<string, Map<string, string>>();
    
    // Pre-process to identify unique values for each column
    columns.forEach(column => {
      if (!column.skip) {
        const uniqueValuesMap = new Map<string, string>();
        columnValueMap.set(column.name, uniqueValuesMap);
      }
    });

    // Step 3: Process each row with consistent replacements for unique values
    const maskedData = await Promise.all(
      workingData.map(async (row) => {
        const modifiedRow: Record<string, string> = {};
        
        for (const column of columns) {
          if (column.skip) {
            modifiedRow[column.name] = row[column.name];
            continue;
          }

          const originalValue = row[column.name];
          if (!originalValue || originalValue.trim() === '') {
            modifiedRow[column.name] = originalValue;
            continue;
          }
          
          // Create a unique key for this column+value combination
          const valueKey = `${column.name}:${originalValue}`;
          
          // Check if we've already generated a replacement for this value
          if (consistentReplacements.has(valueKey)) {
            modifiedRow[column.name] = consistentReplacements.get(valueKey)!;
            continue;
          }
          
          try {
            // Create a prompt that emphasizes format preservation
            const prompt = `Generate a realistic replacement for this ${column.dataType} value: "${originalValue}"
            The replacement must match the exact format, length, and style of the original.`;
            
            const newData = await generateWithOpenAI(prompt, column.dataType, originalValue, count);
            const replacementValue = newData[0] || originalValue;
            
            // Store for consistent replacements
            consistentReplacements.set(valueKey, replacementValue);
            modifiedRow[column.name] = replacementValue;
          } catch (error) {
            console.error(`Error generating data for column ${column.name}:`, error);
            modifiedRow[column.name] = originalValue; // Keep original value on error
          }
        }
        
        return modifiedRow;
      })
    );

    return maskedData;
  } catch (error) {
    console.error("Error while masking data:", error);
    toast.error("Failed to mask data with AI");
    throw error;
  }
};
