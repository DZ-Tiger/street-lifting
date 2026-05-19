'use client';

import React, { useState, useMemo, useEffect, ReactNode } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useStore,
  getSessionTemplate,
  progressionMatrix,
  ExerciseType,
  ExerciseLog,
  CompletedSession,
  UserProfile,
} from '@/store/useStore';
import { useNutritionStore } from '@/store/useNutritionStore';
import { calculateTargets, Gender, NutritionTargets } from '@/lib/nutrition';
import { calculateAge, formatSeconds, useIsHydrated } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { ProfileSettingsDialog } from '@/components/ProfileSettingsDialog';
import { NutritionScreen } from '@/app/nutrition/scanner/page';
import { SKINS, SkinKey, SKIN_STORAGE_KEY, applySkin } from '@/lib/useSkin';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  Home,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Settings2 as SettingsIcon,
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

const STEPPER_BUTTON_CLASS =
  'w-16 min-h-[44px] flex items-center justify-center transition active:opacity-60';

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
      type="button"
      onClick={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
      className={STEPPER_BUTTON_CLASS}
      style={{ color: 'var(--fg)' }}
      aria-label="Decrement"
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
      type="button"
      onClick={() => onChange(Math.round((value + step) * 100) / 100)}
      className={STEPPER_BUTTON_CLASS}
      style={{ color: 'var(--fg)' }}
      aria-label="Increment"
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
  const cell = (level: number) =>
    level === 0
      ? 'bg-[var(--surface-2)]'
      : level === 1
        ? 'bg-[var(--ink-3)]'
        : level === 2
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
          12 weeks
        </NN>
        <div className="flex items-center gap-1">
          <NL className="text-[8px]">less</NL>
          {[0, 1, 2, 3].map((level) => (
            <div key={level} className={`h-2 w-2 rounded-sm ${cell(level)}`} />
          ))}
          <NL className="text-[8px]">more</NL>
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
    {right ?? <div className="h-11 w-11" />}
  </div>
);

/* ─────────────────────── Bottom Nav ─────────────────────── */

type AppView = 'home' | 'workout' | 'nutrition' | 'progress' | 'profile';

const NAV_ITEMS: {
  k: AppView;
  label: string;
  Icon: React.FC<{ size?: number; strokeWidth?: number }>;
}[] = [
  { k: 'home', label: 'Home', Icon: Home },
  { k: 'workout', label: 'Workouts', Icon: Dumbbell },
  { k: 'nutrition', label: 'Nutrition', Icon: Utensils },
  { k: 'progress', label: 'Progress', Icon: TrendingUp },
  { k: 'profile', label: 'Profile', Icon: User },
];

const BottomNav = ({ active, onNav }: { active: AppView; onNav: (v: AppView) => void }) => (
  <div
    className="absolute left-0 right-0 bottom-0 px-3 pt-2 z-30 pointer-events-none"
    style={{ paddingBottom: 'calc(var(--safe-bottom) + 0.75rem)' }}
  >
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
            type="button"
            onClick={() => onNav(k)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition min-h-[44px]"
            aria-label={label}
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
  profileGender: Gender | undefined;
  displayName?: string;
  completedSessionDates: string[];
  template: ReturnType<typeof getSessionTemplate>;
  nutritionTotals: { calories: number; protein: number; carbs: number; fat: number };
  nutritionTargets: NutritionTargets;
  currentWeek: number;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const HomeScreen = ({
  onNav,
  profileGender,
  displayName,
  completedSessionDates,
  template,
  nutritionTotals,
  nutritionTargets,
  currentWeek,
}: HomeScreenProps) => {
  const today = new Date();

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + i);
    const dateStr = date.toISOString().split('T')[0];
    const done = completedSessionDates.some((d) => d.startsWith(dateStr));
    return { day: DAY_LETTERS[date.getDay()], done };
  });

  const remaining = Math.max(0, nutritionTargets.targetCalories - nutritionTotals.calories);
  const greetingName = displayName || (profileGender === 'female' ? 'Athlete' : 'Champion');

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader
        title="Home"
        right={
          <button
            type="button"
            aria-label="Time"
            className="h-11 w-11 -mr-2 flex items-center justify-center rounded-full"
            style={{ color: 'var(--fg)' }}
          >
            <Clock size={18} strokeWidth={1.5} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-5 mb-5">
          <NL>
            {today.toLocaleDateString('en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </NL>
          <div className="mt-1 text-[28px] font-medium leading-[1.05] tracking-tight">
            Hi, {greetingName}.
          </div>
        </div>

        <div
          className="mx-5 mb-5 border rounded-2xl p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <NL>7-day activity</NL>
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

        <button
          type="button"
          onClick={() => onNav('workout')}
          className="block w-full text-left px-5 mb-5"
        >
          <div className="mb-2 flex items-center justify-between">
            <NL>Today&apos;s session</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {template.exercises.length} exercises
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
                  {template.mainExercise} · {template.exercises.length} lifts
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

        <button
          type="button"
          onClick={() => onNav('nutrition')}
          className="block w-full text-left px-5 mb-5"
        >
          <div className="mb-2 flex items-center justify-between">
            <NL>Nutrition</NL>
            <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
          </div>
          <div
            className="border rounded-2xl p-4 flex items-center gap-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <SmallRing
              pct={
                nutritionTargets.targetCalories > 0
                  ? nutritionTotals.calories / nutritionTargets.targetCalories
                  : 0
              }
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <NN className="text-[22px] font-medium leading-none" style={{ color: 'var(--fg)' }}>
                  {nutritionTotals.calories.toLocaleString('en-US')}
                </NN>
                <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  / {nutritionTargets.targetCalories.toLocaleString('en-US')} kcal
                </NN>
              </div>
              <NN className="block mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                {remaining} remaining
              </NN>
              <div className="mt-2 flex gap-1.5">
                {[
                  {
                    l: 'P',
                    v: nutritionTotals.protein,
                    t: nutritionTargets.targetProtein,
                    shade: 'var(--fg)',
                  },
                  {
                    l: 'C',
                    v: nutritionTotals.carbs,
                    t: nutritionTargets.targetCarbs,
                    shade: 'var(--ink-2)',
                  },
                  {
                    l: 'F',
                    v: nutritionTotals.fat,
                    t: nutritionTargets.targetFat,
                    shade: 'var(--ink-3)',
                  },
                ].map((m) => {
                  const pct = m.t > 0 ? (m.v / m.t) * 100 : 0;
                  return (
                    <div key={m.l} className="flex-1">
                      <div
                        className="h-[3px] rounded-full overflow-hidden"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${Math.min(pct, 100)}%`, background: m.shade }}
                        />
                      </div>
                      <NN className="block mt-1 text-[9px]" style={{ color: 'var(--muted)' }}>
                        {m.l} {m.v}g
                      </NN>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </button>

        <div className="px-5">
          <div className="mb-2 flex items-center justify-between">
            <NL>9-week cycle</NL>
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
                Week 1
              </NN>
              <NN className="text-[9px]" style={{ color: 'var(--muted)' }}>
                Peak week 7
              </NN>
              <NN className="text-[9px]" style={{ color: 'var(--muted)' }}>
                Test week 9
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
  onValidate: (lest: number, reps: number) => Promise<void>;
  loading: boolean;
}

const REST_TARGET_SECONDS = 120;

const WorkoutScreen = ({
  template,
  currentWeek,
  currentDay,
  setCurrentWeek,
  setCurrentDay,
  onValidate,
  loading,
}: WorkoutScreenProps) => {
  const mainExercise = template.exercises.find((e) => e.isMain);
  const initialLest = typeof mainExercise?.weight === 'number' ? mainExercise.weight : 0;
  const initialReps = parseInt(mainExercise?.reps ?? '5', 10);

  const [lestInput, setLestInput] = useState(initialLest);
  const [repsInput, setRepsInput] = useState(initialReps);
  const [isDone, setIsDone] = useState(false);
  const [rest, setRest] = useState(0);
  const [running, setRunning] = useState(false);
  const [exIdx, setExIdx] = useState(0);
  const [history, setHistory] = useState<{ set: number; reps: number; load: number }[]>([]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRest((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const exercise = template.exercises[exIdx];

  const handleValidate = async () => {
    await onValidate(lestInput, repsInput);
    setIsDone(true);
    setHistory((h) => [...h, { set: h.length + 1, reps: repsInput, load: lestInput }]);
    setRest(0);
    setRunning(true);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader
        title="Workouts"
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
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <NN className="text-[11px]" style={{ color: 'var(--muted)' }}>
              W{currentWeek} · D{currentDay}
            </NN>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => setCurrentDay(Math.max(1, currentDay - 1))}
                className="h-11 w-11 rounded-lg flex items-center justify-center border"
                style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next day"
                onClick={() => setCurrentDay(Math.min(4, currentDay + 1))}
                className="h-11 w-11 rounded-lg flex items-center justify-center border"
                style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="flex gap-1">
            {progressionMatrix.slice(0, 9).map((step) => (
              <button
                key={step.week}
                type="button"
                aria-label={`Week ${step.week}`}
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

        <div className="px-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {template.exercises.map((e, i) => (
              <button
                key={e.name}
                type="button"
                onClick={() => setExIdx(i)}
                className="shrink-0 px-3 h-11 rounded-full border transition"
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

        <div className="px-5 mt-5">
          <NL>
            Exercise {exIdx + 1}/{template.exercises.length}
          </NL>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <div className="text-[22px] font-medium leading-tight tracking-tight">
                {exercise?.name}
              </div>
              <NN className="block mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                {exercise?.sets} × {exercise?.reps} ·{' '}
                {typeof exercise?.weight === 'number' ? `+${exercise.weight} kg` : exercise?.weight}
              </NN>
            </div>
          </div>
        </div>

        <div
          className="mx-5 mt-5 border rounded-2xl p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <NL>Rest</NL>
            <NL>target 2:00</NL>
          </div>
          <div className="flex items-center justify-between gap-4">
            <NN
              className="text-[64px] font-medium tracking-tight leading-none"
              style={{ color: 'var(--fg)' }}
            >
              {formatSeconds(rest)}
            </NN>
            <button
              type="button"
              aria-label={running ? 'Pause rest timer' : 'Start rest timer'}
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
                width: `${Math.min((rest / REST_TARGET_SECONDS) * 100, 100)}%`,
                background: 'var(--fg)',
              }}
            />
          </div>
        </div>

        <div className="px-5 mt-5 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <NL>Reps</NL>
              <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                target {exercise?.reps}
              </NN>
            </div>
            <Stepper value={repsInput} onChange={setRepsInput} suffix="reps" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <NL>Added load</NL>
              <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
                step 2.5 kg
              </NN>
            </div>
            <Stepper value={lestInput} onChange={setLestInput} step={2.5} suffix="kg" />
          </div>
        </div>

        <div className="px-5 mt-5">
          <button
            type="button"
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
                <span className="text-[14px] font-medium uppercase tracking-[0.22em]">Log set</span>
              </>
            )}
          </button>
        </div>

        {history.length > 0 && (
          <div className="px-5 mt-5">
            <div className="flex items-center justify-between mb-2">
              <NL>Logged sets</NL>
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
                      Set {h.set}
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

type LiftKey = 'pullup' | 'dips' | 'squat';

const LIFT_MAP: Record<LiftKey, ExerciseType> = {
  pullup: 'Pull-up',
  dips: 'Dips',
  squat: 'Squat',
};

const LIFT_OPTIONS: { k: LiftKey; l: string }[] = [
  { k: 'pullup', l: 'Pull-up' },
  { k: 'dips', l: 'Dips' },
  { k: 'squat', l: 'Squat' },
];

const ProgressScreen = ({ exerciseLogs, completedSessions, oneRMs }: ProgressScreenProps) => {
  const [lift, setLift] = useState<LiftKey>('pullup');

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
      <SHeader title="Progress" />
      <div className="flex-1 overflow-y-auto pb-32">
        <div
          className="mx-5 mb-5 grid grid-cols-3 border rounded-2xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {[
            { label: 'Volume', value: totalVolume.toFixed(1), unit: 't', sub: 'total' },
            {
              label: 'Sessions',
              value: String(completedSessions.length),
              unit: '',
              sub: 'all-time',
            },
            {
              label: 'PRs',
              value: String(recentPRs.length),
              unit: '',
              sub: 'recent',
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

        <div
          className="mx-5 mb-5 border rounded-2xl p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <NL>Estimated 1RM · 12 wks</NL>
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
            {LIFT_OPTIONS.map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setLift(o.k)}
                className="flex-1 min-h-[44px] rounded-lg text-[11px] font-medium transition"
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

        <div
          className="mx-5 mb-5 border rounded-2xl p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <NL>Consistency</NL>
            <NN className="text-[10px]" style={{ color: 'var(--muted)' }}>
              {completedSessions.length} sessions
            </NN>
          </div>
          <Heatmap sessionDates={sessionDates} />
        </div>

        {recentPRs.length > 0 && (
          <div className="mx-5 mb-5">
            <div className="flex items-center justify-between mb-2">
              <NL>Recent records</NL>
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
                        ? new Date(r.date).toLocaleDateString('en-US', {
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
  onOpenSettings: () => void;
  avatarUrl?: string | null;
}

const ONE_RM_ROWS: { label: string; key: ExerciseType }[] = [
  { label: 'Weighted Pull-up', key: 'Pull-up' },
  { label: 'Weighted Dips', key: 'Dips' },
  { label: 'Squat', key: 'Squat' },
  { label: 'Muscle-up', key: 'Muscle-up' },
];

const ProfileScreen = ({
  profile,
  bodyWeight,
  oneRMs,
  skin,
  onSkin,
  onLogout,
  onOpenSettings,
  avatarUrl,
}: ProfileScreenProps) => {
  const fallbackInitial = profile?.gender === 'female' ? 'F' : 'A';
  const initial = (profile?.display_name?.[0] || fallbackInitial).toUpperCase();
  const age = calculateAge(profile?.birth_date || '');

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <SHeader
        title="Profile"
        right={
          <div className="flex items-center gap-1 -mr-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="h-11 w-11 flex items-center justify-center rounded-full transition hover:opacity-70"
              style={{ color: 'var(--fg)' }}
              aria-label="Settings"
            >
              <SettingsIcon size={18} strokeWidth={1.75} />
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-5 mb-5 flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-2xl border flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
            ) : (
              <NN className="text-[22px] font-medium" style={{ color: 'var(--fg)' }}>
                {initial}
              </NN>
            )}
          </div>
          <div>
            <div className="text-[20px] font-medium leading-tight">
              {profile?.display_name || (profile?.gender === 'female' ? 'Athlete' : 'Champion')}
            </div>
            <NN className="block mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              {profile?.onboarding_completed ? 'profile complete' : 'in progress'} · {bodyWeight} kg
            </NN>
          </div>
        </div>

        <div className="px-5 mb-2">
          <NL>Measurements</NL>
        </div>
        <div
          className="mx-5 mb-5 border rounded-2xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {[
            { label: 'Weight', value: String(bodyWeight), unit: 'kg' },
            { label: 'Height', value: String(profile?.height || '—'), unit: 'cm' },
            { label: 'Age', value: age > 0 ? String(age) : '—', unit: 'yrs' },
            {
              label: 'Sex',
              value:
                profile?.gender === 'female' ? 'Female' : profile?.gender === 'male' ? 'Male' : '—',
              unit: undefined,
            },
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

        <div className="px-5 mb-2">
          <NL>1RM baselines</NL>
        </div>
        <div
          className="mx-5 mb-5 border rounded-2xl overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {ONE_RM_ROWS.map(({ label, key }, i) => (
            <div
              key={key}
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
            >
              <NL>{label}</NL>
              <div className="flex items-baseline gap-1">
                <NN className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>
                  {oneRMs[key]}
                </NN>
                <NL className="text-[9px]">kg</NL>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 mb-2 flex items-center justify-between">
          <NL>Theme</NL>
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
                type="button"
                onClick={() => onSkin(s.k)}
                className="p-3 rounded-2xl border transition text-left"
                style={{ borderColor: active ? 'var(--fg)' : 'var(--border)' }}
              >
                <div className="flex gap-1.5 mb-2">
                  {s.sw.map((color, i) => (
                    <div
                      key={i}
                      className="h-6 flex-1 rounded-md border"
                      style={{ background: color, borderColor: 'var(--border)' }}
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

        <div className="px-5 mb-6">
          <button
            type="button"
            onClick={onLogout}
            className="w-full h-12 rounded-2xl border text-[11px] font-medium uppercase tracking-[0.22em] transition hover:opacity-70"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Sign out
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
    avatarUrl,
    fetchProfile,
    fetchTrainingLogs,
    updatePerformance,
    signOut,
  } = useStore();

  const { meals } = useNutritionStore();

  const isHydrated = useIsHydrated();
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nutritionView, setNutritionView] = useState('dashboard');

  const [skin, setSkinState] = useState<SkinKey>(() => {
    if (typeof window === 'undefined') return 'mono';
    const stored = window.localStorage.getItem(SKIN_STORAGE_KEY);
    return stored && stored in SKINS ? (stored as SkinKey) : 'mono';
  });

  useEffect(() => {
    applySkin(skin);
    window.localStorage.setItem(SKIN_STORAGE_KEY, skin);
  }, [skin]);

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
  }, [profile, fetchTrainingLogs]);

  const bodyWeight = profile?.body_weight || 75;

  const oneRMs = useMemo<Record<ExerciseType, number>>(
    () => ({
      'Muscle-up': profile?.current_1rm_muscleup || 0,
      'Pull-up': profile?.current_1rm_pullup || 0,
      Dips: profile?.current_1rm_dips || 0,
      Squat: profile?.current_1rm_squat || 0,
    }),
    [profile]
  );

  const template = useMemo(
    () => getSessionTemplate(currentWeek, currentDay, oneRMs, bodyWeight),
    [currentWeek, currentDay, oneRMs, bodyWeight]
  );

  const handleValidateMain = async (lest: number, reps: number) => {
    await updatePerformance(
      template.mainExercise,
      bodyWeight,
      lest,
      reps,
      8,
      [],
      currentWeek,
      currentDay
    );
  };

  const nutritionTargets = useMemo(
    () =>
      calculateTargets(
        profile?.height ?? 180,
        calculateAge(profile?.birth_date ?? ''),
        profile?.gender ?? 'male',
        profile?.activity_level ?? 1.55,
        profile?.goal_program ?? 'maintain',
        bodyWeight
      ),
    [profile, bodyWeight]
  );

  const nutritionTotals = useMemo(() => {
    const today = new Date().toDateString();
    return meals
      .filter((m) => new Date(m.timestamp).toDateString() === today)
      .reduce(
        (a, m) => ({
          calories: a.calories + m.calories,
          protein: a.protein + m.macros.protein,
          carbs: a.carbs + m.macros.carbs,
          fat: a.fat + m.macros.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
  }, [meals]);

  const handleNav = (view: AppView) => {
    setCurrentView(view);
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (!isHydrated || loading || !profile) {
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

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return (
          <HomeScreen
            onNav={handleNav}
            profileGender={profile.gender}
            displayName={profile.display_name}
            completedSessionDates={completedSessionDates}
            template={template}
            nutritionTotals={nutritionTotals}
            nutritionTargets={nutritionTargets}
            currentWeek={currentWeek}
          />
        );
      case 'workout':
        return (
          <WorkoutScreen
            key={`${currentWeek}-${currentDay}-${template.mainExercise}`}
            template={template}
            currentWeek={currentWeek}
            currentDay={currentDay}
            setCurrentWeek={setCurrentWeek}
            setCurrentDay={setCurrentDay}
            onValidate={handleValidateMain}
            loading={loading}
          />
        );
      case 'nutrition':
        return (
          <NutritionScreen
            hideBackButton
            bottomInset={nutritionView === 'dashboard' ? BOTTOM_NAV_INSET_PX : 0}
            onBack={() => setCurrentView('home')}
            onViewChange={setNutritionView}
          />
        );
      case 'progress':
        return (
          <ProgressScreen
            exerciseLogs={exerciseLogs}
            completedSessions={completedSessions}
            oneRMs={oneRMs}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            key={profile.user_id}
            profile={profile}
            bodyWeight={bodyWeight}
            oneRMs={oneRMs}
            skin={skin}
            onSkin={setSkinState}
            onLogout={handleLogout}
            onOpenSettings={() => setSettingsOpen(true)}
            avatarUrl={avatarUrl}
          />
        );
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg)',
        fontFamily: 'var(--font-geist, ui-sans-serif, system-ui, sans-serif)',
      }}
    >
      <div className="relative w-full max-w-md mx-auto" style={{ height: '100svh' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>

        {(currentView !== 'nutrition' || nutritionView === 'dashboard') && (
          <BottomNav active={currentView} onNav={handleNav} />
        )}
      </div>

      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

const BOTTOM_NAV_INSET_PX = 88;
