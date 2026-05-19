import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { useNutritionStore, HistoryItem } from '@/store/useNutritionStore';
import { toast } from 'sonner';

export interface NutritionSuggestion {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  frequency: number;
  matchType: 'habit' | 'weekday';
}

/**
 * Advanced Fuzzy Matching using Tokenization and Stem-based Intersection.
 * Handles "Shaker 20g protein" vs "protein shake" by focusing on significant words.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const getTokens = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[0-9]/g, ' ') // Replace digits with spaces
      .replace(/[^a-z\s]/g, '') // Keep only letters and spaces
      .split(/\s+/)
      .filter((w) => w.length > 2); // Keep significant words (> 2 chars)

  const t1 = getTokens(str1);
  const t2 = getTokens(str2);

  if (t1.length === 0 || t2.length === 0) return 0;

  let matches = 0;
  const usedT2 = new Set<number>();

  t1.forEach((w1) => {
    const matchIdx = t2.findIndex((w2, idx) => {
      if (usedT2.has(idx)) return false;
      // Exact match or common root (e.g., shake vs shaker)
      return (
        w1 === w2 || (w1.startsWith(w2) && w2.length >= 4) || (w2.startsWith(w1) && w1.length >= 4)
      );
    });

    if (matchIdx !== -1) {
      matches++;
      usedT2.add(matchIdx);
    }
  });

  // Dice coefficient on tokens (2 * intersection / sum of lengths)
  return (2 * matches) / (t1.length + t2.length);
}

const SIMILARITY_THRESHOLD = 0.5;

export function useNutritionSuggestions() {
  const { profile } = useStore();
  const { addMeal } = useNutritionStore();
  const [suggestions, setSuggestions] = useState<NutritionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const userId = profile?.user_id;

    async function fetchSuggestions() {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const twentyOneDaysAgo = new Date();
        twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);
        twentyOneDaysAgo.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentWeekday = today.getDay();

        const { data, error } = await supabase
          .from('nutrition_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', twentyOneDaysAgo.toISOString());

        if (error) throw error;

        if (!data || data.length === 0) {
          if (isMounted) {
            setSuggestions([]);
            setIsLoading(false);
          }
          return;
        }

        // 1. Group by Fuzzy Token Similarity
        const groupedMeals: {
          representativeName: string;
          totalCalories: number;
          totalProtein: number;
          totalCarbs: number;
          totalFat: number;
          logs: (typeof data)[number][];
          lastSeen: Date;
        }[] = [];

        data.forEach((row) => {
          const rowDate = new Date(row.created_at);
          const match = groupedMeals.find(
            (g) => calculateSimilarity(g.representativeName, row.meal_name) >= SIMILARITY_THRESHOLD
          );

          if (match) {
            if (rowDate > match.lastSeen) {
              match.representativeName = row.meal_name;
              match.lastSeen = rowDate;
            }
            match.totalCalories += row.calories;
            match.totalProtein += row.protein;
            match.totalCarbs += row.carbs;
            match.totalFat += row.fat;
            match.logs.push(row);
          } else {
            groupedMeals.push({
              representativeName: row.meal_name,
              totalCalories: row.calories,
              totalProtein: row.protein,
              totalCarbs: row.carbs,
              totalFat: row.fat,
              logs: [row],
              lastSeen: rowDate,
            });
          }
        });

        // 2. Identify Patterns and Filter
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const processedSuggestions: NutritionSuggestion[] = [];

        groupedMeals.forEach((group) => {
          // Rule: Exclude if eaten today (Fuzzy check already covered by being in same group)
          const eatenToday = group.logs.some((log) => new Date(log.created_at) >= today);
          if (eatenToday) return;

          // Pattern A: Habit (>= 3 times in last 7 days)
          const countLast7Days = group.logs.filter(
            (log) => new Date(log.created_at) >= sevenDaysAgo
          ).length;
          const isHabit = countLast7Days >= 3;

          // Pattern B: Weekday Habit (>= 2 times in last 3 same-weekdays)
          const weekdayLogs = group.logs.filter((log) => {
            const d = new Date(log.created_at);
            return d.getDay() === currentWeekday && d < today;
          });
          const uniqueWeeks = new Set(
            weekdayLogs.map((l) => {
              const d = new Date(l.created_at);
              d.setHours(0, 0, 0, 0);
              return d.getTime();
            })
          ).size;
          const isWeekdayHabit = uniqueWeeks >= 2;

          if (isHabit || isWeekdayHabit) {
            processedSuggestions.push({
              mealName: group.representativeName,
              calories: Math.round(group.totalCalories / group.logs.length),
              protein: Math.round(group.totalProtein / group.logs.length),
              carbs: Math.round(group.totalCarbs / group.logs.length),
              fat: Math.round(group.totalFat / group.logs.length),
              frequency: group.logs.length,
              matchType: isHabit ? 'habit' : 'weekday',
            });
          }
        });

        const final = processedSuggestions.sort((a, b) => b.frequency - a.frequency).slice(0, 3);

        if (isMounted) {
          setSuggestions(final);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching nutrition suggestions:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    fetchSuggestions();
    return () => {
      isMounted = false;
    };
  }, [profile]);

  const handleQuickAdd = useCallback(
    async (suggestion: NutritionSuggestion) => {
      if (!profile?.user_id) return;

      try {
        const { data, error } = await supabase
          .from('nutrition_logs')
          .insert({
            user_id: profile.user_id,
            meal_name: suggestion.mealName,
            calories: suggestion.calories,
            protein: suggestion.protein,
            carbs: suggestion.carbs,
            fat: suggestion.fat,
            micros: [],
          })
          .select()
          .single();

        if (error) throw error;

        // Update store to reflect the change in the UI immediately
        const createdAt = new Date(data.created_at);
        const newMeal: HistoryItem = {
          id: data.id,
          time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          timestamp: createdAt.getTime(),
          mealName: data.meal_name,
          calories: data.calories,
          macros: { protein: data.protein, carbs: data.carbs, fat: data.fat },
          micros: [],
          portion: 1,
          baseCalories: data.calories,
          baseMacros: { protein: data.protein, carbs: data.carbs, fat: data.fat },
        };
        addMeal(newMeal);

        // Remove from local suggestions to update UI instantly
        setSuggestions((prev) => prev.filter((s) => s.mealName !== suggestion.mealName));

        toast.success(`${suggestion.mealName} ajouté !`);
      } catch (err) {
        console.error('Error adding suggestion:', err);
        toast.error("Erreur lors de l'ajout");
      }
    },
    [profile, addMeal]
  );

  return { suggestions, isLoading, handleQuickAdd };
}
