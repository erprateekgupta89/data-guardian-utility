
import { toast } from "sonner";
import { ColumnInfo, DataType, FileData } from '@/types';
import { getRandomSample } from './maskingHelpers';

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = "https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_API_VERSION = "2025-01-01-preview";
const MAX_RETRIES = 3;

// Function to validate the API key (stored in localStorage)
export const validateApiKey = (): string => {
  const apiKey = localStorage.getItem('azure_openai_api_key');
  if (!apiKey) {
    throw new Error('Azure OpenAI API key not found');
  }
  return apiKey;
};

// Function to generate data with OpenAI
export const generateWithOpenAI = async (prompt: string, type: DataType, count: number = 1): Promise<string[]> => {
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      const apiKey = validateApiKey();
      
      // Add timestamp and random seed to make each prompt unique to avoid 304 responses
      const timestamp = new Date().toISOString();
      const randomSeed = Math.random().toString(36).substring(2, 15);
      const uniquePrompt = `${prompt} (timestamp: ${timestamp}, seed: ${randomSeed})`;
      
      const systemPrompt = `You are a data generation assistant that ONLY returns exact data items as requested.
      Generate ${count} realistic ${type} items.
      Do not include ANY explanation, formatting, or extra information.
      Return ONLY a valid JSON array of strings with EXACTLY ${count} data points.
      Format example: ["item1", "item2", "item3"]
      Each item in the array must be a simple string, not an object.
      Current timestamp: ${timestamp}`;
      
      // Generate a unique request ID for each request
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      console.log(`Making request ${requestId} for type: ${type}, timestamp: ${timestamp}`);
      
      const response = await fetch(AZURE_OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          // Add cache-busting headers
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Request-ID": requestId
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: uniquePrompt }
          ],
          // Add randomness to the request params
          temperature: 0.7 + Math.random() * 0.05, // Slight variation in temperature
          top_p: 0.95 + Math.random() * 0.05,     // Slight variation in top_p
          frequency_penalty: Math.random() * 0.1,  // Small random frequency penalty
          presence_penalty: Math.random() * 0.1,   // Small random presence penalty
          request_id: requestId                    // Include request ID in the body
        }),
      });
      
      // Check for HTTP 304 status
      if (response.status === 304) {
        console.warn(`Received HTTP 304 response for request ${requestId}, retrying...`);
        retryCount++;
        // Wait a bit before retrying to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        continue;
      }
      
      // Check for other error status codes
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        throw new Error(`Azure OpenAI API returned status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        console.error("Azure OpenAI API error:", data.error);
        throw new Error(data.error.message || "Azure OpenAI API error");
      }
      
      console.log(`Successfully received response for request ${requestId}`);
      
      const content = data.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[.*\]/s);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      
      try {
        const parsedItems = JSON.parse(jsonContent);
        
        if (Array.isArray(parsedItems)) {
          return parsedItems.slice(0, count);
        } else {
          return Array(count).fill(content);
        }
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        throw new Error("Failed to parse API response");
      }
    } catch (error) {
      console.error("Azure OpenAI generation error:", error);
      retryCount++;
      
      if (retryCount >= MAX_RETRIES) {
        toast.error("Failed to generate data with Azure OpenAI after multiple attempts");
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  // This should not be reached due to the throw in the catch block
  // but TypeScript requires a return statement
  throw new Error("Failed to generate data after maximum retries");
};

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

    const maskedData = await Promise.all(
      workingData.map(async (row, rowIndex) => {
        const modifiedRow: Record<string, string> = {};
        
        for (const column of columns) {
          if (column.skip) {
            modifiedRow[column.name] = row[column.name];
            continue;
          }

          const value = row[column.name];
          // Add row index to make prompts more unique
          const prompt = `Generate realistic ${column.dataType} data similar to the format of: ${value} (row: ${rowIndex})`;
          
          try {
            const newData = await generateWithOpenAI(prompt, column.dataType, count);
            modifiedRow[column.name] = newData[0];
          } catch (error) {
            console.error(`Error generating data for column ${column.name}:`, error);
            modifiedRow[column.name] = value; // Keep original value on error
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
