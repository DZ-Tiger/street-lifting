import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export interface NutritionResponse {
  mealName: string;
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  micros: {
    name: string;
    amount: string;
  }[];
  estimatedWeightGrams: number;
}

interface ScanRequestBody {
  image?: unknown;
}

const GEMINI_TIMEOUT_MS = 30_000;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const PROMPT = `You are a world-class sports nutritionist analyzing a meal photo for a strength athlete.

ANALYSIS RULES
1. Identify the visible foods and account for the cooking method (fried, boiled, grilled).
2. Estimate the total plate weight in grams, using standard plate proportions.
3. Account for hidden calories (cooking oils, butter, sauces, marinades).
4. MANDATORY CHECK: macros must reconcile with calories (protein * 4 + carbs * 4 + fat * 9 ≈ total calories).
5. For micronutrients, focus on 4–5 items relevant to athletic recovery (e.g. Sodium, Potassium, Magnesium, Iron, Vitamin C, Calcium).

OUTPUT RULES
Return ONLY a valid JSON object — no prose, no markdown fences.

Expected schema:
{
  "reasoning": "Brief one-line explanation of volumes and hidden ingredients.",
  "mealName": "Short precise dish name in English",
  "calories": 0,
  "estimatedWeightGrams": 0,
  "macros": { "protein": 0, "carbs": 0, "fat": 0 },
  "micros": [
    { "name": "Sodium", "amount": "0mg" },
    { "name": "Iron", "amount": "0mg" }
  ]
}`;

function parseDataUrl(image: string): { base64: string; mimeType: string } | null {
  const match = image.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function isValidScanResponse(value: unknown): value is NutritionResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.mealName !== 'string') return false;
  if (typeof record.calories !== 'number' || !Number.isFinite(record.calories)) return false;
  if (typeof record.estimatedWeightGrams !== 'number') return false;
  const macros = record.macros as Record<string, unknown> | undefined;
  if (
    !macros ||
    typeof macros.protein !== 'number' ||
    typeof macros.carbs !== 'number' ||
    typeof macros.fat !== 'number'
  ) {
    return false;
  }
  if (!Array.isArray(record.micros)) return false;
  return record.micros.every(
    (m) =>
      typeof m === 'object' &&
      m !== null &&
      typeof (m as { name?: unknown }).name === 'string' &&
      typeof (m as { amount?: unknown }).amount === 'string'
  );
}

function mockResponse(): NutritionResponse {
  return {
    mealName: 'Grilled Chicken Bowl',
    calories: 650,
    macros: { protein: 45, carbs: 50, fat: 25 },
    micros: [
      { name: 'Sodium', amount: '420mg' },
      { name: 'Iron', amount: '2.5mg' },
      { name: 'Fiber', amount: '5g' },
    ],
    estimatedWeightGrams: 400,
  };
}

export async function POST(req: Request) {
  let body: ScanRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { image } = body;

  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'A base64 image is required' }, { status: 400 });
  }

  const parsed = parseDataUrl(image);
  if (!parsed) {
    return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(parsed.mimeType)) {
    return NextResponse.json({ error: 'Unsupported image MIME type' }, { status: 415 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('GEMINI_API_KEY missing — returning mock response.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return NextResponse.json(mockResponse());
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const abort = new AbortController();
  const timeoutId = setTimeout(() => abort.abort(), GEMINI_TIMEOUT_MS);

  try {
    const result = await model.generateContent(
      [PROMPT, { inlineData: { data: parsed.base64, mimeType: parsed.mimeType } }],
      { signal: abort.signal } as Parameters<typeof model.generateContent>[1]
    );

    const text = result.response.text();

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      console.error('Gemini returned non-JSON payload', text.slice(0, 200));
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 502 }
      );
    }

    if (!isValidScanResponse(payload)) {
      console.error('Gemini response failed schema validation', payload);
      return NextResponse.json(
        { error: 'AI response did not match expected schema.' },
        { status: 502 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Nutrition Scan Error (Gemini):', error);
    const aborted = (error as { name?: string }).name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? 'AI analysis timed out.'
          : 'Failed to analyze the image. Please try again.',
      },
      { status: aborted ? 504 : 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
