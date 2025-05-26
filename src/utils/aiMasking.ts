import { toast } from "sonner";
import { ColumnInfo, DataType, FileData } from '@/types';
import { getRandomSample, chunkArray } from './maskingHelpers';
import { maskPersonalInfo, maskLocationData, maskDateTime } from './dataTypeMasking';
import Chance from 'chance';
const chance = new Chance();

// Azure OpenAI configuration
const apiKey = "AEw7fZ3WwPe6u6Msudlam9bpTz7sSM8JiUhVHIDtpvSHpXn4GDcIJQQJ99BBACYeBjFXJ3w3AAABACOGZap5";
const AZURE_OPENAI_ENDPOINT = "https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_API_VERSION = "2025-01-01-preview";
const MAX_RETRIES = 3;

// List of geo-specific data types
const GEO_FIELD_TYPES: DataType[] = ['Address', 'City', 'State', 'Postal Code'];

// Helper to check if a column is geo-specific
function isGeoField(column: ColumnInfo): boolean {
  return GEO_FIELD_TYPES.includes(column.dataType);
}

// Helper to infer a simple format from a string value
function inferFormatPattern(value: string): { pattern: RegExp, length: number, type: 'alphanumeric' | 'numeric' | 'alpha' | 'custom' } {
  if (/^[0-9]+$/.test(value)) {
    return { pattern: /^[0-9]+$/, length: value.length, type: 'numeric' };
  }
  if (/^[A-Za-z]+$/.test(value)) {
    return { pattern: /^[A-Za-z]+$/, length: value.length, type: 'alpha' };
  }
  if (/^[A-Za-z0-9]+$/.test(value)) {
    return { pattern: /^[A-Za-z0-9]+$/, length: value.length, type: 'alphanumeric' };
  }
  // fallback: custom pattern (preserve special chars)
  return { pattern: /.*/, length: value.length, type: 'custom' };
}

function randomStringFromPattern(type: string, length: number, original: string): string {
  if (type === 'numeric') {
    return Array(length).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
  }
  if (type === 'alpha') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return Array(length).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }
  if (type === 'alphanumeric') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array(length).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }
  // For custom, try to preserve special chars positions
  let out = '';
  for (let i = 0; i < original.length; i++) {
    const c = original[i];
    if (/[A-Za-z]/.test(c)) {
      out += String.fromCharCode(65 + Math.floor(Math.random() * 26));
    } else if (/[0-9]/.test(c)) {
      out += Math.floor(Math.random() * 10).toString();
    } else {
      out += c;
    }
  }
  return out;
}

// Helper to detect marital/relationship status columns
function isMaritalStatusColumn(column: ColumnInfo): boolean {
  const name = column.name.toLowerCase();
  return (
    name.includes('marital') ||
    name.includes('relationship') ||
    (name.includes('status') && (name.includes('marital') || name.includes('relationship')))
  );
}
const MARITAL_STATUS_VALUES = ["Single", "Married", "Divorced", "Widowed", "In a relationship"];

// Function to generate data with OpenAI
export const generateWithOpenAI = async (prompt: string, type: DataType, count: number = 1, country: string = "India"): Promise<string[]> => {  // UPDATE TO PICK COUNTRY VALUE DYNAMICALLY     
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      // const apiKey = validateApiKey();
      
      // Add timestamp and random seed to make each prompt unique to avoid 304 responses
      const timestamp = new Date().toISOString();
      const randomSeed = Math.random().toString(36).substring(2, 15);
      const uniquePrompt = `${prompt} (timestamp: ${timestamp}, seed: ${randomSeed})`;
      
      const systemPrompt = `You are a synthetic test data generator for software development purposes.
                            Generate fictional, non-sensitive test data only. 
                            Return data as a JSON array of strings with no additional text.`;
      
/**{"role":"user","content":"Generate a integer value for OrderID. 
 * Generate 100 items. 
 * Return ONLY the requested values as plain text, one per line, nothing else. */

      // `You are a data generation assistant that ONLY returns exact data items as requested.
      // Generate ${count} realistic ${type} items.
      // Do not include ANY explanation, formatting, or extra information.
      // Return ONLY a valid JSON array of strings with EXACTLY ${count} data points.
      // Format example: ["item1", "item2", "item3"]
      // Each item in the array must be a simple string, not an object.
      // Current timestamp: ${timestamp}`

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
          // request_id: requestId                    // Include request ID in the body: NOT REQUIRED
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

interface MaskingOptions {
  count?: number;
  useCountryDropdown: boolean;
  selectedCountries: string[];
}

// Main batch masking function
export const maskDataWithAIBatched = async (
  fileData: FileData,
  columns: ColumnInfo[],
  options: MaskingOptions,
  onProgress?: (progress: number) => void
): Promise<Record<string, string>[]> => {
  const { useCountryDropdown, selectedCountries } = options;
  const BATCH_SIZE = 100;
  const allRows = fileData.data;
  const batches = chunkArray(allRows, BATCH_SIZE);
  let maskedRows: Record<string, string>[] = [];

  // Find if the file has a Country column
  const hasCountryColumn = columns.some(col => col.name.toLowerCase() === 'country');
  // If so, get the unique values from the original data
  let originalCountryValues: string[] = [];
  if (hasCountryColumn) {
    const countryColName = columns.find(col => col.name.toLowerCase() === 'country')!.name;
    originalCountryValues = Array.from(new Set(allRows.map(row => row[countryColName]).filter(Boolean)));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    // Prepare a new array for masked rows in this batch
    const batchMaskedRows: Record<string, string>[] = batch.map(() => ({}));

    // Process each column for the entire batch
    for (const column of columns) {
      if (column.skip) {
        // Copy original values for skipped columns
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          batchMaskedRows[rowIdx][column.name] = batch[rowIdx][column.name];
        }
        continue;
      }
      // Special handling for 'Country' column
      if (column.name.toLowerCase() === 'country') {
        const countryValues: string[] = [];
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          let value = '';
          if (!hasCountryColumn) {
            // No country column in file: always generate random country
            value = chance.country({ full: true });
          } else if (useCountryDropdown && selectedCountries && selectedCountries.length > 0) {
            // Use only values from selectedCountries
            value = selectedCountries[Math.floor(Math.random() * selectedCountries.length)];
          } else {
            if (originalCountryValues.length > 0) {
              value = originalCountryValues[Math.floor(Math.random() * originalCountryValues.length)];
            } else {
              value = chance.country({ full: true });
            }
          }
          batchMaskedRows[rowIdx][column.name] = value;
          countryValues.push(value);
        }
        console.log(`[Batch ${batchIdx}] Masked 'Country' column values:`, countryValues);
        continue;
      }
      if (isGeoField(column)) {
        // For geo fields, generate synthetic data for the entire batch using a single AI call
        // Optionally, you can pass all countries for each row, but for now, use the first country or a random one
        let countryList: string[] = batch.map(row => {
          let country = row['Country'] || row['country'];
          if (useCountryDropdown && selectedCountries && selectedCountries.length > 0) {
            country = selectedCountries[Math.floor(Math.random() * selectedCountries.length)];
          }
          return country || 'United States';
        });
        // If all countries are the same, use a simple prompt; otherwise, mention that countries may vary
        const uniqueCountries = Array.from(new Set(countryList));
        let prompt = '';
        if (uniqueCountries.length === 1) {
          prompt = `Generate ${batch.length} realistic ${column.dataType} values appropriate for people in ${uniqueCountries[0]}. Return ONLY a valid JSON array of strings with exactly ${batch.length} items, no extra text.`;
        } else {
          prompt = `Generate ${batch.length} realistic ${column.dataType} values for people in the following countries (in order): [${countryList.join(', ')}]. Return ONLY a valid JSON array of strings with exactly ${batch.length} items, no extra text.`;
        }
        try {
          const aiResult = await generateWithOpenAI(prompt, column.dataType, batch.length, uniqueCountries[0]);
          for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
            batchMaskedRows[rowIdx][column.name] = aiResult[rowIdx] || batch[rowIdx][column.name];
          }
          console.log(`[Batch ${batchIdx}] Masked geo column '${column.name}' AI result:`, aiResult);
        } catch (error) {
          // fallback: use original values
          for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
            batchMaskedRows[rowIdx][column.name] = batch[rowIdx][column.name];
          }
          console.log(`[Batch ${batchIdx}] Masked geo column '${column.name}' AI fallback to original values.`);
        }
      } else {
        // For non-geo fields, generate synthetic data for each row in the batch using random utilities
        const nonGeoValues: string[] = [];
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          const row = batch[rowIdx];
          let value = '';
          // Infer format from the original value
          const originalValue = row[column.name] || '';
          const { pattern, length, type } = inferFormatPattern(originalValue);
          // Marital/relationship status masking
          if (isMaritalStatusColumn(column) && column.dataType === 'String') {
            value = MARITAL_STATUS_VALUES[Math.floor(Math.random() * MARITAL_STATUS_VALUES.length)];
          } else {
            switch (column.dataType) {
              case 'Name':
                value = maskPersonalInfo(originalValue, 'Name');
                break;
              case 'Email':
                value = chance.email();
                break;
              case 'Phone Number':
                value = chance.phone();
                break;
              case 'Date':
              case 'Date of birth':
              case 'Time':
              case 'Date Time':
                value = maskDateTime(originalValue, column.dataType as any);
                break;
              case 'Int':
                value = chance.integer({ min: 0, max: 10000 }).toString();
                break;
              case 'Float':
                value = chance.floating({ min: 0, max: 10000, fixed: 2 }).toString();
                break;
              case 'Bool':
                value = chance.bool().toString();
                break;
              case 'Gender':
                value = chance.gender();
                break;
              case 'Company':
                value = chance.company();
                break;
              case 'Password':
                value = chance.string({ length: 10 });
                break;
              case 'Text':
              case 'String':
              default:
                // Use the inferred pattern to generate a similar format
                value = randomStringFromPattern(type, length, originalValue);
                break;
            }
          }
          batchMaskedRows[rowIdx][column.name] = value;
          nonGeoValues.push(value);
        }
        console.log(`[Batch ${batchIdx}] Masked non-geo column '${column.name}' values:`, nonGeoValues);
      }
    }
    // Add the masked rows from this batch to the overall result
    maskedRows = maskedRows.concat(batchMaskedRows);
    // Update progress after each batch
    if (onProgress) {
      const progress = Math.round((maskedRows.length / allRows.length) * 100);
      onProgress(progress);
    }
  }
  if (onProgress) onProgress(100);
  return maskedRows;
};

// // Function to mask data using AI
// export const maskDataWithAI = async (
//   fileData: FileData,
//   columns: ColumnInfo[],
//   count: number = 1
// ): Promise<Record<string, string>[]> => {
//   interface MaskingOptions {
//     count?: number;
//     useCountryDropdown: boolean;
//     selectedCountries: string[];
//   }
//   
//   export const maskDataWithAI = async (
//     fileData: FileData,
//     columns: ColumnInfo[],
//     options: MaskingOptions
//   ): Promise<Record<string, string>[]> => {
//     const { count = 1, useCountryDropdown, selectedCountries } = options;
//     
//   try {
//     // Step 1: Sample the data if there are more than 1000 rows
//     let workingData = fileData.data;
//     if (workingData.length > 1000) {
//       workingData = getRandomSample(workingData, 100);
//     }
//
//     const maskedData = await Promise.all(
//       workingData.map(async (row, rowIndex) => {
//         const modifiedRow: Record<string, string> = {};
//         
//         for (const column of columns) {
//           if (column.skip) {
//             modifiedRow[column.name] = row[column.name];
//             continue;
//           }
//
//           // UPDATE CODE FOR VARIOUS PROMPTS
//
//           const value = row[column.name];
//
//           console.log("Value: ", value);
//           console.log("Column: ", column.name);
//           
//           // Add row index to make prompts more unique
//           const prompt = `Generate realistic ${column.dataType} data similar to the format of: ${value} (row: ${rowIndex})`;
//           
//           try {
//             const newData = await generateWithOpenAI(prompt, column.dataType, count, "India");
//             modifiedRow[column.name] = newData[0];
//           } catch (error) {
//             console.error(`Error generating data for column ${column.name}:`, error);
//             modifiedRow[column.name] = value; // Keep original value on error
//           }
//         }
//         
//         return modifiedRow;
//       })
//     );
//
//     return maskedData;
//   } catch (error) {
//     console.error("Error while masking data:", error);
//     toast.error("Failed to mask data with AI");
//     throw error;
//   }
// };

// import { toast } from "sonner";
 
// // Azure OpenAI configuration
// const AZURE_OPENAI_API_KEY = "AEw7fZ3WwPe6u6Msudlam9bpTz7sSM8JiUhVHIDtpvSHpXn4GDcIJQQJ99BBACYeBjFXJ3w3AAABACOGZap5";
// const AZURE_OPENAI_ENDPOINT = "https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";
// const AZURE_OPENAI_API_VERSION = "2025-01-01-preview";
 
// export const validateApiKey = (): string => {
//   return AZURE_OPENAI_API_KEY;
// };
 
// export const generateWithOpenAI = async (prompt: string, type: string, count: number = 1): Promise<string[]> => {
//   try {
//     const apiKey = validateApiKey();
//     // Craft a very specific system prompt to ensure we get exactly what we want
//     const systemPrompt = `You are a data generation assistant that ONLY returns exact data items as requested.
//     Generate ${count} realistic ${type} items.
//     Do not include ANY explanation, formatting, or extra information.
//     Return ONLY a valid JSON array of strings with EXACTLY ${count} data points.
//     Format example: ["item1", "item2", "item3"]
//     Each item in the array must be a simple string, not an object.`;
//     console.log(`Generating ${count} ${type} items with Azure OpenAI...`);
//     const response = await fetch(AZURE_OPENAI_ENDPOINT, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "api-key": apiKey,
//       },
//       body: JSON.stringify({
//         messages: [
//           { role: "system", content: systemPrompt },
//           { role: "user", content: prompt }
//         ],
//         temperature: 0.7,
//         max_tokens: 2048,
//       }),
//     });
 
//     const data = await response.json();
//     if (data.error) {
//       console.error("Azure OpenAI API error:", data.error);
//       throw new Error(data.error.message || "Azure OpenAI API error");
//     }
 
//     const content = data.choices[0].message.content.trim();
//     console.log("Raw API response:", content);
//     // Try to parse the response as JSON
//     try {
//       // First, find anything that looks like a JSON array in the response
//       const jsonMatch = content.match(/\[.*\]/s);
//       const jsonContent = jsonMatch ? jsonMatch[0] : content;
//       const parsedItems = JSON.parse(jsonContent);
//       if (Array.isArray(parsedItems)) {
//         // If we got an array, ensure all items are strings
//         return parsedItems.map(item => {
//           if (typeof item === 'object' && item !== null) {
//             // Handle complex object - extract most relevant string property
//             if (Object.keys(item).length === 1) {
//               // If object has only one property, use its value
//               return String(Object.values(item)[0]);
//             } else if (item.hasOwnProperty(type) || item.hasOwnProperty('value')) {
//               // Try to find a property that matches the type or is called 'value'
//               return String(item[type] || item['value']);
//             } else {
//               // Otherwise get the first string property
//               const firstStringProp = Object.values(item).find(v => typeof v === 'string');
//               return firstStringProp ? String(firstStringProp) : JSON.stringify(item);
//             }
//           }
//           // Otherwise convert to string
//           return String(item);
//         }).slice(0, count);
//       } else if (typeof parsedItems === 'object') {
//         // Handle case where we got an object instead of an array
//         return Array(count).fill(JSON.stringify(parsedItems));
//       }
//       // Fallback to string splitting if not a valid JSON array
//       const items = content.split(/[\n,]/)
//         .map(item => item.trim())
//         .filter(Boolean);
//       return items.length >= count ? items.slice(0, count) : Array(count).fill(content);
//     } catch (e) {
//       console.error("JSON parsing error:", e);
//       // Last resort: split by newlines or commas
//       const items = content
//         .replace(/[\[\]"'{}]/g, '') // Remove JSON syntax
//         .split(/[\n,]/)
//         .map(item => item.trim())
//         .filter(Boolean);
//       if (items.length >= count) {
//         return items.slice(0, count);
//       }
//       // If we couldn't get enough items, repeat what we have to fill the count
//       const result = [];
//       for (let i = 0; i < count; i++) {
//         result.push(items[i % items.length] || content);
//       }
//       return result;
//     }
//   } catch (error: any) {
//     console.error("Azure OpenAI generation error:", error);
//     toast.error("Failed to generate data with Azure OpenAI");
//     throw error;
//   }
// };