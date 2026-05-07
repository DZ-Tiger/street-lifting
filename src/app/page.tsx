'use client';

import { useStore, getSessionTemplate, progressionMatrix, calculate1RM } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dumbbell,
  Scale,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Minus,
  Target,
  TrendingUp,
  ArrowRight,
  LogOut,
  Activity,
  Info,
  Loader2,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const { profile, loading, fetchProfile, updatePerformance, signOut } = useStore();

  const [bwInput, setBwInput] = useState(75);
  const [lestInput, setLestInput] = useState(0);
  const [repsInput, setRepsInput] = useState(5);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        await fetchProfile();
        setHasMounted(true);
      }
    };
    checkUser();
  }, [fetchProfile, router]);

  const oneRMs = useMemo(
    () => ({
      'Muscle-up': profile?.max_muscleup || 0,
      Tractions: profile?.max_pullup || 0,
      Dips: profile?.max_dip || 0,
      Squat: profile?.max_squat || 0,
    }),
    [profile]
  );

  const bodyWeight = profile?.current_bodyweight || 75;

  const template = useMemo(() => {
    return getSessionTemplate(currentWeek, currentDay, oneRMs, bodyWeight);
  }, [currentWeek, currentDay, oneRMs, bodyWeight]);

  useEffect(() => {
    const main = template.exercises.find((e) => e.isMain);
    if (main && typeof main.weight === 'number') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLestInput(main.weight);

      setRepsInput(parseInt(main.reps));
    }

    setBwInput(bodyWeight);

    setIsDone(false);
  }, [template, bodyWeight]);

  if (!hasMounted || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const handleValidateMain = async () => {
    await updatePerformance(template.mainExercise, bwInput, lestInput, repsInput);

    const old1RM = oneRMs[template.mainExercise];
    const new1RM = calculate1RM(bwInput, lestInput, repsInput);

    if (new1RM > old1RM) {
      toast.success('NOUVEAU RECORD !', {
        description: `${template.mainExercise} : ${Math.round(new1RM * 10) / 10}kg 🔥`,
        className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      });
    } else {
      toast.info('Performance validée');
    }
    setIsDone(true);
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight italic uppercase">
            Street <span className="text-blue-600">Flow</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-slate-400 hover:text-red-500"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </nav>

      <main className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar -mx-4 px-4">
          <div className="flex-shrink-0 bg-white border border-slate-100 p-4 rounded-2xl min-w-[120px] shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
              <Scale className="w-3 h-3" /> Poids
            </p>
            <p className="text-xl font-black text-slate-800">{bodyWeight}kg</p>
          </div>
          {(['Muscle-up', 'Tractions', 'Dips', 'Squat'] as const).map((ex) => (
            <div
              key={ex}
              className="flex-shrink-0 bg-white border border-slate-100 p-4 rounded-2xl min-w-[120px] shadow-sm"
            >
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                <Trophy className="w-3 h-3 text-amber-500" /> {ex}
              </p>
              <p className="text-xl font-black text-slate-800">{Math.round(oneRMs[ex])}kg</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Badge className="bg-blue-600/10 text-blue-600 border-none px-2 py-0.5 font-bold text-[10px] uppercase">
                W{currentWeek} • Jour {currentDay}
              </Badge>
              <h2 className="text-2xl font-black text-slate-900 uppercase italic leading-tight">
                {template.title}
              </h2>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-xl border-slate-100"
                onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-xl border-slate-100"
                onClick={() => setCurrentDay(Math.min(4, currentDay + 1))}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-1">
            {progressionMatrix.slice(0, 9).map((step) => (
              <div
                key={step.week}
                className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                  currentWeek === step.week
                    ? 'bg-blue-600'
                    : currentWeek > step.week
                      ? 'bg-blue-200'
                      : 'bg-slate-200'
                }`}
                onClick={() => setCurrentWeek(step.week)}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentWeek}-${currentDay}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="bg-white border-slate-100 shadow-xl shadow-blue-500/5 rounded-[2rem] overflow-hidden">
              <div className="bg-blue-600 px-6 py-3 flex justify-between items-center">
                <span className="text-white font-black uppercase italic text-xs flex items-center gap-2">
                  <Target className="w-4 h-4" /> Force
                </span>
                <span className="text-[10px] text-blue-100 font-bold uppercase">
                  Base: {Math.round(oneRMs[template.mainExercise])}kg
                </span>
              </div>

              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic">
                      {template.mainExercise}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      Objectif :{' '}
                      {Math.round(
                        (progressionMatrix.find((s) => s.week === currentWeek)?.pct || 0) * 100
                      )}
                      % d&apos;intensité
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-blue-600 tracking-tighter">
                      {lestInput}kg
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Cible Lest</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      label: 'Poids de Corps',
                      value: bwInput,
                      setter: setBwInput,
                      step: 0.5,
                      unit: 'kg',
                    },
                    {
                      label: 'Lest Réel',
                      value: lestInput,
                      setter: setLestInput,
                      step: 0.5,
                      unit: 'kg',
                    },
                    {
                      label: 'Reps Réelles',
                      value: repsInput,
                      setter: setRepsInput,
                      step: 1,
                      unit: '',
                    },
                  ].map((field) => (
                    <div
                      key={field.label}
                      className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between"
                    >
                      <Label className="text-[10px] font-black uppercase text-slate-400">
                        {field.label}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl bg-white"
                          onClick={() => field.setter(field.value - field.step)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <div className="w-16 text-center">
                          <span className="text-lg font-black text-slate-800">
                            {field.value}
                            {field.unit}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl bg-white"
                          onClick={() => field.setter(field.value + field.step)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleValidateMain}
                  disabled={isDone || loading}
                  className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black text-lg uppercase italic shadow-lg shadow-blue-500/20"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isDone ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    'Valider'
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3" /> Accessoires
              </h4>
              <div className="space-y-2">
                {template.exercises
                  .filter((e) => !e.isMain)
                  .map((ex) => (
                    <Card key={ex.name} className="bg-white border-slate-100 rounded-2xl shadow-sm">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
                            <Dumbbell className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{ex.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                              {ex.sets}x{ex.reps}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-700">
                            {typeof ex.weight === 'number' ? `${ex.weight}kg` : ex.weight}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentDay < 4) setCurrentDay(currentDay + 1);
                  else {
                    setCurrentWeek(Math.min(9, currentWeek + 1));
                    setCurrentDay(1);
                  }
                  setIsDone(false);
                }}
                className="w-full h-12 rounded-xl border-slate-200 text-slate-600 font-bold"
              >
                Prochaine séance <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="fixed bottom-6 right-6">
        <Button size="icon" className="h-12 w-12 rounded-full bg-slate-900 text-white shadow-2xl">
          <Info className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
