export type Gender = 'male' | 'female';
export type GoalType = 'cut' | 'maintain' | 'bulk';
export type ActivityLevel = 1.2 | 1.55 | 1.75;

export const GOAL_LABELS: Record<GoalType, string> = {
  cut: 'Cut',
  maintain: 'Maintain',
  bulk: 'Bulk',
};

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: 1.2, label: 'Sedentary', sub: '0 sessions' },
  { value: 1.55, label: 'Moderate', sub: '1–3 sessions' },
  { value: 1.75, label: 'Very active', sub: '4+ sessions' },
];

const GOAL_CALORIE_ADJUSTMENT: Record<GoalType, number> = {
  cut: -500,
  maintain: 0,
  bulk: 300,
};

const PROTEIN_PER_KG = 2.0;
const FAT_PER_KG = 1.0;

/**
 * Mifflin–St Jeor BMR.
 * Male:   (10 * kg) + (6.25 * cm) - (5 * age) + 5
 * Female: (10 * kg) + (6.25 * cm) - (5 * age) - 161
 */
export function calculateBMR(
  bodyWeightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const sexConstant = gender === 'male' ? 5 : -161;
  return 10 * bodyWeightKg + 6.25 * heightCm - 5 * age + sexConstant;
}

export function calculateTDEE(bmr: number, activityLevel: number): number {
  return Math.round(bmr * activityLevel);
}

export interface NutritionTargets {
  targetCalories: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
}

export function calculateTargets(
  heightCm: number,
  age: number,
  gender: Gender,
  activityLevel: number,
  goal: GoalType,
  bodyWeightKg: number
): NutritionTargets {
  const bmr = calculateBMR(bodyWeightKg, heightCm, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  const targetCalories = tdee + GOAL_CALORIE_ADJUSTMENT[goal];

  const targetProtein = Math.round(bodyWeightKg * PROTEIN_PER_KG);
  const targetFat = Math.round(bodyWeightKg * FAT_PER_KG);
  const remainingCalories = targetCalories - (targetProtein * 4 + targetFat * 9);
  const targetCarbs = Math.round(Math.max(0, remainingCalories / 4));

  return { targetCalories, targetProtein, targetFat, targetCarbs };
}

export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

const LEGACY_GENDER_MAP: Record<string, Gender> = {
  Homme: 'male',
  Femme: 'female',
  M: 'male',
  F: 'female',
  male: 'male',
  female: 'female',
};

export function normalizeGender(value: string | null | undefined): Gender {
  if (!value) return 'male';
  return LEGACY_GENDER_MAP[value] ?? 'male';
}

const LEGACY_GOAL_MAP: Record<string, GoalType> = {
  cut: 'cut',
  seche: 'cut',
  sèche: 'cut',
  seche_extreme: 'cut',
  maintain: 'maintain',
  maintenance: 'maintain',
  maintien: 'maintain',
  bulk: 'bulk',
  masse: 'bulk',
  prise_de_masse: 'bulk',
};

export function normalizeGoal(value: string | null | undefined): GoalType {
  if (!value) return 'maintain';
  return LEGACY_GOAL_MAP[value.toLowerCase()] ?? 'maintain';
}
