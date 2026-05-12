import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type GoalType = 'cut' | 'maintain' | 'bulk';
export type GenderType = 'M' | 'F';

export interface HistoryItem {
  id: string;
  time: string;
  timestamp: number;
  mealName: string;
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  micros: { name: string; amount: string }[];
  portion: number;
  baseCalories?: number;
  baseMacros?: {
    protein: number;
    carbs: number;
    fat: number;
  };
  estimatedWeightGrams?: number;
}

export interface UserNutritionProfile {
  height: number;
  age: number;
  gender: GenderType;
  activityLevel: number;
  goal: GoalType;
}

interface NutritionState {
  profile: UserNutritionProfile;
  meals: HistoryItem[];
  addMeal: (meal: HistoryItem) => void;
  removeMeal: (id: string) => void;
  updateMealPortion: (id: string, newPortion: number) => void;
  updateMealMacros: (
    id: string,
    newMacros: { protein: number; carbs: number; fat: number }
  ) => void;
  setGoal: (goal: GoalType) => void;
  updateProfile: (profile: Partial<UserNutritionProfile>) => void;
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set) => ({
      // Profil nutrition par défaut (le poids vient du store global useStore)
      profile: {
        height: 180,
        age: 25,
        gender: 'M',
        activityLevel: 1.55, // Modéré
        goal: 'cut',
      },
      meals: [],

      addMeal: (meal) =>
        set((state) => ({
          meals: [meal, ...state.meals],
        })),

      removeMeal: (id) =>
        set((state) => ({
          meals: state.meals.filter((m) => m.id !== id),
        })),

      updateMealPortion: (id, newPortion) =>
        set((state) => ({
          meals: state.meals.map((meal) => {
            if (meal.id !== id) return meal;

            // On a besoin des bases pour recalculer
            const baseCals = meal.baseCalories ?? meal.calories / meal.portion;
            const baseProt = meal.baseMacros?.protein ?? meal.macros.protein / meal.portion;
            const baseCarbs = meal.baseMacros?.carbs ?? meal.macros.carbs / meal.portion;
            const baseFat = meal.baseMacros?.fat ?? meal.macros.fat / meal.portion;

            return {
              ...meal,
              portion: newPortion,
              calories: Math.round(baseCals * newPortion),
              macros: {
                protein: Math.round(baseProt * newPortion),
                carbs: Math.round(baseCarbs * newPortion),
                fat: Math.round(baseFat * newPortion),
              },
              baseCalories: baseCals,
              baseMacros: {
                protein: baseProt,
                carbs: baseCarbs,
                fat: baseFat,
              },
            };
          }),
        })),

      updateMealMacros: (id, newMacros) =>
        set((state) => ({
          meals: state.meals.map((meal) => {
            if (meal.id !== id) return meal;

            // Calcul des nouvelles calories basées sur les macros
            const newBaseCalories = Math.round(
              newMacros.protein * 4 + newMacros.carbs * 4 + newMacros.fat * 9
            );

            return {
              ...meal,
              calories: Math.round(newBaseCalories * meal.portion),
              macros: {
                protein: Math.round(newMacros.protein * meal.portion),
                carbs: Math.round(newMacros.carbs * meal.portion),
                fat: Math.round(newMacros.fat * meal.portion),
              },
              baseCalories: newBaseCalories,
              baseMacros: newMacros,
            };
          }),
        })),

      setGoal: (goal) =>
        set((state) => ({
          profile: { ...state.profile, goal },
        })),

      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
        })),
    }),
    {
      name: 'street-flow-nutrition-storage',
    }
  )
);

/**
 * Logique Métier Professionnelle : Équation de Mifflin-St Jeor
 */
export const calculateTargets = (nutritionProfile: UserNutritionProfile, bodyWeight: number) => {
  const { height, age, gender, activityLevel, goal } = nutritionProfile;

  // 1. Calcul du BMR (Mifflin-St Jeor) basé sur le poids réel du profil global
  const s = gender === 'M' ? 5 : -161;
  const bmr = 10 * bodyWeight + 6.25 * height - 5 * age + s;

  // 2. Calcul du TDEE
  const tdee = Math.round(bmr * activityLevel);

  // 3. Ajustement selon l'objectif calorique
  let targetCalories = tdee;
  if (goal === 'cut') targetCalories -= 500;
  if (goal === 'bulk') targetCalories += 300;

  // 4. Répartition des Macros (Standard Musculation)
  const targetProtein = Math.round(bodyWeight * 2.0);
  const targetFat = Math.round(bodyWeight * 1.0);

  // Glucides: Le reste des calories (1g Prot=4kcal, 1g Lip=9kcal, 1g Glu=4kcal)
  const remainingCalories = targetCalories - (targetProtein * 4 + targetFat * 9);
  const targetCarbs = Math.round(Math.max(0, remainingCalories / 4));

  return { targetCalories, targetProtein, targetFat, targetCarbs };
};
