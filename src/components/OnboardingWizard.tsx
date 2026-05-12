'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, calculate1RM, ExerciseType } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  ChevronRight,
  ChevronLeft,
  Minus,
  Plus,
  Target,
  Check,
  TrendingUp,
  Activity,
  Calendar,
  Ruler,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ExerciseConfig = {
  enabled: boolean;
  mode: 'known' | 'estimate';
  max: number;
  addedWeight: number;
  reps: number;
};

type ExercisesState = Record<ExerciseType, ExerciseConfig>;

const MaleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="10" cy="14" r="5" />
    <path d="M14 10l7-7" />
    <path d="M16 3h5v5" />
  </svg>
);

const FemaleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="9" r="6" />
    <path d="M12 15v7" />
    <path d="M9 19h6" />
  </svg>
);

const GENDERS = [
  { id: 'Homme' as const, label: 'ATHLÈTE M', color: 'blue', icon: MaleIcon },
  { id: 'Femme' as const, label: 'ATHLÈTE F', color: 'indigo', icon: FemaleIcon },
];

const PROGRAMS = [
  { id: 'seche_extreme', label: 'SÈCHE', description: 'Perte de gras' },
  { id: 'prise_de_masse', label: 'MASSE', description: 'Gain musculaire' },
  { id: 'maintenance', label: 'MAINTIEN', description: 'Stabilité' },
];

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function OnboardingWizard() {
  const router = useRouter();
  const { completeOnboarding, profile } = useStore();

  const [step, setStep] = useState(1);
  const [bodyWeight, setBodyWeight] = useState<number>(profile?.body_weight || 75);
  const [birthDate, setBirthDate] = useState<string>('2000-01-01');
  const [height, setHeight] = useState<number>(175);
  const [goalProgram, setGoalProgram] = useState<string>('maintenance');
  const [gender, setGender] = useState<'Homme' | 'Femme' | null>(null);
  const [trainingDays, setTrainingDays] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [success, setSuccess] = useState(false);

  const [exercises, setExercises] = useState<ExercisesState>({
    Tractions: { enabled: true, mode: 'estimate', max: 0, addedWeight: 0, reps: 0 },
    Dips: { enabled: true, mode: 'estimate', max: 0, addedWeight: 0, reps: 0 },
    'Muscle-up': { enabled: true, mode: 'estimate', max: 0, addedWeight: 0, reps: 0 },
    Squat: { enabled: true, mode: 'estimate', max: 0, addedWeight: 0, reps: 0 },
  });

  // Press and hold logic
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopAdjusting = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startAdjusting = (adjustFn: () => void) => {
    stopAdjusting();
    adjustFn();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(adjustFn, 80);
    }, 500);
  };

  useEffect(() => {
    return () => stopAdjusting();
  }, []);

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const updateExercise = (
    exercise: ExerciseType,
    field: keyof ExerciseConfig,
    value: string | number | boolean
  ) => {
    setExercises((prev) => ({
      ...prev,
      [exercise]: {
        ...prev[exercise],
        [field]: value,
      },
    }));
  };

  const adjustExerciseValue = (
    exercise: ExerciseType,
    field: 'addedWeight' | 'reps' | 'max',
    delta: number
  ) => {
    setExercises((prev) => {
      const currentValue = prev[exercise][field] as number;
      const newValue = Math.max(0, currentValue + delta);
      return {
        ...prev,
        [exercise]: {
          ...prev[exercise],
          [field]: newValue,
        },
      };
    });
  };

  const toggleDay = (day: number) => {
    setTrainingDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length < 4) return [...prev, day].sort();
      return prev;
    });
  };

  const handleComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const loadingLabels = [
      'ANALYSE DU PROFIL',
      'CALCUL DES CHARGES',
      'GÉNÉRATION DU CYCLE',
      'FINALISATION',
    ];

    for (let i = 0; i < loadingLabels.length; i++) {
      setLoadingStep(i);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const getFinal1RM = (exo: ExerciseType) => {
      const config = exercises[exo];
      if (!config.enabled) return 0;
      if (config.mode === 'known') return config.max;
      return Math.round(calculate1RM(bodyWeight + config.addedWeight, config.reps) * 2) / 2;
    };

    try {
      if (typeof completeOnboarding !== 'function') {
        throw new Error('Store error: completeOnboarding is missing');
      }

      await completeOnboarding({
        body_weight: bodyWeight,
        current_1rm_pullup: getFinal1RM('Tractions'),
        current_1rm_dips: getFinal1RM('Dips'),
        current_1rm_muscleup: getFinal1RM('Muscle-up'),
        current_1rm_squat: getFinal1RM('Squat'),
        birth_date: birthDate,
        height,
        goal_program: goalProgram,
        gender: gender || 'Homme',
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la configuration', {
        description: 'Vérifiez votre connexion ou que les colonnes existent dans Supabase.',
      });
      setIsSubmitting(false);
    }
  };

  const get1RMPreview = (exo: ExerciseType) => {
    const config = exercises[exo];
    if (config.mode === 'known') return config.max;
    if (config.addedWeight > 0 && config.reps > 0) {
      return Math.round(calculate1RM(bodyWeight + config.addedWeight, config.reps) * 2) / 2;
    }
    return 0;
  };

  const getStrengthLevel = (exo: ExerciseType) => {
    const rm = get1RMPreview(exo);
    if (rm === 0) return { label: 'À SAISIR', color: 'text-slate-300', pct: 0 };
    const ratio = rm / bodyWeight;
    const isUpper = exo !== 'Squat';
    const thresholds = isUpper ? [1.1, 1.4] : [1.3, 1.7];

    if (ratio < thresholds[0]) return { label: 'NOVICE', color: 'text-slate-400', pct: 33 };
    if (ratio < thresholds[1]) return { label: 'AVANCÉ', color: 'text-blue-600', pct: 66 };
    return { label: 'ELITE', color: 'text-slate-900', pct: 100 };
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/20"
        >
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </motion.div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black uppercase tracking-tight">
            PROFIL <span className="text-blue-600">CONFIGURÉ</span>
          </h2>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
            Initialisation de votre premier cycle...
          </p>
        </div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-12">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-slate-100 rounded-full" />
          <motion.div
            className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={loadingStep}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-sm font-black uppercase tracking-[0.2em] text-slate-900"
          >
            {
              ['ANALYSE DU PROFIL', 'CALCUL DES CHARGES', 'GÉNÉRATION DU CYCLE', 'FINALISATION'][
                loadingStep
              ]
            }
          </motion.p>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto min-h-[85vh] flex flex-col pt-4 px-4 pb-12">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <span className="text-xl font-black uppercase tracking-tighter">
            STREET<span className="text-blue-600">FLOW</span>
          </span>
        </div>

        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 transition-all duration-500 rounded-full',
                step === i ? 'w-12 bg-blue-600' : 'w-4 bg-slate-200'
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl shadow-slate-200/50 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-10 flex-1 flex flex-col"
            >
              <div>
                <h2 className="text-2xl font-black uppercase leading-tight tracking-tight">
                  VOTRE <br />
                  <span className="text-blue-600">PROFIL.</span>
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  DÉFINITION DES PARAMÈTRES DE BASE
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id)}
                    className={cn(
                      'relative p-6 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center gap-4 group',
                      gender === g.id
                        ? 'border-blue-600 bg-blue-50/20'
                        : 'border-slate-50 bg-white hover:border-slate-200'
                    )}
                  >
                    <g.icon
                      className={cn(
                        'w-12 h-12 transition-all duration-700 ease-in-out',
                        gender === g.id ? 'text-blue-600' : 'text-slate-200'
                      )}
                      strokeWidth={1.5}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-black tracking-[0.2em] transition-colors',
                        gender === g.id ? 'text-blue-600' : 'text-slate-300'
                      )}
                    >
                      {g.label}
                    </span>
                    {gender === g.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20"
                      >
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                      </motion.div>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      POIDS DE CORPS
                    </Label>
                    <div className="flex items-end gap-1">
                      <input
                        type="number"
                        value={bodyWeight}
                        onChange={(e) => setBodyWeight(Number(e.target.value))}
                        className="w-20 text-3xl font-black italic bg-transparent border-none focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs font-bold text-slate-400 mb-1.5 not-italic uppercase">
                        KG
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl bg-white border-slate-200 hover:border-blue-600 hover:text-blue-600 shadow-sm transition-all active:scale-90"
                      onMouseDown={() =>
                        startAdjusting(() => setBodyWeight((prev) => Math.max(20, prev - 0.5)))
                      }
                      onMouseUp={stopAdjusting}
                      onMouseLeave={stopAdjusting}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        startAdjusting(() => setBodyWeight((prev) => Math.max(20, prev - 0.5)));
                      }}
                      onTouchEnd={stopAdjusting}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="20"
                        max="350"
                        step="0.5"
                        value={bodyWeight}
                        onChange={(e) => setBodyWeight(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl bg-white border-slate-200 hover:border-blue-600 hover:text-blue-600 shadow-sm transition-all active:scale-90"
                      onMouseDown={() =>
                        startAdjusting(() => setBodyWeight((prev) => Math.min(350, prev + 0.5)))
                      }
                      onMouseUp={stopAdjusting}
                      onMouseLeave={stopAdjusting}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        startAdjusting(() => setBodyWeight((prev) => Math.min(350, prev + 0.5)));
                      }}
                      onTouchEnd={stopAdjusting}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <Label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                        NAISSANCE
                      </Label>
                    </div>
                    <div className="flex items-center justify-between">
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full text-sm font-black italic bg-transparent border-none focus:outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2">
                      <Ruler className="w-3 h-3 text-slate-400" />
                      <Label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                        TAILLE (CM)
                      </Label>
                    </div>
                    <div className="flex items-center justify-between">
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        className="w-12 text-2xl font-black italic bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="flex gap-1">
                        <button
                          onMouseDown={() =>
                            startAdjusting(() => setHeight((h) => Math.max(100, h - 1)))
                          }
                          onMouseUp={stopAdjusting}
                          onMouseLeave={stopAdjusting}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            startAdjusting(() => setHeight((h) => Math.max(100, h - 1)));
                          }}
                          onTouchEnd={stopAdjusting}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onMouseDown={() =>
                            startAdjusting(() => setHeight((h) => Math.min(250, h + 1)))
                          }
                          onMouseUp={stopAdjusting}
                          onMouseLeave={stopAdjusting}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            startAdjusting(() => setHeight((h) => Math.min(250, h + 1)));
                          }}
                          onTouchEnd={stopAdjusting}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4">
                <Button
                  className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wide shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98]"
                  onClick={nextStep}
                  disabled={!gender}
                >
                  ÉTAPE SUIVANTE <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col"
            >
              <div>
                <h2 className="text-2xl font-black uppercase leading-tight tracking-tight">
                  NIVEAU DE <br />
                  <span className="text-blue-600">PERFORMANCE.</span>
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  ÉVALUATION DES MAXIMA ACTUELS
                </p>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
                {(Object.keys(exercises) as ExerciseType[]).map((exo) => {
                  const level = getStrengthLevel(exo);
                  const isEnabled = exercises[exo].enabled;
                  return (
                    <div
                      key={exo}
                      className={cn(
                        'rounded-[2.5rem] border-2 p-6 transition-all duration-500',
                        isEnabled
                          ? 'bg-white border-slate-100 shadow-md shadow-slate-200/50'
                          : 'bg-slate-50 border-transparent opacity-40'
                      )}
                    >
                      <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'w-14 h-14 rounded-[1.25rem] flex items-center justify-center transition-all shadow-lg',
                              isEnabled
                                ? 'bg-slate-900 text-white shadow-slate-900/20'
                                : 'bg-slate-200 text-slate-400 shadow-none'
                            )}
                          >
                            <Target className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="text-base font-black uppercase tracking-tight">{exo}</h3>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-[8px] font-black tracking-widest uppercase',
                                  level.color
                                )}
                              >
                                {level.label}
                              </span>
                              <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                  className={cn('h-full', level.color.replace('text-', 'bg-'))}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${level.pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => updateExercise(exo, 'enabled', !isEnabled)}
                          className={cn(
                            'text-[9px] font-black uppercase px-5 py-2.5 rounded-xl border-2 transition-all',
                            isEnabled
                              ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                              : 'border-slate-200 text-slate-400'
                          )}
                        >
                          {isEnabled ? 'ACTIF' : 'IGNORER'}
                        </button>
                      </div>

                      {isEnabled && (
                        <div className="space-y-8">
                          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.25rem]">
                            {['estimate', 'known'].map((m) => (
                              <button
                                key={m}
                                onClick={() =>
                                  updateExercise(exo, 'mode', m as 'estimate' | 'known')
                                }
                                className={cn(
                                  'flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all',
                                  exercises[exo].mode === m
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-500'
                                )}
                              >
                                {m === 'estimate' ? 'Estimation' : 'Saisie Directe'}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-5">
                            {exercises[exo].mode === 'estimate' ? (
                              <>
                                <div className="bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100 flex items-center justify-between">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      LEST (KG)
                                    </Label>
                                    <input
                                      type="number"
                                      value={exercises[exo].addedWeight}
                                      onChange={(e) =>
                                        updateExercise(exo, 'addedWeight', Number(e.target.value))
                                      }
                                      className="w-16 text-2xl font-black italic bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-12 w-12 rounded-xl bg-white shadow-sm border-slate-200 active:scale-90"
                                      onMouseDown={() =>
                                        startAdjusting(() =>
                                          adjustExerciseValue(exo, 'addedWeight', -1)
                                        )
                                      }
                                      onMouseUp={stopAdjusting}
                                      onMouseLeave={stopAdjusting}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        startAdjusting(() =>
                                          adjustExerciseValue(exo, 'addedWeight', -1)
                                        );
                                      }}
                                      onTouchEnd={stopAdjusting}
                                    >
                                      <Minus className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-12 w-12 rounded-xl bg-white shadow-sm border-slate-200 active:scale-90"
                                      onMouseDown={() =>
                                        startAdjusting(() =>
                                          adjustExerciseValue(exo, 'addedWeight', 1)
                                        )
                                      }
                                      onMouseUp={stopAdjusting}
                                      onMouseLeave={stopAdjusting}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        startAdjusting(() =>
                                          adjustExerciseValue(exo, 'addedWeight', 1)
                                        );
                                      }}
                                      onTouchEnd={stopAdjusting}
                                    >
                                      <Plus className="h-5 w-5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100 flex items-center justify-between">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                      RÉPÉTITIONS
                                    </Label>
                                    <input
                                      type="number"
                                      value={exercises[exo].reps}
                                      onChange={(e) =>
                                        updateExercise(exo, 'reps', Number(e.target.value))
                                      }
                                      className="w-16 text-2xl font-black italic bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-12 w-12 rounded-xl bg-white shadow-sm border-slate-200 active:scale-90"
                                      onMouseDown={() =>
                                        startAdjusting(() => adjustExerciseValue(exo, 'reps', -1))
                                      }
                                      onMouseUp={stopAdjusting}
                                      onMouseLeave={stopAdjusting}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        startAdjusting(() => adjustExerciseValue(exo, 'reps', -1));
                                      }}
                                      onTouchEnd={stopAdjusting}
                                    >
                                      <Minus className="h-5 w-5" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-12 w-12 rounded-xl bg-white shadow-sm border-slate-200 active:scale-90"
                                      onMouseDown={() =>
                                        startAdjusting(() => adjustExerciseValue(exo, 'reps', 1))
                                      }
                                      onMouseUp={stopAdjusting}
                                      onMouseLeave={stopAdjusting}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        startAdjusting(() => adjustExerciseValue(exo, 'reps', 1));
                                      }}
                                      onTouchEnd={stopAdjusting}
                                    >
                                      <Plus className="h-5 w-5" />
                                    </Button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="bg-slate-50/50 p-6 rounded-[1.5rem] border border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    MAX TOTAL (KG)
                                  </Label>
                                  <input
                                    type="number"
                                    value={exercises[exo].max}
                                    onChange={(e) =>
                                      updateExercise(exo, 'max', Number(e.target.value))
                                    }
                                    className="w-16 text-2xl font-black italic bg-transparent border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-xl bg-white shadow-sm border-slate-200 active:scale-90"
                                    onMouseDown={() =>
                                      startAdjusting(() => adjustExerciseValue(exo, 'max', -1))
                                    }
                                    onMouseUp={stopAdjusting}
                                    onMouseLeave={stopAdjusting}
                                    onTouchStart={(e) => {
                                      e.preventDefault();
                                      startAdjusting(() => adjustExerciseValue(exo, 'max', -1));
                                    }}
                                    onTouchEnd={stopAdjusting}
                                  >
                                    <Minus className="h-5 w-5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-xl bg-white shadow-sm border-slate-200 active:scale-90"
                                    onMouseDown={() =>
                                      startAdjusting(() => adjustExerciseValue(exo, 'max', 1))
                                    }
                                    onMouseUp={stopAdjusting}
                                    onMouseLeave={stopAdjusting}
                                    onTouchStart={(e) => {
                                      e.preventDefault();
                                      startAdjusting(() => adjustExerciseValue(exo, 'max', 1));
                                    }}
                                    onTouchEnd={stopAdjusting}
                                  >
                                    <Plus className="h-5 w-5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  className="h-12 w-12 rounded-2xl border-slate-200 shadow-sm transition-all active:scale-90"
                  onClick={prevStep}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wide shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98]"
                  onClick={nextStep}
                >
                  CONFIRMER LES PERFORMANCES <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 flex-1 flex flex-col"
            >
              <div>
                <h2 className="text-2xl font-black uppercase leading-tight tracking-tight">
                  PLANIFICATION <br />
                  <span className="text-blue-600">HEBDOMADAIRE.</span>
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  DISPONIBILITÉ ET OBJECTIF
                </p>
              </div>

              <div className="bg-slate-900 rounded-[2rem] p-6 space-y-6 relative overflow-hidden shadow-2xl shadow-slate-900/20">
                <div className="space-y-2 relative z-10">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> JOURS D&apos;ENTRAÎNEMENT
                  </h3>
                </div>

                <div className="flex justify-between gap-2 relative z-10">
                  {DAYS.map((day, idx) => {
                    const dNum = idx + 1;
                    const active = trainingDays.includes(dNum);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleDay(dNum)}
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center font-black text-[10px] transition-all duration-300',
                          active
                            ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 scale-110'
                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 relative z-10">
                  <div className="flex justify-between text-[8px] font-black uppercase text-slate-500 tracking-widest">
                    <span>PROGRESSION</span>
                    <span
                      className={trainingDays.length === 4 ? 'text-emerald-400' : 'text-blue-400'}
                    >
                      {trainingDays.length} / 4 JOURS
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full transition-colors duration-500',
                        trainingDays.length === 4 ? 'bg-emerald-500' : 'bg-blue-600'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${(trainingDays.length / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Activity className="w-3 h-3" /> OBJECTIF DU PROGRAMME
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {PROGRAMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setGoalProgram(p.id)}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                        goalProgram === p.id
                          ? 'border-blue-600 bg-blue-50/30'
                          : 'border-slate-100 bg-white opacity-60'
                      )}
                    >
                      <span
                        className={cn(
                          'text-[9px] font-black',
                          goalProgram === p.id ? 'text-blue-600' : 'text-slate-400'
                        )}
                      >
                        {p.label}
                      </span>
                      <span className="text-[7px] font-medium text-slate-400 uppercase text-center leading-tight">
                        {p.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-4 flex gap-4">
                <Button
                  variant="outline"
                  className="h-12 w-12 rounded-2xl border-slate-200 shadow-sm transition-all active:scale-90"
                  onClick={prevStep}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  className="flex-1 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wide shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 transition-all active:scale-[0.98]"
                  onClick={handleComplete}
                  disabled={trainingDays.length !== 4 || isSubmitting}
                >
                  CRÉER MON PROGRAMME <TrendingUp className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center mt-10 text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">
        STREET FLOW • PERFORMANCE ENGINE v1.2.5
      </p>
    </div>
  );
}
