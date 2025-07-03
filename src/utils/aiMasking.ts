
import { ColumnInfo, DataType } from '../types';

const OPENAI_API_ENDPOINT = 'https://api.openai.com/v4/chat/completions';
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface MaskingResponse {
  [key: string]: string;
}

export async function maskDataWithAI(
  data: Record<string, string>[],
  columns: ColumnInfo[],
  apiKey: string,
  onProgress?: (progress: number) => void
): Promise<Record<string, string>[]> {
  console.log('Starting AI masking process', { dataCount: data.length, columnsCount: columns.length });
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const columnsToMask = columns.filter(col => !col.skip);
  console.log('Columns to mask:', columnsToMask.map(col => ({ name: col.name, dataType: col.dataType })));
  
  if (columnsToMask.length === 0) {
    console.log('No columns to mask, returning original data');
    onProgress?.(100);
    return data;
  }

  return await maskDataWithAIBatched(data, columnsToMask, apiKey, onProgress);
}

async function maskDataWithAIBatched(
  data: Record<string, string>[],
  columns: ColumnInfo[],
  apiKey: string,
  onProgress?: (progress: number) => void
): Promise<Record<string, string>[]> {
  const maskedData: Record<string, string>[] = [];
  const totalBatches = Math.ceil(data.length / BATCH_SIZE);
  let processedBatches = 0;

  console.log(`Processing ${data.length} rows in ${totalBatches} batches of ${BATCH_SIZE}`);

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${processedBatches + 1}/${totalBatches}`, { batchSize: batch.length });
    
    try {
      const maskedBatch = await processBatchWithRetry(batch, columns, apiKey);
      maskedData.push(...maskedBatch);
      
      processedBatches++;
      const progress = Math.round((processedBatches / totalBatches) * 100);
      console.log(`Batch ${processedBatches} completed, progress: ${progress}%`);
      onProgress?.(progress);
      
    } catch (error) {
      console.error(`Failed to process batch ${processedBatches + 1}:`, error);
      // Add original batch data as fallback
      maskedData.push(...batch);
      processedBatches++;
      onProgress?.(Math.round((processedBatches / totalBatches) * 100));
    }
  }

  console.log('AI masking completed', { originalCount: data.length, maskedCount: maskedData.length });
  return maskedData;
}

async function processBatchWithRetry(
  batch: Record<string, string>[],
  columns: ColumnInfo[],
  apiKey: string,
  retryCount = 0
): Promise<Record<string, string>[]> {
  try {
    return await processBatch(batch, columns, apiKey);
  } catch (error) {
    console.error(`Batch processing attempt ${retryCount + 1} failed:`, error);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying batch processing (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return processBatchWithRetry(batch, columns, apiKey, retryCount + 1);
    } else {
      console.error('Max retries reached, using fallback masking');
      return batch; // Return original data as fallback
    }
  }
}

async function processBatch(
  batch: Record<string, string>[],
  columns: ColumnInfo[],
  apiKey: string
): Promise<Record<string, string>[]> {
  const prompt = createMaskingPrompt(batch, columns);
  console.log('Generated prompt:', prompt.substring(0, 200) + '...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a data masking assistant. Return only valid JSON arrays without any additional text or formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', { status: response.status, statusText: response.statusText, error: errorText });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result: OpenAIResponse = await response.json();
    console.log('Raw OpenAI response:', result);

    if (!result.choices || result.choices.length === 0) {
      throw new Error('No choices in OpenAI response');
    }

    const content = result.choices[0].message.content.trim();
    console.log('OpenAI response content:', content);

    return parseOpenAIResponse(content, batch, columns);

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

function parseOpenAIResponse(
  content: string,
  originalBatch: Record<string, string>[],
  columns: ColumnInfo[]
): Record<string, string>[] {
  try {
    // Clean the response content
    let cleanContent = content.replace(/```json\s*/, '').replace(/```\s*$/, '').trim();
    
    // Try to find JSON array in the content
    const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanContent = jsonMatch[0];
    }

    console.log('Attempting to parse cleaned content:', cleanContent);
    const parsedResponse: MaskingResponse[] = JSON.parse(cleanContent);

    if (!Array.isArray(parsedResponse)) {
      console.error('Response is not an array:', parsedResponse);
      throw new Error('Expected array response from AI');
    }

    if (parsedResponse.length !== originalBatch.length) {
      console.warn(`Response length mismatch: expected ${originalBatch.length}, got ${parsedResponse.length}`);
    }

    // Process each response item
    const maskedBatch = originalBatch.map((originalRow, index) => {
      const responseRow = parsedResponse[index];
      if (!responseRow) {
        console.warn(`No response for row ${index}, using original data`);
        return originalRow;
      }

      const maskedRow = { ...originalRow };

      // Apply masking for each column
      columns.forEach(column => {
        if (column.skip) return;

        const maskedValue = responseRow[column.name];
        if (maskedValue !== undefined && maskedValue !== null) {
          // Special handling for address fields
          if (column.dataType === 'Address') {
            maskedRow[column.name] = handleAddressResponse(maskedValue, originalRow[column.name]);
          } else {
            maskedRow[column.name] = String(maskedValue);
          }
        } else {
          console.warn(`No masked value for column ${column.name} in row ${index}`);
        }
      });

      return maskedRow;
    });

    console.log('Successfully parsed and processed batch:', { originalCount: originalBatch.length, maskedCount: maskedBatch.length });
    return maskedBatch;

  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    console.error('Original content:', content);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

function handleAddressResponse(aiResponse: any, originalValue: string): string {
  try {
    // If the AI response is already a string, use it directly
    if (typeof aiResponse === 'string') {
      return aiResponse;
    }

    // If the AI response is an object with address components, format it
    if (typeof aiResponse === 'object' && aiResponse !== null) {
      const parts = [];
      
      // Try common address field names
      const addressFields = ['street', 'address', 'street_address', 'line1'];
      const cityFields = ['city', 'locality'];
      const stateFields = ['state', 'region', 'province'];
      const zipFields = ['zip', 'zipcode', 'postal_code', 'postcode'];

      // Extract street address
      for (const field of addressFields) {
        if (aiResponse[field]) {
          parts.push(aiResponse[field]);
          break;
        }
      }

      // Extract city
      for (const field of cityFields) {
        if (aiResponse[field]) {
          parts.push(aiResponse[field]);
          break;
        }
      }

      // Extract state
      for (const field of stateFields) {
        if (aiResponse[field]) {
          parts.push(aiResponse[field]);
          break;
        }
      }

      // Extract zip code
      for (const field of zipFields) {
        if (aiResponse[field]) {
          parts.push(aiResponse[field]);
          break;
        }
      }

      if (parts.length > 0) {
        return parts.join(', ');
      }

      // If we can't parse the object, stringify it
      return JSON.stringify(aiResponse);
    }

    // Fallback to original value if we can't process the response
    console.warn('Could not process address response, using original:', { aiResponse, originalValue });
    return originalValue;

  } catch (error) {
    console.error('Error handling address response:', error);
    return originalValue;
  }
}

function createMaskingPrompt(batch: Record<string, string>[], columns: ColumnInfo[]): string {
  const columnDescriptions = columns
    .filter(col => !col.skip)
    .map(col => `- ${col.name}: ${col.dataType}`)
    .join('\n');

  const sampleData = batch.slice(0, 3).map((row, index) => {
    const filteredRow = {};
    columns.forEach(col => {
      if (!col.skip) {
        filteredRow[col.name] = row[col.name];
      }
    });
    return `Row ${index + 1}: ${JSON.stringify(filteredRow)}`;
  }).join('\n');

  return `Mask the following data by replacing real values with realistic fake values. Keep the same data types and formats.

Columns to mask:
${columnDescriptions}

Rules:
1. For Address: Generate realistic street addresses
2. For Email: Generate realistic email addresses  
3. For Phone Number: Generate realistic phone numbers
4. For Name: Generate realistic names
5. For other fields: Generate appropriate fake data matching the data type
6. Return ONLY a JSON array of objects with the same structure
7. Each object should have the same keys as the input
8. Do not include any explanation or additional text

Sample input data:
${sampleData}

Data to mask (return exactly ${batch.length} objects):
${JSON.stringify(batch.map(row => {
  const filteredRow = {};
  columns.forEach(col => {
    if (!col.skip) {
      filteredRow[col.name] = row[col.name];
    }
  });
  return filteredRow;
}))}`;
}
