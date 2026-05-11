'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore, ExerciseType } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calculateTrendline } from '@/lib/utils';
import { Activity, Trophy, BarChart3, Flame, Lock, CalendarDays } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, addDays, subMonths, isAfter, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProgressionView() {
  const { profile, exerciseLogs, completedSessions } = useStore();
  const [activeExercise, setActiveExercise] = useState<ExerciseType>('Muscle-up');

  // Filtrer les logs des 3 derniers mois pour l'exercice sélectionné
  const filteredLogs = useMemo(() => {
    const threeMonthsAgo = subMonths(new Date(), 3);
    return exerciseLogs
      .filter(
        (log) =>
          log.exercise_name === activeExercise &&
          log.date &&
          isAfter(new Date(log.date), threeMonthsAgo)
      )
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  }, [exerciseLogs, activeExercise]);

  // Préparation des données pour le graphique avec la trendline
  const chartData = useMemo(() => {
    if (filteredLogs.length < 2) return [];

    const startTime = new Date(filteredLogs[0].date).getTime();

    // Convertir les logs en points (x: jours écoulés, y: 1RM)
    const dataPoints = filteredLogs.map((log) => ({
      x: (new Date(log.date).getTime() - startTime) / (1000 * 60 * 60 * 24),
      y: log.calculated_1rm,
      date: new Date(log.date),
      actual1RM: log.calculated_1rm,
    }));

    const trend = calculateTrendline(dataPoints.map((p) => ({ x: p.x, y: p.y })));

    if (!trend) return [];

    // Ajouter les points réels
    const chart = dataPoints.map((p) => ({
      date: format(p.date, 'dd MMM', { locale: fr }),
      '1RM Estimé': Math.round(p.y * 10) / 10,
      Tendance: Math.round((trend.slope * p.x + trend.intercept) * 10) / 10,
      isProjection: false,
    }));

    // Ajouter la prévision à +30 jours après le dernier point
    const lastPoint = dataPoints[dataPoints.length - 1];
    const futureX = lastPoint.x + 30;
    const futureDate = addDays(lastPoint.date, 30);
    const projectedY = trend.slope * futureX + trend.intercept;

    chart.push({
      date: format(futureDate, 'dd MMM', { locale: fr }) + ' (Proj)',
      '1RM Estimé': null as unknown as number,
      Tendance: Math.round(projectedY * 10) / 10,
      isProjection: true,
    });

    return chart;
  }, [filteredLogs]);

  // KPIs
  const kpis = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const lastLog = filteredLogs[filteredLogs.length - 1];
    const bw = profile?.body_weight || 75;

    // Volume du dernier set principal = (Poids de corps + Lest) * Reps
    const lastVolume = (bw + lastLog.added_weight) * lastLog.reps;

    return {
      last1RM: lastLog.calculated_1rm,
      lastVolume: lastVolume,
      date: new Date(lastLog.date!),
    };
  }, [filteredLogs, profile]);

  // Historique des PR (nouveaux records chronologiques)
  const prHistory = useMemo(() => {
    const prs: typeof exerciseLogs = [];
    let currentMax = 0;

    // exerciseLogs est trié du plus récent au plus ancien, on doit l'inverser pour trouver les PRs
    const chronologicalLogs = [...exerciseLogs]
      .filter((log) => log.exercise_name === activeExercise && log.date)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

    for (const log of chronologicalLogs) {
      if (log.calculated_1rm > currentMax) {
        currentMax = log.calculated_1rm;
        prs.push(log);
      }
    }

    // Renvoyer les plus récents en premier
    return prs.reverse().slice(0, 5);
  }, [exerciseLogs, activeExercise]);

  const hasEnoughData = filteredLogs.length >= 3;

  return (
    <motion.div
      key="progression"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="space-y-1 text-center py-2">
        <h2 className="text-2xl font-black text-slate-900 uppercase italic">Progression</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Analyse tes performances et projections
        </p>
      </div>

      {/* Sélecteur d'Exercice */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        {(['Tractions', 'Dips', 'Muscle-up', 'Squat'] as ExerciseType[]).map((ex) => (
          <Button
            key={ex}
            variant={activeExercise === ex ? 'default' : 'outline'}
            onClick={() => setActiveExercise(ex)}
            className={`rounded-xl whitespace-nowrap text-xs font-black uppercase italic tracking-wider h-10 ${
              activeExercise === ex
                ? 'bg-blue-600 text-white border-none shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {ex}
          </Button>
        ))}
      </div>

      {/* KPIs Dashboard */}
      {kpis ? (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-white border-slate-100 rounded-3xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Activity className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Dernier 1RM
                </span>
              </div>
              <p className="text-2xl font-black text-slate-800 italic">
                {Math.round(kpis.last1RM * 10) / 10}
                <span className="text-xs font-bold text-slate-400 ml-1 not-italic">kg</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-100 rounded-3xl shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-amber-50 rounded-lg flex items-center justify-center">
                  <Flame className="w-3 h-3 text-amber-500 fill-current" />
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Volume (Set)
                </span>
              </div>
              <p className="text-2xl font-black text-slate-800 italic">
                {Math.round(kpis.lastVolume)}
                <span className="text-xs font-bold text-slate-400 ml-1 not-italic">kg</span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="bg-slate-100/50 border border-slate-200/50 border-dashed rounded-3xl p-6 text-center">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">
            Aucune donnée pour le moment
          </p>
        </div>
      )}

      {/* Heatmap d'assiduité */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 px-1">
          <CalendarDays className="w-3 h-3 text-emerald-500" /> Assiduité (12 semaines)
        </h4>
        <div className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm">
          <div className="grid grid-rows-7 gap-1.5 grid-flow-col overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 84 }).map((_, i) => {
              const d = subDays(new Date(), 83 - i);
              const dateStr = format(d, 'yyyy-MM-dd');
              const sessionDates = new Set(
                completedSessions.map((s) => format(new Date(s.date), 'yyyy-MM-dd'))
              );
              const isActive = sessionDates.has(dateStr);
              return (
                <div
                  key={dateStr}
                  title={dateStr}
                  className={`w-3.5 h-3.5 rounded-sm flex-shrink-0 transition-all ${isActive ? 'bg-emerald-500 shadow-sm shadow-emerald-500/40' : 'bg-slate-100'}`}
                />
              );
            })}
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 text-center">
            Ne brise pas la chaîne
          </p>
        </div>
      </div>

      {/* Graphique de Performance */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 px-1">
          <BarChart3 className="w-3 h-3 text-blue-600" /> Évolution & Tendance (3 mois)
        </h4>

        <Card className="bg-white border-slate-100 rounded-[2rem] shadow-sm overflow-hidden relative">
          {!hasEnoughData && (
            <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-black text-slate-800 uppercase italic">
                Débloque tes prévisions
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                Continue à t&apos;entraîner ! Il nous faut au moins 3 séances de {activeExercise}{' '}
                pour calculer ta tendance.
              </p>
            </div>
          )}

          <CardContent className="p-6 pt-8 pb-4">
            <div className="h-64 w-full">
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                      domain={['dataMin - 5', 'dataMax + 10']}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '1rem',
                        border: 'none',
                        boxShadow:
                          '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                        fontWeight: 800,
                        fontSize: '12px',
                      }}
                      labelStyle={{
                        color: '#64748b',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        fontSize: '10px',
                        letterSpacing: '0.1em',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Tendance"
                      stroke="#cbd5e1"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="1RM Estimé"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#2563eb' }}
                      activeDot={{ r: 6, fill: '#2563eb', stroke: '#bfdbfe', strokeWidth: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique Simplifié des PRs */}
      <div className="space-y-4 pb-4">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2 px-1">
          <Trophy className="w-3 h-3 text-emerald-500" /> Historique des Records (PR)
        </h4>

        <div className="space-y-3">
          {prHistory.length > 0 ? (
            prHistory.map((pr, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors"
              >
                {idx === 0 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
                <div className="space-y-1 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 uppercase italic text-xs">
                      {pr.exercise_name}
                    </span>
                    {idx === 0 && (
                      <Badge className="bg-emerald-50 text-emerald-600 border-none px-1.5 py-0 text-[8px] font-black uppercase tracking-widest">
                        Actuel
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {format(new Date(pr.date), 'dd MMMM yyyy', { locale: fr })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-800 italic">
                    {Math.round(pr.calculated_1rm * 10) / 10}
                    <span className="text-[10px] text-slate-400 ml-1">kg</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                Enregistre tes premières séances pour voir tes records
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
