/****************************************************************************************
 * Data‑masking helper – Azure OpenAI edition
 ****************************************************************************************/

import { ColumnInfo } from '../types';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Azure OpenAI configuration                                               */
/* ────────────────────────────────────────────────────────────────────────── */

// Change these to match your Azure resource
const AZURE_OPENAI_API_KEY = 'AEw7fZ3WwPe6u6Msudlam9bpTz7sSM8JiUhVHIDtpvSHpXn4GDcIJQQJ99BBACYeBjFXJ3w3AAABACOGZap5';
const AZURE_OPENAI_ENDPOINT =
  'https://qatai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Behaviour tuning                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const BATCH_SIZE   = 10;
const MAX_RETRIES  = 3;
const TIMEOUT_MS   = 30_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Response types                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

interface OpenAIResponse {
  choices: { message: { content: string } }[];
}
interface MaskingResponse {
  [key: string]: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Public API                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Masks `data` using Azure OpenAI.
 * @param data      Array of input rows
 * @param columns   Column metadata
 * @param apiKey    Optional override for the Azure key
 * @param onProgress Optional progress callback (0–100)
 */
export async function maskDataWithAI(
  data: Record<string, string>[],
  columns: ColumnInfo[],
  apiKey: string = AZURE_OPENAI_API_KEY,
  onProgress?: (p: number) => void
): Promise<Record<string, string>[]> {

  console.log('Masking start', { rows: data.length, cols: columns.length });

  if (!apiKey) throw new Error('Azure OpenAI API‑key required');

  const columnsToMask = columns.filter(c => !c.skip);
  if (!columnsToMask.length) {
    onProgress?.(100);
    return data;
  }

  return maskDataWithAIBatched(data, columnsToMask, apiKey, onProgress);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Batch orchestration                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

async function maskDataWithAIBatched(
  allRows : Record<string, string>[],
  columns : ColumnInfo[],
  apiKey  : string,
  progressCb?: (p: number) => void
) {
  const out: Record<string, string>[] = [];
  const total = Math.ceil(allRows.length / BATCH_SIZE);

  for (let o = 0; o < allRows.length; o += BATCH_SIZE) {
    const batch = allRows.slice(o, o + BATCH_SIZE);
    const idx   = o / BATCH_SIZE;

    try {
      const masked = await withRetry(() => processBatch(batch, columns, apiKey));
      out.push(...masked);
    } catch (e) {
      console.error(`Batch ${idx + 1} failed – using originals`, e);
      out.push(...batch);
    }

    progressCb?.(Math.round(((idx + 1) / total) * 100));
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Retry helper                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`Retry ${attempt + 1}/${MAX_RETRIES}`);
      await new Promise(r => setTimeout(r, 1_000 * (attempt + 1)));
      return withRetry(fn, attempt + 1);
    }
    throw err;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Single‑batch call to Azure OpenAI                                        */
/* ────────────────────────────────────────────────────────────────────────── */

async function processBatch(
  batch  : Record<string, string>[],
  columns: ColumnInfo[],
  apiKey : string
) {
  const userPrompt    = createMaskingPrompt(batch, columns);
  const systemPrompt  = 'You are a data‑masking assistant. Return only valid JSON arrays with no extra text.';
  const requestId     = typeof crypto?.randomUUID === 'function'
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const response = await fetch(AZURE_OPENAI_ENDPOINT, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'api-key'      : apiKey,
      // Cache‑busting
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma'       : 'no-cache',
      'Expires'      : '0',
      'X-Request-ID' : requestId,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ],
      /* slight randomness for multi‑call robustness */
      temperature       : 0.7 + Math.random() * 0.05,
      top_p             : 0.6 + Math.random() * 0.1,
      presence_penalty  : Math.random() * 0.1,
      max_tokens        : 4000,
    }),
    signal: controller.signal,
  });

  clearTimeout(t);

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`[Azure OpenAI] ${response.status} ${response.statusText}: ${txt}`);
  }

  const json: OpenAIResponse = await response.json();
  const content = json.choices[0]?.message?.content?.trim() ?? '';

  return parseOpenAIResponse(content, batch, columns);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Response parsing                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function parseOpenAIResponse(
  content : string,
  original: Record<string, string>[],
  columns : ColumnInfo[]
) {
  try {
    let clean = content.replace(/```json\s*|\s*```$/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) clean = match[0];

    const arr: MaskingResponse[] = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('AI response is not an array');

    return original.map((row, i) => {
      const ai = arr[i] ?? {};
      const out: Record<string, string> = { ...row };

      columns.forEach(c => {
        if (c.skip) return;
        const v = ai[c.name];
        if (v !== undefined && v !== null) {
          out[c.name] =
            c.dataType === 'Address'
              ? handleAddressResponse(v, row[c.name])
              : String(v);
        }
      });
      return out;
    });

  } catch (e) {
    console.error('Parse error', e, content);
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Address helper                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function handleAddressResponse(ai: any, fallback: string): string {
  try {
    if (typeof ai === 'string') return ai;

    if (ai && typeof ai === 'object') {
      const pick = (keys: string[]) => keys.find(k => ai[k]);
      const parts = [
        ai[pick(['street', 'address', 'street_address', 'line1'])!],
        ai[pick(['city', 'locality'])!],
        ai[pick(['state', 'region', 'province'])!],
        ai[pick(['zip', 'zipcode', 'postal_code', 'postcode'])!],
      ].filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Prompt builder                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function createMaskingPrompt(
  batch  : Record<string, string>[],
  columns: ColumnInfo[]
) {
  const colDesc = columns.filter(c => !c.skip)
    .map(c => `- ${c.name}: ${c.dataType}`)
    .join('\n');

  const sample = batch.slice(0, 3).map((row, i) => {
    const obj: Record<string, string> = {};
    columns.forEach(c => !c.skip && (obj[c.name] = row[c.name]));
    return `Row ${i + 1}: ${JSON.stringify(obj)}`;
  }).join('\n');

  const payload = batch.map(row => {
    const obj: Record<string, string> = {};
    columns.forEach(c => !c.skip && (obj[c.name] = row[c.name]));
    return obj;
  });

  return `Mask the following data by replacing real values with realistic fakes.

Columns to mask:
${colDesc}

Rules:
1. Address → realistic street addresses
2. Email   → realistic email addresses
3. Phone   → realistic phone numbers
4. Name    → realistic names
5. Others  → type‑appropriate fakes
6. Return ONLY a JSON array with the same keys, no extra text.

Sample input:
${sample}

Data to mask (return exactly ${batch.length} objects):
${JSON.stringify(payload)}`;
}
