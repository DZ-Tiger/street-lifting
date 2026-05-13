import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { mealName } = await req.json();

    if (!mealName || typeof mealName !== 'string') {
      return NextResponse.json({ error: 'Meal name is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY missing — returning mock response.');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return NextResponse.json({
        calories: 500,
        macros: { protein: 30, carbs: 50, fat: 20 },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const PROMPT = `You are a world-class sports nutritionist.
Estimate the calories and macronutrients for a standard portion of the following meal: "${mealName}".
Focus on accuracy for a typical serving.

OUTPUT RULES:
Return ONLY a valid JSON object.
Expected schema:
{
  "calories": 0,
  "macros": { "protein": 0, "carbs": 0, "fat": 0 }
}`;

    const result = await model.generateContent(PROMPT);
    const text = result.response.text();
    const payload = JSON.parse(text);

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Nutrition Guess Error (Gemini):', error);
    return NextResponse.json(
      { error: 'Failed to guess macros. Please try again.' },
      { status: 500 }
    );
  }
}
