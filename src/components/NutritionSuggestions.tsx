'use client';

import React from 'react';
import { useNutritionSuggestions } from '@/hooks/useNutritionSuggestions';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Smart nutrition suggestions component.
 * Displays recurring meals as quick-add chips.
 */
export const NutritionSuggestions: React.FC = () => {
  const { suggestions, isLoading, handleQuickAdd } = useNutritionSuggestions();

  // Skeleton loader while fetching suggestions
  if (isLoading) {
    return (
      <div className="flex gap-2 py-2 overflow-x-auto no-scrollbar">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  // Hide component if no suggestions are available
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-1.5 px-1">
        <Zap className="w-3 h-3 text-blue-500 fill-blue-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
          Suggestions Rapides
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
        <AnimatePresence mode="popLayout">
          {suggestions.map((suggestion) => (
            <motion.div
              key={suggestion.mealName}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 flex items-center gap-1.5 whitespace-nowrap bg-blue-50/50 hover:bg-blue-100/50 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 border-blue-100 dark:border-blue-900 transition-colors"
                onClick={() => handleQuickAdd(suggestion)}
              >
                <span className="font-semibold text-blue-700 dark:text-blue-400">
                  {suggestion.mealName}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {suggestion.calories} kcal
                </span>
                <Plus className="w-3 h-3 text-blue-500" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
