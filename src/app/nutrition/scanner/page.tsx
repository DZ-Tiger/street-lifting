'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Check,
  Loader2,
  ChevronLeft,
  Target,
  Flame,
  ChevronDown,
  ChevronUp,
  Trash2,
  RotateCcw,
  Plus,
  Utensils,
  Settings,
  Activity,
  Scale,
  Pencil,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { NutritionResponse } from '@/app/api/nutrition/scan/route';
import { cn } from '@/lib/utils';

// STORES
import {
  useNutritionStore,
  calculateTargets,
  GoalType,
  HistoryItem,
  GenderType,
} from '@/store/useNutritionStore';
import { useStore } from '@/store/useStore';

/**
 * UTILS: Compression d'image côté client
 */
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const goalLabels: Record<GoalType, string> = {
  cut: 'Sèche',
  maintain: 'Maintien',
  bulk: 'Prise de masse',
};

const PORTIONS = [
  { label: '1/4', value: 0.25 },
  { label: '1/3', value: 0.3333 },
  { label: '1/2', value: 0.5 },
  { label: '2/3', value: 0.6667 },
  { label: '3/4', value: 0.75 },
  { label: '1x', value: 1 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
];

export default function NutritionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ZUSTAND GLOBAL STATES
  const { profile: appProfile, updateBodyweight } = useStore();
  const bodyWeight = appProfile?.body_weight || 80;

  const {
    profile: nutritionProfile,
    meals,
    addMeal,
    removeMeal,
    updateMealPortion,
    updateMealMacros,
    updateProfile,
  } = useNutritionStore();

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // ÉTATS UX
  const [isScanningView, setIsScanningView] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<HistoryItem | null>(null);

  // ÉTATS DÉTAILS REPAS
  const [portionMode, setPortionMode] = useState<'fraction' | 'grams'>('fraction');
  const [isEditingMacros, setIsEditingMacros] = useState(false);
  const [editMacroProt, setEditMacroProt] = useState<number | ''>('');
  const [editMacroCarbs, setEditMacroCarbs] = useState<number | ''>('');
  const [editMacroFat, setEditMacroFat] = useState<number | ''>('');
  const [customGrams, setCustomGrams] = useState<number | ''>('');

  useEffect(() => {
    if (selectedMeal) {
      setPortionMode('fraction');
      setIsEditingMacros(false);
      setEditMacroProt(selectedMeal.macros.protein);
      setEditMacroCarbs(selectedMeal.macros.carbs);
      setEditMacroFat(selectedMeal.macros.fat);
      if (selectedMeal.estimatedWeightGrams) {
        setCustomGrams(Math.round(selectedMeal.estimatedWeightGrams * selectedMeal.portion));
      } else {
        setCustomGrams('');
      }
    }
  }, [selectedMeal?.id]);

  // ÉTATS PARAMÈTRES (SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editWeight, setEditWeight] = useState(bodyWeight);
  const [editHeight, setEditHeight] = useState(nutritionProfile.height);
  const [editAge, setEditAge] = useState(nutritionProfile.age);
  const [editGender, setEditGender] = useState<GenderType>(nutritionProfile.gender);
  const [editActivity, setEditActivity] = useState(nutritionProfile.activityLevel);
  const [editGoal, setEditGoal] = useState<GoalType>(nutritionProfile.goal);

  // Sync form when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      const timer = setTimeout(() => {
        setEditWeight(bodyWeight);
        setEditHeight(nutritionProfile.height);
        setEditAge(nutritionProfile.age);
        setEditGender(nutritionProfile.gender);
        setEditActivity(nutritionProfile.activityLevel);
        setEditGoal(nutritionProfile.goal);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSettingsOpen, bodyWeight, nutritionProfile]);

  // ÉTATS MANUELS
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState<number | ''>('');
  const [manualProtein, setManualProtein] = useState<number | ''>('');
  const [manualCarbs, setManualCarbs] = useState<number | ''>('');
  const [manualFat, setManualFat] = useState<number | ''>('');

  // CALCULS DÉRIVÉS
  const targets = useMemo(
    () => calculateTargets(nutritionProfile, bodyWeight),
    [nutritionProfile, bodyWeight]
  );

  const dailyNutrition = useMemo(() => {
    return meals.reduce(
      (acc, curr) => ({
        calories: acc.calories + curr.calories,
        protein: acc.protein + curr.macros.protein,
        carbs: acc.carbs + curr.macros.carbs,
        fat: acc.fat + curr.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meals]);

  // ÉTATS SCANNER
  const [image, setImage] = useState<string | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [result, setResult] = useState<NutritionResponse | null>(null);
  const [showMicros, setShowMicros] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [portionValue, setPortionValue] = useState<number>(1);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setResult(null);
      setPortionValue(1);
      startScan(compressed);
    } catch {
      toast.error("Erreur lors de la capture de l'image");
    }
  };

  const startScan = async (base64Image: string) => {
    setIsScanningImage(true);
    try {
      const response = await fetch('/api/nutrition/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) throw new Error('Analyse échouée');

      const data: NutritionResponse = await response.json();
      setResult(data);
    } catch {
      toast.error("L'IA n'a pas pu analyser cette image.");
      setImage(null);
    } finally {
      setIsScanningImage(false);
    }
  };

  const resetScanner = () => {
    setImage(null);
    setResult(null);
    setPortionValue(1);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      if (editWeight !== bodyWeight) {
        await updateBodyweight(editWeight);
      }

      updateProfile({
        height: editHeight,
        age: editAge,
        gender: editGender,
        activityLevel: editActivity,
        goal: editGoal,
      });

      toast.success('Paramètres mis à jour !');
      setIsSettingsOpen(false);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScannedMeal = async () => {
    if (!result) return;
    setIsSaving(true);

    // Application de la portion
    const finalCalories = Math.round(result.calories * portionValue);
    const finalProtein = Math.round(result.macros.protein * portionValue);
    const finalCarbs = Math.round(result.macros.carbs * portionValue);
    const finalFat = Math.round(result.macros.fat * portionValue);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('nutrition_logs').insert({
          user_id: user.id,
          meal_name: result.mealName,
          calories: finalCalories,
          protein: finalProtein,
          carbs: finalCarbs,
          fat: finalFat,
          micros: result.micros,
          image_url: image,
        });

        if (error) throw error;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      addMeal({
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        timestamp: Date.now(),
        mealName: result.mealName,
        calories: finalCalories,
        macros: {
          protein: finalProtein,
          carbs: finalCarbs,
          fat: finalFat,
        },
        micros: result.micros,
        portion: portionValue,
        baseCalories: result.calories,
        baseMacros: result.macros,
      });

      toast.success('Repas enregistré !');

      resetScanner();
      setIsScanningView(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (
      !manualName ||
      manualCalories === '' ||
      manualProtein === '' ||
      manualCarbs === '' ||
      manualFat === ''
    ) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('nutrition_logs').insert({
          user_id: user.id,
          meal_name: manualName,
          calories: Number(manualCalories),
          protein: Number(manualProtein),
          carbs: Number(manualCarbs),
          fat: Number(manualFat),
          micros: [],
          image_url: null,
        });

        if (error) throw error;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      addMeal({
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        timestamp: Date.now(),
        mealName: manualName,
        calories: Number(manualCalories),
        macros: {
          protein: Number(manualProtein),
          carbs: Number(manualCarbs),
          fat: Number(manualFat),
        },
        micros: [],
        portion: 1,
      });

      toast.success('Repas manuel ajouté !');

      setManualName('');
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualFat('');
      setIsManualModalOpen(false);
    } catch {
      toast.error("Erreur lors de l'ajout manuel.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeMeal(id);
    toast.success('Repas supprimé.');
  };

  const handleSaveMacros = () => {
    if (!selectedMeal) return;
    const newProt = Number(editMacroProt) || 0;
    const newCarbs = Number(editMacroCarbs) || 0;
    const newFat = Number(editMacroFat) || 0;
    
    const newBaseProt = newProt / selectedMeal.portion;
    const newBaseCarbs = newCarbs / selectedMeal.portion;
    const newBaseFat = newFat / selectedMeal.portion;

    updateMealMacros(selectedMeal.id, {
      protein: newBaseProt,
      carbs: newBaseCarbs,
      fat: newBaseFat
    });

    setIsEditingMacros(false);
    
    const newBaseCals = newBaseProt * 4 + newBaseCarbs * 4 + newBaseFat * 9;
    setSelectedMeal({
      ...selectedMeal,
      baseMacros: { protein: newBaseProt, carbs: newBaseCarbs, fat: newBaseFat },
      baseCalories: newBaseCals,
      macros: {
        protein: newProt,
        carbs: newCarbs,
        fat: newFat,
      },
      calories: Math.round(newBaseCals * selectedMeal.portion)
    });
    toast.success('Macros mises à jour');
  };

  const handleCustomGramsChange = (val: string) => {
    if (!selectedMeal || !selectedMeal.estimatedWeightGrams) return;
    const g = Number(val);
    setCustomGrams(val === '' ? '' : g);
    if (g > 0) {
      const newPortion = g / selectedMeal.estimatedWeightGrams;
      updateMealPortion(selectedMeal.id, newPortion);
      
      const baseCals = selectedMeal.baseCalories ?? selectedMeal.calories / selectedMeal.portion;
      const baseProt = selectedMeal.baseMacros?.protein ?? selectedMeal.macros.protein / selectedMeal.portion;
      const baseCarbs = selectedMeal.baseMacros?.carbs ?? selectedMeal.macros.carbs / selectedMeal.portion;
      const baseFat = selectedMeal.baseMacros?.fat ?? selectedMeal.macros.fat / selectedMeal.portion;

      setSelectedMeal({
        ...selectedMeal,
        portion: newPortion,
        calories: Math.round(baseCals * newPortion),
        macros: {
          protein: Math.round(baseProt * newPortion),
          carbs: Math.round(baseCarbs * newPortion),
          fat: Math.round(baseFat * newPortion),
        },
      });
    }
  };

  if (!isHydrated) return null;

  // VUE DASHBOARD (ÉTAT A - PREMIUM)
  const renderDashboard = () => {
    const radius = 65;
    const stroke = 8;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const pctCal = Math.min(dailyNutrition.calories / targets.targetCalories, 1);
    const strokeDashoffset = circumference - pctCal * circumference;

    return (
      <motion.div
        key="dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex flex-col w-full max-w-md mx-auto"
      >
        <header className="mb-8 flex items-center justify-between bg-slate-900 text-slate-50 p-6 rounded-b-[2.5rem] shadow-md -mx-4 -mt-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-white hover:bg-slate-800 rounded-full"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-xl font-black italic tracking-tight uppercase">NUTRITION</h1>
              <div className="flex items-center gap-1.5 text-blue-400">
                <Target className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Objectif : {goalLabels[nutritionProfile.goal].toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-2xl font-black italic">{targets.targetCalories}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                KCAL CIBLE
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="text-slate-400 hover:text-white rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Cercle Fin Calories */}
        <div className="flex justify-center mb-8">
          <div className="relative flex items-center justify-center">
            <svg height={radius * 2} width={radius * 2} className="-rotate-90">
              <circle
                stroke="#f1f5f9"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke="#2563eb"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-slate-900 italic tracking-tighter">
                {dailyNutrition.calories}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                KCAL
              </span>
            </div>
          </div>
        </div>

        {/* Macros Fines */}
        <div className="space-y-5 px-2 mb-10">
          <div className="space-y-1.5">
            <div className="flex justify-between items-end text-xs font-bold uppercase tracking-wider">
              <span className="text-slate-500">Protéines</span>
              <span className="text-slate-900">
                {dailyNutrition.protein}{' '}
                <span className="text-slate-400">/ {targets.targetProtein}g</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min((dailyNutrition.protein / targets.targetProtein) * 100, 100)}%`,
                }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-end text-xs font-bold uppercase tracking-wider">
              <span className="text-slate-500">Glucides</span>
              <span className="text-slate-900">
                {dailyNutrition.carbs}{' '}
                <span className="text-slate-400">/ {targets.targetCarbs}g</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min((dailyNutrition.carbs / targets.targetCarbs) * 100, 100)}%`,
                }}
                className="h-full bg-emerald-600 rounded-full"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-end text-xs font-bold uppercase tracking-wider">
              <span className="text-slate-500">Lipides</span>
              <span className="text-slate-900">
                {dailyNutrition.fat} <span className="text-slate-400">/ {targets.targetFat}g</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min((dailyNutrition.fat / targets.targetFat) * 100, 100)}%`,
                }}
                className="h-full bg-orange-500 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Historique */}
        <div className="space-y-4 px-2 flex-1 mb-8">
          <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
            Historique du jour
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {meals.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                >
                  <Card
                    className="border-none shadow-sm rounded-2xl overflow-hidden bg-white cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setSelectedMeal(item)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-400 shrink-0">
                            {item.time}
                          </span>
                          <span className="text-sm font-black text-slate-900 italic uppercase leading-tight truncate">
                            {item.mealName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="text-blue-600">{item.macros.protein}g P</span>
                          <span className="text-emerald-600">{item.macros.carbs}g G</span>
                          <span className="text-orange-500">{item.macros.fat}g L</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-900 italic leading-none">
                            {item.calories}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                            Kcal
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(item.id, e)}
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full -mr-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            {meals.length === 0 && (
              <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 py-6">
                Aucun repas scanné
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 w-full max-w-md px-4">
          <Button
            onClick={() => setIsManualModalOpen(true)}
            variant="outline"
            className="h-16 flex-1 rounded-2xl bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 shadow-xl shadow-blue-600/10 transition-all active:scale-95 flex items-center justify-center gap-2 group"
          >
            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform stroke-[3px]" />
            <span className="font-black text-xs uppercase italic tracking-wider">Manuel</span>
          </Button>
          <Button
            onClick={() => setIsScanningView(true)}
            className="h-16 flex-[2] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-3 group"
          >
            <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="font-black text-sm uppercase italic tracking-wider">Scanner</span>
          </Button>
        </div>
      </motion.div>
    );
  };

  // VUE SCANNER (ÉTAT B - PREMIUM)
  const renderScanner = () => {
    const finalCalories = result ? Math.round(result.calories * portionValue) : 0;
    const finalProtein = result ? Math.round(result.macros.protein * portionValue) : 0;
    const finalCarbs = result ? Math.round(result.macros.carbs * portionValue) : 0;
    const finalFat = result ? Math.round(result.macros.fat * portionValue) : 0;

    return (
      <motion.div
        key="scanner"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="flex-1 flex flex-col w-full max-w-md mx-auto relative z-50 bg-slate-900 absolute inset-0 min-h-screen"
      >
        <header className="flex items-center justify-between p-6 sticky top-0 z-10 mb-4 bg-slate-900/80 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsScanningView(false)}
            className="rounded-full bg-white/10 shadow-sm text-white hover:bg-white/20 border border-slate-700"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-sm font-black text-white italic uppercase tracking-widest">
            NUTRITION
          </h1>
          <div className="w-10" />
        </header>

        <div className="px-4 pb-12 flex-1 flex flex-col">
          <section className="relative aspect-square w-full rounded-[2rem] overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg shrink-0">
            {image ? (
              <>
                <Image
                  src={image}
                  alt="Preview"
                  fill
                  className={cn(
                    'object-cover transition-opacity duration-500',
                    isScanningImage ? 'opacity-40' : 'opacity-100'
                  )}
                  unoptimized
                />

                {isScanningImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-pulse z-10">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
                    <span className="text-white font-black italic tracking-widest uppercase text-xs">
                      Analyse en cours...
                    </span>
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-4 w-full h-full justify-center group"
              >
                <div className="w-20 h-20 rounded-full bg-slate-700/50 flex items-center justify-center text-blue-400 group-active:scale-90 transition-transform">
                  <Camera className="w-8 h-8" />
                </div>
                <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                  Scanner votre repas
                </span>
              </button>
            )}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCapture}
            />
          </section>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex flex-col gap-4 mb-20"
              >
                <Card className="border-none shadow-xl bg-slate-800 text-white overflow-hidden rounded-[2rem]">
                  <CardHeader className="pb-0 pt-6 px-6">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-xl font-black italic uppercase leading-tight">
                        {result.mealName}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="text-blue-400 border-blue-400/30 font-bold text-[8px] uppercase tracking-widest shrink-0"
                      >
                        Précision IA
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* Sélecteur de Portions Granulaire */}
                    <div className="space-y-3 pt-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] flex items-center gap-2">
                        <Utensils className="w-3 h-3 text-blue-400" /> Fraction Consommée
                      </Label>
                      <div className="flex gap-2 bg-slate-900/50 p-2 rounded-2xl overflow-x-auto scrollbar-hide border border-slate-700/50 snap-x">
                        {PORTIONS.map((p) => (
                          <Button
                            key={p.label}
                            variant="ghost"
                            onClick={() => setPortionValue(p.value)}
                            className={cn(
                              'shrink-0 rounded-xl h-14 w-16 font-black text-sm transition-all snap-center',
                              Math.abs(portionValue - p.value) < 0.001
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                            )}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="bg-slate-700 p-3 rounded-2xl">
                        <Flame className="w-6 h-6 text-blue-400 fill-current" />
                      </div>
                      <div>
                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em]">
                          Énergie
                        </p>
                        <p className="text-3xl font-black italic">
                          {finalCalories}{' '}
                          <span className="text-xs font-bold text-slate-400 not-italic tracking-normal">
                            KCAL
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-700/50 px-4 py-3 rounded-2xl border border-slate-600/50">
                        <span className="text-blue-400 font-black text-lg italic block">
                          {finalProtein}g
                        </span>
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">
                          Protéines
                        </span>
                      </div>
                      <div className="bg-slate-700/50 px-4 py-3 rounded-2xl border border-slate-600/50">
                        <span className="text-emerald-400 font-black text-lg italic block">
                          {finalCarbs}g
                        </span>
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">
                          Glucides
                        </span>
                      </div>
                      <div className="bg-slate-700/50 px-4 py-3 rounded-2xl border border-slate-600/50">
                        <span className="text-orange-400 font-black text-lg italic block">
                          {finalFat}g
                        </span>
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">
                          Lipides
                        </span>
                      </div>
                    </div>

                    <Separator className="bg-slate-700" />

                    <div>
                      <button
                        onClick={() => setShowMicros(!showMicros)}
                        className="w-full flex justify-between items-center py-1 group"
                      >
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          Micronutriments (Base 1x)
                        </span>
                        {showMicros ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-blue-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-400" />
                        )}
                      </button>

                      <AnimatePresence>
                        {showMicros && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                              {result.micros.map((micro, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between items-center text-[10px] border-b border-slate-700/50 pb-1"
                                >
                                  <span className="text-slate-400 font-bold uppercase tracking-wider">
                                    {micro.name}
                                  </span>
                                  <span className="font-black text-slate-200">{micro.amount}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>

                {/* BOUTONS D'ACTION */}
                <div className="flex flex-col gap-3 mt-4 pb-8">
                  <Button
                    onClick={handleSaveScannedMeal}
                    disabled={isSaving}
                    className="w-full h-16 text-lg font-black italic uppercase rounded-2xl shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    {isSaving ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-6 h-6 mr-3 stroke-[3px]" />
                        VALIDER CE REPAS
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={resetScanner}
                    disabled={isSaving}
                    className="w-full h-16 text-sm font-bold uppercase tracking-widest rounded-2xl border-slate-700 text-slate-300 bg-transparent hover:bg-slate-800 hover:text-white active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-5 h-5 mr-3" />
                    REPRENDRE LA PHOTO
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 relative p-4 pb-28">
      <AnimatePresence mode="wait">
        {isScanningView ? renderScanner() : renderDashboard()}
      </AnimatePresence>

      {/* DIALOG PARAMÈTRES (SETTINGS) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 bg-white overflow-y-auto max-h-[90vh]">
          <DialogHeader className="mb-4 text-left">
            <DialogTitle className="text-xl font-black italic uppercase leading-tight text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600 stroke-[3px]" /> Mes Paramètres
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                  <Scale className="w-3 h-3 text-blue-500" /> Poids (kg)
                </Label>
                <Input
                  type="number"
                  value={editWeight}
                  onChange={(e) => setEditWeight(Number(e.target.value) || 0)}
                  className="h-14 rounded-2xl text-xl font-black text-center bg-slate-50 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-emerald-500" /> Taille (cm)
                </Label>
                <Input
                  type="number"
                  value={editHeight}
                  onChange={(e) => setEditHeight(Number(e.target.value) || 0)}
                  className="h-14 rounded-2xl text-xl font-black text-center bg-slate-50 border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Âge
                </Label>
                <Input
                  type="number"
                  value={editAge}
                  onChange={(e) => setEditAge(Number(e.target.value) || 0)}
                  className="h-14 rounded-2xl text-xl font-black text-center bg-slate-50 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Sexe
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant={editGender === 'M' ? 'default' : 'outline'}
                    onClick={() => setEditGender('M')}
                    className={cn(
                      'flex-1 h-14 rounded-2xl font-black text-lg',
                      editGender === 'M'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 border-slate-200'
                    )}
                  >
                    H
                  </Button>
                  <Button
                    variant={editGender === 'F' ? 'default' : 'outline'}
                    onClick={() => setEditGender('F')}
                    className={cn(
                      'flex-1 h-14 rounded-2xl font-black text-lg',
                      editGender === 'F'
                        ? 'bg-pink-500 hover:bg-pink-600 text-white border-pink-500'
                        : 'text-slate-400 border-slate-200'
                    )}
                  >
                    F
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Niveau d&apos;activité
              </Label>
              <div className="flex flex-col gap-2">
                {[
                  { val: 1.2, label: 'Sédentaire' },
                  { val: 1.55, label: 'Modéré (1-3 séances/sem)' },
                  { val: 1.75, label: 'Très Actif (4+ séances/sem)' },
                ].map((act) => (
                  <Button
                    key={act.val}
                    variant="outline"
                    onClick={() => setEditActivity(act.val)}
                    className={cn(
                      'w-full justify-start h-12 rounded-xl font-black text-xs uppercase tracking-wider transition-all',
                      Math.abs(editActivity - act.val) < 0.01
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'text-slate-500 border-slate-200'
                    )}
                  >
                    {act.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Objectif Nutritionnel
              </Label>
              <div className="flex flex-col gap-2">
                {(['cut', 'maintain', 'bulk'] as GoalType[]).map((g) => (
                  <Button
                    key={g}
                    variant="outline"
                    onClick={() => setEditGoal(g)}
                    className={cn(
                      'w-full justify-start h-14 rounded-xl font-black uppercase italic tracking-wider text-sm transition-all',
                      editGoal === g
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                        : 'text-slate-500 border-slate-200'
                    )}
                  >
                    <Target
                      className={cn(
                        'w-5 h-5 mr-3',
                        editGoal === g ? 'text-blue-200' : 'text-slate-400'
                      )}
                    />
                    {goalLabels[g]}
                    {editGoal === g && (
                      <Check className="ml-auto w-5 h-5 text-white stroke-[3px]" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full h-16 mt-4 text-sm font-black italic uppercase rounded-2xl shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ENREGISTRER'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DÉTAILS REPAS */}
      <Dialog open={!!selectedMeal} onOpenChange={(open) => !open && setSelectedMeal(null)}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 bg-white overflow-y-auto max-h-[90vh]">
          {selectedMeal && (
            <>
              <DialogHeader className="mb-4 text-left">
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant="secondary"
                    className="bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold text-[10px] uppercase tracking-widest border-none"
                  >
                    {selectedMeal.time}
                  </Badge>
                  
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                    <button
                      onClick={() => setPortionMode('fraction')}
                      className={cn('px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all', portionMode === 'fraction' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600')}
                    >
                      Frac.
                    </button>
                    {selectedMeal.estimatedWeightGrams && (
                      <button
                        onClick={() => setPortionMode('grams')}
                        className={cn('px-2 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all', portionMode === 'grams' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600')}
                      >
                        Grammes
                      </button>
                    )}
                  </div>
                </div>
                <DialogTitle className="text-2xl font-black italic uppercase leading-tight text-slate-900">
                  {selectedMeal.mealName}
                </DialogTitle>
                
                <div className="mt-3 flex items-center">
                  {portionMode === 'fraction' ? (
                    <Select
                      value={selectedMeal.portion.toString()}
                      onValueChange={(val) => {
                        if (!val) return;
                        const newPortion = parseFloat(val);
                        updateMealPortion(selectedMeal.id, newPortion);

                        const baseCals = selectedMeal.baseCalories ?? selectedMeal.calories / selectedMeal.portion;
                        const baseProt = selectedMeal.baseMacros?.protein ?? selectedMeal.macros.protein / selectedMeal.portion;
                        const baseCarbs = selectedMeal.baseMacros?.carbs ?? selectedMeal.macros.carbs / selectedMeal.portion;
                        const baseFat = selectedMeal.baseMacros?.fat ?? selectedMeal.macros.fat / selectedMeal.portion;

                        setSelectedMeal({
                          ...selectedMeal,
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
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-fit border border-slate-200 text-slate-700 bg-slate-50 font-black text-[11px] uppercase tracking-widest rounded-xl px-3 outline-none focus:ring-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">PORTION :</span>
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-slate-200 bg-white z-[100] shadow-xl">
                        {PORTIONS.map((p) => (
                          <SelectItem
                            key={p.value}
                            value={p.value.toString()}
                            className="font-bold text-sm cursor-pointer"
                          >
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 w-1/2">
                      <Input 
                        type="number" 
                        inputMode="decimal" 
                        value={customGrams} 
                        onChange={(e) => handleCustomGramsChange(e.target.value)} 
                        placeholder="Ex: 150"
                        className="h-8 text-sm font-black rounded-xl bg-slate-50 border-slate-200 text-center"
                      />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grammes</span>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-900 text-white p-4 rounded-2xl">
                  <div className="bg-orange-500 p-3 rounded-xl">
                    <Flame className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                      Calories
                    </p>
                    <p className="text-3xl font-black italic">
                      {selectedMeal.calories}{' '}
                      <span className="text-sm font-bold text-slate-400 not-italic tracking-normal">
                        kcal
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Macros
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-blue-500 hover:text-blue-600 hover:bg-blue-50 font-bold uppercase tracking-wider px-2 gap-1 rounded-lg"
                      onClick={() => setIsEditingMacros(!isEditingMacros)}
                    >
                      {isEditingMacros ? 'Annuler' : <><Pencil className="w-3 h-3" /> Modifier</>}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100/50 flex flex-col items-center">
                      {isEditingMacros ? (
                        <Input type="number" inputMode="decimal" value={editMacroProt} onChange={(e) => setEditMacroProt(e.target.value === '' ? '' : Number(e.target.value))} className="h-8 w-full text-center font-black text-blue-600 p-1 mb-1 border-blue-200" />
                      ) : (
                        <span className="text-blue-600 font-black text-xl italic block text-center">
                          {selectedMeal.macros.protein}g
                        </span>
                      )}
                      <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                        Protéines
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100/50 flex flex-col items-center">
                      {isEditingMacros ? (
                        <Input type="number" inputMode="decimal" value={editMacroCarbs} onChange={(e) => setEditMacroCarbs(e.target.value === '' ? '' : Number(e.target.value))} className="h-8 w-full text-center font-black text-emerald-600 p-1 mb-1 border-emerald-200" />
                      ) : (
                        <span className="text-emerald-600 font-black text-xl italic block text-center">
                          {selectedMeal.macros.carbs}g
                        </span>
                      )}
                      <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                        Glucides
                      </span>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100/50 flex flex-col items-center">
                      {isEditingMacros ? (
                        <Input type="number" inputMode="decimal" value={editMacroFat} onChange={(e) => setEditMacroFat(e.target.value === '' ? '' : Number(e.target.value))} className="h-8 w-full text-center font-black text-orange-500 p-1 mb-1 border-orange-200" />
                      ) : (
                        <span className="text-orange-500 font-black text-xl italic block text-center">
                          {selectedMeal.macros.fat}g
                        </span>
                      )}
                      <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                        Lipides
                      </span>
                    </div>
                  </div>
                  {isEditingMacros && (
                    <Button onClick={handleSaveMacros} className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 font-black text-xs uppercase italic tracking-wider gap-2">
                       <Save className="w-4 h-4" /> Enregistrer les macros
                    </Button>
                  )}
                </div>

                {selectedMeal.micros && selectedMeal.micros.length > 0 && (
                  <>
                    <Separator className="bg-slate-100" />
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">
                        Micronutriments
                      </h4>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {selectedMeal.micros.map((micro, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center text-xs border-b border-slate-50 pb-1.5"
                          >
                            <span className="text-slate-500 font-bold uppercase tracking-wider">
                              {micro.name}
                            </span>
                            <span className="font-black text-slate-800">{micro.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG AJOUT MANUEL */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 bg-white overflow-y-auto max-h-[90vh]">
          <DialogHeader className="mb-4 text-left">
            <DialogTitle className="text-xl font-black italic uppercase leading-tight text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600 stroke-[3px]" /> Saisie Manuelle
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Nom du plat
              </Label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ex: Shaker Protéiné"
                className="h-14 rounded-2xl text-lg font-bold bg-slate-50 border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-orange-500">
                Calories (kcal)
              </Label>
              <Input
                type="number"
                value={manualCalories}
                onChange={(e) => setManualCalories(e.target.value ? Number(e.target.value) : '')}
                placeholder="0"
                className="h-14 rounded-2xl text-xl font-black italic bg-slate-50 border-slate-200"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-blue-600">
                  Protéines (g)
                </Label>
                <Input
                  type="number"
                  value={manualProtein}
                  onChange={(e) => setManualProtein(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                  className="h-12 rounded-xl text-lg font-black bg-slate-50 border-slate-200 text-center"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-emerald-600">
                  Glucides (g)
                </Label>
                <Input
                  type="number"
                  value={manualCarbs}
                  onChange={(e) => setManualCarbs(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                  className="h-12 rounded-xl text-lg font-black bg-slate-50 border-slate-200 text-center"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-orange-500">
                  Lipides (g)
                </Label>
                <Input
                  type="number"
                  value={manualFat}
                  onChange={(e) => setManualFat(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                  className="h-12 rounded-xl text-lg font-black bg-slate-50 border-slate-200 text-center"
                />
              </div>
            </div>

            <Button
              onClick={handleManualSave}
              disabled={isSaving}
              className="w-full h-16 mt-6 text-sm font-black italic uppercase rounded-2xl shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2 stroke-[3px]" />
                  AJOUTER AU JOURNAL
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
