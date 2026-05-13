import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { caloriesFromMacros } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';

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
  fetchMeals: (userId: string) => Promise<void>;
}

type DbRow = {
  id: string;
  created_at: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: Micronutrient[] | null;
};

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      meals: [],

      addMeal: (meal) =>
        set((state) => ({
          meals: [meal, ...state.meals],
        })),

      removeMeal: (id) => {
        set((state) => ({
          meals: state.meals.filter((m) => m.id !== id),
        }));
        supabase
          .from('nutrition_logs')
          .delete()
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('Failed to delete meal from DB:', error);
          });
      },

      updateMealPortion: (id, newPortion) => {
        const meal = get().meals.find((m) => m.id === id);
        if (!meal) return;

        const safePortion = meal.portion === 0 ? 1 : meal.portion;
        const baseCalories = meal.baseCalories ?? meal.calories / safePortion;
        const baseProtein = meal.baseMacros?.protein ?? meal.macros.protein / safePortion;
        const baseCarbs = meal.baseMacros?.carbs ?? meal.macros.carbs / safePortion;
        const baseFat = meal.baseMacros?.fat ?? meal.macros.fat / safePortion;

        const updatedCalories = Math.round(baseCalories * newPortion);
        const updatedProtein = Math.round(baseProtein * newPortion);
        const updatedCarbs = Math.round(baseCarbs * newPortion);
        const updatedFat = Math.round(baseFat * newPortion);

        set((state) => ({
          meals: state.meals.map((m) => {
            if (m.id !== id) return m;
            return {
              ...m,
              portion: newPortion,
              calories: updatedCalories,
              macros: { protein: updatedProtein, carbs: updatedCarbs, fat: updatedFat },
              baseCalories,
              baseMacros: { protein: baseProtein, carbs: baseCarbs, fat: baseFat },
            };
          }),
        }));

        supabase
          .from('nutrition_logs')
          .update({ calories: updatedCalories, protein: updatedProtein, carbs: updatedCarbs, fat: updatedFat })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('Failed to update meal portion in DB:', error);
          });
      },

      updateMealMacros: (id, newMacros) => {
        const meal = get().meals.find((m) => m.id === id);
        if (!meal) return;

        const newBaseCalories = caloriesFromMacros(newMacros.protein, newMacros.carbs, newMacros.fat);
        const updatedCalories = Math.round(newBaseCalories * meal.portion);
        const updatedProtein = Math.round(newMacros.protein * meal.portion);
        const updatedCarbs = Math.round(newMacros.carbs * meal.portion);
        const updatedFat = Math.round(newMacros.fat * meal.portion);

        set((state) => ({
          meals: state.meals.map((m) => {
            if (m.id !== id) return m;
            return {
              ...m,
              calories: updatedCalories,
              macros: { protein: updatedProtein, carbs: updatedCarbs, fat: updatedFat },
              baseCalories: newBaseCalories,
              baseMacros: newMacros,
            };
          }),
        }));

        supabase
          .from('nutrition_logs')
          .update({ calories: updatedCalories, protein: updatedProtein, carbs: updatedCarbs, fat: updatedFat })
          .eq('id', id)
          .then(({ error }) => {
            if (error) console.error('Failed to update meal macros in DB:', error);
          });
      },

      fetchMeals: async (userId) => {
        const { data, error } = await supabase
          .from('nutrition_logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error || !data) return;

        const meals: HistoryItem[] = (data as DbRow[]).map((row) => {
          const createdAt = new Date(row.created_at);
          return {
            id: row.id,
            time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            timestamp: createdAt.getTime(),
            mealName: row.meal_name,
            calories: row.calories,
            macros: { protein: row.protein, carbs: row.carbs, fat: row.fat },
            micros: row.micros ?? [],
            portion: 1,
            baseCalories: row.calories,
            baseMacros: { protein: row.protein, carbs: row.carbs, fat: row.fat },
          };
        });

        set({ meals });
      },
    }),
    {
      name: 'street-flow-nutrition-storage',
    }
  )
);
