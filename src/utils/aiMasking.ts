
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
    
    console.log(`Making API request to Azure OpenAI for type: ${type}`);
    
    try {
      const controller = new AbortController();
      // Set a timeout of 15 seconds for the fetch request
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Generate a unique request identifier to prevent caching
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      const response = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          // Add cache control headers to prevent 304 responses
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          // Add a unique header to ensure a fresh response each time
          "X-Request-ID": requestId
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.7, // Balanced between consistency and variety
          // Add a random seed parameter to prevent caching based on identical requests
          seed: Math.floor(Math.random() * 10000000)
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Azure OpenAI API error:", errorText);
        console.error(`Status: ${response.status}, Status Text: ${response.statusText}`);
        console.error(`Response headers:`, Object.fromEntries([...response.headers.entries()]));
        
        // More detailed error handling based on status code
        let errorMessage = `Azure OpenAI API error: ${response.status} ${response.statusText}`;
        
        if (response.status === 304) {
          errorMessage = "API returned cached response (304). Trying again with cache-busting...";
          // If we get a 304, try again with a different request ID
          return generateWithOpenAI(prompt, type, originalValue, count);
        } else if (response.status === 401) {
          errorMessage = "Authentication failed. Please check your API key.";
        } else if (response.status === 403) {
          errorMessage = "Access denied. Your API key might not have sufficient permissions.";
        } else if (response.status === 429) {
          errorMessage = "Rate limit exceeded. Please try again later.";
        } else if (response.status >= 500) {
          errorMessage = "Azure OpenAI service is currently unavailable. Please try again later.";
        }
        
        throw new Error(errorMessage);
      }
      
      // Log response headers to diagnose caching issues
      console.log("Response headers:", Object.fromEntries([...response.headers.entries()]));
      console.log(`Response status: ${response.status}`);
      
      const data = await response.json();
      console.log("API response received successfully");
      
      if (data.error) {
        console.error("Azure OpenAI API error:", data.error);
        throw new Error(data.error.message || "Azure OpenAI API error");
      }
      
      const content = data.choices[0].message.content.trim();
      console.log("Response content:", content.substring(0, 100) + (content.length > 100 ? "..." : ""));
      
      // Try to extract a JSON array from the response
      try {
        const jsonMatch = content.match(/\[.*\]/s);
        const jsonContent = jsonMatch ? jsonMatch[0] : content;
        const parsedItems = JSON.parse(jsonContent);
        
        if (Array.isArray(parsedItems)) {
          return parsedItems.slice(0, count);
        } else {
          console.warn("API returned valid JSON but not an array:", parsedItems);
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
      if (error.name === 'AbortError') {
        console.error("Request timed out");
        throw new Error("Request to Azure OpenAI timed out. Please try again later.");
      }
      throw error;
    }
  } catch (error) {
    console.error("Azure OpenAI generation error:", error);
    toast.error(`AI masking failed: ${error.message || "Unknown error"}`);
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
    // Reset the consistent replacements for a new masking operation
    consistentReplacements.clear();
    
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

    // Number of columns to process
    const columnsToProcess = columns.filter(column => !column.skip).length;
    
    // If no columns to process, return original data
    if (columnsToProcess === 0) {
      console.log("No columns selected for masking, returning original data");
      return workingData;
    }

    console.log(`Starting AI masking for ${columnsToProcess} columns and ${workingData.length} rows`);

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
            
            // Add timestamp to make each request unique
            const uniquePrompt = `${prompt}\nTimestamp: ${Date.now()}`;
            
            const newData = await generateWithOpenAI(uniquePrompt, column.dataType, originalValue, count);
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

    console.log(`AI masking completed successfully for ${maskedData.length} rows`);
    return maskedData;
  } catch (error) {
    console.error("Error while masking data:", error);
    toast.error(`Failed to mask data with AI: ${error.message || "Unknown error"}`);
    throw error;
  }
};
