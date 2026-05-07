'use client';

import { useStore, getSessionTemplate, progressionMatrix, calculate1RM, motivationalMessages, ExerciseType } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dumbbell, Scale, Trophy, ChevronRight, 
  ChevronLeft, Check, Plus, Minus, Target, 
  TrendingUp, Calendar, ArrowRight, LogOut,
  Activity, Info, Loader2, History, Pencil,
  Clock, Flame, Home, User, BarChart3,
  Quote, CalendarDays, Zap
} from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function App() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const { 
    profile, trainingLogs, loading, fetchProfile, fetchTrainingLogs, updatePerformance, updateBodyweight, signOut 
  } = useStore();

  const [currentView, setCurrentView] = useState<'home' | 'sessions' | 'profile'>('home');
  
  // Training State
  const [bwInput, setBwInput] = useState(75);
  const [lestInput, setLestInput] = useState(0);
  const [repsInput, setRepsInput] = useState(5);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [isDone, setIsDone] = useState(false);
  
  // Profile State
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [newBw, setNewBw] = useState(75);

  // Continuous adjustment logic
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const startAdjusting = (adjustFn: () => void) => {
    adjustFn();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(adjustFn, 80);
    }, 500);
  };

  const stopAdjusting = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    return () => stopAdjusting();
  }, []);

  const quote = useMemo(() => {
    return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        await fetchProfile();
        setHasMounted(true);
      }
    };
    checkUser();
  }, [fetchProfile, router]);

  useEffect(() => {
    if (profile) {
      fetchTrainingLogs();
      setBwInput(profile.current_bodyweight);
      setNewBw(profile.current_bodyweight);
    }
  }, [profile, fetchTrainingLogs]);

  const oneRMs = useMemo(() => ({
    'Muscle-up': profile?.max_muscleup || 0,
    'Tractions': profile?.max_pullup || 0,
    'Dips': profile?.max_dip || 0,
    'Squat': profile?.max_squat || 0,
  }), [profile]);

  const bodyWeight = profile?.current_bodyweight || 75;

  const template = useMemo(() => {
    const t = getSessionTemplate(currentWeek, currentDay, oneRMs, bodyWeight);
    const main = t.exercises.find(e => e.isMain);
    if (main && typeof main.weight === 'number') {
      setLestInput(main.weight);
      setRepsInput(parseInt(main.reps));
    }
    setIsDone(false);
    return t;
  }, [currentWeek, currentDay, oneRMs, bodyWeight]);

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
      toast.success("NOUVEAU RECORD !", {
        description: `${template.mainExercise} : ${Math.round(new1RM * 10) / 10}kg 🔥`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });
    } else {
      toast.info("Performance validée");
    }
    setIsDone(true);
  };

  const handleUpdateBw = async () => {
    await updateBodyweight(newBw);
    setBwInput(newBw);
    setIsWeightDialogOpen(false);
    toast.success("Poids mis à jour");
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
      {/* Top Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight italic uppercase">
            Street <span className="text-blue-600">Flow</span>
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleLogout} className="text-slate-400 hover:text-red-500">
          <LogOut className="w-4 h-4" />
        </Button>
      </nav>

      <main className="px-4 py-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Welcome & Motivation */}
              <div className="space-y-2">
                <h1 className="text-3xl font-black text-slate-900 uppercase italic leading-tight">Salut Champion !</h1>
                <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                   <Quote className="absolute -right-4 -top-4 w-24 h-24 text-white/10" />
                   <p className="relative z-10 font-bold italic text-lg leading-snug">
                     &quot;{quote}&quot;
                   </p>
                </div>
              </div>

              {/* Today's Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
                     <CalendarDays className="w-3 h-3" /> Aujourd&apos;hui
                   </h2>
                   <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px] uppercase tracking-tighter">W{currentWeek} • J{currentDay}</Badge>
                </div>
                
                <Card className="bg-white border-slate-100 rounded-[2rem] shadow-sm overflow-hidden" onClick={() => setCurrentView('sessions')}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-slate-900 uppercase italic">{template.title}</p>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1 text-slate-400">
                           <Target className="w-3 h-3" />
                           <span className="text-[10px] font-bold uppercase">{template.mainExercise}</span>
                         </div>
                         <div className="flex items-center gap-1 text-slate-400">
                           <Dumbbell className="w-3 h-3" />
                           <span className="text-[10px] font-bold uppercase">{template.exercises.length} Exos</span>
                         </div>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                   <div className="flex items-center gap-2 mb-2">
                     <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center">
                       <Zap className="w-3 h-3 text-amber-500 fill-current" />
                     </div>
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Sessions</span>
                   </div>
                   <p className="text-3xl font-black text-slate-800">{trainingLogs.length}</p>
                </div>
                <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                   <div className="flex items-center gap-2 mb-2">
                     <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center">
                       <BarChart3 className="w-3 h-3 text-emerald-500" />
                     </div>
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Moyenne 1RM</span>
                   </div>
                   <p className="text-3xl font-black text-slate-800">
                     {trainingLogs.length > 0 
                       ? Math.round(trainingLogs.reduce((acc, log) => acc + log.calculated_1rm, 0) / trainingLogs.length)
                       : 0}
                     <span className="text-sm font-bold ml-1">kg</span>
                   </p>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'sessions' && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Training Logic (Existing) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Badge className="bg-blue-600/10 text-blue-600 border-none px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider">
                      Programme Force • W{currentWeek} • J{currentDay}
                    </Badge>
                    <h2 className="text-2xl font-black text-slate-900 uppercase italic leading-tight">{template.title}</h2>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl border-slate-100" onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}>
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl border-slate-100" onClick={() => setCurrentDay(Math.min(4, currentDay + 1))}>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-1">
                  {progressionMatrix.slice(0, 9).map((step) => (
                    <div 
                      key={step.week}
                      className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                        currentWeek === step.week ? 'bg-blue-600' : currentWeek > step.week ? 'bg-blue-200' : 'bg-slate-200'
                      }`}
                      onClick={() => setCurrentWeek(step.week)}
                    />
                  ))}
                </div>

                <Card className="bg-white border-slate-100 shadow-xl shadow-blue-500/5 rounded-[2.5rem] overflow-hidden">
                  <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
                    <span className="text-white font-black uppercase italic text-[10px] flex items-center gap-2 tracking-[0.2em]">
                      <Target className="w-4 h-4" /> Exercice Principal
                    </span>
                    <span className="text-[10px] text-blue-100 font-bold uppercase tracking-wider">Base: {Math.round(oneRMs[template.mainExercise])}kg</span>
                  </div>
                  
                  <CardContent className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase italic">{template.mainExercise}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          Objectif : {Math.round((progressionMatrix.find(s => s.week === currentWeek)?.pct || 0) * 100)}% d&apos;intensité
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-4xl font-black text-blue-600 tracking-tighter">{lestInput}kg</span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cible Lest</p>
                      </div>
                    </div>

                        <div className="space-y-3">
                          {[
                            { label: 'Poids de Corps', value: bwInput, setter: setBwInput, step: 0.5, unit: 'kg' },
                            { label: 'Lest Réel', value: lestInput, setter: setLestInput, step: 0.5, unit: 'kg' },
                            { label: 'Reps Réelles', value: repsInput, setter: setRepsInput, step: 1, unit: '' }
                          ].map((field) => (
                            <div key={field.label} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100/50 flex items-center justify-between">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{field.label}</Label>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-10 w-10 rounded-xl bg-white shadow-sm border-slate-200" 
                                  onMouseDown={() => startAdjusting(() => field.setter(prev => prev - field.step))}
                                  onMouseUp={stopAdjusting}
                                  onMouseLeave={stopAdjusting}
                                  onTouchStart={(e) => { e.preventDefault(); startAdjusting(() => field.setter(prev => prev - field.step)); }}
                                  onTouchEnd={stopAdjusting}
                                >
                                  <Minus className="w-4 h-4 text-slate-600" />
                                </Button>
                                <div className="w-20 text-center">
                                  <Input 
                                    type="number" 
                                    value={field.value} 
                                    onChange={(e) => field.setter(parseFloat(e.target.value) || 0)}
                                    className="text-xl font-black text-slate-800 text-center border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
                                  />
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-10 w-10 rounded-xl bg-white shadow-sm border-slate-200" 
                                  onMouseDown={() => startAdjusting(() => field.setter(prev => prev + field.step))}
                                  onMouseUp={stopAdjusting}
                                  onMouseLeave={stopAdjusting}
                                  onTouchStart={(e) => { e.preventDefault(); startAdjusting(() => field.setter(prev => prev + field.step)); }}
                                  onTouchEnd={stopAdjusting}
                                >
                                  <Plus className="w-4 h-4 text-slate-600" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                    <Button 
                      onClick={handleValidateMain}
                      disabled={isDone || loading}
                      className="w-full h-16 rounded-[1.25rem] bg-blue-600 hover:bg-blue-700 text-white font-black text-xl uppercase italic shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : isDone ? <Check className="w-6 h-6" /> : "Valider la séance"}
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 px-1">
                    <Activity className="w-3 h-3" /> Travail Accessoire
                  </h4>
                  <div className="space-y-2">
                    {template.exercises.filter(e => !e.isMain).map((ex) => (
                      <Card key={ex.name} className="bg-white border-slate-100 rounded-2xl shadow-sm border-l-4 border-l-blue-100">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                              <Dumbbell className="w-5 h-5 text-slate-400" />
                            </div>
                            <div>
                              <p className="font-black text-slate-800 text-sm uppercase italic tracking-tight">{ex.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ex.sets} séries • {ex.reps} reps</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-slate-700 italic">{typeof ex.weight === 'number' ? `${ex.weight}kg` : ex.weight}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              {/* History Section (Fixed) */}
              <div className="space-y-4 pt-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 px-1">
                    <History className="w-3 h-3" /> Historique récent
                  </h4>
                  <div className="space-y-3">
                    {trainingLogs.slice(0, 10).map((log, idx) => (
                      <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
                        <div className="space-y-1">
                           <div className="flex items-center gap-2">
                             <span className="font-black text-slate-900 uppercase italic text-xs">{log.exercise_type}</span>
                             <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                               {new Date(log.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                             </span>
                           </div>
                           <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-tighter">
                             <span>Lest: +{log.weight_added}kg</span>
                             <span>•</span>
                             <span>{log.reps_done} reps</span>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="flex items-center gap-1 justify-end text-blue-600">
                             <Flame className="w-3 h-3 fill-current" />
                             <span className="text-lg font-black italic">{Math.round(log.calculated_1rm * 10) / 10}kg</span>
                           </div>
                           <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">1RM Estimé</p>
                        </div>
                      </div>
                    ))}
                    {trainingLogs.length === 0 && (
                      <p className="text-center py-10 text-slate-400 font-bold text-xs uppercase tracking-widest italic">Aucun historique disponible</p>
                    )}
                  </div>
              </div>
            </motion.div>
          )}

          {currentView === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Header Profile */}
              <div className="flex flex-col items-center gap-4 py-4">
                 <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                    <User className="w-12 h-12 text-white" />
                 </div>
                 <div className="text-center space-y-1">
                   <h2 className="text-2xl font-black text-slate-900 uppercase italic">Profil Athlète</h2>
                   <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[9px] uppercase tracking-widest px-3">Niveau Intermédiaire</Badge>
                 </div>
              </div>

              {/* Bodyweight Card */}
              <Card className="bg-white border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                <CardContent className="p-6 flex items-center justify-between">
                   <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                       <Scale className="w-3 h-3" /> Poids Actuel
                     </p>
                     <p className="text-3xl font-black text-slate-800">{bodyWeight}<span className="text-sm font-bold text-slate-400 ml-1">kg</span></p>
                   </div>
                   <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
                    <DialogTrigger
                      render={
                        <Button variant="outline" size="sm" className="rounded-xl border-slate-200 font-bold uppercase text-[10px] italic h-10 px-4">
                          Modifier <Pencil className="w-3 h-3 ml-2" />
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-[400px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                      <div className="bg-slate-900 p-6 text-white">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                            <Scale className="w-5 h-5 text-blue-400" /> Mon Poids Actuel
                          </DialogTitle>
                        </DialogHeader>
                      </div>
                      
                      <div className="p-8 bg-white space-y-8">
                        <div className="flex items-center justify-between gap-4">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-16 w-16 rounded-2xl border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 transition-all active:scale-90" 
                            onMouseDown={() => startAdjusting(() => setNewBw(prev => Math.max(0, prev - 0.5)))}
                            onMouseUp={stopAdjusting}
                            onMouseLeave={stopAdjusting}
                            onTouchStart={(e) => { e.preventDefault(); startAdjusting(() => setNewBw(prev => Math.max(0, prev - 0.5))); }}
                            onTouchEnd={stopAdjusting}
                          >
                            <Minus className="w-6 h-6" />
                          </Button>
                          
                          <div className="flex-1 text-center group">
                            <div className="relative">
                              <Input 
                                type="number" 
                                value={newBw} 
                                onChange={(e) => setNewBw(parseFloat(e.target.value) || 0)}
                                className="text-5xl font-black text-center border-none shadow-none focus-visible:ring-0 p-0 h-auto text-slate-900"
                              />
                              <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full mt-1 group-focus-within:w-24 transition-all duration-300" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 block">Kilogrammes</span>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-16 w-16 rounded-2xl border-2 border-slate-100 hover:border-blue-600 hover:text-blue-600 transition-all active:scale-90" 
                            onMouseDown={() => startAdjusting(() => setNewBw(prev => prev + 0.5))}
                            onMouseUp={stopAdjusting}
                            onMouseLeave={stopAdjusting}
                            onTouchStart={(e) => { e.preventDefault(); startAdjusting(() => setNewBw(prev => prev + 0.5)); }}
                            onTouchEnd={stopAdjusting}
                          >
                            <Plus className="w-6 h-6" />
                          </Button>
                        </div>

                        <div className="pt-2">
                          <Button 
                            onClick={handleUpdateBw} 
                            className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase italic rounded-2xl text-lg shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]"
                          >
                            Confirmer la mise à jour
                          </Button>
                          <p className="text-center text-[9px] text-slate-400 font-bold uppercase mt-4 tracking-wider">
                            Ton programme s&apos;adaptera automatiquement à ton nouveau poids
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Records Grid */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 px-1">
                    <Trophy className="w-3 h-3 text-amber-500" /> Records Personnels (1RM)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Tractions', 'Dips', 'Muscle-up', 'Squat'] as ExerciseType[]).map((ex) => (
                      <div key={ex} className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-slate-50 rounded-bl-[2rem] -mr-4 -mt-4 opacity-50" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{ex}</p>
                        <p className="text-2xl font-black text-slate-800 italic">{Math.round(oneRMs[ex])}<span className="text-[10px] ml-1 text-slate-400 uppercase">kg</span></p>
                      </div>
                    ))}
                  </div>
              </div>

              {/* App Info / Other things */}
              <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-4 relative overflow-hidden">
                  <div className="relative z-10 space-y-4">
                    <h3 className="font-black uppercase italic text-sm tracking-wider flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-400" /> Progression Street Flow
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      Ton programme suit une progression linéaire sur 9 semaines. Assure-toi de valider chaque séance principale pour que tes 1RM soient recalculés dynamiquement.
                    </p>
                    <div className="flex gap-2">
                       <Badge className="bg-blue-500/20 text-blue-400 border-none font-black text-[8px] uppercase tracking-widest px-2">Cycle: Force</Badge>
                       <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-black text-[8px] uppercase tracking-widest px-2">Statut: Actif</Badge>
                    </div>
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md h-20 bg-white/90 backdrop-blur-2xl border border-slate-200/50 rounded-[2.5rem] shadow-2xl shadow-slate-900/5 px-6 flex items-center justify-between z-50">
         {[
           { id: 'home', icon: Home, label: 'Accueil' },
           { id: 'sessions', icon: Dumbbell, label: 'Séances' },
           { id: 'profile', icon: User, label: 'Profil' }
         ].map((item) => (
           <button
             key={item.id}
             onClick={() => setCurrentView(item.id as any)}
             className={cn(
               "flex flex-col items-center gap-1 transition-all relative px-4 py-2 rounded-2xl",
               currentView === item.id ? "text-blue-600 scale-110" : "text-slate-400 hover:text-slate-600"
             )}
           >
             <item.icon className={cn("w-6 h-6", currentView === item.id ? "fill-blue-600/10" : "")} />
             <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
             {currentView === item.id && (
               <motion.div layoutId="nav-indicator" className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
             )}
           </button>
         ))}
      </div>
    </div>
  );
}
