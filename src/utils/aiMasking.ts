
import { toast } from "sonner";
import { ColumnInfo, DataType, FileData } from '@/types';
import { getRandomSample } from './maskingHelpers';

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
  try {
    const apiKey = validateApiKey();
    const systemPrompt = `You are a data generation assistant that ONLY returns exact data items as requested.
    Generate ${count} realistic ${type} items.
    Do not include ANY explanation, formatting, or extra information.
    Return ONLY a valid JSON array of strings with EXACTLY ${count} data points.
    Format example: ["item1", "item2", "item3"]
    Each item in the array must be a simple string, not an object.`;
    
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("OpenAI API error:", data.error);
      throw new Error(data.error.message || "OpenAI API error");
    }

    const content = data.choices[0].message.content.trim();
    const jsonMatch = content.match(/\[.*\]/s);
    const jsonContent = jsonMatch ? jsonMatch[0] : content;
    const parsedItems = JSON.parse(jsonContent);

    if (Array.isArray(parsedItems)) {
      return parsedItems.slice(0, count);
    } else {
      return Array(count).fill(content);
    }
  } catch (error) {
    console.error("OpenAI generation error:", error);
    toast.error("Failed to generate data with OpenAI");
    throw error;
  }
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
      workingData.map(async (row) => {
        const modifiedRow: Record<string, string> = {};
        
        for (const column of columns) {
          if (column.skip) {
            modifiedRow[column.name] = row[column.name];
            continue;
          }

          const value = row[column.name];
          const prompt = `Generate realistic ${column.dataType} data similar to the format of: ${value}`;
          
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
