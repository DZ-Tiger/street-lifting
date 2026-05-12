import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { caloriesFromMacros } from '@/lib/nutrition';

export type { Gender, GoalType, NutritionTargets, ActivityLevel } from '@/lib/nutrition';
export {
  calculateTargets,
  calculateBMR,
  calculateTDEE,
  GOAL_LABELS,
  ACTIVITY_OPTIONS,
  normalizeGender,
  normalizeGoal,
  caloriesFromMacros,
} from '@/lib/nutrition';

export interface MacroSet {
  protein: number;
  carbs: number;
  fat: number;
}

export interface Micronutrient {
  name: string;
  amount: string;
}

export interface HistoryItem {
  id: string;
  time: string;
  timestamp: number;
  mealName: string;
  calories: number;
  macros: MacroSet;
  micros: Micronutrient[];
  portion: number;
  baseCalories?: number;
  baseMacros?: MacroSet;
  estimatedWeightGrams?: number;
}

interface NutritionState {
  meals: HistoryItem[];
  addMeal: (meal: HistoryItem) => void;
  removeMeal: (id: string) => void;
  updateMealPortion: (id: string, newPortion: number) => void;
  updateMealMacros: (id: string, newMacros: MacroSet) => void;
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set) => ({
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

            const safePortion = meal.portion === 0 ? 1 : meal.portion;
            const baseCalories = meal.baseCalories ?? meal.calories / safePortion;
            const baseProtein = meal.baseMacros?.protein ?? meal.macros.protein / safePortion;
            const baseCarbs = meal.baseMacros?.carbs ?? meal.macros.carbs / safePortion;
            const baseFat = meal.baseMacros?.fat ?? meal.macros.fat / safePortion;

            return {
              ...meal,
              portion: newPortion,
              calories: Math.round(baseCalories * newPortion),
              macros: {
                protein: Math.round(baseProtein * newPortion),
                carbs: Math.round(baseCarbs * newPortion),
                fat: Math.round(baseFat * newPortion),
              },
              baseCalories,
              baseMacros: {
                protein: baseProtein,
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

            const newBaseCalories = caloriesFromMacros(
              newMacros.protein,
              newMacros.carbs,
              newMacros.fat
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
    }),
    {
      name: 'street-flow-nutrition-storage',
    }
  )
);
