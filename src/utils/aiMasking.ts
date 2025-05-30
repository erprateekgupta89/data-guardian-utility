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

// Country to nationality mapping (partial, extend as needed)
const COUNTRY_TO_NATIONALITY: Record<string, string> = {
  "United States": "American",
  "Canada": "Canadian",
  "United Kingdom": "British",
  "Australia": "Australian",
  "Germany": "German",
  "France": "French",
  "Spain": "Spanish",
  "Italy": "Italian",
  "Japan": "Japanese",
  "China": "Chinese",
  "India": "Indian",
  "Brazil": "Brazilian",
  "Mexico": "Mexican",
  "South Africa": "South African",
  "Russia": "Russian",
  "South Korea": "South Korean",
  "Netherlands": "Dutch",
  "Sweden": "Swedish",
  "Norway": "Norwegian",
  "Denmark": "Danish",
  "Finland": "Finnish",
  "Switzerland": "Swiss",
  "Austria": "Austrian",
  "Belgium": "Belgian",
  "Portugal": "Portuguese",
  "Greece": "Greek",
  "Ireland": "Irish",
  "New Zealand": "New Zealander",
  "Singapore": "Singaporean",
  "Malaysia": "Malaysian",
  "Thailand": "Thai",
  "Indonesia": "Indonesian",
  "Philippines": "Filipino",
  "Vietnam": "Vietnamese",
  "Turkey": "Turkish",
  // Add more as needed
};

// Country to currency mapping (partial, extend as needed)
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  "United States": "$",
  "Canada": "C$",
  "United Kingdom": "£",
  "Australia": "A$",
  "Germany": "€",
  "France": "€",
  "Spain": "€",
  "Italy": "€",
  "Japan": "¥",
  "China": "¥",
  "India": "₹",
  "Brazil": "R$",
  "Mexico": "$",
  "South Africa": "R",
  "Russia": "₽",
  "South Korea": "₩",
  "Netherlands": "€",
  "Sweden": "kr",
  "Norway": "kr",
  "Denmark": "kr",
  "Finland": "€",
  "Switzerland": "CHF",
  "Austria": "€",
  "Belgium": "€",
  "Portugal": "€",
  "Greece": "€",
  "Ireland": "€",
  "New Zealand": "NZ$",
  "Singapore": "$",
  "Malaysia": "RM",
  "Thailand": "฿",
  "Indonesia": "Rp",
  "Philippines": "₱",
  "Vietnam": "₫",
  "Turkey": "₺",
  // Add more as needed
};

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

// Helper to detect salary/currency columns
function isSalaryColumn(column: ColumnInfo): boolean {
  const name = column.name.toLowerCase();
  return (
    name.includes('salary') ||
    name.includes('income') ||
    name.includes('wage') ||
    name.includes('pay') ||
    name.includes('compensation') ||
    name.includes('earnings')
  );
}

// Helper to enforce uniqueness in an array, with re-attempts for duplicates
async function enforceBatchUniqueness(
  generateFn: (count: number, indices: number[]) => Promise<string[]>,
  initialValues: string[],
  maxAttempts: number = 3
): Promise<string[]> {
  let values = [...initialValues];
  let attempts = 0;
  let uniqueSet = new Set(values);
  let duplicateIndices: number[] = [];

  while (attempts < maxAttempts) {
    // Find indices of duplicates
    const seen = new Map<string, number>();
    duplicateIndices = [];
    values.forEach((val, idx) => {
      if (seen.has(val)) {
        duplicateIndices.push(idx);
      } else {
        seen.set(val, idx);
      }
    });
    if (duplicateIndices.length === 0) break; // All unique
    // Re-generate only for duplicate indices
    const newVals = await generateFn(duplicateIndices.length, duplicateIndices);
    duplicateIndices.forEach((idx, i) => {
      values[idx] = newVals[i];
    });
    uniqueSet = new Set(values);
    attempts++;
  }
  // Final pass: if still not unique, forcibly make unique by appending index
  if (new Set(values).size !== values.length) {
    const seen = new Map<string, number>();
    values = values.map((val, idx) => {
      if (seen.has(val)) {
        return val + '_' + idx;
      } else {
        seen.set(val, idx);
        return val;
      }
    });
  }
  return values;
}

// Function to generate data with OpenAI
export const generateWithOpenAI = async (prompt: string, type: DataType, count: number = 1, country: string = "India"): Promise<string[]> => {  // UPDATE TO PICK COUNTRY VALUE DYNAMICALLY     
  let retryCount = 0;
  let lastError: any = null;
  while (retryCount < MAX_RETRIES) {
    try {
      // const apiKey = validateApiKey();
      
      // Add timestamp and random seed to make each prompt unique to avoid 304 responses
      const timestamp = new Date().toISOString();
      const randomSeed = Math.random().toString(36).substring(2, 15);
      // Add ASCII quote instruction to prompt
      const asciiQuoteInstruction = '\nUse only standard ASCII double quotes (\") for all JSON keys and values. Do NOT use curly quotes or any other characters.';
      const uniquePrompt = `${prompt}${asciiQuoteInstruction} (timestamp: ${timestamp}, seed: ${randomSeed})`;
      
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
      let jsonContent = jsonMatch ? jsonMatch[0] : content;
      // Sanitize curly quotes and common LLM issues
      let sanitized = jsonContent
        .replace(/[""]/g, '"') // curly double quotes
        .replace(/['']/g, "'") // curly single quotes
        .replace(/,\s*([\]}])/g, '$1') // trailing commas
        .replace(/\u201c|\u201d/g, '"') // unicode curly quotes
        .replace(/\u2018|\u2019/g, "'");
      try {
        const parsedItems = JSON.parse(sanitized);
        
        if (Array.isArray(parsedItems)) {
          return parsedItems.slice(0, count);
        } else {
          return Array(count).fill(content);
        }
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        console.error("Raw content:", content);
        console.error("Sanitized content:", sanitized);
        throw new Error("Failed to parse API response");
      }
    } catch (error) {
      lastError = error;
      console.error("Azure OpenAI generation error:", error);
      retryCount++;
      // Exponential backoff
      const waitMs = 1000 * Math.pow(2, retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      if (retryCount >= MAX_RETRIES) {
        toast.error("Failed to generate data with Azure OpenAI after multiple attempts");
        // Fallback: generate random/pattern values for the requested count
        let fallback: string[] = [];
        switch (type) {
          case 'Address':
            for (let i = 0; i < count; i++) fallback.push(`${100 + i} Main St`);
            break;
          case 'City':
            for (let i = 0; i < count; i++) fallback.push(`City${i}`);
            break;
          case 'State':
            for (let i = 0; i < count; i++) fallback.push(`State${i}`);
            break;
          case 'Postal Code':
            for (let i = 0; i < count; i++) fallback.push(`${100000 + i}`);
            break;
          default:
            for (let i = 0; i < count; i++) fallback.push(`Value${i}`);
        }
        return fallback;
      }
    }
  }
  // Should not reach here
  throw lastError || new Error("Failed to generate data after maximum retries");
};

interface MaskingOptions {
  count?: number;
  useCountryDropdown: boolean;
  selectedCountries: string[];
}

// Enhanced: Generate a new geo value based on a reference batch and index, with better pattern logic for City/State/Postal
function generateGeoValueFromReference(referenceBatch: string[], idx: number, dataType: DataType): string {
  const base = referenceBatch[idx % referenceBatch.length];
  if (dataType === 'Address') {
    const match = base.match(/(\d+)(.*)/);
    if (match) {
      const num = parseInt(match[1], 10) + Math.floor(idx / referenceBatch.length) + 1;
      return `${num}${match[2]}`;
    }
    return `${100 + idx} ${base.replace(/^[0-9]+ /, '')}`;
  } else if (dataType === 'City' || dataType === 'State') {
    // Shuffle or append a suffix for more variety
    if (base.length > 3) {
      if (idx < referenceBatch.length) {
        return base;
      }
      // Shuffle: pick a random reference, append a letter
      const ref = referenceBatch[Math.floor(Math.random() * referenceBatch.length)];
      return ref + String.fromCharCode(65 + (idx % 26));
    }
    return base + String.fromCharCode(65 + (idx % 26));
  } else if (dataType === 'Postal Code') {
    // Increment numeric code or append digit
    const num = parseInt(base.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      return (num + idx + 1).toString().padStart(base.length, '0');
    }
    // Shuffle reference and append a digit
    const ref = referenceBatch[Math.floor(Math.random() * referenceBatch.length)];
    return ref + ((idx % 10).toString());
  }
  return base + '_' + idx;
}

// Card type detection and fake card number generation
const CARD_TYPE_RULES = [
  { type: 'Visa', prefix: ['4'], length: [13, 16, 19] },
  { type: 'MasterCard', prefix: ['51', '52', '53', '54', '55', '2221', '2720'], length: [16] },
  { type: 'American Express', prefix: ['34', '37'], length: [15] },
  { type: 'Discover', prefix: ['6011', '65', '644', '645', '646', '647', '648', '649'], length: [16, 19] },
  { type: 'JCB', prefix: ['35'], length: [16, 19] },
  { type: 'Diners Club', prefix: ['300', '301', '302', '303', '304', '305', '36', '38'], length: [14] },
  // Add more as needed
];
function detectCardType(cardNumber: string): string {
  for (const rule of CARD_TYPE_RULES) {
    for (const prefix of rule.prefix) {
      if (cardNumber.startsWith(prefix)) {
        return rule.type;
      }
    }
  }
  return 'Visa'; // Default fallback
}
function generateFakeCardNumber(cardType: string): string {
  const rule = CARD_TYPE_RULES.find(r => r.type === cardType) || CARD_TYPE_RULES[0];
  const prefix = rule.prefix[Math.floor(Math.random() * rule.prefix.length)];
  const length = rule.length[Math.floor(Math.random() * rule.length.length)];
  let number = prefix;
  while (number.length < length - 1) {
    number += Math.floor(Math.random() * 10).toString();
  }
  // Luhn checksum
  function luhnChecksum(num: string): string {
    let sum = 0;
    let shouldDouble = true;
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num[i], 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }
  number += luhnChecksum(number);
  return number;
}

function formatCardNumber(cardNumber: string, cardType: string): string {
  // Remove any non-digit characters
  const digits = cardNumber.replace(/\D/g, '');
  switch (cardType) {
    case 'American Express': // 15 digits: 4-6-5
      return digits.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
    case 'Diners Club': // 14 digits: 4-6-4
      return digits.replace(/(\d{4})(\d{6})(\d{4})/, '$1 $2 $3');
    case 'Visa':
    case 'MasterCard':
    case 'Discover':
    case 'JCB':
    default: // 16/19 digits: 4-4-4-4(-3)
      if (digits.length === 16)
        return digits.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
      if (digits.length === 19)
        return digits.replace(/(\d{4})(\d{4})(\d{4})(\d{4})(\d{3})/, '$1 $2 $3 $4 $5');
      if (digits.length === 13)
        return digits.replace(/(\d{4})(\d{4})(\d{4})(\d{1})/, '$1 $2 $3 $4');
      return digits;
  }
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
  const usedEmails = new Set<string>();
  const usedUsernames = new Set<string>();
  const usedAddresses = new Set<string>();
  const geoReference: Record<string, string[]> = {};
  const geoFirstBatch: Record<string, string[]> = {};
  const hasCountryColumn = columns.some(col => col.name.toLowerCase() === 'country');
  let originalCountryValues: string[] = [];
  if (hasCountryColumn) {
    const countryColName = columns.find(col => col.name.toLowerCase() === 'country')!.name;
    originalCountryValues = Array.from(new Set(allRows.map(row => row[countryColName]).filter(Boolean)));
  }
  // Determine the country to use for the first batch
  let consistentCountry = 'India';
  if (hasCountryColumn) {
    if (useCountryDropdown && selectedCountries && selectedCountries.length > 0) {
      consistentCountry = selectedCountries[0];
    } else if (originalCountryValues.length > 0) {
      consistentCountry = originalCountryValues[0];
    } else {
      consistentCountry = 'India';
    }
  }
  // Detect card type for each credit/debit card column from the first row
  const cardTypeMap: Record<string, string> = {};
  columns.forEach(col => {
    if (/credit.?card|debit.?card|card.?number|cc.?number|ccnum|payment.?card/i.test(col.name)) {
      const firstValue = fileData.data[0]?.[col.name] || '';
      cardTypeMap[col.name] = detectCardType(firstValue);
    }
  });
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchMaskedRows: Record<string, string>[] = batch.map(() => ({}));
    for (const column of columns) {
      if (column.skip) {
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          batchMaskedRows[rowIdx][column.name] = batch[rowIdx][column.name];
        }
        continue;
      }
      if (column.name.toLowerCase() === 'country') {
        const countryValues: string[] = [];
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          let value = '';
          if (batchIdx === 0) {
            value = consistentCountry;
          } else {
            // For subsequent batches, use the value from the corresponding row in the first batch
            value = geoFirstBatch[column.name]?.[rowIdx % BATCH_SIZE] || consistentCountry;
          }
          batchMaskedRows[rowIdx][column.name] = value;
          countryValues.push(value);
        }
        if (batchIdx === 0) geoFirstBatch[column.name] = countryValues.slice();
        console.log(`[Batch ${batchIdx}] Masked 'Country' column values:`, countryValues);
        continue;
      }
      if (isGeoField(column)) {
        if (batchIdx === 0) {
          // First batch: use consistent country for all rows
          let prompt = '';
          let aiResult: any = null;
          let cityArr: string[] = [], stateArr: string[] = [], postalArr: string[] = [];
          if (column.dataType === 'Address') {
            // If city/country context is available, use it for each address
            let cityContextArr: string[] = geoFirstBatch['City'] || [];
            let countryContextArr: string[] = geoFirstBatch['Country'] || Array(batch.length).fill(consistentCountry);
            // Helper to check if an address is valid
            const isValidAddress = (addr: string) => typeof addr === 'string' && addr.trim().length > 0;
            // If city context is not available yet, generate addresses as before
            if (cityContextArr.length === 0) {
              prompt = `Generate ${batch.length} realistic street-level address values for people in ${consistentCountry}. Each address should ONLY contain the street-level address (e.g., house number, building, street, apartment, etc.) and MUST NOT include city, state, postal code, or country. Use local naming conventions and locality structure for ${consistentCountry}. Return ONLY a valid JSON array of strings with exactly ${batch.length} items, no extra text. All values must be unique within the batch.`;
              aiResult = await generateWithOpenAI(prompt, column.dataType, batch.length, consistentCountry);
              // Retry logic for missing/invalid addresses
              let attempts = 0;
              while (attempts < 3) {
                const invalidIndices = aiResult
                  .map((addr: string, idx: number) => (!isValidAddress(addr) ? idx : -1))
                  .filter(idx => idx !== -1);
                if (aiResult.length < batch.length) {
                  for (let i = aiResult.length; i < batch.length; i++) invalidIndices.push(i);
                }
                if (invalidIndices.length === 0) break;
                const retryPrompt = prompt.replace(`${batch.length}`, `${invalidIndices.length}`);
                const retryResult = await generateWithOpenAI(retryPrompt, column.dataType, invalidIndices.length, consistentCountry);
                invalidIndices.forEach((idx, i) => {
                  aiResult[idx] = retryResult[i] || '';
                });
                attempts++;
              }
              // Fallback for any remaining invalids
              for (let i = 0; i < batch.length; i++) {
                if (!isValidAddress(aiResult[i])) {
                  aiResult[i] = `${100 + i} Main St`;
                }
              }
              aiResult = await enforceBatchUniqueness(async (count, indices) => {
                const subPrompt = prompt.replace(`${batch.length}`, `${count}`);
                return await generateWithOpenAI(subPrompt, column.dataType, count, consistentCountry);
              }, aiResult, 3);
            } else {
              // Group by city/country for contextual address generation
              aiResult = Array(batch.length).fill('');
              const cityCountryGroups: Record<string, number[]> = {};
              for (let i = 0; i < batch.length; i++) {
                const city = cityContextArr[i] || '';
                const country = countryContextArr[i] || consistentCountry;
                const key = `${city}|||${country}`;
                if (!cityCountryGroups[key]) cityCountryGroups[key] = [];
                cityCountryGroups[key].push(i);
              }
              for (const [key, indices] of Object.entries(cityCountryGroups)) {
                const [city, country] = key.split('|||');
                const cityCountryPrompt = `Generate ${indices.length} realistic street-level address values for people in ${city}, ${country}. Each address should ONLY contain the street-level address (e.g., house number, building, street, apartment, etc.) and MUST NOT include city, state, postal code, or country. Use local naming conventions and locality structure for ${city}, ${country}. Return ONLY a valid JSON array of strings with exactly ${indices.length} items, no extra text. All values must be unique within the batch.`;
                let subResult = await generateWithOpenAI(cityCountryPrompt, column.dataType, indices.length, country);
                // Retry logic for missing/invalid addresses in this group
                let attempts = 0;
                while (attempts < 3) {
                  const invalidIndices = subResult
                    .map((addr: string, idx: number) => (!isValidAddress(addr) ? idx : -1))
                    .filter(idx => idx !== -1);
                  if (subResult.length < indices.length) {
                    for (let i = subResult.length; i < indices.length; i++) invalidIndices.push(i);
                  }
                  if (invalidIndices.length === 0) break;
                  const retryPrompt = cityCountryPrompt.replace(`${indices.length}`, `${invalidIndices.length}`);
                  const retryResult = await generateWithOpenAI(retryPrompt, column.dataType, invalidIndices.length, country);
                  invalidIndices.forEach((idx, i) => {
                    subResult[idx] = retryResult[i] || '';
                  });
                  attempts++;
                }
                // Fallback for any remaining invalids
                for (let i = 0; i < indices.length; i++) {
                  if (!isValidAddress(subResult[i])) {
                    subResult[i] = `${100 + indices[i]} Main St`;
                  }
                }
                for (let j = 0; j < indices.length; j++) {
                  aiResult[indices[j]] = subResult[j];
                }
              }
              aiResult = await enforceBatchUniqueness(async (count, indices) => {
                // Use the first city/country group for fallback
                const firstKey = Object.keys(cityCountryGroups)[0];
                const [city, country] = firstKey.split('|||');
                const fallbackPrompt = `Generate ${count} realistic street-level address values for people in ${city}, ${country}. Each address should ONLY contain the street-level address (e.g., house number, building, street, apartment, etc.) and MUST NOT include city, state, postal code, or country. Use local naming conventions and locality structure for ${city}, ${country}. Return ONLY a valid JSON array of strings with exactly ${count} items, no extra text. All values must be unique within the batch.`;
                return await generateWithOpenAI(fallbackPrompt, column.dataType, count, country);
              }, aiResult, 3);
            }
          } else if (column.dataType === 'City' || column.dataType === 'State' || column.dataType === 'Postal Code') {
            prompt = `Generate ${batch.length} sets of logically consistent city, state, and postal code values for ${consistentCountry}. Each set must have a postal code that correctly corresponds to the city and state in ${consistentCountry}. Return ONLY a valid JSON array of objects, each with 'city', 'state', and 'postalCode' fields, with exactly ${batch.length} items, no extra text. All values must be unique within the batch.`;
            aiResult = await generateWithOpenAI(prompt, column.dataType, batch.length, consistentCountry);
            // Parse into separate arrays
            cityArr = aiResult.map((obj: any) => obj.city || '');
            stateArr = aiResult.map((obj: any) => obj.state || '');
            postalArr = aiResult.map((obj: any) => obj.postalCode || obj.postal_code || '');
            // Robust retry/fallback for each field
            const isValidCity = (val: string) => typeof val === 'string' && val.trim().length > 0;
            const isValidState = (val: string) => typeof val === 'string' && val.trim().length > 0;
            const isValidPostal = (val: string) => typeof val === 'string' && val.trim().length > 0;
            let attempts = 0;
            while (attempts < 3) {
              const invalidCityIdx = cityArr.map((v, i) => (!isValidCity(v) ? i : -1)).filter(i => i !== -1);
              const invalidStateIdx = stateArr.map((v, i) => (!isValidState(v) ? i : -1)).filter(i => i !== -1);
              const invalidPostalIdx = postalArr.map((v, i) => (!isValidPostal(v) ? i : -1)).filter(i => i !== -1);
              // If any array is too short, add missing indices
              if (cityArr.length < batch.length) for (let i = cityArr.length; i < batch.length; i++) invalidCityIdx.push(i);
              if (stateArr.length < batch.length) for (let i = stateArr.length; i < batch.length; i++) invalidStateIdx.push(i);
              if (postalArr.length < batch.length) for (let i = postalArr.length; i < batch.length; i++) invalidPostalIdx.push(i);
              if (invalidCityIdx.length === 0 && invalidStateIdx.length === 0 && invalidPostalIdx.length === 0) break;
              // Retry for all invalids at once (get new sets)
              const retryCount = Math.max(invalidCityIdx.length, invalidStateIdx.length, invalidPostalIdx.length);
              if (retryCount === 0) break;
              const retryPrompt = `Generate ${retryCount} sets of logically consistent city, state, and postal code values for ${consistentCountry}. Each set must have a postal code that correctly corresponds to the city and state in ${consistentCountry}. Return ONLY a valid JSON array of objects, each with 'city', 'state', and 'postalCode' fields, with exactly ${retryCount} items, no extra text. All values must be unique within the batch.`;
              const retryResult = await generateWithOpenAI(retryPrompt, column.dataType, retryCount, consistentCountry);
              for (let j = 0; j < retryCount; j++) {
                const obj: any = retryResult[j];
                const isObj = obj && typeof obj === 'object' && !Array.isArray(obj);
                if (invalidCityIdx[j] !== undefined) cityArr[invalidCityIdx[j]] = isObj && typeof obj.city === 'string' && obj.city.trim() ? obj.city : `City${invalidCityIdx[j]}`;
                if (invalidStateIdx[j] !== undefined) stateArr[invalidStateIdx[j]] = isObj && typeof obj.state === 'string' && obj.state.trim() ? obj.state : `State${invalidStateIdx[j]}`;
                if (invalidPostalIdx[j] !== undefined) postalArr[invalidPostalIdx[j]] = isObj && (typeof obj.postalCode === 'string' && obj.postalCode.trim() ? obj.postalCode : (typeof obj.postal_code === 'string' && obj.postal_code.trim() ? obj.postal_code : `000000`));
              }
              attempts++;
            }
            // Fallback for any remaining invalids
            for (let i = 0; i < batch.length; i++) {
              if (!isValidCity(cityArr[i])) cityArr[i] = `City${i}`;
              if (!isValidState(stateArr[i])) stateArr[i] = `State${i}`;
              if (!isValidPostal(postalArr[i])) postalArr[i] = `000000`;
            }
            // Assign to geoReference and geoFirstBatch for each
            geoReference['City'] = cityArr;
            geoReference['State'] = stateArr;
            geoReference['Postal Code'] = postalArr;
            geoFirstBatch['City'] = cityArr.slice();
            geoFirstBatch['State'] = stateArr.slice();
            geoFirstBatch['Postal Code'] = postalArr.slice();
          } else {
            prompt = `Generate ${batch.length} realistic ${column.dataType} values appropriate for people in ${consistentCountry}. Return ONLY a valid JSON array of strings with exactly ${batch.length} items, no extra text. All values must be unique within the batch.`;
            aiResult = await generateWithOpenAI(prompt, column.dataType, batch.length, consistentCountry);
            aiResult = await enforceBatchUniqueness(async (count, indices) => {
              const subPrompt = prompt.replace(`${batch.length}`, `${count}`);
              return await generateWithOpenAI(subPrompt, column.dataType, count, consistentCountry);
            }, aiResult, 3);
          }
          if (column.dataType === 'Address') {
            for (let rowIdx = 0; rowIdx < aiResult.length; rowIdx++) {
              const originalValue = batch[rowIdx][column.name];
              let address = aiResult[rowIdx] || originalValue;
              let attempt = 0;
              while ((usedAddresses.has(address) || address === originalValue) && attempt < 100) {
                const match = address.match(/(\d+)(.*)/);
                if (match) {
                  const num = parseInt(match[1], 10) + attempt + 1;
                  address = `${num}${match[2]}`;
                } else {
                  address = address + '_' + attempt;
                }
                attempt++;
              }
              usedAddresses.add(address);
              batchMaskedRows[rowIdx][column.name] = address;
              aiResult[rowIdx] = address;
            }
            geoReference[column.name] = aiResult;
            geoFirstBatch[column.name] = aiResult.slice();
          } else if (column.dataType === 'City') {
            for (let rowIdx = 0; rowIdx < cityArr.length; rowIdx++) {
              batchMaskedRows[rowIdx][column.name] = cityArr[rowIdx];
            }
          } else if (column.dataType === 'State') {
            for (let rowIdx = 0; rowIdx < stateArr.length; rowIdx++) {
              batchMaskedRows[rowIdx][column.name] = stateArr[rowIdx];
            }
          } else if (column.dataType === 'Postal Code') {
            for (let rowIdx = 0; rowIdx < postalArr.length; rowIdx++) {
              batchMaskedRows[rowIdx][column.name] = postalArr[rowIdx];
            }
          } else {
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              const originalValue = batch[rowIdx][column.name];
              let value = aiResult[rowIdx] || originalValue;
              let attempt = 0;
              while (value === originalValue && attempt < 20) {
                value = generateGeoValueFromReference(aiResult, rowIdx + attempt + 1, column.dataType);
                attempt++;
              }
              batchMaskedRows[rowIdx][column.name] = value;
              aiResult[rowIdx] = value;
            }
            geoReference[column.name] = aiResult;
            geoFirstBatch[column.name] = aiResult.slice();
          }
          console.log(`[Batch ${batchIdx}] Masked geo column '${column.name}' AI result:`, aiResult);
        } else {
          const reference = geoReference[column.name];
          if (!reference || reference.length === 0) {
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              const originalValue = batch[rowIdx][column.name];
              let value = maskLocationData(originalValue, column.dataType as any);
              let attempt = 0;
              while (value === originalValue && attempt < 20) {
                value = maskLocationData(originalValue, column.dataType as any);
                attempt++;
              }
              batchMaskedRows[rowIdx][column.name] = value;
            }
          } else {
            if (column.dataType === 'Address') {
              for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
                const originalValue = batch[rowIdx][column.name];
                let idx = (batchIdx - 1) * BATCH_SIZE + rowIdx;
                let address = generateGeoValueFromReference(reference, idx, column.dataType);
                let attempt = 0;
                while ((usedAddresses.has(address) || address === originalValue) && attempt < 100) {
                  const match = address.match(/(\d+)(.*)/);
                  if (match) {
                    const num = parseInt(match[1], 10) + attempt + 1;
                    address = `${num}${match[2]}`;
                  } else {
                    address = address + '_' + attempt;
                  }
                  attempt++;
                }
                usedAddresses.add(address);
                batchMaskedRows[rowIdx][column.name] = address;
              }
            } else if (
              column.dataType === 'City' ||
              column.dataType === 'State' ||
              column.dataType === 'Postal Code'
            ) {
              // Use the value from the corresponding row in the first batch as a fixed template
              for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
                const template = geoFirstBatch[column.name]?.[rowIdx % BATCH_SIZE];
                batchMaskedRows[rowIdx][column.name] = template || '';
              }
            } else {
              for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
                const originalValue = batch[rowIdx][column.name];
                let value = generateGeoValueFromReference(reference, (batchIdx - 1) * BATCH_SIZE + rowIdx, column.dataType);
                let attempt = 0;
                while (value === originalValue && attempt < 20) {
                  value = generateGeoValueFromReference(reference, (batchIdx - 1) * BATCH_SIZE + rowIdx + attempt + 1, column.dataType);
                  attempt++;
                }
                batchMaskedRows[rowIdx][column.name] = value;
              }
            }
          }
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
          } else if (column.name.toLowerCase() === 'nationality') {
            // Nationality masking based on country value
            // Use the already-masked country value for this row
            const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
            let countryValue = '';
            if (countryCol) {
              countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || '';
            }
            // Normalize country value for mapping
            const mappedNationality = COUNTRY_TO_NATIONALITY[countryValue.trim()] || (countryValue ? countryValue + ' National' : 'National');
            value = mappedNationality;
          } else if (isSalaryColumn(column)) {
            // Salary masking with country currency
            const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
            let countryValue = '';
            if (countryCol) {
              countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || '';
            }
            const currency = COUNTRY_TO_CURRENCY[countryValue.trim()] || '$';
            // Generate a random salary value (optionally, you can use originalValue to infer range)
            const salary = chance.integer({ min: 20000, max: 200000 });
            // Format: $50,000 or ₹50,000 etc.
            value = `${currency}${salary.toLocaleString()}`;
          } else if (column.name.toLowerCase() === 'email') {
            // Email masking: preserve domain, randomize username, ensure uniqueness
            const originalEmail = originalValue;
            const atIdx = originalEmail.indexOf('@');
            if (atIdx !== -1) {
              const domain = originalEmail.slice(atIdx);
              let email;
              let attempts = 0;
              do {
                const username = chance.string({ length: 8, pool: 'abcdefghijklmnopqrstuvwxyz0123456789' });
                email = `${username}${domain}`;
                attempts++;
                // Safety: avoid infinite loop (should never happen in practice)
                if (attempts > 100) {
                  email = `${username}${Date.now()}${domain}`;
                  break;
                }
              } while (usedEmails.has(email));
              usedEmails.add(email);
              value = email;
            } else {
              let email;
              let attempts = 0;
              do {
                email = chance.email();
                attempts++;
                if (attempts > 100) {
                  email = `${chance.string({ length: 8 })}${Date.now()}@example.com`;
                  break;
                }
              } while (usedEmails.has(email));
              usedEmails.add(email);
              value = email;
            }
          } else if (column.name.toLowerCase() === 'username') {
            // Username masking: treat as generic String, ensure alphanumeric and unique
            let username;
            let attempts = 0;
            do {
              // Generate a username with text and numbers (e.g., user123, alex99)
              const prefix = chance.string({ length: chance.integer({ min: 3, max: 6 }), pool: 'abcdefghijklmnopqrstuvwxyz' });
              const suffix = chance.integer({ min: 10, max: 99999 }).toString();
              username = `${prefix}${suffix}`;
              attempts++;
              if (attempts > 100) {
                username = `${prefix}${suffix}${Date.now()}`;
                break;
              }
            } while (usedUsernames.has(username));
            usedUsernames.add(username);
            value = username;
          } else {
            switch (column.dataType) {
              case 'Name':
                // If this is a username column, skip Name logic (already handled above)
                if (column.name.toLowerCase() === 'username') {
                  break;
                }
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
          // Ensure the masked value is different from the original value
          let attempt = 0;
          while (value === originalValue && attempt < 20) {
            // Regenerate using the same logic
            if (isMaritalStatusColumn(column) && column.dataType === 'String') {
              value = MARITAL_STATUS_VALUES[Math.floor(Math.random() * MARITAL_STATUS_VALUES.length)];
            } else if (column.name.toLowerCase() === 'nationality') {
              const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
              let countryValue = '';
              if (countryCol) {
                countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || '';
              }
              const mappedNationality = COUNTRY_TO_NATIONALITY[countryValue.trim()] || (countryValue ? countryValue + ' National' : 'National');
              value = mappedNationality;
            } else if (isSalaryColumn(column)) {
              const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
              let countryValue = '';
              if (countryCol) {
                countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || '';
              }
              const currency = COUNTRY_TO_CURRENCY[countryValue.trim()] || '$';
              const salary = chance.integer({ min: 20000, max: 200000 });
              value = `${currency}${salary.toLocaleString()}`;
            } else if (column.name.toLowerCase() === 'email') {
              const originalEmail = originalValue;
              const atIdx = originalEmail.indexOf('@');
              if (atIdx !== -1) {
                const domain = originalEmail.slice(atIdx);
                let email;
                let attempts = 0;
                do {
                  const username = chance.string({ length: 8, pool: 'abcdefghijklmnopqrstuvwxyz0123456789' });
                  email = `${username}${domain}`;
                  attempts++;
                  if (attempts > 100) {
                    email = `${username}${Date.now()}${domain}`;
                    break;
                  }
                } while (usedEmails.has(email));
                usedEmails.add(email);
                value = email;
              } else {
                let email;
                let attempts = 0;
                do {
                  email = chance.email();
                  attempts++;
                  if (attempts > 100) {
                    email = `${chance.string({ length: 8 })}${Date.now()}@example.com`;
                    break;
                  }
                } while (usedEmails.has(email));
                usedEmails.add(email);
                value = email;
              }
            } else if (column.name.toLowerCase() === 'username') {
              let username;
              let attempts = 0;
              do {
                const prefix = chance.string({ length: chance.integer({ min: 3, max: 6 }), pool: 'abcdefghijklmnopqrstuvwxyz' });
                const suffix = chance.integer({ min: 10, max: 99999 }).toString();
                username = `${prefix}${suffix}`;
                attempts++;
                if (attempts > 100) {
                  username = `${prefix}${suffix}${Date.now()}`;
                  break;
                }
              } while (usedUsernames.has(username));
              usedUsernames.add(username);
              value = username;
            } else {
              switch (column.dataType) {
                case 'Name':
                  if (column.name.toLowerCase() === 'username') {
                    break;
                  }
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
                  value = randomStringFromPattern(type, length, originalValue);
                  break;
              }
            }
            attempt++;
          }
          // Mask credit/debit card columns with detected type and format
          if (/credit.?card|debit.?card|card.?number|cc.?number|ccnum|payment.?card/i.test(column.name)) {
            const cardType = cardTypeMap[column.name] || 'Visa';
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              const rawCard = generateFakeCardNumber(cardType);
              batchMaskedRows[rowIdx][column.name] = formatCardNumber(rawCard, cardType);
            }
            continue;
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
    // If there is no country column, ensure geoFirstBatch['Country'] is always filled with 'India' for reference
    if (!hasCountryColumn && batchIdx === 0) {
      geoFirstBatch['Country'] = Array(batch.length).fill('India');
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