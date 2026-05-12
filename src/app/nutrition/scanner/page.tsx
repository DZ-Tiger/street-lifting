'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSkin } from '@/lib/useSkin';
import {
  Camera,
  Check,
  Loader2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  RotateCcw,
  Plus,
  Pencil,
  X,
  Flame,
  Settings2 as SettingsIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { NutritionResponse } from '@/app/api/nutrition/scan/route';
import { useNutritionStore, HistoryItem } from '@/store/useNutritionStore';
import {
  calculateTargets,
  Gender,
  GoalType,
  GOAL_LABELS,
  ACTIVITY_OPTIONS,
  caloriesFromMacros,
} from '@/lib/nutrition';
import { useStore } from '@/store/useStore';
import { calculateAge, compressImage, useIsHydrated } from '@/lib/utils';

/* ─────────────────────── Constants ─────────────────────── */

const PORTIONS = [
  { label: '1/4', value: 0.25 },
  { label: '1/3', value: 0.333 },
  { label: '1/2', value: 0.5 },
  { label: '2/3', value: 0.667 },
  { label: '3/4', value: 0.75 },
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2 },
];

/**
 * All values are CSS variable references — they automatically follow the active skin
 * (mono / carbon / sand) defined in `useSkin.ts`. Use these inside `style={{ ... }}`
 * props. For SVG `stroke` / `fill` ATTRIBUTES (not style), use inline style instead
 * so `var()` resolves correctly.
 */
const PALETTE = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  border: 'var(--border)',
  muted: 'var(--muted)',
  ink3: 'var(--ink-3)',
  ink2: 'var(--ink-2)',
  fg: 'var(--fg)',
  carbon: 'var(--carbon)',
  carbon2: 'var(--carbon-2)',
} as const;

const cssVars: React.CSSProperties = {
  fontFamily: 'var(--font-geist, ui-sans-serif, system-ui, sans-serif)',
};

/* ─────────────────────── Micro-components ─────────────────────── */

const NL = ({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
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
  children: React.ReactNode;
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

const HDivider = ({ className = '' }: { className?: string }) => (
  <div className={`h-px w-full ${className}`} style={{ background: 'var(--border)' }} />
);

/* ─────────────────────── CalorieRing ─────────────────────── */

const CalorieRing = ({ consumed, goal }: { consumed: number; goal: number }) => {
  const size = 220;
  const stroke = 3;
  const r = (size - stroke * 2) / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.min(consumed / Math.max(goal, 1), 1);
  const offset = c - pct * c;
  const remaining = Math.max(goal - consumed, 0);
  const tickCount = 60;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        <g transform={`translate(${size / 2},${size / 2})`}>
          {Array.from({ length: tickCount }).map((_, i) => {
            const angle = (i / tickCount) * 2 * Math.PI - Math.PI / 2;
            const major = i % 5 === 0;
            const inner = r + 6;
            const outer = r + (major ? 12 : 9);
            const filled = i / tickCount <= pct;
            return (
              <line
                key={i}
                x1={Math.cos(angle) * inner}
                y1={Math.sin(angle) * inner}
                x2={Math.cos(angle) * outer}
                y2={Math.sin(angle) * outer}
                style={{ stroke: filled ? PALETTE.fg : PALETTE.border }}
                strokeWidth={major ? 1.25 : 0.75}
                strokeLinecap="round"
              />
            );
          })}
        </g>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          style={{ stroke: PALETTE.border }}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            stroke: PALETTE.fg,
            transition: 'stroke-dashoffset 800ms cubic-bezier(.2,.7,.2,1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-center gap-1.5 mb-2" style={{ color: PALETTE.muted }}>
          <Flame size={11} strokeWidth={1.5} />
          <NL className="tracking-[0.22em]">Energy</NL>
        </div>
        <NN
          className="text-[44px] leading-none font-medium tracking-tight"
          style={{ color: PALETTE.fg } as React.CSSProperties}
        >
          {consumed.toLocaleString('en-US')}
        </NN>
        <div className="mt-1.5 flex items-center gap-1.5">
          <NN className="text-[11px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
            / {goal.toLocaleString('en-US')}
          </NN>
          <NL className="text-[9px] tracking-[0.2em]">kcal</NL>
        </div>
        <div
          className="mt-3 px-2.5 py-1 rounded-full flex items-center gap-1.5"
          style={{ border: `1px solid ${PALETTE.border}` }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: PALETTE.fg }} />
          <NN
            className="text-[10px] font-medium"
            style={{ color: PALETTE.fg } as React.CSSProperties}
          >
            {remaining}
          </NN>
          <NL className="text-[9px] tracking-[0.18em]">remaining</NL>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── MacroBar ─────────────────────── */

const MacroBar = ({
  label,
  current,
  target,
  shade = 'fg',
}: {
  label: string;
  current: number;
  target: number;
  shade?: 'fg' | 'mid' | 'low';
}) => {
  const safeTarget = Math.max(target, 1);
  const pct = Math.min((current / safeTarget) * 100, 100);
  const over = current > target;
  const color = shade === 'fg' ? PALETTE.fg : shade === 'mid' ? PALETTE.ink2 : PALETTE.ink3;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <NL>{label}</NL>
        <div className="flex items-baseline gap-1">
          <NN
            className="text-[13px] font-medium"
            style={{ color: PALETTE.fg } as React.CSSProperties}
          >
            {current}
          </NN>
          <NN className="text-[11px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
            / {target}g
          </NN>
        </div>
      </div>
      <div
        className="relative h-[6px] w-full rounded-full overflow-hidden"
        style={{ background: PALETTE.surface2 }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
        {[25, 50, 75].map((p) => (
          <div
            key={p}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: `${p}%`, background: PALETTE.bg }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
          {Math.round(pct)}%
        </NN>
        <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
          {over ? `+${current - target}g` : `−${target - current}g`}
        </NN>
      </div>
    </div>
  );
};

/* ─────────────────────── MealRow ─────────────────────── */

const MealRow = ({
  meal,
  onOpen,
  onDelete,
}: {
  meal: HistoryItem;
  onOpen: (m: HistoryItem) => void;
  onDelete: (id: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onOpen(meal)}
    className="w-full text-left group relative pl-6 pr-2 py-3.5 hover:opacity-90 transition-colors"
  >
    <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: PALETTE.border }} />
    <div
      className="absolute left-2 top-5 -translate-x-1/2 h-1.5 w-1.5 rounded-full ring-4"
      style={{ background: PALETTE.fg, ringColor: PALETTE.bg } as React.CSSProperties}
    />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <NN
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: PALETTE.muted } as React.CSSProperties}
          >
            {meal.time}
          </NN>
          <div className="h-px w-2" style={{ background: PALETTE.border }} />
        </div>
        <div
          className="text-[15px] font-medium leading-snug truncate"
          style={{ color: PALETTE.fg }}
        >
          {meal.mealName}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          {[
            { dot: PALETTE.fg, val: meal.macros.protein, unit: 'P' },
            { dot: PALETTE.ink2, val: meal.macros.carbs, unit: 'C' },
            { dot: PALETTE.ink3, val: meal.macros.fat, unit: 'F' },
          ].map(({ dot, val, unit }) => (
            <span key={unit} className="flex items-center gap-1">
              <span className="h-1 w-1 rounded-full" style={{ background: dot }} />
              <NN className="text-[11px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                {val}
                <span className="ml-0.5 text-[9px]">{unit}</span>
              </NN>
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <div className="text-right">
          <NN
            className="text-[17px] font-medium leading-none"
            style={{ color: PALETTE.fg } as React.CSSProperties}
          >
            {meal.calories}
          </NN>
          <div className="mt-1">
            <NL className="text-[8px] tracking-[0.22em]">kcal</NL>
          </div>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(meal.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onDelete(meal.id);
            }
          }}
          className="ml-2 h-11 w-11 inline-flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:opacity-70 transition cursor-pointer"
          style={{ color: PALETTE.muted }}
          aria-label="Delete meal"
        >
          <Trash2 size={15} />
        </span>
      </div>
    </div>
  </button>
);

/* ─────────────────────── Corner Bracket ─────────────────────── */

const CornerBracket = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const rotate = { tl: '', tr: 'rotate-90', bl: '-rotate-90', br: 'rotate-180' }[position];
  return (
    <div
      className={`absolute w-10 h-10 ${position === 'tl' ? 'top-0 left-0' : position === 'tr' ? 'top-0 right-0' : position === 'bl' ? 'bottom-0 left-0' : 'bottom-0 right-0'} ${rotate}`}
    >
      <svg
        viewBox="0 0 40 40"
        className="w-full h-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M2 14 V4 a2 2 0 0 1 2-2 H14" />
      </svg>
    </div>
  );
};

/* ─────────────────────── Analyzing ─────────────────────── */

const ANALYZE_STEPS = [
  'Detecting contents',
  'Segmenting ingredients',
  'Estimating volume',
  'Computing macronutrients',
];

const AnalyzingView = ({ onCancel }: { onCancel: () => void }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZE_STEPS.length)), 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: PALETTE.carbon }}>
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          type="button"
          aria-label="Back"
          onClick={onCancel}
          className="h-11 w-11 -ml-2 flex items-center justify-center rounded-full text-white/70 hover:bg-white/10 transition"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-white">
          Analyzing
        </div>
        <div className="h-11 w-11" />
      </div>

      <div className="flex-1 flex flex-col px-5">
        <div
          className="relative w-full rounded-[28px] overflow-hidden"
          style={{ aspectRatio: '4/5', background: PALETTE.carbon2 }}
        >
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)',
            }}
          />
          <div className="absolute inset-6 grid grid-cols-3 grid-rows-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-white/10"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  animation: `pulse 1.6s ease-in-out ${i * 120}ms infinite`,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center mb-3 relative">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping absolute" />
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <NL className="text-white tracking-[0.28em]">Analyzing</NL>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          {ANALYZE_STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'live' : 'todo';
            return (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${
                    state === 'done'
                      ? 'border-white bg-white/10 text-white'
                      : state === 'live'
                        ? 'border-white/60 text-white/80'
                        : 'border-white/15 text-white/30'
                  }`}
                >
                  {state === 'done' ? (
                    <Check size={11} strokeWidth={2} />
                  ) : state === 'live' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                  )}
                </div>
                <span
                  className={`text-[12px] tracking-wide ${
                    state === 'todo' ? 'text-white/30' : 'text-white/85'
                  }`}
                >
                  {s}
                </span>
                {state === 'live' && (
                  <div className="ml-auto flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1 w-1 rounded-full bg-white/60"
                        style={{ animation: `pulse 1s ${d * 150}ms infinite` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-auto mb-8">
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-12 rounded-2xl border border-white/15 text-white/80 text-[11px] font-medium uppercase tracking-[0.22em] hover:bg-white/5 transition"
          >
            Cancel analysis
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Result View ─────────────────────── */

type ResultInitial =
  | HistoryItem
  | (NutritionResponse & {
      id?: string;
      time?: string;
      portion?: number;
      baseCalories?: number;
      baseMacros?: { protein: number; carbs: number; fat: number };
      estimatedWeightGrams?: number;
    });

const ResultView = ({
  initial,
  image,
  onBack,
  onSave,
  mode,
  isSaving,
  onUpdateMacros,
  onUpdatePortion,
}: {
  initial: ResultInitial;
  image?: string | null;
  onBack: () => void;
  onSave: (portion: number, macros: { protein: number; carbs: number; fat: number }) => void;
  mode: 'scan' | 'detail';
  isSaving?: boolean;
  onUpdateMacros?: (macros: { protein: number; carbs: number; fat: number }) => void;
  onUpdatePortion?: (portion: number) => void;
}) => {
  const basePortion = (initial as HistoryItem).portion ?? 1;
  const [portion, setPortion] = useState(basePortion);
  const [name, setName] = useState(initial.mealName);
  const [editName, setEditName] = useState(false);
  const [editing, setEditing] = useState<'protein' | 'carbs' | 'fat' | null>(null);
  const [macros, setMacros] = useState({
    protein: (initial as HistoryItem).baseMacros?.protein ?? initial.macros.protein / basePortion,
    carbs: (initial as HistoryItem).baseMacros?.carbs ?? initial.macros.carbs / basePortion,
    fat: (initial as HistoryItem).baseMacros?.fat ?? initial.macros.fat / basePortion,
  });
  const [showMicros, setShowMicros] = useState(false);

  const cal = Math.round(caloriesFromMacros(macros.protein, macros.carbs, macros.fat) * portion);
  const macroAt = (k: 'protein' | 'carbs' | 'fat') => Math.round(macros[k] * portion);

  const proteinKcal = macroAt('protein') * 4;
  const carbsKcal = macroAt('carbs') * 4;
  const fatKcal = macroAt('fat') * 9;
  const macroTotal = Math.max(proteinKcal + carbsKcal + fatKcal, 1);

  return (
    <div className="flex flex-col h-full" style={{ background: PALETTE.bg, color: PALETTE.fg }}>
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="h-11 w-11 -ml-2 flex items-center justify-center rounded-full transition hover:opacity-70 active:scale-95"
          style={{ color: PALETTE.fg }}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div
          className="text-[11px] font-medium uppercase tracking-[0.28em]"
          style={{ color: PALETTE.fg }}
        >
          {mode === 'scan' ? 'Review' : 'Meal details'}
        </div>
        <div className="h-11 w-11 -mr-2 flex items-center justify-center">
          <NL>{mode === 'scan' ? 'AI scan' : 'History'}</NL>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        <div
          className="mx-5 rounded-2xl border overflow-hidden mb-4"
          style={{ borderColor: PALETTE.border }}
        >
          <div
            className="relative"
            style={{
              aspectRatio: '16/9',
              background: PALETTE.surface2,
              backgroundImage: image
                ? undefined
                : `repeating-linear-gradient(135deg, ${PALETTE.border} 0 2px, transparent 2px 14px)`,
            }}
          >
            {image ? (
              <Image src={image} alt="Meal" fill className="object-cover" unoptimized />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full border"
                  style={{ background: PALETTE.bg, borderColor: PALETTE.border }}
                >
                  <ImageIcon size={12} strokeWidth={1.5} style={{ color: PALETTE.muted }} />
                  <NN
                    className="text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: PALETTE.muted } as React.CSSProperties}
                  >
                    Meal photo
                  </NN>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <NL>Detected meal</NL>
            <div className="h-px flex-1" style={{ background: PALETTE.border }} />
          </div>
          <button
            type="button"
            onClick={() => setEditName(true)}
            className="group w-full text-left flex items-start gap-2"
          >
            {editName ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditName(false);
                }}
                className="text-[22px] font-medium leading-tight bg-transparent outline-none w-full border-b"
                style={{ color: PALETTE.fg, borderColor: PALETTE.fg }}
              />
            ) : (
              <>
                <h2
                  className="text-[22px] font-medium leading-tight flex-1"
                  style={{ color: PALETTE.fg }}
                >
                  {name}
                </h2>
                <Pencil size={14} className="mt-2 transition" style={{ color: PALETTE.muted }} />
              </>
            )}
          </button>
          {initial.estimatedWeightGrams != null && (
            <NN
              className="block mt-2 text-[11px]"
              style={{ color: PALETTE.muted } as React.CSSProperties}
            >
              ≈ {Math.round(initial.estimatedWeightGrams * portion)} g
            </NN>
          )}
        </div>

        <div
          className="mx-5 mb-5 border rounded-2xl p-5"
          style={{ borderColor: PALETTE.border, background: PALETTE.surface }}
        >
          <div className="flex items-end justify-between mb-4">
            <div>
              <NL>Total energy</NL>
              <div className="mt-1 flex items-baseline gap-1.5">
                <NN
                  className="text-[40px] font-medium leading-none tracking-tight"
                  style={{ color: PALETTE.fg } as React.CSSProperties}
                >
                  {cal}
                </NN>
                <NL className="text-[10px]">kcal</NL>
              </div>
            </div>
            {initial.estimatedWeightGrams != null && initial.estimatedWeightGrams > 0 && (
              <div className="text-right">
                <NL>Density</NL>
                <NN
                  className="block mt-1 text-[13px] font-medium"
                  style={{ color: PALETTE.fg } as React.CSSProperties}
                >
                  {(cal / (initial.estimatedWeightGrams * portion)).toFixed(2)} kcal/g
                </NN>
              </div>
            )}
          </div>
          <div>
            <div
              className="flex h-2 rounded-full overflow-hidden border"
              style={{ borderColor: PALETTE.border }}
            >
              <div
                style={{ width: `${(proteinKcal / macroTotal) * 100}%`, background: PALETTE.fg }}
              />
              <div
                style={{ width: `${(carbsKcal / macroTotal) * 100}%`, background: PALETTE.ink2 }}
              />
              <div
                style={{ width: `${(fatKcal / macroTotal) * 100}%`, background: PALETTE.ink3 }}
              />
            </div>
            <div className="mt-2 flex justify-between">
              <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                P {Math.round((proteinKcal / macroTotal) * 100)}%
              </NN>
              <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                C {Math.round((carbsKcal / macroTotal) * 100)}%
              </NN>
              <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                F {Math.round((fatKcal / macroTotal) * 100)}%
              </NN>
            </div>
          </div>
        </div>

        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <NL>Portion consumed</NL>
            <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
              ×{portion === 1 ? '1.00' : portion.toFixed(2)}
            </NN>
          </div>
          <div className="border rounded-2xl p-1 flex" style={{ borderColor: PALETTE.border }}>
            {PORTIONS.map((p) => {
              const active = Math.abs(portion - p.value) < 0.001;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setPortion(p.value);
                    onUpdatePortion?.(p.value);
                  }}
                  className={`flex-1 min-h-[44px] rounded-xl text-[12px] font-medium transition ${
                    active ? '' : 'hover:opacity-70'
                  }`}
                  style={
                    active
                      ? { background: PALETTE.fg, color: PALETTE.bg }
                      : { color: PALETTE.muted }
                  }
                >
                  <NN>{p.label}</NN>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <NL>Macronutrients</NL>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { k: 'protein' as const, label: 'Protein', unit: 'g', kcalFactor: 4 },
                { k: 'carbs' as const, label: 'Carbs', unit: 'g', kcalFactor: 4 },
                { k: 'fat' as const, label: 'Fat', unit: 'g', kcalFactor: 9 },
              ] as const
            ).map((m, idx) => {
              const isEditing = editing === m.k;
              return (
                <div
                  key={m.k}
                  className="relative border rounded-2xl p-3 transition"
                  style={{
                    borderColor: isEditing ? PALETTE.fg : PALETTE.border,
                    background: PALETTE.surface,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <NL className="text-[9px]">{m.label}</NL>
                    <button
                      type="button"
                      aria-label={`Edit ${m.label}`}
                      onClick={() => {
                        if (isEditing && onUpdateMacros) onUpdateMacros(macros);
                        setEditing(isEditing ? null : m.k);
                      }}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                      style={{ color: PALETTE.muted }}
                    >
                      {isEditing ? <Check size={12} /> : <Pencil size={11} />}
                    </button>
                  </div>
                  {isEditing ? (
                    <input
                      autoFocus
                      type="number"
                      value={macros[m.k]}
                      onChange={(e) => setMacros({ ...macros, [m.k]: Number(e.target.value) || 0 })}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditing(null);
                      }}
                      className="w-full bg-transparent outline-none font-mono tabular-nums text-[22px] font-medium border-b"
                      style={{ color: PALETTE.fg, borderColor: PALETTE.fg }}
                    />
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <NN
                        className="text-[22px] font-medium leading-none"
                        style={{ color: PALETTE.fg } as React.CSSProperties}
                      >
                        {macroAt(m.k)}
                      </NN>
                      <NN
                        className="text-[10px]"
                        style={{ color: PALETTE.muted } as React.CSSProperties}
                      >
                        {m.unit}
                      </NN>
                    </div>
                  )}
                  <NN
                    className="block mt-1.5 text-[9px]"
                    style={{ color: PALETTE.muted } as React.CSSProperties}
                  >
                    {Math.round(macroAt(m.k) * m.kcalFactor)} kcal
                  </NN>
                  <div
                    className="mt-2 h-[3px] rounded-full overflow-hidden"
                    style={{ background: PALETTE.surface2 }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((macroAt(m.k) / (m.k === 'protein' ? 60 : m.k === 'carbs' ? 90 : 40)) * 100, 100)}%`,
                        background:
                          idx === 0 ? PALETTE.fg : idx === 1 ? PALETTE.ink2 : PALETTE.ink3,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {initial.micros && initial.micros.length > 0 && (
          <div className="px-5 mb-5">
            <button
              type="button"
              onClick={() => setShowMicros((s) => !s)}
              className="w-full flex items-center justify-between py-3 border-t min-h-[44px]"
              style={{ borderColor: PALETTE.border }}
            >
              <NL>Micronutrients</NL>
              <div className="flex items-center gap-2" style={{ color: PALETTE.muted }}>
                <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                  {initial.micros.length} entries
                </NN>
                {showMicros ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {showMicros && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 pb-2">
                {initial.micros.map((mi, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between border-b border-dashed pb-1.5"
                    style={{ borderColor: PALETTE.border }}
                  >
                    <NL className="text-[9px]">{mi.name}</NL>
                    <NN
                      className="text-[11px] font-medium"
                      style={{ color: PALETTE.fg } as React.CSSProperties}
                    >
                      {mi.amount}
                    </NN>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="absolute left-0 right-0 bottom-0 px-5 pt-6 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${PALETTE.bg} 50%, transparent)`,
          paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)',
        }}
      >
        <div className="pointer-events-auto flex gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="px-4 rounded-2xl border flex items-center gap-2 active:scale-[0.98] transition hover:opacity-80"
            style={{
              height: 52,
              borderColor: PALETTE.border,
              background: PALETTE.surface,
              color: PALETTE.fg,
            }}
          >
            <RotateCcw size={16} strokeWidth={1.75} />
            <NL className="text-[10px]">Retake</NL>
          </button>
          <button
            type="button"
            onClick={() => onSave(portion, macros)}
            disabled={isSaving}
            className="flex-1 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition hover:opacity-90 disabled:opacity-50"
            style={{ height: 52, background: PALETTE.fg, color: PALETTE.bg }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Check size={16} strokeWidth={2} />
                <span className="text-[12px] font-medium uppercase tracking-[0.22em]">
                  {mode === 'scan' ? 'Add to log' : 'Save'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Settings Sheet ─────────────────────── */

interface NutritionProfileSnapshot {
  height: number;
  age: number;
  gender: Gender;
  activityLevel: number;
  goal: GoalType;
}

const SettingsSheet = ({
  open,
  onClose,
  bodyWeight,
  nutritionProfile,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  bodyWeight: number;
  nutritionProfile: NutritionProfileSnapshot;
  onSave: (data: {
    weight: number;
    height: number;
    age: number;
    gender: Gender;
    activity: number;
    goal: GoalType;
  }) => void;
  isSaving: boolean;
}) => {
  const [weight, setWeight] = useState(bodyWeight);
  const [height, setHeight] = useState(nutritionProfile.height);
  const [age, setAge] = useState(nutritionProfile.age);
  const [gender, setGender] = useState<Gender>(nutritionProfile.gender);
  const [activity, setActivity] = useState(nutritionProfile.activityLevel);
  const [goal, setGoal] = useState<GoalType>(nutritionProfile.goal);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div role="presentation" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full rounded-t-[28px] border-t max-h-[88%] overflow-y-auto"
        style={{ background: PALETTE.bg, borderColor: PALETTE.border }}
      >
        <div className="px-5 pt-3 pb-2 flex justify-center">
          <div className="h-1 w-9 rounded-full" style={{ background: PALETTE.border }} />
        </div>
        <div className="px-5 pb-2 pt-1 flex items-center justify-between">
          <div className="text-[16px] font-medium" style={{ color: PALETTE.fg }}>
            Settings
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="h-11 w-11 rounded-full flex items-center justify-center hover:opacity-70"
            style={{ color: PALETTE.fg }}
          >
            <X size={16} />
          </button>
        </div>
        <HDivider />

        <div className="px-5 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Weight', val: weight, set: setWeight, u: 'kg' },
              { l: 'Height', val: height, set: setHeight, u: 'cm' },
              { l: 'Age', val: age, set: setAge, u: 'yrs' },
            ].map((f) => (
              <div
                key={f.l}
                className="border rounded-xl p-3"
                style={{ borderColor: PALETTE.border }}
              >
                <NL>{f.l}</NL>
                <div className="mt-1 flex items-baseline gap-1">
                  <input
                    type="number"
                    value={f.val}
                    onChange={(e) => f.set(Number(e.target.value) || 0)}
                    className="bg-transparent outline-none font-mono tabular-nums text-[20px] font-medium w-full"
                    style={{ color: PALETTE.fg }}
                  />
                  <NL className="text-[9px]">{f.u}</NL>
                </div>
              </div>
            ))}
            <div className="border rounded-xl p-3" style={{ borderColor: PALETTE.border }}>
              <NL>Sex</NL>
              <div className="mt-2 flex gap-1">
                {(['male', 'female'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className="flex-1 min-h-[44px] rounded-lg text-[12px] font-medium transition"
                    style={
                      gender === g
                        ? { background: PALETTE.fg, color: PALETTE.bg }
                        : { color: PALETTE.muted, border: `1px solid ${PALETTE.border}` }
                    }
                  >
                    {g === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <NL className="mb-2 block">Goal</NL>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { k: 'cut' as GoalType, l: 'Cut' },
                  { k: 'maintain' as GoalType, l: 'Maintain' },
                  { k: 'bulk' as GoalType, l: 'Bulk' },
                ] as const
              ).map((g) => (
                <button
                  key={g.k}
                  type="button"
                  onClick={() => setGoal(g.k)}
                  className="min-h-[44px] rounded-xl border text-[11px] font-medium uppercase tracking-[0.18em] transition"
                  style={
                    goal === g.k
                      ? { background: PALETTE.fg, color: PALETTE.bg, borderColor: PALETTE.fg }
                      : { borderColor: PALETTE.border, color: PALETTE.muted }
                  }
                >
                  {g.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <NL className="mb-2 block">Activity</NL>
            <div className="space-y-2">
              {ACTIVITY_OPTIONS.map((a) => {
                const active = Math.abs(activity - a.value) < 0.01;
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setActivity(a.value)}
                    className="w-full min-h-[48px] px-4 rounded-xl border flex items-center justify-between transition"
                    style={{ borderColor: active ? PALETTE.fg : PALETTE.border }}
                  >
                    <span className="text-[13px] font-medium" style={{ color: PALETTE.fg }}>
                      {a.label}
                    </span>
                    <div className="flex items-center gap-3">
                      <NN
                        className="text-[10px]"
                        style={{ color: PALETTE.muted } as React.CSSProperties}
                      >
                        {a.sub}
                      </NN>
                      <span
                        className="h-3.5 w-3.5 rounded-full border"
                        style={
                          active
                            ? { background: PALETTE.fg, borderColor: PALETTE.fg }
                            : { borderColor: PALETTE.border }
                        }
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSave({ weight, height, age, gender, activity, goal })}
            disabled={isSaving}
            className="w-full h-12 rounded-2xl text-[12px] font-medium uppercase tracking-[0.22em] disabled:opacity-50 transition"
            style={{ background: PALETTE.fg, color: PALETTE.bg }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Manual Entry Sheet ─────────────────────── */

const ManualSheet = ({
  open,
  onClose,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => void;
  isSaving: boolean;
}) => {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  if (!open) return null;

  const handleSave = () => {
    if (!name || !calories || !protein || !carbs || !fat) {
      toast.error('Please fill in every field.');
      return;
    }
    onSave({
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
    });
    setName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div role="presentation" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full rounded-t-[28px] border-t max-h-[88%] overflow-y-auto"
        style={{ background: PALETTE.bg, borderColor: PALETTE.border }}
      >
        <div className="px-5 pt-3 pb-2 flex justify-center">
          <div className="h-1 w-9 rounded-full" style={{ background: PALETTE.border }} />
        </div>
        <div className="px-5 pb-2 pt-1 flex items-center justify-between">
          <div className="text-[16px] font-medium" style={{ color: PALETTE.fg }}>
            Manual entry
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="h-11 w-11 rounded-full flex items-center justify-center hover:opacity-70"
            style={{ color: PALETTE.fg }}
          >
            <X size={16} />
          </button>
        </div>
        <HDivider />

        <div className="px-5 py-5 space-y-4">
          <div>
            <NL className="block mb-1.5">Meal name</NL>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Protein shake"
              className="w-full h-12 px-3 rounded-xl border bg-transparent outline-none text-[16px] font-medium"
              style={{ borderColor: PALETTE.border, color: PALETTE.fg }}
            />
          </div>
          <div>
            <NL className="block mb-1.5">Calories (kcal)</NL>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="0"
              className="w-full h-12 px-3 rounded-xl border bg-transparent outline-none font-mono tabular-nums text-[20px] font-medium"
              style={{ borderColor: PALETTE.border, color: PALETTE.fg }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Protein', val: protein, set: setProtein },
              { label: 'Carbs', val: carbs, set: setCarbs },
              { label: 'Fat', val: fat, set: setFat },
            ].map((f) => (
              <div key={f.label}>
                <NL className="block mb-1.5 text-[9px]">{f.label} (g)</NL>
                <input
                  type="number"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder="0"
                  className="w-full h-12 px-2 rounded-xl border bg-transparent outline-none font-mono tabular-nums text-[18px] font-medium text-center"
                  style={{ borderColor: PALETTE.border, color: PALETTE.fg }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-12 rounded-2xl text-[12px] font-medium uppercase tracking-[0.22em] mt-2 disabled:opacity-50"
            style={{ background: PALETTE.fg, color: PALETTE.bg }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Add to log'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Main Page ─────────────────────── */

type ViewType = 'dashboard' | 'scanner' | 'analyzing' | 'result' | 'detail';

export interface NutritionScreenProps {
  /** Called when the user taps the dashboard back button. Defaults to router.back(). */
  onBack?: () => void;
  /**
   * Extra pixels of space the screen should leave at the bottom (e.g. when rendered
   * inside the main app behind a BottomNav). Default: 0.
   */
  bottomInset?: number;
  /** Hides the dashboard back button entirely (use when navigation is handled outside). */
  hideBackButton?: boolean;
}

export function NutritionScreen({
  onBack,
  bottomInset = 0,
  hideBackButton = false,
}: NutritionScreenProps = {}) {
  useSkin();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBack = onBack ?? (() => router.back());

  const { profile: appProfile, updateBodyweight, updateProfile } = useStore();
  const bodyWeight = appProfile?.body_weight || 80;

  const nutritionProfile = useMemo<NutritionProfileSnapshot>(
    () => ({
      height: appProfile?.height ?? 180,
      age: calculateAge(appProfile?.birth_date ?? ''),
      gender: appProfile?.gender ?? 'male',
      activityLevel: appProfile?.activity_level ?? 1.55,
      goal: appProfile?.goal_program ?? 'maintain',
    }),
    [appProfile]
  );

  const { meals, addMeal, removeMeal, updateMealPortion, updateMealMacros } = useNutritionStore();

  const isHydrated = useIsHydrated();

  const [view, setView] = useState<ViewType>('dashboard');
  const [image, setImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<NutritionResponse | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<HistoryItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const targets = useMemo(
    () =>
      calculateTargets(
        nutritionProfile.height,
        nutritionProfile.age,
        nutritionProfile.gender,
        nutritionProfile.activityLevel,
        nutritionProfile.goal,
        bodyWeight
      ),
    [nutritionProfile, bodyWeight]
  );

  const totals = useMemo(
    () =>
      meals.reduce(
        (acc, meal) => ({
          calories: acc.calories + meal.calories,
          protein: acc.protein + meal.macros.protein,
          carbs: acc.carbs + meal.macros.carbs,
          fat: acc.fat + meal.macros.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [meals]
  );

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setScanResult(null);
      setView('analyzing');
      const response = await fetch('/api/nutrition/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: compressed }),
      });
      if (!response.ok) throw new Error('Scan request failed');
      const data: NutritionResponse = await response.json();
      setScanResult(data);
      setView('result');
    } catch (error) {
      console.error('Scan capture failed', error);
      toast.error('The AI could not analyze this image.');
      setImage(null);
      setView('scanner');
    }
  };

  const handleSaveScanned = async (
    portion: number,
    macros: { protein: number; carbs: number; fat: number }
  ) => {
    if (!scanResult) return;
    setIsSaving(true);
    const finalCalories = Math.round(
      caloriesFromMacros(macros.protein, macros.carbs, macros.fat) * portion
    );
    const finalProtein = Math.round(macros.protein * portion);
    const finalCarbs = Math.round(macros.carbs * portion);
    const finalFat = Math.round(macros.fat * portion);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('nutrition_logs').insert({
          user_id: user.id,
          meal_name: scanResult.mealName,
          calories: finalCalories,
          protein: finalProtein,
          carbs: finalCarbs,
          fat: finalFat,
          micros: scanResult.micros,
          image_url: null,
        });
      }
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      addMeal({
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        timestamp: Date.now(),
        mealName: scanResult.mealName,
        calories: finalCalories,
        macros: { protein: finalProtein, carbs: finalCarbs, fat: finalFat },
        micros: scanResult.micros,
        portion,
        baseCalories: scanResult.calories,
        baseMacros: macros,
        estimatedWeightGrams: scanResult.estimatedWeightGrams,
      });
      toast.success('Meal saved.');
      setImage(null);
      setScanResult(null);
      setView('dashboard');
    } catch (error) {
      console.error('Meal save failed', error);
      toast.error('Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (data: {
    weight: number;
    height: number;
    age: number;
    gender: Gender;
    activity: number;
    goal: GoalType;
  }) => {
    setIsSaving(true);
    try {
      if (data.weight !== bodyWeight) await updateBodyweight(data.weight);
      await updateProfile({
        height: data.height,
        gender: data.gender,
        activity_level: data.activity,
        goal_program: data.goal,
      });
      toast.success('Settings updated.');
      setSettingsOpen(false);
    } catch (error) {
      console.error('Settings save failed', error);
      toast.error('Update failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async (data: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => {
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('nutrition_logs').insert({
          user_id: user.id,
          meal_name: data.name,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          micros: [],
          image_url: null,
        });
      }
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      addMeal({
        id: Math.random().toString(36).substring(2, 9),
        time: timeStr,
        timestamp: Date.now(),
        mealName: data.name,
        calories: data.calories,
        macros: { protein: data.protein, carbs: data.carbs, fat: data.fat },
        micros: [],
        portion: 1,
      });
      toast.success('Meal added.');
      setManualOpen(false);
    } catch (error) {
      console.error('Manual save failed', error);
      toast.error('Could not add the meal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    removeMeal(id);
    toast.success('Meal removed.');
  };

  const openMealDetail = (meal: HistoryItem) => {
    setSelectedMeal(meal);
    setView('detail');
  };

  if (!isHydrated) return null;

  const renderDashboard = () => (
    <div className="flex flex-col h-full" style={{ background: PALETTE.bg }}>
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        {hideBackButton ? (
          <div className="h-11 w-11" />
        ) : (
          <button
            type="button"
            aria-label="Back"
            onClick={handleBack}
            className="h-11 w-11 -ml-2 flex items-center justify-center rounded-full transition active:scale-95 hover:opacity-70"
            style={{ color: PALETTE.fg }}
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
        )}
        <div
          className="text-[11px] font-medium uppercase tracking-[0.28em]"
          style={{ color: PALETTE.fg }}
        >
          Nutrition
        </div>
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setSettingsOpen(true)}
          className="h-11 w-11 -mr-2 flex items-center justify-center rounded-full transition hover:opacity-70 active:scale-95"
          style={{ color: PALETTE.fg }}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        <div className="px-5 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[20px] font-medium leading-tight" style={{ color: PALETTE.fg }}>
              Today
            </div>
            <NN
              className="text-[11px] tracking-[0.05em]"
              style={{ color: PALETTE.muted } as React.CSSProperties}
            >
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              })}
            </NN>
          </div>
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-full border"
            style={{ borderColor: PALETTE.border }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ background: PALETTE.fg }}
            />
            <NL className="text-[9px] tracking-[0.2em]">{GOAL_LABELS[nutritionProfile.goal]}</NL>
          </div>
        </div>

        <div className="py-2">
          <CalorieRing consumed={totals.calories} goal={targets.targetCalories} />
        </div>

        <div
          className="mx-5 mt-5 mb-7 grid grid-cols-2 border rounded-2xl overflow-hidden"
          style={{ borderColor: PALETTE.border }}
        >
          {[
            { l: 'Meals', v: meals.length, s: 'logged' },
            { l: 'Remaining', v: Math.max(0, targets.targetCalories - totals.calories), s: 'kcal' },
          ].map((s, i) => (
            <div
              key={s.l}
              className="px-3 py-3 text-center"
              style={i > 0 ? { borderLeft: `1px solid ${PALETTE.border}` } : undefined}
            >
              <NN
                className="block text-[18px] font-medium leading-none"
                style={{ color: PALETTE.fg } as React.CSSProperties}
              >
                {s.v}
              </NN>
              <div className="mt-1.5 flex items-center justify-center gap-1">
                <NL className="text-[8px] tracking-[0.22em]">{s.l}</NL>
                <NN className="text-[8px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                  {s.s}
                </NN>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <NL>Macronutrients</NL>
            <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
              P · C · F
            </NN>
          </div>
          <div className="space-y-5">
            <MacroBar
              label="Protein"
              current={totals.protein}
              target={targets.targetProtein}
              shade="fg"
            />
            <MacroBar
              label="Carbs"
              current={totals.carbs}
              target={targets.targetCarbs}
              shade="mid"
            />
            <MacroBar label="Fat" current={totals.fat} target={targets.targetFat} shade="low" />
          </div>
        </div>

        <div className="px-5">
          <div className="flex items-center justify-between mb-2">
            <NL>Today&apos;s log</NL>
            <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
              {meals.length} entries
            </NN>
          </div>
          <div
            className="border rounded-2xl overflow-hidden"
            style={{ borderColor: PALETTE.border, background: PALETTE.surface }}
          >
            {meals.length === 0 ? (
              <div className="py-8 text-center">
                <NL>No meals logged</NL>
              </div>
            ) : (
              meals.map((m, i) => (
                <div
                  key={m.id}
                  style={i > 0 ? { borderTop: `1px solid ${PALETTE.border}` } : undefined}
                >
                  <MealRow meal={m} onOpen={openMealDetail} onDelete={handleDelete} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className="absolute left-0 right-0 px-5 pt-10 pointer-events-none"
        style={{
          bottom: `${bottomInset}px`,
          background: `linear-gradient(to top, ${PALETTE.bg} 60%, transparent)`,
          paddingBottom: 'calc(var(--safe-bottom) + 1.5rem)',
        }}
      >
        <div className="pointer-events-auto flex gap-2.5">
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="h-14 px-4 rounded-2xl border flex items-center gap-2 active:scale-[0.98] transition hover:opacity-80"
            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.fg }}
          >
            <Plus size={18} strokeWidth={1.75} />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Manual</span>
          </button>
          <button
            type="button"
            onClick={() => setView('scanner')}
            className="h-14 flex-1 rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition hover:opacity-90"
            style={{ background: PALETTE.fg, color: PALETTE.bg }}
          >
            <Camera size={18} strokeWidth={1.75} />
            <span className="text-[12px] font-medium uppercase tracking-[0.22em]">Scan meal</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderScanner = () => (
    <div className="absolute inset-0 flex flex-col" style={{ background: PALETTE.carbon }}>
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setView('dashboard')}
          className="h-11 w-11 -ml-2 flex items-center justify-center rounded-full text-white/70 hover:bg-white/10 transition"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-white">
          Scanner
        </div>
        <div className="h-11 w-11 -mr-2 flex items-center justify-center text-white/40">
          <Camera size={18} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div
          className="relative w-full rounded-[28px] overflow-hidden"
          style={{ aspectRatio: '4/5', background: PALETTE.carbon2 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 8px, transparent 8px 16px)',
            }}
          />
          <div className="absolute inset-0 flex">
            <div className="flex-1 border-r border-white/5" />
            <div className="flex-1 border-r border-white/5" />
            <div className="flex-1" />
          </div>
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 border-b border-white/5" />
            <div className="flex-1 border-b border-white/5" />
            <div className="flex-1" />
          </div>
          <div className="absolute inset-4 text-white/80">
            <CornerBracket position="tl" />
            <CornerBracket position="tr" />
            <CornerBracket position="bl" />
            <CornerBracket position="br" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-px w-3 bg-white/40" />
            <div className="absolute h-3 w-px bg-white/40" />
            <div className="absolute h-10 w-10 rounded-full border border-white/15" />
          </div>
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <NL className="text-white/80 text-[9px] tracking-[0.22em]">Frame the dish</NL>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 2.5rem)' }}>
        <div className="flex items-center justify-center gap-6 mb-6">
          <NL className="text-white/40 tracking-[0.22em]">Gallery</NL>
          <NL className="text-white tracking-[0.22em]">AI scan</NL>
          <NL className="text-white/40 tracking-[0.22em]">Barcode</NL>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Open gallery"
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 rounded-2xl border border-white/15 flex items-center justify-center text-white/70 hover:bg-white/5 transition"
          >
            <ImageIcon size={18} />
          </button>
          <button
            type="button"
            aria-label="Capture meal"
            onClick={() => fileInputRef.current?.click()}
            className="relative h-20 w-20 rounded-full border-2 border-white/80 flex items-center justify-center active:scale-95 transition"
          >
            <span className="h-[60px] w-[60px] rounded-full bg-white" />
          </button>
          <button
            type="button"
            aria-label="Reset"
            onClick={() => {
              setImage(null);
              setScanResult(null);
            }}
            className="h-12 w-12 rounded-2xl border border-white/15 flex items-center justify-center text-white/70 hover:bg-white/5 transition"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleCapture}
      />
    </div>
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ ...cssVars, background: PALETTE.bg } as React.CSSProperties}
    >
      <div className="relative h-full overflow-hidden" style={{ maxWidth: 480, margin: '0 auto' }}>
        {view === 'dashboard' && renderDashboard()}
        {view === 'scanner' && renderScanner()}
        {view === 'analyzing' && (
          <AnalyzingView
            onCancel={() => {
              setView('scanner');
              setImage(null);
            }}
          />
        )}
        {view === 'result' && scanResult && (
          <ResultView
            initial={{
              ...scanResult,
              id: undefined,
              time: undefined,
              portion: 1,
              baseCalories: scanResult.calories,
              baseMacros: scanResult.macros,
            }}
            image={image}
            onBack={() => setView('scanner')}
            onSave={handleSaveScanned}
            mode="scan"
            isSaving={isSaving}
          />
        )}
        {view === 'detail' && selectedMeal && (
          <ResultView
            initial={selectedMeal}
            image={null}
            onBack={() => {
              setSelectedMeal(null);
              setView('dashboard');
            }}
            onSave={(portion, macros) => {
              updateMealPortion(selectedMeal.id, portion);
              updateMealMacros(selectedMeal.id, macros);
              setSelectedMeal(null);
              setView('dashboard');
              toast.success('Meal updated.');
            }}
            onUpdatePortion={(p) => updateMealPortion(selectedMeal.id, p)}
            onUpdateMacros={(m) => updateMealMacros(selectedMeal.id, m)}
            mode="detail"
            isSaving={isSaving}
          />
        )}

        <SettingsSheet
          key={
            settingsOpen
              ? `${bodyWeight}-${nutritionProfile.height}-${nutritionProfile.age}-${nutritionProfile.gender}-${nutritionProfile.activityLevel}-${nutritionProfile.goal}`
              : 'settings-closed'
          }
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          bodyWeight={bodyWeight}
          nutritionProfile={nutritionProfile}
          onSave={handleSaveSettings}
          isSaving={isSaving}
        />
        <ManualSheet
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          onSave={handleManualSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}

/**
 * Route entry point. Renders the same screen as the inline `<NutritionScreen />`
 * used by the main app tab, but falls back to `router.back()` for the close button
 * and provides its own viewport sizing.
 */
export default function NutritionRoutePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="relative w-full max-w-md mx-auto" style={{ height: '100svh' }}>
        <NutritionScreen />
      </div>
    </div>
  );
}
