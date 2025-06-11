import { toast } from "sonner";
import { ColumnInfo, DataType, FileData } from '@/types';
import { getRandomSample, chunkArray } from './maskingHelpers';
import { maskPersonalInfo, maskLocationData, maskDateTime } from './dataTypeMasking';
import { detectColumnDataType } from './dataDetection';
import Chance from 'chance';
const chance = new Chance();

// Azure OpenAI configuration
const apiKey = "AEw7fZ3WwPe6u6Msudlam9bpTz7sSM8JiUhVHIDtpvSHpXn4GDcIJQQJ99BBACYeBjFXJ3w3AAABACOGZap5";
const AZURE_OPENAI_ENDPOINT = "https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview";
const AZURE_OPENAI_API_VERSION = "2025-01-01-preview";
const MAX_RETRIES = 3;

// List of geo-specific data types
const GEO_FIELD_TYPES: DataType[] = ['Address', 'City', 'State', 'Postal Code', 'Nationality'];

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

// Helper to detect and extend sequence patterns like 'character 1', 'character 2', ...
function detectSequencePattern(values: string[]): { prefix: string, start: number, pad: number, matched: boolean, last: number } {
  // Looser detection: accept if >70% of non-empty values match the pattern
  const regex = /^(.*?)(\d+)$/;
  let prefix = '';
  let numbers: number[] = [];
  let pad = 0;
  let matchCount = 0;
  let lastNum = 0;
  for (const val of values) {
    if (!val) continue;
    const match = val.match(regex);
    if (match) {
      if (!prefix) prefix = match[1];
      if (match[1] === prefix) {
        numbers.push(parseInt(match[2], 10));
        pad = Math.max(pad, match[2].length);
        matchCount++;
        lastNum = parseInt(match[2], 10);
      }
    }
  }
  const nonEmptyCount = values.filter(v => v).length;
  if (matchCount / (nonEmptyCount || 1) < 0.7 || numbers.length === 0) {
    return { prefix: '', start: 0, pad: 0, matched: false, last: 0 };
  }
  numbers.sort((a, b) => a - b);
  // Accept gaps, just extend from the max
  return { prefix, start: numbers[0], pad, matched: true, last: Math.max(...numbers) };
}

// Main batch masking function
export const maskDataWithAIBatched = async (
  fileData: FileData,
  columns: ColumnInfo[],
  options: MaskingOptions,
  onProgress?: (progress: number) => void
): Promise<Record<string, string>[]> => {
  // --- Pre-masking: Re-infer and correct column data types ---
  columns.forEach(col => {
    if (
      col.dataType === 'Postal Code' ||
      col.dataType === 'Unknown' ||
      col.dataType === 'String' ||
      col.dataType === 'Int'
    ) {
      const samples = fileData.data.map(row => row[col.name]).filter(Boolean).slice(0, 20);
      const inferred = detectColumnDataType(samples, col.name);
      if (inferred === 'Date' || inferred === 'Date of birth' || inferred === 'Date Time') {
        col.dataType = inferred;
      }
    }
  });
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
  // Store sequence patterns per column
  const sequencePatterns: Record<string, { prefix: string, start: number, pad: number, matched: boolean, last: number }> = {};
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

  // --- NEW LOGIC: If no country is selected, assign random country per row for first 100 rows ---
  let assignedCountryPerRow: string[] = [];
  if (hasCountryColumn && (!useCountryDropdown || !selectedCountries || selectedCountries.length === 0)) {
    // Get all unique countries from the data
    const countryColName = columns.find(col => col.name.toLowerCase() === 'country')!.name;
    const uniqueCountries = Array.from(new Set(allRows.map(row => row[countryColName]).filter(Boolean)));
    // For the first 100 rows, randomly assign a country from the unique list
    assignedCountryPerRow = Array(Math.min(100, allRows.length)).fill('').map(() => {
      return uniqueCountries[Math.floor(Math.random() * uniqueCountries.length)] || 'India';
    });
    // For rows beyond 100, repeat the assignment pattern
    for (let i = 100; i < allRows.length; i++) {
      assignedCountryPerRow[i] = assignedCountryPerRow[i % 100];
    }
  } else {
    // If country is selected, use consistentCountry for all
    assignedCountryPerRow = allRows.map(() => consistentCountry);
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
      // --- Percentage Column Masking Logic (move to top, assign directly, skip rest) ---
      if (/%|percent|percentage/i.test(column.name)) {
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          batchMaskedRows[rowIdx][column.name] = (Math.floor(Math.random() * 100) + 1).toString();
        }
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
        // --- Country Column Distribution-Preserving Randomization ---
        // Get the original country values for this batch
        const countryColName = column.name;
        const batchStartIdx = batchIdx * BATCH_SIZE;
        const originalCountries: string[] = allRows.slice(batchStartIdx, batchStartIdx + batch.length).map(row => row[countryColName]).filter(Boolean);
        // Count frequency of each unique value
        const freqMap: Record<string, number> = {};
        for (const val of originalCountries) {
          freqMap[val] = (freqMap[val] || 0) + 1;
        }
        // Build a new array with the same counts
        let distributionArray: string[] = [];
        for (const [val, count] of Object.entries(freqMap)) {
          for (let i = 0; i < count; i++) {
            distributionArray.push(val);
          }
        }
        // Shuffle the array
        for (let i = distributionArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [distributionArray[i], distributionArray[j]] = [distributionArray[j], distributionArray[i]];
        }
        // Assign shuffled values to the batch
        const countryValues: string[] = [];
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          let value = distributionArray[rowIdx] || (assignedCountryPerRow[batchStartIdx + rowIdx] || consistentCountry);
          batchMaskedRows[rowIdx][column.name] = value;
          countryValues.push(value);
        }
        if (batchIdx === 0) geoFirstBatch[column.name] = countryValues.slice();
        console.log(`[Batch ${batchIdx}] Masked 'Country' column values:`, countryValues);
        continue;
      }
      if (isGeoField(column)) {
        if (batchIdx === 0) {
          // --- NEW: For first batch, generate geo fields per row's assigned country ---
          if (column.dataType === 'Address' && !geoFirstBatch['Address']) {
            // Group rows by assigned country for efficient AI calls
            const countryGroups: Record<string, number[]> = {};
            for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
              const rowCountry = assignedCountryPerRow[batchIdx * BATCH_SIZE + rowIdx] || consistentCountry;
              if (!countryGroups[rowCountry]) countryGroups[rowCountry] = [];
              countryGroups[rowCountry].push(rowIdx);
            }
            // For each country, generate addresses for its rows
            let addressArr: string[] = Array(batch.length).fill('');
            let cityArr: string[] = Array(batch.length).fill('');
            let stateArr: string[] = Array(batch.length).fill('');
            let postalArr: string[] = Array(batch.length).fill('');
            let countryArr: string[] = Array(batch.length).fill('');
            for (const [country, indices] of Object.entries(countryGroups)) {
              let prompt = `Generate ${indices.length} unique, realistic postal addresses for software testing in ${country}. Each address must include: street, city, state, postal code, and country — all in correct local format. Ensure postal codes match their corresponding city and state. Return only a valid JSON array of exactly ${indices.length} strings, with no extra text or metadata.`;
              // --- Incremental retry mechanism for partially successful responses ---
              let aiResult: string[] = Array(indices.length).fill('');
              let attempts = 0;
              let missingIndices = Array.from({ length: indices.length }, (_, i) => i);
              const isValid = (val: string, idx: number, arr: string[]) => typeof val === 'string' && val.trim().length > 0 && arr.indexOf(val) === idx;
              while (missingIndices.length > 0 && attempts < 3) {
                const countToFetch = missingIndices.length;
                const fetchPrompt = prompt.replace(`${indices.length}`, `${countToFetch}`);
                const fetchResult = await generateWithOpenAI(fetchPrompt, column.dataType, countToFetch, country);
                for (let i = 0; i < fetchResult.length; i++) {
                  aiResult[missingIndices[i]] = fetchResult[i];
                }
                missingIndices = aiResult.map((val, idx, arr) => (!isValid(val, idx, arr) ? idx : -1)).filter(idx => idx !== -1);
                attempts++;
              }
              for (let i = 0; i < aiResult.length; i++) {
                if (!isValid(aiResult[i], i, aiResult)) {
                  aiResult[i] = '';
                }
              }
              // Parse and assign geo fields for each row in this country group
              for (let i = 0; i < indices.length; i++) {
                const idx = indices[i];
                const addr = aiResult[i];
                let street = '', city = '', state = '', postal = '', countryVal = country;
                let parsed = false;
                try {
                  const obj = JSON.parse(addr);
                  if (typeof obj === 'object' && obj !== null) {
                    street = obj.street || '';
                    city = obj.city || '';
                    state = obj.state || '';
                    postal = obj.postal || obj.zip || obj['postal code'] || '';
                    countryVal = obj.country || country;
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
                    countryVal = parts[parts.length - 1];
                  } else if (parts.length === 4) {
                    street = parts[0];
                    city = parts[1];
                    state = parts[2];
                    postal = '';
                    countryVal = parts[3];
                  } else if (parts.length === 3) {
                    street = parts[0];
                    city = parts[1];
                    state = '';
                    postal = '';
                    countryVal = parts[2];
                  } else {
                    street = addr;
                    city = '';
                    state = '';
                    postal = '';
                    countryVal = country;
                  }
                  if (!postal) {
                    const postalMatch = addr.match(/\b\d{5,6}\b/);
                    if (postalMatch) postal = postalMatch[0];
                  }
                }
                addressArr[idx] = street;
                cityArr[idx] = city;
                stateArr[idx] = state;
                postalArr[idx] = postal;
                countryArr[idx] = countryVal;
              }
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
              if (column.dataType === 'Address') {
                const base = geoFirstBatch['Address'][rowIdx];
                const match = base.match(/(\d+)(.*)/);
                if (match) {
                  const baseNum = parseInt(match[1], 10);
                  const group = batchIdx;
                  batchMaskedRows[rowIdx][column.dataType] = `${baseNum + group}${match[2]}`;
                } else {
                  batchMaskedRows[rowIdx][column.dataType] = base;
                }
                if (geoFirstBatch['City']) batchMaskedRows[rowIdx]['City'] = geoFirstBatch['City'][rowIdx];
                if (geoFirstBatch['State']) batchMaskedRows[rowIdx]['State'] = geoFirstBatch['State'][rowIdx];
                if (geoFirstBatch['Postal Code']) batchMaskedRows[rowIdx]['Postal Code'] = geoFirstBatch['Postal Code'][rowIdx];
                if (geoFirstBatch['Country']) batchMaskedRows[rowIdx]['Country'] = geoFirstBatch['Country'][rowIdx];
                if (geoFirstBatch['Country'] && geoFirstBatch['Nationality']) {
                  const countryValue = geoFirstBatch['Country'][rowIdx] || '';
                  batchMaskedRows[rowIdx]['Nationality'] = COUNTRY_TO_NATIONALITY[countryValue.trim()] || (countryValue ? countryValue + ' National' : 'National');
                }
              } else if (['City', 'State', 'Postal Code', 'Country'].includes(column.dataType)) {
                batchMaskedRows[rowIdx][column.dataType] = geoFirstBatch[column.dataType][rowIdx];
              } else if (column.dataType === 'Nationality') {
                const countryValue = geoFirstBatch['Country'] ? geoFirstBatch['Country'][rowIdx] : '';
                batchMaskedRows[rowIdx][column.dataType] = COUNTRY_TO_NATIONALITY[countryValue.trim()] || (countryValue ? countryValue + ' National' : 'National');
              } else {
                batchMaskedRows[rowIdx][column.dataType] = generateGeoValueFromReference(geoFirstBatch[column.dataType], rowIdx, column.dataType);
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
          // Marital/relationship status masking
          if (isMaritalStatusColumn(column) && column.dataType === 'String') {
            value = MARITAL_STATUS_VALUES[Math.floor(Math.random() * MARITAL_STATUS_VALUES.length)];
          } else if (column.name.toLowerCase() === 'nationality') {
            // Nationality masking based on country value
            // Use the already-masked country value for this row
            const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
            let countryValue = '';
            if (countryCol) {
              countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || assignedCountryPerRow[batchIdx * BATCH_SIZE + rowIdx] || '';
            }
            // Normalize country value for mapping
            const mappedNationality = COUNTRY_TO_NATIONALITY[countryValue.trim()] || (countryValue ? countryValue + ' National' : 'National');
            value = mappedNationality;
          } else if (isSalaryColumn(column)) {
            // Salary masking with country currency
            const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
            let countryValue = '';
            if (countryCol) {
              countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || assignedCountryPerRow[batchIdx * BATCH_SIZE + rowIdx] || '';
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
            // --- Percentage Column Masking Logic ---
            if (/%|percent|percentage/i.test(column.name)) {
              value = (Math.floor(Math.random() * 100) + 1).toString();
              continue;
            }
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
                countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || assignedCountryPerRow[batchIdx * BATCH_SIZE + rowIdx] || '';
              }
              const mappedNationality = COUNTRY_TO_NATIONALITY[countryValue.trim()] || (countryValue ? countryValue + ' National' : 'National');
              value = mappedNationality;
            } else if (isSalaryColumn(column)) {
              const countryCol = columns.find(col => col.name.toLowerCase() === 'country');
              let countryValue = '';
              if (countryCol) {
                countryValue = batchMaskedRows[rowIdx][countryCol.name] || batch[rowIdx][countryCol.name] || assignedCountryPerRow[batchIdx * BATCH_SIZE + rowIdx] || '';
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
      // --- Generic Sequence Extension Logic (applies to any column) ---
      if (sequencePatterns[column.name]) {
        const seqPattern = sequencePatterns[column.name];
        // Always generate new values starting from last+1, for all rows (exclude all original values)
        const globalStartNum = seqPattern.last + 1;
        const globalRowOffset = batchIdx * batch.length;
        if (batchIdx === 0 && globalRowOffset === 0) {
          console.log(`[SequenceMasking] Extending sequence for column '${column.name}' from ${globalStartNum}`);
        }
        for (let rowIdx = 0; rowIdx < batch.length; rowIdx++) {
          const seqNum = globalStartNum + globalRowOffset + rowIdx;
          const paddedNum = seqNum.toString().padStart(seqPattern.pad, '0');
          batchMaskedRows[rowIdx][column.name] = `${seqPattern.prefix}${paddedNum}`;
        }
        continue;
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