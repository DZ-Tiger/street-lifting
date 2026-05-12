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

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'Image requise' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY manquante, retour d'une réponse simulée.");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockResponse: NutritionResponse = {
        mealName: 'Tajine Poulet Olives',
        calories: 650,
        macros: {
          protein: 45,
          carbs: 50,
          fat: 25,
        },
        micros: [
          { name: 'Vitamine C', amount: '12mg' },
          { name: 'Fer', amount: '2.5mg' },
          { name: 'Fibres', amount: '5g' },
        ],
        estimatedWeightGrams: 400,
      };

      return NextResponse.json(mockResponse);
    }

    // Instanciation stricte et sécurisée selon la doc Google
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const base64Data = image.split(',')[1];
    const mimeType = image.split(';')[0].split(':')[1];

    const prompt = `Tu es un expert mondial en nutrition sportive et diététique, spécialisé dans l'accompagnement d'athlètes de force. 
    Ton objectif est d'analyser visuellement ce repas avec la plus grande précision possible.

    INSTRUCTIONS D'ANALYSE :
    1. Identifie précisément les aliments visibles, en prenant en compte le mode de cuisson (frit, bouilli, grillé).
    2. Estime le poids total (en grammes) en te basant sur des proportions standard d'assiettes.
    3. N'oublie pas d'inclure des calories "cachées" probables (huiles de cuisson, beurre, sauces, marinades).
    4. VÉRIFICATION MATHÉMATIQUE OBLIGATOIRE : Tes macros doivent correspondre à tes calories totales (Protéines x 4 + Glucides x 4 + Lipides x 9 = Calories totales).
    5. Pour les micronutriments, concentre-toi sur 4 ou 5 éléments cruciaux pour la récupération sportive (ex: Sodium, Potassium, Magnésium, Fer, Vitamine C, Calcium).

    RÈGLES DE FORMATAGE :
    Tu dois renvoyer UNIQUEMENT un objet JSON valide. 
    N'ajoute AUCUN texte avant ou après. 
    N'utilise PAS de balises de code markdown comme \`\`\`json. 

    Format JSON strict attendu :
    {
      "reasoning": "Explication très brève de ton estimation des volumes et des ingrédients cachés (ex: 'Présence de frites estimée à 150g, poulet avec peau 200g, sauce à l'huile visible').",
      "mealName": "Nom du plat court et précis",
      "calories": 0,
      "estimatedWeightGrams": 0,
      "macros": {
        "protein": 0,
        "carbs": 0,
        "fat": 0
      },
      "micros": [
        { "name": "Sodium", "amount": "0mg" },
        { "name": "Fer", "amount": "0mg" }
      ]
  }`;

    // Structure inlineData stricte
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error('Nutrition Scan Error (Gemini):', error);
    return NextResponse.json(
      { error: "Échec de l'analyse de l'image avec Gemini. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
