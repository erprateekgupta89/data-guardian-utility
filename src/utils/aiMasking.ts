// import { OpenAI } from 'openai';
import { toast } from "sonner";
import { ColumnInfo, DataType, FileData } from '@/types';
import { getRandomSample, chunkArray } from './maskingHelpers';
import { maskPersonalInfo, maskLocationData, maskDateTime } from './dataTypeMasking';
import { detectColumnDataType } from './dataDetection';
import { Chance } from 'chance';

const chance = new Chance();
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// Azure OpenAI configuration
const AZURE_OPENAI_API_KEY = "AEw7fZ3WwPe6u6Msudlam9bpTz7sSM8JiUhVHIDtpvSHpXn4GDcIJQQJ99BBACYeBjFXJ3w3AAABACOGZap5";
const AZURE_OPENAI_ENDPOINT = "https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_API_VERSION = "2025-01-01-preview";
const MAX_RETRIES = 3;

// Regex patterns for common data types
const REGEX_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phoneNumber: /^\+?[1-9]\d{1,14}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  aadhaar: /^\d{4}\s\d{4}\s\d{4}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  iban: /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
  name: /^[A-Za-z\s'-]+$/,
  amount: /^\$\d{1,3}(,\d{3})*(\.\d{2})?$/,
  percentage: /^\d{1,3}%$/,
  creditCard: /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/
};

// Pattern detection functions
function detectColumnPattern(values: string[]): { pattern: string; confidence: number } | null {
  const nonEmptyValues = values.filter(v => v && v.trim() !== '');
  if (nonEmptyValues.length === 0) return null;

  let bestMatch: { pattern: string; confidence: number } | null = null;
  let highestConfidence = 0;

  for (const [pattern, regex] of Object.entries(REGEX_PATTERNS)) {
    const matches = nonEmptyValues.filter(v => new RegExp(regex).test(v));
    const confidence = matches.length / nonEmptyValues.length;
    
    if (confidence > highestConfidence && confidence > 0.5) {
      highestConfidence = confidence;
      bestMatch = { pattern, confidence };
    }
  }

  return bestMatch;
}

// async function detectPatternWithAI(values: string[]): Promise<{ pattern: string; regex: string } | null> {
//   try {
//     const nonEmptyValues = values.filter(v => v && v.trim() !== '');
//     if (nonEmptyValues.length === 0) return null;

//     const sampleValues = nonEmptyValues.slice(0, 5);
//     const prompt = `Analyze these values and identify their pattern:
// ${sampleValues.join('\n')}

// Return the pattern in JSON format:
// {
//   "pattern": "pattern_name",
//   "regex": "regex_pattern"
// }`;

//     const response = await openai.chat.completions.create({
//       model: "gpt-4",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0.1,
//       max_tokens: 150
//     });

//     const result = response.choices[0]?.message?.content;
//     if (!result) return null;

//     try {
//       const patternInfo = JSON.parse(result);
//       if (patternInfo.pattern && patternInfo.regex) {
//         return patternInfo;
//       }
//     } catch (e) {
//       console.error('Failed to parse AI pattern response:', e);
//     }
//   } catch (error) {
//     console.error('Error in AI pattern detection:', error);
//   }
//   return null;
// }

// function addPatternToPool(pattern: string, regex: string): void {
//   if (!REGEX_PATTERNS[pattern]) {
//     REGEX_PATTERNS[pattern] = regex;
//   }
// }

function validateMaskedValue(original: string, masked: string, pattern: string): boolean {
  if (original === masked) return false;

  const regex = REGEX_PATTERNS[pattern];
  if (!regex) return true;

  return new RegExp(regex).test(masked);
}

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

// Country to phone code mapping (partial, extend as needed)
const COUNTRY_TO_PHONE_CODE: Record<string, string> = {
  'India': '+91',
  'United States': '+1',
  'Canada': '+1',
  'United Kingdom': '+44',
  'Australia': '+61',
  'Germany': '+49',
  'France': '+33',
  'Japan': '+81',
  'China': '+86',
  'Brazil': '+55',
  'Mexico': '+52',
  'South Africa': '+27',
  'Russia': '+7',
  'South Korea': '+82',
  'Netherlands': '+31',
  'Sweden': '+46',
  'Norway': '+47',
  'Denmark': '+45',
  'Finland': '+358',
  'Switzerland': '+41',
  'Austria': '+43',
  'Belgium': '+32',
  'Portugal': '+351',
  'Greece': '+30',
  'Ireland': '+353',
  'New Zealand': '+64',
  'Singapore': '+65',
  'Malaysia': '+60',
  'Thailand': '+66',
  'Indonesia': '+62',
  'Philippines': '+63',
  'Vietnam': '+84',
  'Turkey': '+90',
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

// Common uniform text patterns (case-insensitive, trimmed)
const UNIFORM_TEXT_PATTERNS = [
  /^n[./-]?a$/i, // N/A, n.a., n-a
  /^not[\s_-]?applicable$/i,
  /^confidential$/i,
  /^unknown$/i,
  /^unspecified$/i,
  /^missing$/i,
  /^null$/i,
  /^none$/i,
  /^blank$/i,
  /^empty$/i,
  /^no data$/i,
  /^not provided$/i,
  /^not specified$/i
];

// Function to detect constant and uniform text columns
const detectConstantColumns = (data: Record<string, string>[], columns: ColumnInfo[]): Record<string, string> => {
  const constantColumns: Record<string, string> = {};
  
  columns.forEach(column => {
    if (column.skip) return; // Skip columns marked for skipping
    const values = data.map(row => (row[column.name] || '').trim()).filter(Boolean);
    if (values.length === 0) return; // Skip empty columns
    const uniqueValues = Array.from(new Set(values.map(v => v.toLowerCase())));
    // Check for true constant
    if (uniqueValues.length === 1) {
      constantColumns[column.name] = values[0];
      console.log(`Column '${column.name}' is constant/uniform with value: ${values[0]}`);
      return;
    }
    // Check for uniform text pattern
    if (uniqueValues.length === 1 || uniqueValues.every(val => UNIFORM_TEXT_PATTERNS.some(re => re.test(val)))) {
      constantColumns[column.name] = values[0];
      console.log(`Column '${column.name}' is uniform text with value: ${values[0]}`);
      return;
    }
  });
  return constantColumns;
};

// Function to detect dual-label columns and their distribution
const detectDualLabelColumns = (data: Record<string, string>[], columns: ColumnInfo[]): Record<string, { labels: string[], distribution: number[] }> => {
  const dualLabelColumns: Record<string, { labels: string[], distribution: number[] }> = {};
  
  columns.forEach(column => {
    if (column.skip) return; // Skip columns marked for skipping
    
    const values = data.map(row => (row[column.name] || '').trim()).filter(Boolean);
    if (values.length === 0) return; // Skip empty columns
    
    // Get unique values and their counts
    const valueCounts = new Map<string, number>();
    values.forEach(value => {
      valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
    });
    
    // Check if this is a dual-label column (exactly 2 unique values)
    if (valueCounts.size === 2) {
      const labels = Array.from(valueCounts.keys());
      const total = values.length;
      const distribution = labels.map(label => valueCounts.get(label)! / total);
      
      dualLabelColumns[column.name] = {
        labels,
        distribution
      };
      
      console.log(`Column '${column.name}' is a dual-label column with values:`, labels, 'and distribution:', distribution);
    }
  });
  
  return dualLabelColumns;
};

// Function to generate a value based on the original distribution
const generateValueFromDistribution = (labels: string[], distribution: number[]): string => {
  const random = Math.random();
  let cumulative = 0;
  
  for (let i = 0; i < distribution.length; i++) {
    cumulative += distribution[i];
    if (random <= cumulative) {
      return labels[i];
    }
  }
  
  return labels[0]; // Fallback to first label
};

// Add sequential pattern detection function
function detectSequentialPattern(values: string[]): { prefix: string; lastNumber: number } | null {
  if (values.length < 2) return null;
  
  // Try to find a pattern like "abc1", "abc2", etc.
  const pattern = /^([a-zA-Z]+)(\d+)$/;
  const matches = values.map(v => v.match(pattern));
  
  // Check if all values match the pattern
  if (!matches.every(m => m !== null)) return null;
  
  // Extract prefix and numbers
  const firstMatch = matches[0]!;
  const prefix = firstMatch[1];
  
  // Verify all values have the same prefix
  if (!matches.every(m => m![1] === prefix)) return null;
  
  // Extract and sort numbers
  const numbers = matches.map(m => parseInt(m![2], 10)).sort((a, b) => a - b);
  
  // Check if numbers are sequential
  const isSequential = numbers.every((num, index) => {
    if (index === 0) return true;
    return num === numbers[index - 1] + 1;
  });
  
  if (!isSequential) return null;
  
  return {
    prefix,
    lastNumber: numbers[numbers.length - 1]
  };
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
          "api-key": AZURE_OPENAI_API_KEY,
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
          temperature: 0.4 + Math.random() * 0.05, // Slight variation in temperature
          top_p: 0.6 + Math.random() * 0.1,     // Slight variation in top_p
          // frequency_penalty: 1.8 + Math.random() * 0.1,  // Small random frequency penalty    //
          presence_penalty: Math.random() * 0.1,   // Small random presence penalty
          // request_id: requestId                    // Include request ID in the body: NOT REQUIRED
          max_tokens: 6000   // Increased max tokens to allow larger responses
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
      // For the first batch, return as-is
      if (idx < referenceBatch.length) {
        return base;
      }
      // For subsequent rows, increment house number by 1 for each row after 100
      const baseNum = parseInt(match[1], 10);
      const increment = idx - referenceBatch.length + 1;
      return `${baseNum + increment}${match[2]}`;
    }
    // Fallback if no number found
    if (idx < referenceBatch.length) {
      return base;
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

// Debit card rules (example: RuPay, Maestro, etc.)
const DEBIT_CARD_TYPE_RULES = [
  { type: 'RuPay', prefix: ['60', '65', '81', '82', '508'], length: [16] },
  { type: 'Maestro', prefix: ['5018', '5020', '5038', '56', '57', '58', '6304', '6759', '6761', '6762', '6763'], length: [16, 19] },
  // Add more as needed
];
function generateFakeDebitCardNumber(): string {
  const rule = DEBIT_CARD_TYPE_RULES[Math.floor(Math.random() * DEBIT_CARD_TYPE_RULES.length)];
  const prefix = rule.prefix[Math.floor(Math.random() * rule.prefix.length)];
  // Only allow 16-digit numbers for formatting (4-4-4-4)
  const length = 16;
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
  // Ensure exactly 16 digits
  number = number.slice(0, 16);
  return number;
}

function extractPhoneFormat(original: string, country: string): { code: string, format: string, digitCount: number, prefix: string, suffix: string } {
  // Try to extract country code with or without brackets
  let code = '';
  let rest = original;
  let prefix = '';
  let suffix = '';
  // Match patterns like (+91), +91, (91), etc.
  const match = original.match(/^(\(\+?\d{1,4}\)|\+\d{1,4}|\(\d{1,4}\))[\s-]?(.+)$/);
  if (match) {
    code = match[1];
    rest = match[2];
    prefix = original.slice(0, match.index! + match[1].length);
    suffix = original.slice(match.index! + match[0].length);
  } else {
    // Try to find code at the start
    const codeMatch = original.match(/^(\+\d{1,4})[\s-]?(.+)$/);
    if (codeMatch) {
      code = codeMatch[1];
      rest = codeMatch[2];
      prefix = original.slice(0, codeMatch.index! + codeMatch[1].length);
      suffix = original.slice(codeMatch.index! + codeMatch[0].length);
    } else {
      code = COUNTRY_TO_PHONE_CODE[country] || '';
      rest = original;
      prefix = '';
      suffix = '';
    }
  }
  // Remove any other country code from rest
  rest = rest.replace(/(\(\+?\d{1,4}\)|\+\d{1,4}|\(\d{1,4}\))/, '');
  // Count digits
  const digitCount = rest.replace(/\D/g, '').length;
  // Build format string (e.g., (###)###-####)
  let format = rest.replace(/\d/g, '#');
  return { code, format, digitCount, prefix, suffix };
}

function formatPhoneNumberStrict(original: string, country: string, usedNumbers: Set<string>): string {
  const { code, format, digitCount, prefix, suffix } = extractPhoneFormat(original, country);
  let newDigits = '';
  do {
    newDigits = '';
    for (let i = 0; i < digitCount; i++) {
      newDigits += Math.floor(Math.random() * 10).toString();
    }
  } while (usedNumbers.has(`${code}${newDigits}`));
  // Reapply format
  let masked = '';
  let digitIdx = 0;
  for (let i = 0; i < format.length; i++) {
    if (format[i] === '#') {
      masked += newDigits[digitIdx++] || '';
    } else {
      masked += format[i];
    }
  }
  // Ensure only one country code, in the same position as original
  let result = '';
  if (prefix) {
    result = `${prefix}${masked}${suffix}`.replace(/\s+/g, ' ').trim();
  } else if (code) {
    result = `${code} ${masked}`.replace(/\s+/g, ' ').trim();
  } else {
    result = masked;
  }
  return result;
}

// --- Country-aware Postal Code Validation ---
const postalCodePatterns: Record<string, RegExp> = {
  India: /^[1-9][0-9]{5}$/,
  US: /^\d{5}(-\d{4})?$/,
  USA: /^\d{5}(-\d{4})?$/,
  Canada: /^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/,
  UK: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
  UnitedKingdom: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
  Australia: /^\d{4}$/,
  Germany: /^\d{5}$/,
  France: /^\d{5}$/,
  Italy: /^\d{5}$/,
  Spain: /^\d{5}$/,
  Netherlands: /^\d{4}\s?[A-Za-z]{2}$/,
  Belgium: /^\d{4}$/,
  Switzerland: /^\d{4}$/,
  Austria: /^\d{4}$/,
  Sweden: /^\d{3}\s?\d{2}$/,
  Norway: /^\d{4}$/,
  Denmark: /^\d{4}$/,
  Finland: /^\d{5}$/,
  Japan: /^\d{3}-\d{4}$/,
  China: /^\d{6}$/,
  SouthKorea: /^\d{5}$/,
  Singapore: /^\d{6}$/,
  NewZealand: /^\d{4}$/,
  Brazil: /^\d{5}-\d{3}$/,
  Mexico: /^\d{5}$/,
  Russia: /^\d{6}$/,
  SouthAfrica: /^\d{4}$/,
  UAE: /^\d{5}$/, // UAE often uses P.O. Boxes but fallback to numeric
  SaudiArabia: /^\d{5}$/
  // Add more as needed
};

function validatePostalCode(postalCode: string, country: string): boolean {
  if (!postalCode || !country) return false;
  const normCountry = country.replace(/\s+/g, '').toLowerCase();
  for (const [key, pattern] of Object.entries(postalCodePatterns)) {
    if (normCountry.includes(key.replace(/\s+/g, '').toLowerCase())) {
      return pattern.test(postalCode.trim());
    }
  }
  // Fallback: accept 3-10 alphanumeric/space/hyphen
  return /^[A-Za-z0-9\s-]{3,10}$/.test(postalCode.trim());
}

// Main batch masking function
export const maskDataWithAIBatched = async (
  fileData: FileData,
  columns: ColumnInfo[],
  options: MaskingOptions,
  onProgress?: (progress: number) => void
): Promise<Record<string, string>[]> => {
  // --- Pre-masking: Re-infer and correct column data types (only if Unknown or not user-selected) ---
  columns.forEach(col => {
    // Never override user-selected types
    if (col.userModified) return;
    // Only re-detect if the type is Unknown or if it appears to be auto-detected (not user-selected)
    if (
      col.dataType === 'Unknown' ||
      (col.dataType === 'String' && !col.name.toLowerCase().includes('name') && !col.name.toLowerCase().includes('email'))
    ) {
      const samples = fileData.data.map(row => row[col.name]).filter(Boolean).slice(0, 20);
      const inferred = detectColumnDataType(samples, col.name);
      if (inferred && inferred !== 'Unknown' && inferred !== col.dataType) {
        // Only update if the inferred type is more specific than the current type
        const typeSpecificity = {
          'Int': 3,
          'Float': 3,
          'Date': 3,
          'Email': 3,
          'Phone Number': 3,
          'Bool': 2,
          'String': 1,
          'Text': 1,
          'Unknown': 0
        };
        const currentSpecificity = typeSpecificity[col.dataType] || 0;
        const inferredSpecificity = typeSpecificity[inferred] || 0;
        if (inferredSpecificity > currentSpecificity) {
          col.dataType = inferred;
          console.log(`[Data Type Detection] Updated column '${col.name}' from ${col.dataType} to ${inferred}`);
        }
      }
    }
  });

  // Detect constant columns
  const constantColumns = detectConstantColumns(fileData.data, columns);
  
  // Detect dual-label columns
  const dualLabelColumns = detectDualLabelColumns(fileData.data, columns);
  
  // Detect column patterns
  const columnPatterns: Record<string, { pattern: string; confidence: number }> = {};
  for (const column of columns) {
    if (!column.skip && !constantColumns[column.name] && !dualLabelColumns[column.name]) {
      const values = fileData.data.map(row => row[column.name]).filter(Boolean);
      const pattern = detectColumnPattern(values);
      if (pattern) {
        columnPatterns[column.name] = pattern;
        console.log(`Column '${column.name}' detected as ${pattern.pattern} with ${(pattern.confidence * 100).toFixed(1)}% confidence`);
      } else {
        // // Try AI-based pattern detection
        // const aiPattern = await detectPatternWithAI(values);
        // if (aiPattern) {
        //   addPatternToPool(aiPattern.pattern, aiPattern.regex);
        //   const matches = values.filter(v => new RegExp(aiPattern.regex).test(v));
        //   const confidence = matches.length / values.length;
        //   if (confidence > 0.5) {
        //     columnPatterns[column.name] = {
        //       pattern: aiPattern.pattern,
        //       confidence
        //     };
        //     console.log(`Column '${column.name}' detected as ${aiPattern.pattern} with ${(confidence * 100).toFixed(1)}% confidence (AI)`);
        //   }
        // }
        console.log(`Column '${column.name}' has no detectable pattern`);
      }
    }
  }

  // Detect sequential patterns
  const sequentialPatterns: Record<string, { prefix: string; lastNumber: number }> = {};

  // Detect sequential patterns in each column
  for (const column of columns) {
    if (column.skip) continue;
    
    const values = fileData.data.map(row => row[column.name]?.toString() || '');
    const pattern = detectSequentialPattern(values);
    
    if (pattern) {
      sequentialPatterns[column.name] = {
        prefix: pattern.prefix,
        lastNumber: pattern.lastNumber
      };
      console.log(`Column '${column.name}' detected as sequential pattern: ${pattern.prefix}[1-${pattern.lastNumber}]`);
    }
  }

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
  const countryColName = hasCountryColumn ? columns.find(col => col.name.toLowerCase() === 'country')!.name : null;
  if (hasCountryColumn && countryColName) {
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

  // --- Country-aware Geo Masking for Full Dataset (with strict filtering and validation) ---
  let countryAddressPool: Record<string, string[]> = {};
  let countryAddressCounters: Record<string, number> = {};
  let countryRowIndices: Record<string, number[]> = {};

  if (hasCountryColumn && countryColName) {
    // --- EOF Handling: Only consider up to the last non-empty row in the Country column ---
    const allCountryValues = allRows.map(row => row[countryColName] || '');
    let lastNonEmptyIdx = allCountryValues.length - 1;
    while (lastNonEmptyIdx >= 0 && !allCountryValues[lastNonEmptyIdx].trim()) {
      lastNonEmptyIdx--;
    }
    const trimmedRows = allRows.slice(0, lastNonEmptyIdx + 1);
    const trimmedCountryValues = allCountryValues.slice(0, lastNonEmptyIdx + 1);

    // --- Conditional batching: <=100 use all, >100 use first 100 ---
    const effectiveRows = trimmedRows.length <= 100 ? trimmedRows : trimmedRows.slice(0, 100);
    const effectiveCountryValues = trimmedCountryValues.slice(0, effectiveRows.length);

    // --- Country-wise counts for logging and batching ---
    const countryCounts: Record<string, number> = {};
    effectiveCountryValues.forEach(c => {
      const country = c.trim();
      if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    console.log('[Masking Info] Detected Country Counts:', countryCounts);

    // --- Normalization for batching logic ---
    const countryValuesRaw = effectiveCountryValues;
    const countryValuesNorm = countryValuesRaw.map(v => v.trim().toLowerCase());
    const countryMap: Record<string, string> = {};
    countryValuesRaw.forEach((raw, i) => {
      const norm = raw.trim().toLowerCase();
      if (norm) countryMap[norm] = raw.trim(); // preserve original case for output
    });
    const uniqueCountriesNorm = Array.from(new Set(countryValuesNorm.filter(v => v)));

    // Map: normalized country -> list of row indices (relative to effectiveRows)
    let countryRowIndices: Record<string, number[]> = {};
    for (let i = 0; i < countryValuesNorm.length; i++) {
      const c = countryValuesNorm[i];
      if (!c) continue;
      if (!countryRowIndices[c]) countryRowIndices[c] = [];
      countryRowIndices[c].push(i);
    }

    // For each normalized country, generate the exact number of addresses needed
    for (const normCountry of uniqueCountriesNorm) {
      const rowIndices = countryRowIndices[normCountry];
      const addressCount = rowIndices.length;
      if (addressCount === 0) continue;
      const displayCountry = countryMap[normCountry];
      const prompt = `Generate ${addressCount} unique, realistic postal addresses for software testing in ${displayCountry}. Each address must include: street (with house number), city, state, postal code, and country — all in correct local format. Return only a valid JSON array of exactly ${addressCount} strings, with no extra text or metadata.`;
      let addresses: string[] = [];
      let retries = 0;
      while (addresses.length < addressCount && retries < MAX_RETRIES) {
        try {
          const needed = addressCount - addresses.length;
          const result = await generateWithOpenAI(prompt.replace(`${addressCount}`, `${needed}`), 'Address', needed, displayCountry);
          addresses = addresses.concat(result);
        } catch (error) {
          console.error(`[Country Distribution] Failed to generate addresses for ${displayCountry} (retry ${retries + 1}):`, error);
          addresses.push(`123 Main St, Default City, Default State, 12345, ${displayCountry}`);
        }
        // Only retry if any postal code is blank/missing
        let hasBlankPostal = false;
        for (let i = 0; i < addresses.length; i++) {
          let addr = addresses[i];
          let postal = '';
          let parsed = false;
          try {
            const obj = JSON.parse(addr);
            if (typeof obj === 'object' && obj !== null) {
              postal = obj.postal || obj.zip || obj['postal code'] || '';
              parsed = true;
            }
          } catch {}
          if (!parsed) {
            const parts = addr.split(',').map(s => s.trim());
            if (parts.length >= 5) {
              postal = parts[parts.length - 2];
            } else if (parts.length === 4) {
              postal = '';
            } else if (parts.length === 3) {
              postal = '';
            } else {
              postal = '';
            }
            if (!postal) {
              const postalMatch = addr.match(/\b\d{5,6}\b/);
              if (postalMatch) postal = postalMatch[0];
            }
          }
          if (!postal || !postal.trim()) {
            hasBlankPostal = true;
            break;
          }
        }
        if (!hasBlankPostal) break;
        retries++;
      }
      // After all retries, keep blank if still missing
      countryAddressPool[displayCountry] = addresses.slice(0, addressCount);
      countryAddressCounters[displayCountry] = 0;
    }
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    let batchMaskedRows: Record<string, string>[] = batch.map(() => ({}));

    // Handle constant columns first
    for (const [columnName, constantValue] of Object.entries(constantColumns)) {
      for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
        batchMaskedRows[rowIdx][columnName] = constantValue;
      }
    }

    // Handle dual-label columns
    for (const [columnName, { labels, distribution }] of Object.entries(dualLabelColumns)) {
      for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
        batchMaskedRows[rowIdx][columnName] = generateValueFromDistribution(labels, distribution);
      }
    } 

    // Handle sequential patterns
    for (const [columnName, pattern] of Object.entries(sequentialPatterns)) {
      for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
        const currentNumber = pattern.lastNumber + 1 + rowIdx;
        batchMaskedRows[rowIdx][columnName] = `${pattern.prefix}${currentNumber}`;
      }
      // Update the last number after processing the batch
      sequentialPatterns[columnName].lastNumber += batch.length;
    }

    // Handle geo-specific columns first
    const geoFields = columns.filter(col => 
      GEO_FIELD_TYPES.includes(col.dataType as any) && 
      !constantColumns[col.name] && // Skip if it's a constant column
      !dualLabelColumns[col.name] && // Skip if it's a dual-label column
      !sequentialPatterns[col.name] // Skip if it's a sequential pattern column
    );

    for (const column of columns) {
      // Skip columns that are constant/uniform or dual-label (already set)
      if (constantColumns[column.name] || dualLabelColumns[column.name] || sequentialPatterns[column.name]) {
        continue;
      }
      // Preserve placeholder values: empty string, single space, or dash
      for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
        const originalValue = batch[rowIdx][column.name];
        if (originalValue === '' || originalValue === ' ' || originalValue === '-') {
          batchMaskedRows[rowIdx][column.name] = originalValue;
        }
      }
      // Skip masking for placeholder values
      if (batch.some((row) => row[column.name] === '' || row[column.name] === ' ' || row[column.name] === '-')) {
        continue;
      }
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
          // Strict mapping: For the first batch, geo fields must be directly and only from AI, no mutation or fallback.
          // Only trigger the unified address prompt for the Address column
          if (column.dataType === 'Address' && !geoFirstBatch['Address']) {
            let prompt = `Generate ${batch.length} unique, realistic postal addresses for software testing in ${consistentCountry}. Each address must include: street, city, state, postal code, and country — all in correct local format. Ensure postal codes match their corresponding city and state. Return only a valid JSON array of exactly ${batch.length} strings, with no extra text or metadata.`;
            // --- Incremental retry mechanism for partially successful responses ---
            let aiResult: string[] = Array(batch.length).fill('');
            let attempts = 0;
            let missingIndices = Array.from({ length: batch.length }, (_, i) => i);
            const isValid = (val: string, idx: number, arr: string[]) => typeof val === 'string' && val.trim().length > 0 && arr.indexOf(val) === idx;
            while (missingIndices.length > 0 && attempts < 3) {
              const countToFetch = missingIndices.length;
              const fetchPrompt = prompt.replace(`${batch.length}`, `${countToFetch}`);
              const fetchResult = await generateWithOpenAI(fetchPrompt, column.dataType, countToFetch, consistentCountry);
              // Debug: Log raw AI output for this fetch
              console.debug(`[AI Masking] Raw AI address output (attempt ${attempts + 1}):`, fetchResult);
              // Place new results into the correct slots
              for (let i = 0; i < fetchResult.length; i++) {
                aiResult[missingIndices[i]] = fetchResult[i];
              }
              // Recompute missing/invalid indices
              missingIndices = aiResult.map((val, idx, arr) => (!isValid(val, idx, arr) ? idx : -1)).filter(idx => idx !== -1);
              attempts++;
            }
            // After all attempts, blank out any remaining invalids
            for (let i = 0; i < aiResult.length; i++) {
              if (!isValid(aiResult[i], i, aiResult)) {
                // Debug: Log discarded address
                console.warn(`[AI Masking] Discarded address at index ${i}:`, aiResult[i]);
                aiResult[i] = '';
              }
            }
            // Direct mapping: assign each AI result to its exact row index, no mutation or incrementing
            const addressArr: string[] = [];
            const cityArr: string[] = [];
            const stateArr: string[] = [];
            const postalArr: string[] = [];
            const countryArr: string[] = [];
            for (let idx = 0; idx < aiResult.length; idx++) {
              const addr = aiResult[idx];
              if (!addr) {
                addressArr.push('');
                cityArr.push('');
                stateArr.push('');
                postalArr.push('');
                countryArr.push('');
                continue;
              }
              // Try to parse as JSON object first
              let street = '', city = '', state = '', postal = '', country = '';
              let parsed = false;
              try {
                const obj = JSON.parse(addr);
                if (typeof obj === 'object' && obj !== null) {
                  street = obj.street || '';
                  city = obj.city || '';
                  state = obj.state || '';
                  postal = obj.postal || obj.zip || obj['postal code'] || '';
                  country = obj.country || consistentCountry;
                  parsed = true;
                }
              } catch {}
              if (!parsed) {
                // Fallback: parse as comma-separated string
                const parts = addr.split(',').map(s => s.trim());
                if (parts.length >= 5) {
                  street = parts.slice(0, parts.length - 4).join(', ');
                  city = parts[parts.length - 4];
                  state = parts[parts.length - 3];
                  postal = parts[parts.length - 2];
                  country = parts[parts.length - 1];
                } else if (parts.length === 4) {
                  street = parts[0];
                  city = parts[1];
                  state = parts[2];
                  postal = '';
                  country = parts[3];
                } else if (parts.length === 3) {
                  street = parts[0];
                  city = parts[1];
                  state = '';
                  postal = '';
                  country = parts[2];
                } else {
                  street = addr;
                  city = '';
                  state = '';
                  postal = '';
                  country = consistentCountry;
                }
                if (!postal) {
                  const postalMatch = addr.match(/\b\d{5,6}\b/);
                  if (postalMatch) postal = postalMatch[0];
                }
              }
              addressArr.push(street);
              cityArr.push(city);
              stateArr.push(state);
              postalArr.push(postal);
              countryArr.push(country);
              // Debug: Log final assigned address for this row
              console.debug(`[AI Masking] Assigned address for row ${idx}:`, { street, city, state, postal, country });
            }
            // Validation: ensure all 100 address values are unique and non-blank
            const addressSet = new Set(addressArr);
            if (addressArr.length !== addressSet.size || addressArr.includes('')) {
              console.error('[AI Masking] Address mapping failure in first batch:', addressArr);
            }
            geoFirstBatch['Address'] = addressArr.slice();
            geoFirstBatch['City'] = cityArr.slice();
            geoFirstBatch['State'] = stateArr.slice();
            geoFirstBatch['Postal Code'] = postalArr.slice();
            geoFirstBatch['Country'] = countryArr.slice();
            geoReference['Address'] = addressArr;
            geoReference['City'] = cityArr;
            geoReference['State'] = stateArr;
            geoReference['Postal Code'] = postalArr;
            geoReference['Country'] = countryArr;
            // Strict assignment: map each value to its exact row
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              batchMaskedRows[rowIdx]['Address'] = addressArr[rowIdx];
              batchMaskedRows[rowIdx]['City'] = cityArr[rowIdx];
              batchMaskedRows[rowIdx]['State'] = stateArr[rowIdx];
              batchMaskedRows[rowIdx]['Postal Code'] = postalArr[rowIdx];
              batchMaskedRows[rowIdx]['Country'] = countryArr[rowIdx];
            }
            continue;
          }
          // For City, State, Postal Code, Country columns in the first batch, always use geoFirstBatch values (no fallback)
          if (geoFirstBatch[column.dataType]) {
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              batchMaskedRows[rowIdx][column.name] = geoFirstBatch[column.dataType][rowIdx];
            }
            continue;
          }
        } else {
          // For subsequent batches, fallback logic is allowed as before
          if (geoFirstBatch[column.dataType]) {
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              // For Address, increment house number by group number; for others, just copy
              if (column.dataType === 'Address') {
                const base = geoFirstBatch['Address'][rowIdx];
                const match = base.match(/(\d+)(.*)/);
                if (match) {
                  const baseNum = parseInt(match[1], 10);
                  const group = batchIdx; // batchIdx: 1 for 101-200, 2 for 201-300, etc.
                  batchMaskedRows[rowIdx][column.name] = `${baseNum + group}${match[2]}`;
                } else {
                  batchMaskedRows[rowIdx][column.name] = base;
                }
                // Also update City, State, Postal Code for this row to match the first batch
                if (geoFirstBatch['City']) batchMaskedRows[rowIdx]['City'] = geoFirstBatch['City'][rowIdx];
                if (geoFirstBatch['State']) batchMaskedRows[rowIdx]['State'] = geoFirstBatch['State'][rowIdx];
                if (geoFirstBatch['Postal Code']) batchMaskedRows[rowIdx]['Postal Code'] = geoFirstBatch['Postal Code'][rowIdx];
              } else if (['City', 'State', 'Postal Code'].includes(column.dataType)) {
                batchMaskedRows[rowIdx][column.name] = geoFirstBatch[column.dataType][rowIdx];
              } else {
                batchMaskedRows[rowIdx][column.name] = generateGeoValueFromReference(geoFirstBatch[column.dataType], rowIdx, column.dataType);
              }
            }
            continue;
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
          
          // Step 3: Handle percentage-based columns
          const columnNameLower = column.name.toLowerCase();
          const isPercentageColumn = /%|percent|percentage/i.test(columnNameLower);
          if (isPercentageColumn && (column.dataType === 'Int' || column.dataType === 'Float')) {
            // Generate integers between 1 and 100 for percentage columns
            value = chance.integer({ min: 1, max: 100 }).toString();
          } else {
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
              switch (column.dataType as DataType) {
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
                  // Always generate a valid integer (whole number)
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
                  // General columns: type- and pattern-aware masking
                  let maskedValue = '';
                  let attempts = 0;
                  const maxAttempts = 20;
                  // Always honor explicit Int selection
                  if (column.dataType === 'Int') {
                    do {
                      maskedValue = chance.integer({ min: 0, max: 10000 }).toString();
                      attempts++;
                    } while ((maskedValue === originalValue || isNaN(Number(maskedValue))) && attempts < maxAttempts);
                    value = maskedValue;
                  } else {
                    const columnPattern = detectColumnPattern([originalValue]);
                    do {
                      if (columnPattern && columnPattern.confidence > 0.7) {
                        // Use detected pattern for format-aware masking
                        switch (columnPattern.pattern) {
                          case 'email':
                            maskedValue = chance.email();
                            break;
                          case 'phoneNumber':
                            maskedValue = chance.phone();
                            break;
                          case 'pan':
                            maskedValue = chance.string({ length: 5, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }) +
                              chance.string({ length: 4, pool: '0123456789' }) +
                              chance.string({ length: 1, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
                            break;
                          case 'aadhaar':
                            maskedValue = Array(3).fill(0)
                              .map(() => chance.string({ length: 4, pool: '0123456789' }))
                              .join(' ');
                            break;
                          case 'date':
                            maskedValue = maskDateTime(originalValue, 'Date');
                            break;
                          case 'iban':
                            maskedValue = chance.string({ length: 2, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }) +
                              chance.string({ length: 2, pool: '0123456789' }) +
                              chance.string({ length: 20, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });
                            break;
                          case 'ssn':
                            maskedValue = `${chance.string({ length: 3, pool: '0123456789' })}-` +
                              `${chance.string({ length: 2, pool: '0123456789' })}-` +
                              `${chance.string({ length: 4, pool: '0123456789' })}`;
                            break;
                          case 'ipv4':
                            maskedValue = Array(4).fill(0)
                              .map(() => chance.integer({ min: 0, max: 255 }))
                              .join('.');
                            break;
                          case 'url':
                            maskedValue = chance.url();
                            break;
                          case 'name':
                            maskedValue = chance.name();
                            break;
                          case 'amount':
                            const amount = chance.floating({ min: 100, max: 10000, fixed: 2 });
                            maskedValue = `$${amount.toLocaleString()}`;
                            break;
                          case 'percentage':
                            maskedValue = `${chance.integer({ min: 0, max: 100 })}%`;
                            break;
                          case 'creditCard':
                            maskedValue = chance.cc();
                            break;
                          default:
                            // Fallback to pattern-based generation
                            maskedValue = randomStringFromPattern('alphanumeric', originalValue.length, originalValue);
                        }
                      } else {
                        // Strictly match the selected data type
                        switch (column.dataType as DataType) {
                          case 'Float':
                            maskedValue = chance.floating({ min: 0, max: 10000, fixed: 2 }).toString();
                            break;
                          case 'Bool':
                            maskedValue = chance.bool().toString();
                            break;
                          case 'Date':
                          case 'Date of birth':
                          case 'Time':
                          case 'Date Time':
                            maskedValue = maskDateTime(originalValue, column.dataType as any);
                            break;
                          case 'Gender':
                            maskedValue = chance.gender();
                            break;
                          case 'Company':
                            maskedValue = chance.company();
                            break;
                          case 'Password':
                            maskedValue = chance.string({ length: 10 });
                            break;
                          case 'Text':
                          case 'String':
                          default:
                            maskedValue = randomStringFromPattern('alphanumeric', originalValue.length, originalValue);
                            break;
                        }
                      }
                      attempts++;
                    } while (maskedValue === originalValue && attempts < maxAttempts);
                    value = maskedValue;
                  }
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
                  const suffix = chance.string({ length: 10, pool: '0123456789'});
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
                switch (column.dataType as DataType) {
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
                    // Always generate a valid integer (whole number)
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
            }
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
          // Enhanced phone number masking (strict format)
          if (column.dataType === 'Phone Number' || /phone|mobile|contact|cell|tel|fax|tele|number/i.test(column.name)) {
            const usedNumbers = new Set<string>();
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              const originalValue = batch[rowIdx][column.name] || '';
              // Use associated country if available
              let country = consistentCountry;
              if (geoFirstBatch['Country'] && geoFirstBatch['Country'][rowIdx % BATCH_SIZE]) {
                country = geoFirstBatch['Country'][rowIdx % BATCH_SIZE];
              }
              let phone = formatPhoneNumberStrict(originalValue, country, usedNumbers);
              let attempt = 0;
              while ((usedNumbers.has(phone) || phone === originalValue) && attempt < 20) {
                phone = formatPhoneNumberStrict(originalValue, country, usedNumbers);
                attempt++;
              }
              usedNumbers.add(phone);
              batchMaskedRows[rowIdx][column.name] = phone;
            }
            continue;
          }
          // Enhanced debit card masking
          if (/debit.?card/i.test(column.name)) {
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              let card = generateFakeDebitCardNumber();
              card = card.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4');
              batchMaskedRows[rowIdx][column.name] = card;
            }
            continue;
          }
          batchMaskedRows[rowIdx][column.name] = value;
          nonGeoValues.push(value);
        }
        console.log(`[Batch ${batchIdx}] Masked non-geo column '${column.name}' values:`, nonGeoValues);
      }
    }

    // Handle pattern-based columns
    for (const [columnName, { pattern, confidence }] of Object.entries(columnPatterns)) {
      const column = columns.find(col => col.name === columnName);
      if (!column || column.skip) continue;

      for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
        const originalValue = batch[rowIdx][columnName];
        if (!originalValue || originalValue.trim() === '') {
          batchMaskedRows[rowIdx][columnName] = originalValue;
          continue;
        }

        let maskedValue = '';
        let isValid = false;
        let attempts = 0;
        const maxAttempts = 20;
        const failedAttempts: string[] = [];

        while (!isValid && attempts < maxAttempts) {
          switch (pattern) {
            case 'email':
              maskedValue = chance.email();
              while (maskedValue === originalValue || usedEmails.has(maskedValue)) {
                maskedValue = chance.email();
              }
              usedEmails.add(maskedValue);
              break;

            case 'phoneNumber':
              maskedValue = formatPhoneNumberStrict(originalValue, consistentCountry, new Set());
              break;

            case 'pan':
              maskedValue = chance.string({ length: 5, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }) +
                chance.string({ length: 4, pool: '0123456789' }) +
                chance.string({ length: 1, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
              break;

            case 'aadhaar':
              maskedValue = Array(3).fill(0)
                .map(() => chance.string({ length: 4, pool: '0123456789' }))
                .join(' ');
              break;

            case 'date':
              maskedValue = maskDateTime(originalValue, 'Date');
              break;

            case 'iban':
              maskedValue = chance.string({ length: 2, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }) +
                chance.string({ length: 2, pool: '0123456789' }) +
                chance.string({ length: 20, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });
              break;

            case 'ssn':
              maskedValue = `${chance.string({ length: 3, pool: '0123456789' })}-` +
                `${chance.string({ length: 2, pool: '0123456789' })}-` +
                `${chance.string({ length: 4, pool: '0123456789' })}`;
              break;

            case 'ipv4':
              maskedValue = Array(4).fill(0)
                .map(() => chance.integer({ min: 0, max: 255 }))
                .join('.');
              break;

            case 'url':
              maskedValue = chance.url();
              break;

            case 'name':
              maskedValue = chance.name();
              break;

            case 'amount':
              const amount = chance.floating({ min: 100, max: 10000, fixed: 2 });
              maskedValue = `$${amount.toLocaleString()}`;
              break;

            case 'percentage':
              maskedValue = `${chance.integer({ min: 0, max: 100 })}%`;
              break;

            case 'creditCard':
              maskedValue = chance.cc();
              break;

            // Robust Postal Code (Pincode) masking
            case 'postal code':
            case 'pincode':
              // Try AI/rule-based generation first
              maskedValue = chance.string({ length: 6, pool: '0123456789' });
              // Validate: must match /^[1-9][0-9]{5}$/
              if (!/^[1-9][0-9]{5}$/.test(maskedValue)) {
                failedAttempts.push(`Attempt ${attempts + 1}: '${maskedValue}' (invalid format)`);
                maskedValue = (Math.floor(Math.random() * 900000) + 100000).toString();
              }
              // Check for duplicates if uniqueness is enforced (optional)
              // if (usedPincodes.has(maskedValue)) {
              //   failedAttempts.push(`Attempt ${attempts + 1}: '${maskedValue}' (duplicate)`);
              //   maskedValue = (Math.floor(Math.random() * 900000) + 100000).toString();
              // }
              break;

            default:
              maskedValue = randomStringFromPattern('alphanumeric', originalValue.length, originalValue);
          }

          // Final validation for Pincode
          if ((pattern === 'postal code' || pattern === 'pincode') && !/^[1-9][0-9]{5}$/.test(maskedValue)) {
            failedAttempts.push(`Attempt ${attempts + 1}: '${maskedValue}' (invalid format)`);
            isValid = false;
          } else {
            isValid = validateMaskedValue(originalValue, maskedValue, pattern);
            if (!isValid) {
              failedAttempts.push(`Attempt ${attempts + 1}: '${maskedValue}' (failed validation)`);
            }
          }
          attempts++;
        }

        if (!isValid) {
          console.warn(`Failed to generate valid masked value for ${columnName} after ${maxAttempts} attempts`);
          maskedValue = randomStringFromPattern('alphanumeric', originalValue.length, originalValue);
        }

        batchMaskedRows[rowIdx][columnName] = maskedValue;
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

  // --- Assignment Logic for All Rows (Country-Aligned) ---
  if (
    columns.some(col => col.dataType === 'Address') &&
    Object.keys(countryAddressPool).length > 0 &&
    countryColName
  ) {
    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
      const row = allRows[rowIdx];
      const maskedRow = maskedRows[rowIdx] ?? {};
      const rowCountry = row[countryColName]?.trim();
      if (
        rowCountry &&
        countryAddressPool[rowCountry] &&
        countryAddressCounters[rowCountry] < countryAddressPool[rowCountry].length
      ) {
        const addr = countryAddressPool[rowCountry][countryAddressCounters[rowCountry]];
        countryAddressCounters[rowCountry]++;
        // Parse address into components (street, city, state, postal, country)
        let street = '', city = '', state = '', postal = '', country = '';
        let parsed = false;
        try {
          const obj = JSON.parse(addr);
          if (typeof obj === 'object' && obj !== null) {
            street = obj.street || '';
            city = obj.city || '';
            state = obj.state || '';
            postal = obj.postal || obj.zip || obj['postal code'] || '';
            country = obj.country || rowCountry;
            parsed = true;
          }
        } catch {}
        if (!parsed) {
          const parts = addr.split(',').map(s => s.trim());
          if (parts.length >= 5) {
            street = parts.slice(0, parts.length - 4).join(', ');
            city = parts[parts.length - 4];
            state = parts[parts.length - 3];
            postal = parts[parts.length - 2];
            country = parts[parts.length - 1];
          } else if (parts.length === 4) {
            street = parts[0];
            city = parts[1];
            state = parts[2];
            postal = '';
            country = parts[3];
          } else if (parts.length === 3) {
            street = parts[0];
            city = parts[1];
            state = '';
            postal = '';
            country = parts[2];
          } else {
            street = addr;
            city = '';
            state = '';
            postal = '';
            country = rowCountry;
          }
          if (!postal) {
            const postalMatch = addr.match(/\b\d{5,6}\b/);
            if (postalMatch) postal = postalMatch[0];
          }
        }
        // Always assign parsed values to maskedRows
        maskedRow['Address'] = street;
        maskedRow['City'] = city;
        maskedRow['State'] = state;
        maskedRow['Postal Code'] = postal;
        maskedRow['Country'] = country;
        maskedRows[rowIdx] = maskedRow;
      } else {
        // Only blank if truly no country or no address pool
        maskedRow['Address'] = '';
        maskedRow['City'] = '';
        maskedRow['State'] = '';
        maskedRow['Postal Code'] = '';
        maskedRow['Country'] = rowCountry || '';
        maskedRows[rowIdx] = maskedRow;
      }
    }
  }

  // --- Auto-fill Nationality Based on Country (if column exists) ---
  const hasNationalityColumn = columns.some(col => col.name.toLowerCase() === 'nationality');
  const nationalityColName = hasNationalityColumn
    ? columns.find(col => col.name.toLowerCase() === 'nationality')!.name
    : null;
  if (hasNationalityColumn && countryColName && nationalityColName) {
    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
      const maskedRow = maskedRows[rowIdx] ?? {};
      const countryValue = maskedRow[countryColName]?.trim() || allRows[rowIdx][countryColName]?.trim();
      if (countryValue) {
        maskedRow[nationalityColName] =
          COUNTRY_TO_NATIONALITY[countryValue] || (countryValue + ' National');
      } else {
        maskedRow[nationalityColName] = 'National';
      }
      maskedRows[rowIdx] = maskedRow;
    }
  }

  return maskedRows;
};
