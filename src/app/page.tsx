'use client';

import React, { useState, useMemo, useEffect, useRef, ReactNode } from 'react';
import {
  useStore,
  getSessionTemplate,
  progressionMatrix,
  ExerciseType,
  ExerciseLog,
  CompletedSession,
  UserProfile,
  calculateAge,
} from '@/store/useStore';
import { useNutritionStore, calculateTargets } from '@/store/useNutritionStore';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { SKINS, SkinKey, SKIN_STORAGE_KEY, applySkin } from '@/lib/useSkin';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Home,
  Loader2,
  LogOut,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  TrendingUp,
  User,
  Utensils,
} from 'lucide-react';

/* ─────────────────────── Micro-components ─────────────────────── */

const NL = ({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <span
    className={`text-[10px] font-medium uppercase tracking-[0.16em] ${className}`}
    style={{ color: 'var(--muted)', ...style }}
  >
    {children}
  </span>
);

const NN = ({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <span
    className={`font-mono tabular-nums ${className}`}
    style={{
      fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)',
      fontFeatureSettings: '"tnum" 1, "ss01" 1',
      ...style,
    }}
  >
    {children}
  </span>
);

/* ─────────────────────── Stepper ─────────────────────── */

const Stepper = ({
  value,
  onChange,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) => (
  <div
    className="flex items-stretch rounded-2xl overflow-hidden border"
    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
  >
    <button
      onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
      className="w-16 flex items-center justify-center transition active:opacity-60"
      style={{ color: 'var(--fg)' }}
      aria-label="decrement"
    >
      <Minus size={24} strokeWidth={2} />
    </button>
    <div className="flex-1 flex items-baseline justify-center gap-1.5 py-4">
      <NN
        className="text-[44px] font-medium leading-none tracking-tight"
        style={{ color: 'var(--fg)' }}
      >
        {value}
      </NN>
      {suffix && <NL className="text-[10px]">{suffix}</NL>}
    </div>
    <button
      onClick={() => onChange(Math.round((value + step) * 100) / 100)}
      className="w-16 flex items-center justify-center transition active:opacity-60"
      style={{ color: 'var(--fg)' }}
      aria-label="increment"
    >
      <Plus size={24} strokeWidth={2} />
    </button>
  </div>
);

/* ─────────────────────── SmallRing ─────────────────────── */

const SmallRing = ({ pct }: { pct: number }) => {
  const r = 24;
  const s = 2.5;
  const C = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth={s} />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="var(--fg)"
        strokeWidth={s}
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C - Math.min(pct, 1) * C}
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
};

/* ─────────────────────── SparkLine ─────────────────────── */

const SparkLine = ({ data, height = 90 }: { data: number[]; height?: number }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const w = 320;
  const padX = 8;
  const xs = data.map((_, i) => padX + (i * (w - padX * 2)) / (data.length - 1));
  const ys = data.map((v) => height - 8 - ((v - min) / (max - min || 1)) * (height - 16));
  const d = data.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${ys[i]}`).join(' ');
  const area = `${d} L${xs[xs.length - 1]},${height} L${xs[0]},${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full block">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fg)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--fg)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={padX}
          x2={w - padX}
          y1={height * p}
          y2={height * p}
          stroke="var(--border)"
          strokeDasharray="1 4"
        />
      ))}
      <path d={area} fill="url(#spark-grad)" />
      <path d={d} stroke="var(--fg)" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      {xs.map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={ys[i]}
          r={i === data.length - 1 ? 3 : 1.5}
          fill={i === data.length - 1 ? 'var(--fg)' : 'var(--muted)'}
        />
      ))}
    </svg>
  );
};

/* ─────────────────────── Heatmap ─────────────────────── */

const Heatmap = ({ sessionDates }: { sessionDates: string[] }) => {
  const today = new Date();
  const days = Array.from({ length: 12 * 7 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (12 * 7 - 1 - i));
    const dateStr = date.toISOString().split('T')[0];
    const count = sessionDates.filter((d) => d.startsWith(dateStr)).length;
    return count === 0 ? 0 : count >= 3 ? 3 : count >= 2 ? 2 : 1;
  });
  const cell = (l: number) =>
    l === 0
      ? 'bg-[var(--surface-2)]'
      : l === 1
        ? 'bg-[var(--ink-3)]'
        : l === 2
          ? 'bg-[var(--ink-2)]'
          : 'bg-[var(--fg)]';
  return (
    <div>
      <div className="grid grid-rows-7 grid-flow-col gap-1">
        {days.map((d, i) => (
          <div key={i} className={`h-3 w-3 rounded-[3px] ${cell(d)}`} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <NN className="text-[9px]" style={{ color: 'var(--muted)' }}>
          12 sem.
        </NN>
        <div className="flex items-center gap-1">
          <NL className="text-[8px]">moins</NL>
          {[0, 1, 2, 3].map((l) => (
            <div key={l} className={`h-2 w-2 rounded-sm ${cell(l)}`} />
          ))}
          <NL className="text-[8px]">plus</NL>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── SHeader ─────────────────────── */

const SHeader = ({ title, right }: { title: string; right?: ReactNode }) => (
  <div
    className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0"
    style={{ background: 'var(--bg)' }}
  >
    <div
      className="text-[11px] font-medium uppercase tracking-[0.28em]"
      style={{ color: 'var(--fg)' }}
    >
      {title}
    </div>
    {right ?? <div className="h-10 w-10" />}
  </div>
);

/* ─────────────────────── Bottom Nav ─────────────────────── */

type AppView = 'home' | 'workout' | 'nutrition' | 'progress' | 'profile';

const NAV_ITEMS: {
  k: AppView;
  label: string;
  Icon: React.FC<{ size?: number; strokeWidth?: number }>;
}[] = [
  { k: 'home', label: 'Accueil', Icon: Home },
  { k: 'workout', label: 'Séances', Icon: Dumbbell },
  { k: 'nutrition', label: 'Nutrition', Icon: Utensils },
  { k: 'progress', label: 'Progrès', Icon: TrendingUp },
  { k: 'profile', label: 'Profil', Icon: User },
];

const BottomNav = ({ active, onNav }: { active: AppView; onNav: (v: AppView) => void }) => (
  <div className="absolute left-0 right-0 bottom-0 px-3 pb-3 pt-2 z-30 pointer-events-none">
    <div
      className="pointer-events-auto rounded-2xl flex items-stretch px-1.5 py-1.5 border"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--border)',
      }}
    >
      {NAV_ITEMS.map(({ k, label, Icon }) => {
        const isActive = active === k;
        return (
          <button
            key={k}
            onClick={() => onNav(k)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition"
          >
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center transition"
              style={
                isActive
                  ? { background: 'var(--fg)', color: 'var(--bg)' }
                  : { color: 'var(--muted)' }
              }
            >
              <Icon size={15} strokeWidth={1.75} />
            </div>
            <span
              className="text-[8.5px] uppercase tracking-[0.16em] font-medium"
              style={{ color: isActive ? 'var(--fg)' : 'var(--muted)' }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

/* ─────────────────────── HomeScreen ─────────────────────── */

interface HomeScreenProps {
  onNav: (v: AppView) => void;
  profileGender: 'Homme' | 'Femme' | undefined;
  completedSessionDates: string[];
  template: ReturnType<typeof getSessionTemplate>;
  nutritionTotals: { calories: number; protein: number; carbs: number; fat: number };
  nutritionTarget: number;
  currentWeek: number;
}

const HomeScreen = ({
  onNav,
  profileGender,
  completedSessionDates,
  template,
  nutritionTotals,
  nutritionTarget,
  currentWeek,
}: HomeScreenProps) => {
  const today = new Date();
  const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + i);
    const dateStr = date.toISOString().split('T')[0];
    const done = completedSessionDates.some((d) => d.startsWith(dateStr));
    return { day: DAY_LETTERS[date.getDay()], done };
  });

  const remaining = Math.max(0, nutritionTarget - nutritionTotals.calories);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader
        title="Accueil"
        right={
          <button
            className="h-10 w-10 -mr-2 flex items-center justify-center rounded-full"
            style={{ color: 'var(--fg)' }}
          >
            <Clock size={18} strokeWidth={1.5} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Date + greeting */}
        <div className="px-5 mb-5">
          <NL>
            {today.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </NL>
          <div className="mt-1 text-[28px] font-medium leading-[1.05] tracking-tight">
            Bonjour, {profileGender === 'Femme' ? 'Athlète' : 'Champion'}.
          </div>
        </div>

        {/* 7-day streak */}
        <div
          className="mx-5 mb-5 border rounded-2xl p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <NL>Activité 7 jours</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {last7.filter((d) => d.done).length} / 7
            </NN>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {last7.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className="h-9 rounded-md w-full border"
                  style={
                    d.done
                      ? { background: 'var(--fg)', borderColor: 'var(--fg)' }
                      : { borderColor: 'var(--border)' }
                  }
                />
                <NL className="text-[8px]">{d.day}</NL>
              </div>
            ))}
          </div>
        </div>

        {/* Today's workout */}
        <button onClick={() => onNav('workout')} className="block w-full text-left px-5 mb-5">
          <div className="mb-2 flex items-center justify-between">
            <NL>Séance du jour</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {template.exercises.length} exercices
            </NN>
          </div>
          <div
            className="border rounded-2xl p-4 transition hover:opacity-80"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[18px] font-medium leading-tight">{template.title}</div>
                <NN className="block mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                  {template.mainExercise} · {template.exercises.length} exos
                </NN>
              </div>
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--fg)', color: 'var(--bg)' }}
              >
                <Play size={18} strokeWidth={1.75} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {template.exercises.slice(0, 4).map((e) => (
                <div
                  key={e.name}
                  className="text-center px-2 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <NN className="block text-[10px] font-medium" style={{ color: 'var(--fg)' }}>
                    {e.name.split(' ')[0]}
                  </NN>
                </div>
              ))}
            </div>
          </div>
        </button>

        {/* Nutrition snapshot */}
        <button onClick={() => onNav('nutrition')} className="block w-full text-left px-5 mb-5">
          <div className="mb-2 flex items-center justify-between">
            <NL>Nutrition</NL>
            <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
          </div>
          <div
            className="border rounded-2xl p-4 flex items-center gap-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <SmallRing pct={nutritionTarget > 0 ? nutritionTotals.calories / nutritionTarget : 0} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <NN className="text-[22px] font-medium leading-none" style={{ color: 'var(--fg)' }}>
                  {nutritionTotals.calories.toLocaleString('fr-FR')}
                </NN>
                <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  / {nutritionTarget.toLocaleString('fr-FR')} kcal
                </NN>
              </div>
              <NN className="block mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                {remaining} restantes
              </NN>
              <div className="mt-2 flex gap-1.5">
                {[
                  { l: 'P', v: nutritionTotals.protein, shade: 'var(--fg)' },
                  { l: 'G', v: nutritionTotals.carbs, shade: 'var(--ink-2)' },
                  { l: 'L', v: nutritionTotals.fat, shade: 'var(--ink-3)' },
                ].map((m) => (
                  <div key={m.l} className="flex-1">
                    <div
                      className="h-[3px] rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div className="h-full" style={{ width: '70%', background: m.shade }} />
                    </div>
                    <NN className="block mt-1 text-[9px]" style={{ color: 'var(--muted)' }}>
                      {m.l} {m.v}g
                    </NN>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </button>

        {/* Cycle progress */}
        <div className="px-5">
          <div className="mb-2 flex items-center justify-between">
            <NL>Cycle 9 sem.</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {Math.round((currentWeek / 9) * 100)}%
            </NN>
          </div>
          <div
            className="border rounded-2xl p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-7 rounded-md border"
                  style={
                    i < currentWeek - 1
                      ? { background: 'var(--fg)', borderColor: 'var(--fg)' }
                      : i === currentWeek - 1
                        ? { borderColor: 'var(--fg)' }
                        : { borderColor: 'var(--border)' }
                  }
                />
              ))}
            </div>
            <div className="mt-3 flex justify-between">
              <NN className="text-[9px]" style={{ color: 'var(--muted)' }}>
                Sem 1
              </NN>
              <NN className="text-[9px]" style={{ color: 'var(--muted)' }}>
                Pic sem 7
              </NN>
              <NN className="text-[9px]" style={{ color: 'var(--muted)' }}>
                Test sem 9
              </NN>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── WorkoutScreen ─────────────────────── */

interface WorkoutScreenProps {
  template: ReturnType<typeof getSessionTemplate>;
  currentWeek: number;
  currentDay: number;
  setCurrentWeek: (w: number) => void;
  setCurrentDay: (d: number) => void;
  bwInput: number;
  setBwInput: (v: number) => void;
  lestInput: number;
  setLestInput: (v: number) => void;
  repsInput: number;
  setRepsInput: (v: number) => void;
  isDone: boolean;
  onValidate: () => Promise<void>;
  loading: boolean;
}

const WorkoutScreen = ({
  template,
  currentWeek,
  currentDay,
  setCurrentWeek,
  setCurrentDay,
  lestInput,
  setLestInput,
  repsInput,
  setRepsInput,
  isDone,
  onValidate,
  loading,
}: WorkoutScreenProps) => {
  const [rest, setRest] = useState(0);
  const [running, setRunning] = useState(false);
  const [exIdx, setExIdx] = useState(0);
  const [history, setHistory] = useState<{ set: number; reps: number; load: number }[]>([]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRest((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const ex = template.exercises[exIdx];

  const handleValidate = async () => {
    await onValidate();
    setHistory((h) => [...h, { set: h.length + 1, reps: repsInput, load: lestInput }]);
    setRest(0);
    setRunning(true);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader
        title="Séances"
        right={
          <div className="flex items-center gap-1 -mr-2">
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ background: 'var(--fg)' }}
            />
            <NN
              className="text-[10px] uppercase tracking-[0.18em] pr-2"
              style={{ color: 'var(--muted)' }}
            >
              REC
            </NN>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Week selector */}
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <NN className="text-[11px]" style={{ color: 'var(--muted)' }}>
              W{currentWeek} · J{currentDay}
            </NN>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                className="h-8 w-8 rounded-lg flex items-center justify-center border"
                style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentDay(Math.min(4, currentDay + 1))}
                className="h-8 w-8 rounded-lg flex items-center justify-center border"
                style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-1">
            {progressionMatrix.slice(0, 9).map((step) => (
              <div
                key={step.week}
                className="flex-1 h-1.5 rounded-full cursor-pointer"
                style={
                  currentWeek === step.week
                    ? { background: 'var(--fg)' }
                    : currentWeek > step.week
                      ? { background: 'var(--ink-3)' }
                      : { background: 'var(--surface-2)' }
                }
                onClick={() => setCurrentWeek(step.week)}
              />
            ))}
          </div>
          <NL className="block mt-2">{template.title}</NL>
        </div>

        {/* Exercise switcher */}
        <div className="px-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {template.exercises.map((e, i) => (
              <button
                key={e.name}
                onClick={() => setExIdx(i)}
                className="shrink-0 px-3 h-9 rounded-full border transition"
                style={
                  i === exIdx
                    ? {
                        background: 'var(--fg)',
                        color: 'var(--bg)',
                        borderColor: 'var(--fg)',
                      }
                    : { borderColor: 'var(--border)', color: 'var(--muted)' }
                }
              >
                <NN className="text-[11px] font-medium">{e.name}</NN>
              </button>
            ))}
          </div>
        </div>

        {/* Exercise header */}
        <div className="px-5 mt-5">
          <NL>
            Exercice {exIdx + 1}/{template.exercises.length}
          </NL>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <div className="text-[22px] font-medium leading-tight tracking-tight">{ex?.name}</div>
              <NN className="block mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                {ex?.sets} × {ex?.reps} ·{' '}
                {typeof ex?.weight === 'number' ? `+${ex.weight} kg` : ex?.weight}
              </NN>
            </div>
          </div>
        </div>

        {/* Rest timer */}
        <div
          className="mx-5 mt-5 border rounded-2xl p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <NL>Repos</NL>
            <NL>cible 2:00</NL>
          </div>
          <div className="flex items-center justify-between gap-4">
            <NN
              className="text-[64px] font-medium tracking-tight leading-none"
              style={{ color: 'var(--fg)' }}
            >
              {fmt(rest)}
            </NN>
            <button
              onClick={() => setRunning((r) => !r)}
              className="h-16 w-16 rounded-full flex items-center justify-center active:scale-95 shrink-0"
              style={{ background: 'var(--fg)', color: 'var(--bg)' }}
            >
              {running ? <Pause size={22} /> : <Play size={22} />}
            </button>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full overflow-hidden"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${Math.min((rest / 120) * 100, 100)}%`,
                background: 'var(--fg)',
              }}
            />
          </div>
        </div>

        {/* Big steppers */}
        <div className="px-5 mt-5 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <NL>Répétitions</NL>
              <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                cible {ex?.reps}
              </NN>
            </div>
            <Stepper value={repsInput} onChange={setRepsInput} suffix="reps" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <NL>Charge ajoutée</NL>
              <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                pas 2,5 kg
              </NN>
            </div>
            <Stepper value={lestInput} onChange={setLestInput} step={2.5} suffix="kg" />
          </div>
        </div>

        {/* Oversized validate button */}
        <div className="px-5 mt-5">
          <button
            onClick={handleValidate}
            disabled={isDone || loading}
            className="w-full h-20 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.99] transition disabled:opacity-50"
            style={{ background: 'var(--fg)', color: 'var(--bg)' }}
          >
            {loading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <>
                <Check size={22} strokeWidth={2.5} />
                <span className="text-[14px] font-medium uppercase tracking-[0.22em]">
                  Valider la série
                </span>
              </>
            )}
          </button>
        </div>

        {/* Set history */}
        {history.length > 0 && (
          <div className="px-5 mt-5">
            <div className="flex items-center justify-between mb-2">
              <NL>Séries validées</NL>
              <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {history.length}
              </NN>
            </div>
            <div
              className="border rounded-2xl overflow-hidden"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              {history.map((h, i) => (
                <div
                  key={i}
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'var(--fg)', color: 'var(--bg)' }}
                    >
                      <Check size={12} strokeWidth={2.5} />
                    </div>
                    <NN className="text-[12px] font-medium" style={{ color: 'var(--fg)' }}>
                      Série {h.set}
                    </NN>
                  </div>
                  <div className="flex items-baseline gap-4">
                    <NN className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                      {h.reps}
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {' '}
                        reps
                      </span>
                    </NN>
                    <NN className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                      +{h.load}
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {' '}
                        kg
                      </span>
                    </NN>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────── ProgressScreen ─────────────────────── */

interface ProgressScreenProps {
  exerciseLogs: ExerciseLog[];
  completedSessions: CompletedSession[];
  oneRMs: Record<ExerciseType, number>;
}

const LIFT_MAP: Record<string, ExerciseType> = {
  traction: 'Tractions',
  dips: 'Dips',
  squat: 'Squat',
};

const ProgressScreen = ({ exerciseLogs, completedSessions, oneRMs }: ProgressScreenProps) => {
  const [lift, setLift] = useState<'traction' | 'dips' | 'squat'>('traction');

  const sparkData = useMemo(() => {
    const key = LIFT_MAP[lift];
    const filtered = exerciseLogs
      .filter((l) => l.exercise_name === key)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-12)
      .map((l) => Math.round(l.calculated_1rm * 10) / 10);
    if (filtered.length >= 2) return filtered;
    const base = oneRMs[key] || 0;
    return base > 0 ? [base * 0.9, base] : [0, 1];
  }, [lift, exerciseLogs, oneRMs]);

  const last1RM = sparkData[sparkData.length - 1];
  const gain = sparkData.length >= 2 ? last1RM - sparkData[0] : 0;

  const totalVolume = useMemo(
    () => exerciseLogs.reduce((acc, l) => acc + l.total_weight * l.reps, 0) / 1000,
    [exerciseLogs]
  );

  const recentPRs = useMemo(
    () =>
      exerciseLogs
        .filter((l) => l.is_pr)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4),
    [exerciseLogs]
  );

  const sessionDates = completedSessions.map((s) => s.date);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader title="Progrès" />
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Stat row */}
        <div
          className="mx-5 mb-5 grid grid-cols-3 border rounded-2xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {[
            { label: 'Volume', value: totalVolume.toFixed(1), unit: 't', sub: 'total' },
            {
              label: 'Séances',
              value: String(completedSessions.length),
              unit: '',
              sub: 'toutes',
            },
            {
              label: 'PRs',
              value: String(recentPRs.length),
              unit: '',
              sub: 'confirmés',
            },
          ].map((s, i) => (
            <div
              key={s.label}
              className="px-3 py-3 text-center"
              style={i > 0 ? { borderLeft: '1px solid var(--border)' } : undefined}
            >
              <div className="flex items-baseline justify-center gap-1">
                <NN className="text-[20px] font-medium leading-none" style={{ color: 'var(--fg)' }}>
                  {s.value}
                </NN>
                {s.unit && <NL className="text-[9px]">{s.unit}</NL>}
              </div>
              <div className="mt-1.5">
                <NL className="text-[8px] tracking-[0.22em]">{s.label}</NL>
              </div>
              <NN className="block mt-0.5 text-[9px]" style={{ color: 'var(--muted)' }}>
                {s.sub}
              </NN>
            </div>
          ))}
        </div>

        {/* 1RM sparkline */}
        <div
          className="mx-5 mb-5 border rounded-2xl p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <NL>1RM estimé · 12 sem.</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {gain >= 0 ? '+' : ''}
              {gain.toFixed(1)} kg
            </NN>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <NN
              className="text-[36px] font-medium tracking-tight leading-none"
              style={{ color: 'var(--fg)' }}
            >
              {last1RM}
            </NN>
            <NL>kg</NL>
          </div>
          <SparkLine data={sparkData} />
          <div
            className="mt-3 flex gap-1 border rounded-xl p-1"
            style={{ borderColor: 'var(--border)' }}
          >
            {[
              { k: 'traction', l: 'Traction' },
              { k: 'dips', l: 'Dips' },
              { k: 'squat', l: 'Squat' },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setLift(o.k as 'traction' | 'dips' | 'squat')}
                className="flex-1 h-8 rounded-lg text-[11px] font-medium transition"
                style={
                  lift === o.k
                    ? { background: 'var(--fg)', color: 'var(--bg)' }
                    : { color: 'var(--muted)' }
                }
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        <div
          className="mx-5 mb-5 border rounded-2xl p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <NL>Régularité</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {completedSessions.length} séances
            </NN>
          </div>
          <Heatmap sessionDates={sessionDates} />
        </div>

        {/* PR list */}
        {recentPRs.length > 0 && (
          <div className="mx-5 mb-5">
            <div className="flex items-center justify-between mb-2">
              <NL>Records récents</NL>
            </div>
            <div
              className="border rounded-2xl overflow-hidden"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              {recentPRs.map((r, i) => (
                <div
                  key={r.id || i}
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  <div>
                    <NN className="block text-[13px] font-medium" style={{ color: 'var(--fg)' }}>
                      {r.exercise_name}
                    </NN>
                    <NN className="block mt-0.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                      {r.date
                        ? new Date(r.date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : ''}
                    </NN>
                  </div>
                  <NN className="text-[16px] font-medium" style={{ color: 'var(--fg)' }}>
                    {Math.round(r.calculated_1rm * 10) / 10} kg
                  </NN>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────── ProfileScreen ─────────────────────── */

const SKINS_META = [
  { k: 'mono' as SkinKey, l: 'Mono', sw: ['#ffffff', '#0f0f0e', '#8a8884'] },
  { k: 'carbon' as SkinKey, l: 'Carbon', sw: ['#0f0f0e', '#f7f6f3', '#7c7a76'] },
  { k: 'sand' as SkinKey, l: 'Sand', sw: ['#f6f3ec', '#191813', '#8a8472'] },
];

interface ProfileScreenProps {
  profile: UserProfile | null;
  bodyWeight: number;
  oneRMs: Record<ExerciseType, number>;
  skin: SkinKey;
  onSkin: (s: SkinKey) => void;
  onLogout: () => void;
  onUpdateProfile: (updates: {
    birth_date?: string;
    height?: number;
    gender?: 'Homme' | 'Femme';
    goal_program?: string;
    activity_level?: number;
  }) => Promise<void>;
}

const ProfileScreen = ({
  profile,
  bodyWeight,
  oneRMs,
  skin,
  onSkin,
  onLogout,
  onUpdateProfile,
}: ProfileScreenProps) => {
  const [editMode, setEditMode] = useState(false);
  const [editBirthDate, setEditBirthDate] = useState(profile?.birth_date || '2000-01-01');
  const [editHeight, setEditHeight] = useState(profile?.height || 180);
  const [editGender, setEditGender] = useState<'Homme' | 'Femme'>(profile?.gender || 'Homme');
  const [editGoal, setEditGoal] = useState(profile?.goal_program || 'maintain');
  const [editActivity, setEditActivity] = useState(profile?.activity_level || 1.55);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const t = setTimeout(() => {
      setEditBirthDate(profile.birth_date || '2000-01-01');
      setEditHeight(profile.height);
      setEditGender(profile.gender);
      setEditGoal(profile.goal_program);
      setEditActivity(profile.activity_level || 1.55);
    }, 0);
    return () => clearTimeout(t);
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateProfile({
        birth_date: editBirthDate,
        height: editHeight,
        gender: editGender,
        goal_program: editGoal,
        activity_level: editActivity,
      });
      toast.success('Profil mis à jour');
      setEditMode(false);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const initial = profile?.gender === 'Femme' ? 'F' : 'A';
  const age = calculateAge(profile?.birth_date || '');

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader
        title="Profil"
        right={
          <button
            onClick={onLogout}
            className="h-10 w-10 -mr-2 flex items-center justify-center rounded-full transition hover:opacity-70"
            style={{ color: 'var(--muted)' }}
            aria-label="Se déconnecter"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Identity */}
        <div className="px-5 mb-5 flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-2xl border flex items-center justify-center shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <NN className="text-[22px] font-medium" style={{ color: 'var(--fg)' }}>
              {initial}
            </NN>
          </div>
          <div>
            <div className="text-[20px] font-medium leading-tight">
              {profile?.gender === 'Femme' ? 'Athlète' : 'Champion'}
            </div>
            <NN className="block mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              {profile?.onboarding_completed ? 'profil complet' : 'en cours'} · {bodyWeight} kg
            </NN>
          </div>
        </div>

        {/* Mensurations */}
        <div className="px-5 mb-2">
          <NL>Mensurations</NL>
        </div>
        <div
          className="mx-5 mb-5 border rounded-2xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {[
            { label: 'Poids', value: String(bodyWeight), unit: 'kg' },
            { label: 'Taille', value: String(profile?.height || '—'), unit: 'cm' },
            { label: 'Âge', value: age > 0 ? String(age) : '—', unit: 'ans' },
            { label: 'Sexe', value: profile?.gender || '—', unit: undefined },
          ].map(({ label, value, unit }, i) => (
            <div
              key={label}
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
            >
              <NL>{label}</NL>
              <div className="flex items-baseline gap-1">
                <NN className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                  {value}
                </NN>
                {unit && <NL className="text-[9px]">{unit}</NL>}
              </div>
            </div>
          ))}
        </div>

        {/* 1RM baselines */}
        <div className="px-5 mb-2">
          <NL>Baselines 1RM</NL>
        </div>
        <div
          className="mx-5 mb-5 border rounded-2xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {(
            [
              { label: 'Traction lestée', key: 'Tractions' },
              { label: 'Dips lestés', key: 'Dips' },
              { label: 'Squat', key: 'Squat' },
              { label: 'Muscle-up', key: 'Muscle-up' },
            ] as { label: string; key: ExerciseType }[]
          ).map(({ label, key }, i) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
            >
              <NL>{label}</NL>
              <div className="flex items-baseline gap-1">
                <NN className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                  {Math.round(oneRMs[key])}
                </NN>
                <NL className="text-[9px]">kg</NL>
                <Pencil size={12} className="ml-2" style={{ color: 'var(--muted)' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Skin switcher */}
        <div className="px-5 mb-2 flex items-center justify-between">
          <NL>Thème</NL>
          <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
            global
          </NN>
        </div>
        <div className="mx-5 mb-5 grid grid-cols-3 gap-2">
          {SKINS_META.map((s) => {
            const active = skin === s.k;
            return (
              <button
                key={s.k}
                onClick={() => onSkin(s.k)}
                className="p-3 rounded-2xl border transition text-left"
                style={{ borderColor: active ? 'var(--fg)' : 'var(--border)' }}
              >
                <div className="flex gap-1.5 mb-2">
                  {s.sw.map((c, i) => (
                    <div
                      key={i}
                      className="h-6 flex-1 rounded-md border"
                      style={{ background: c, borderColor: 'var(--border)' }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <NN className="text-[11px] font-medium" style={{ color: 'var(--fg)' }}>
                    {s.l}
                  </NN>
                  {active && <Check size={12} strokeWidth={2.5} style={{ color: 'var(--fg)' }} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Edit toggle */}
        <div className="px-5 mb-2 flex items-center justify-between">
          <NL>Paramètres</NL>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="text-[10px] font-medium uppercase tracking-[0.16em] transition hover:opacity-70"
            style={{ color: 'var(--fg)' }}
          >
            {editMode ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {editMode && (
          <div
            className="mx-5 mb-5 border rounded-2xl p-5 space-y-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-xl p-3" style={{ borderColor: 'var(--border)' }}>
                <NL>Taille</NL>
                <div className="mt-1 flex items-baseline gap-1">
                  <input
                    type="number"
                    value={editHeight}
                    onChange={(e) => setEditHeight(Number(e.target.value) || 0)}
                    className="bg-transparent outline-none font-mono tabular-nums text-[20px] font-medium w-full"
                    style={{ color: 'var(--fg)' }}
                  />
                  <NL className="text-[9px]">cm</NL>
                </div>
              </div>
              <div className="border rounded-xl p-3" style={{ borderColor: 'var(--border)' }}>
                <NL>Sexe</NL>
                <div className="mt-2 flex gap-1">
                  {(['Homme', 'Femme'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setEditGender(g)}
                      className="flex-1 h-8 rounded-lg text-[12px] font-medium transition"
                      style={
                        editGender === g
                          ? { background: 'var(--fg)', color: 'var(--bg)' }
                          : { color: 'var(--muted)', border: '1px solid var(--border)' }
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <NL className="mb-2 block">Objectif</NL>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'cut', l: 'Sèche' },
                  { k: 'maintain', l: 'Maintien' },
                  { k: 'bulk', l: 'Prise' },
                ].map((g) => (
                  <button
                    key={g.k}
                    onClick={() => setEditGoal(g.k)}
                    className="h-11 rounded-xl border text-[11px] font-medium uppercase tracking-[0.18em] transition"
                    style={
                      editGoal === g.k
                        ? {
                            background: 'var(--fg)',
                            color: 'var(--bg)',
                            borderColor: 'var(--fg)',
                          }
                        : { borderColor: 'var(--border)', color: 'var(--muted)' }
                    }
                  >
                    {g.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <NL className="mb-2 block">Activité</NL>
              <div className="space-y-2">
                {[
                  { v: 1.2, l: 'Sédentaire', s: '0 séance' },
                  { v: 1.55, l: 'Modéré', s: '1–3 séances' },
                  { v: 1.75, l: 'Très actif', s: '4+ séances' },
                ].map((a) => {
                  const active = Math.abs(editActivity - a.v) < 0.01;
                  return (
                    <button
                      key={a.v}
                      onClick={() => setEditActivity(a.v)}
                      className="w-full h-12 px-4 rounded-xl border flex items-center justify-between transition"
                      style={{ borderColor: active ? 'var(--fg)' : 'var(--border)' }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>
                        {a.l}
                      </span>
                      <div className="flex items-center gap-3">
                        <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                          {a.s}
                        </NN>
                        <span
                          className="h-3.5 w-3.5 rounded-full border"
                          style={
                            active
                              ? { background: 'var(--fg)', borderColor: 'var(--fg)' }
                              : { borderColor: 'var(--border)' }
                          }
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <NL className="mb-1.5 block">Date de naissance</NL>
              <input
                type="date"
                value={editBirthDate}
                onChange={(e) => setEditBirthDate(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border bg-transparent outline-none text-[15px] font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full h-12 rounded-2xl text-[12px] font-medium uppercase tracking-[0.22em] disabled:opacity-50"
              style={{ background: 'var(--fg)', color: 'var(--bg)' }}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Enregistrer'}
            </button>
          </div>
        )}

        <div className="px-5 mb-6">
          <button
            onClick={onLogout}
            className="w-full h-12 rounded-2xl border text-[11px] font-medium uppercase tracking-[0.22em] transition hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Main App ─────────────────────── */

export default function App() {
  const router = useRouter();

  const {
    profile,
    exerciseLogs,
    completedSessions,
    loading,
    fetchProfile,
    fetchTrainingLogs,
    updatePerformance,
    updateProfile,
    signOut,
  } = useStore();

  const { meals } = useNutritionStore();

  const [hasMounted, setHasMounted] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('home');

  // Training state
  const [bwInput, setBwInput] = useState(75);
  const [lestInput, setLestInput] = useState(0);
  const [repsInput, setRepsInput] = useState(5);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [isDone, setIsDone] = useState(false);

  // Skin state
  const [skin, setSkinState] = useState<SkinKey>('mono');

  // Hydrate skin from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY) as SkinKey | null;
    if (stored && stored in SKINS) {
      const t = setTimeout(() => setSkinState(stored as SkinKey), 0);
      return () => clearTimeout(t);
    }
  }, []);

  // Apply skin CSS vars whenever skin changes
  useEffect(() => {
    applySkin(skin);
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
  }, [skin]);

  // Auth check
  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          // If there's an error (like invalid refresh token), sign out to clear local state
          if (error) {
            console.warn('Auth check error, signing out:', error.message);
            await supabase.auth.signOut();
          }
          router.push('/login');
        } else {
          await fetchProfile();
          setHasMounted(true);
        }
      } catch (err) {
        console.error('Unexpected auth error:', err);
        router.push('/login');
      }
    };
    checkUser();
  }, [fetchProfile, router]);

  useEffect(() => {
    if (!profile) return;
    fetchTrainingLogs();
    const t = setTimeout(() => setBwInput(profile.body_weight), 0);
    return () => clearTimeout(t);
  }, [profile, fetchTrainingLogs]);

  const bodyWeight = profile?.body_weight || 75;

  const oneRMs = useMemo(
    () => ({
      'Muscle-up': profile?.current_1rm_muscleup || 0,
      Tractions: profile?.current_1rm_pullup || 0,
      Dips: profile?.current_1rm_dips || 0,
      Squat: profile?.current_1rm_squat || 0,
    }),
    [profile]
  );

  const template = useMemo(
    () => getSessionTemplate(currentWeek, currentDay, oneRMs, bodyWeight),
    [currentWeek, currentDay, oneRMs, bodyWeight]
  );

  // Sync lest/reps to template main exercise
  const prevTemplateRef = useRef(template);
  useEffect(() => {
    if (prevTemplateRef.current === template) return;
    prevTemplateRef.current = template;
    const main = template.exercises.find((e) => e.isMain);
    const t = setTimeout(() => {
      if (main && typeof main.weight === 'number') setLestInput(main.weight);
      setRepsInput(parseInt(main?.reps ?? '5'));
      setIsDone(false);
    }, 0);
    return () => clearTimeout(t);
  }, [template]);

  const handleValidateMain = async () => {
    await updatePerformance(
      template.mainExercise,
      bwInput,
      lestInput,
      repsInput,
      8,
      [],
      currentWeek,
      currentDay
    );
    setIsDone(true);
  };

  // Nutrition targets
  const nutritionTargets = useMemo(
    () =>
      calculateTargets(
        profile?.height || 180,
        calculateAge(profile?.birth_date || ''),
        profile?.gender || 'Homme',
        profile?.activity_level || 1.55,
        profile?.goal_program || 'maintain',
        bodyWeight
      ),
    [profile, bodyWeight]
  );

  const nutritionTotals = useMemo(
    () =>
      meals.reduce(
        (a, m) => ({
          calories: a.calories + m.calories,
          protein: a.protein + m.macros.protein,
          carbs: a.carbs + m.macros.carbs,
          fat: a.fat + m.macros.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [meals]
  );

  const handleNav = (view: AppView) => {
    if (view === 'nutrition') {
      router.push('/nutrition/scanner');
    } else {
      setCurrentView(view);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (!hasMounted || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--fg)' }} />
      </div>
    );
  }

  if (profile && !profile.onboarding_completed) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 pt-12">
        <OnboardingWizard />
      </div>
    );
  }

  const completedSessionDates = completedSessions.map((s) => s.date);

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg)',
        fontFamily: 'var(--font-geist, ui-sans-serif, system-ui, sans-serif)',
      }}
    >
      <div className="relative w-full max-w-md mx-auto" style={{ height: '100svh' }}>
        {currentView === 'home' && (
          <HomeScreen
            onNav={handleNav}
            profileGender={profile?.gender}
            completedSessionDates={completedSessionDates}
            template={template}
            nutritionTotals={nutritionTotals}
            nutritionTarget={nutritionTargets.targetCalories}
            currentWeek={currentWeek}
          />
        )}
        {currentView === 'workout' && (
          <WorkoutScreen
            template={template}
            currentWeek={currentWeek}
            currentDay={currentDay}
            setCurrentWeek={setCurrentWeek}
            setCurrentDay={setCurrentDay}
            bwInput={bwInput}
            setBwInput={setBwInput}
            lestInput={lestInput}
            setLestInput={setLestInput}
            repsInput={repsInput}
            setRepsInput={setRepsInput}
            isDone={isDone}
            onValidate={handleValidateMain}
            loading={loading}
          />
        )}
        {currentView === 'progress' && (
          <ProgressScreen
            exerciseLogs={exerciseLogs}
            completedSessions={completedSessions}
            oneRMs={oneRMs}
          />
        )}
        {currentView === 'profile' && (
          <ProfileScreen
            profile={profile}
            bodyWeight={bodyWeight}
            oneRMs={oneRMs}
            skin={skin}
            onSkin={setSkinState}
            onLogout={handleLogout}
            onUpdateProfile={updateProfile}
          />
        )}

        <BottomNav active={currentView} onNav={handleNav} />
      </div>
    </div>
  );
}
