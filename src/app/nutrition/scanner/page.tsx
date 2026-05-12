'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
import {
  useNutritionStore,
  calculateTargets,
  GoalType,
  HistoryItem,
  GenderType,
} from '@/store/useNutritionStore';
import { useStore, calculateAge } from '@/store/useStore';
/* ─────────────────────── Utilities ─────────────────────── */

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
      const img = new window.Image();
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1024;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) {
            height *= MAX / width;
            width = MAX;
          }
        } else {
          if (height > MAX) {
            width *= MAX / height;
            height = MAX;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

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

/* ─────────────────────── Design tokens (scoped) ─────────────────────── */

const PALETTE = {
  bg: '#ffffff',
  surface: '#fcfcfc',
  surface2: '#f3f3f2',
  border: '#e7e6e3',
  muted: '#8a8884',
  ink3: '#b8b6b1',
  ink2: '#5a5854',
  fg: '#0f0f0e',
  carbon: '#0c0c0b',
  carbon2: '#161614',
} as const;

const cssVars: React.CSSProperties = {
  '--n-bg': PALETTE.bg,
  '--n-surface': PALETTE.surface,
  '--n-surface-2': PALETTE.surface2,
  '--n-border': PALETTE.border,
  '--n-muted': PALETTE.muted,
  '--n-ink-3': PALETTE.ink3,
  '--n-ink-2': PALETTE.ink2,
  '--n-fg': PALETTE.fg,
  '--n-carbon': PALETTE.carbon,
  '--n-carbon-2': PALETTE.carbon2,
  fontFamily: 'var(--font-geist, ui-sans-serif, system-ui, sans-serif)',
} as React.CSSProperties;

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
    style={{ color: 'var(--n-muted)', ...style }}
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
  <div className={`h-px w-full ${className}`} style={{ background: 'var(--n-border)' }} />
);

/* ─────────────────────── CalorieRing ─────────────────────── */

const CalorieRing = ({ consumed, goal }: { consumed: number; goal: number }) => {
  const size = 220;
  const stroke = 3;
  const r = (size - stroke * 2) / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.min(consumed / goal, 1);
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
                stroke={filled ? PALETTE.fg : PALETTE.border}
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
          stroke={PALETTE.border}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={PALETTE.fg}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-center gap-1.5 mb-2" style={{ color: PALETTE.muted }}>
          <Flame size={11} strokeWidth={1.5} />
          <NL className="tracking-[0.22em]">Énergie</NL>
        </div>
        <NN
          className="text-[44px] leading-none font-medium tracking-tight"
          style={{ color: PALETTE.fg } as React.CSSProperties}
        >
          {consumed.toLocaleString('fr-FR')}
        </NN>
        <div className="mt-1.5 flex items-center gap-1.5">
          <NN className="text-[11px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
            / {goal.toLocaleString('fr-FR')}
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
          <NL className="text-[9px] tracking-[0.18em]">restantes</NL>
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
  const pct = Math.min((current / target) * 100, 100);
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
    onClick={() => onOpen(meal)}
    className="w-full text-left group relative pl-6 pr-2 py-3.5 hover:bg-[#f3f3f2]/60 transition-colors"
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
            { dot: PALETTE.ink2, val: meal.macros.carbs, unit: 'G' },
            { dot: PALETTE.ink3, val: meal.macros.fat, unit: 'L' },
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
          className="ml-2 h-8 w-8 inline-flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#f3f3f2] transition cursor-pointer"
          style={{ color: PALETTE.muted }}
          aria-label="Supprimer"
        >
          <Trash2 size={15} />
        </span>
      </div>
    </div>
  </button>
);

/* ─────────────────────── Corner Bracket (Scanner) ─────────────────────── */

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

/* ─────────────────────── Analyzing Steps ─────────────────────── */

const ANALYZE_STEPS = [
  'Détection du contenu',
  'Segmentation des ingrédients',
  'Estimation du volume',
  'Calcul des macronutriments',
];

const AnalyzingView = ({ onCancel }: { onCancel: () => void }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, ANALYZE_STEPS.length)), 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: PALETTE.carbon }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          onClick={onCancel}
          className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full text-white/70 hover:bg-white/10 transition"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-white">
          Analyse
        </div>
        <div className="h-10 w-10" />
      </div>

      <div className="flex-1 flex flex-col px-5">
        {/* Pulsing frame */}
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
              <NL className="text-white tracking-[0.28em]">Analyse en cours</NL>
            </div>
          </div>
        </div>

        {/* Steps log */}
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
            onClick={onCancel}
            className="w-full h-12 rounded-2xl border border-white/15 text-white/80 text-[11px] font-medium uppercase tracking-[0.22em] hover:bg-white/5 transition"
          >
            Annuler l&apos;analyse
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Result / Detail View ─────────────────────── */

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
  initial:
    | HistoryItem
    | (NutritionResponse & {
        id?: string;
        time?: string;
        portion?: number;
        baseCalories?: number;
        baseMacros?: { protein: number; carbs: number; fat: number };
        estimatedWeightGrams?: number;
      });
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

  const cal = Math.round((macros.protein * 4 + macros.carbs * 4 + macros.fat * 9) * portion);
  const macroAt = (k: 'protein' | 'carbs' | 'fat') => Math.round(macros[k] * portion);

  const p = macroAt('protein') * 4;
  const cg = macroAt('carbs') * 4;
  const f = macroAt('fat') * 9;
  const macroTotal = Math.max(p + cg + f, 1);

  return (
    <div className="flex flex-col h-full" style={{ background: PALETTE.bg, color: PALETTE.fg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          onClick={onBack}
          className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full transition hover:bg-[#f3f3f2] active:scale-95"
          style={{ color: PALETTE.fg }}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div
          className="text-[11px] font-medium uppercase tracking-[0.28em]"
          style={{ color: PALETTE.fg }}
        >
          {mode === 'scan' ? 'Vérifier' : 'Détail repas'}
        </div>
        <div className="h-10 w-10 -mr-2 flex items-center justify-center">
          <NL>{mode === 'scan' ? 'Scan IA' : 'Historique'}</NL>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Image strip */}
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
              <Image src={image} alt="Repas" fill className="object-cover" unoptimized />
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
                    Photo du repas
                  </NN>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="px-5 mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <NL>Repas détecté</NL>
            <div className="h-px flex-1" style={{ background: PALETTE.border }} />
            <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
              conf. 94%
            </NN>
          </div>
          <button
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

        {/* Hero calorie panel */}
        <div
          className="mx-5 mb-5 border rounded-2xl p-5"
          style={{ borderColor: PALETTE.border, background: PALETTE.surface }}
        >
          <div className="flex items-end justify-between mb-4">
            <div>
              <NL>Énergie totale</NL>
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
            {initial.estimatedWeightGrams != null && (
              <div className="text-right">
                <NL>Densité</NL>
                <NN
                  className="block mt-1 text-[13px] font-medium"
                  style={{ color: PALETTE.fg } as React.CSSProperties}
                >
                  {(cal / (initial.estimatedWeightGrams * portion)).toFixed(2)} kcal/g
                </NN>
              </div>
            )}
          </div>
          {/* Stacked distribution bar */}
          <div>
            <div
              className="flex h-2 rounded-full overflow-hidden border"
              style={{ borderColor: PALETTE.border }}
            >
              <div style={{ width: `${(p / macroTotal) * 100}%`, background: PALETTE.fg }} />
              <div style={{ width: `${(cg / macroTotal) * 100}%`, background: PALETTE.ink2 }} />
              <div style={{ width: `${(f / macroTotal) * 100}%`, background: PALETTE.ink3 }} />
            </div>
            <div className="mt-2 flex justify-between">
              <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                P {Math.round((p / macroTotal) * 100)}%
              </NN>
              <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                G {Math.round((cg / macroTotal) * 100)}%
              </NN>
              <NN className="text-[9px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                L {Math.round((f / macroTotal) * 100)}%
              </NN>
            </div>
          </div>
        </div>

        {/* Portion segment control */}
        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <NL>Fraction consommée</NL>
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
                  onClick={() => {
                    setPortion(p.value);
                    onUpdatePortion?.(p.value);
                  }}
                  className={`flex-1 h-10 rounded-xl text-[12px] font-medium transition ${
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

        {/* Editable macro cards */}
        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2">
            <NL>Macronutriments</NL>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { k: 'protein' as const, label: 'Protéines', unit: 'g', kcalFactor: 4 },
                { k: 'carbs' as const, label: 'Glucides', unit: 'g', kcalFactor: 4 },
                { k: 'fat' as const, label: 'Lipides', unit: 'g', kcalFactor: 9 },
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
                      onClick={() => {
                        if (isEditing && onUpdateMacros) onUpdateMacros(macros);
                        setEditing(isEditing ? null : m.k);
                      }}
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

        {/* Micros */}
        {initial.micros && initial.micros.length > 0 && (
          <div className="px-5 mb-5">
            <button
              onClick={() => setShowMicros((s) => !s)}
              className="w-full flex items-center justify-between py-3 border-t"
              style={{ borderColor: PALETTE.border }}
            >
              <NL>Micronutriments</NL>
              <div className="flex items-center gap-2" style={{ color: PALETTE.muted }}>
                <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
                  {initial.micros.length} mesures
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

      {/* Footer */}
      <div
        className="absolute left-0 right-0 bottom-0 px-5 pb-6 pt-6 pointer-events-none"
        style={{ background: `linear-gradient(to top, ${PALETTE.bg} 50%, transparent)` }}
      >
        <div className="pointer-events-auto flex gap-2.5">
          <button
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
            <NL className="text-[10px]">Recommencer</NL>
          </button>
          <button
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
                  {mode === 'scan' ? 'Ajouter au journal' : 'Enregistrer'}
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
  nutritionProfile: {
    height: number;
    age: number;
    gender: GenderType;
    activityLevel: number;
    goal: GoalType;
  };
  onSave: (data: {
    weight: number;
    height: number;
    age: number;
    gender: GenderType;
    activity: number;
    goal: GoalType;
  }) => void;
  isSaving: boolean;
}) => {
  const [weight, setWeight] = useState(bodyWeight);
  const [height, setHeight] = useState(nutritionProfile.height);
  const [age, setAge] = useState(nutritionProfile.age);
  const [gender, setGender] = useState<GenderType>(nutritionProfile.gender);
  const [activity, setActivity] = useState(nutritionProfile.activityLevel);
  const [goal, setGoal] = useState<GoalType>(nutritionProfile.goal);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full rounded-t-[28px] border-t max-h-[88%] overflow-y-auto"
        style={{ background: PALETTE.bg, borderColor: PALETTE.border }}
      >
        <div className="px-5 pt-3 pb-2 flex justify-center">
          <div className="h-1 w-9 rounded-full" style={{ background: PALETTE.border }} />
        </div>
        <div className="px-5 pb-2 pt-1 flex items-center justify-between">
          <div className="text-[16px] font-medium" style={{ color: PALETTE.fg }}>
            Paramètres
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-[#f3f3f2]"
            style={{ color: PALETTE.fg }}
          >
            <X size={16} />
          </button>
        </div>
        <HDivider />

        <div className="px-5 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Poids', val: weight, set: setWeight, u: 'kg' },
              { l: 'Taille', val: height, set: setHeight, u: 'cm' },
              { l: 'Âge', val: age, set: setAge, u: 'ans' },
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
              <NL>Sexe</NL>
              <div className="mt-2 flex gap-1">
                {(['M', 'F'] as GenderType[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className="flex-1 h-8 rounded-lg text-[12px] font-medium transition"
                    style={
                      gender === g
                        ? { background: PALETTE.fg, color: PALETTE.bg }
                        : { color: PALETTE.muted, border: `1px solid ${PALETTE.border}` }
                    }
                  >
                    {g === 'M' ? 'Homme' : 'Femme'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <NL className="mb-2 block">Objectif</NL>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'cut' as GoalType, l: 'Sèche' },
                { k: 'maintain' as GoalType, l: 'Maintien' },
                { k: 'bulk' as GoalType, l: 'Prise' },
              ].map((g) => (
                <button
                  key={g.k}
                  onClick={() => setGoal(g.k)}
                  className="h-11 rounded-xl border text-[11px] font-medium uppercase tracking-[0.18em] transition"
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
            <NL className="mb-2 block">Activité</NL>
            <div className="space-y-2">
              {[
                { v: 1.2, l: 'Sédentaire', s: '0 séance' },
                { v: 1.55, l: 'Modéré', s: '1–3 séances' },
                { v: 1.75, l: 'Très actif', s: '4+ séances' },
              ].map((a) => {
                const active = Math.abs(activity - a.v) < 0.01;
                return (
                  <button
                    key={a.v}
                    onClick={() => setActivity(a.v)}
                    className="w-full h-12 px-4 rounded-xl border flex items-center justify-between transition"
                    style={{ borderColor: active ? PALETTE.fg : PALETTE.border }}
                  >
                    <span className="text-[13px] font-medium" style={{ color: PALETTE.fg }}>
                      {a.l}
                    </span>
                    <div className="flex items-center gap-3">
                      <NN
                        className="text-[10px]"
                        style={{ color: PALETTE.muted } as React.CSSProperties}
                      >
                        {a.s}
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
            onClick={() => onSave({ weight, height, age, gender, activity, goal })}
            disabled={isSaving}
            className="w-full h-12 rounded-2xl text-[12px] font-medium uppercase tracking-[0.22em] disabled:opacity-50 transition"
            style={{ background: PALETTE.fg, color: PALETTE.bg }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Enregistrer'}
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
      toast.error('Veuillez remplir tous les champs.');
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full rounded-t-[28px] border-t max-h-[88%] overflow-y-auto"
        style={{ background: PALETTE.bg, borderColor: PALETTE.border }}
      >
        <div className="px-5 pt-3 pb-2 flex justify-center">
          <div className="h-1 w-9 rounded-full" style={{ background: PALETTE.border }} />
        </div>
        <div className="px-5 pb-2 pt-1 flex items-center justify-between">
          <div className="text-[16px] font-medium" style={{ color: PALETTE.fg }}>
            Saisie manuelle
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-[#f3f3f2]"
            style={{ color: PALETTE.fg }}
          >
            <X size={16} />
          </button>
        </div>
        <HDivider />

        <div className="px-5 py-5 space-y-4">
          <div>
            <NL className="block mb-1.5">Nom du repas</NL>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Shaker protéiné"
              className="w-full h-12 px-3 rounded-xl border bg-transparent outline-none text-[15px] font-medium"
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
              { label: 'Protéines', val: protein, set: setProtein },
              { label: 'Glucides', val: carbs, set: setCarbs },
              { label: 'Lipides', val: fat, set: setFat },
            ].map((f) => (
              <div key={f.label}>
                <NL className="block mb-1.5 text-[9px]">{f.label} (g)</NL>
                <input
                  type="number"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 px-2 rounded-xl border bg-transparent outline-none font-mono tabular-nums text-[18px] font-medium text-center"
                  style={{ borderColor: PALETTE.border, color: PALETTE.fg }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-12 rounded-2xl text-[12px] font-medium uppercase tracking-[0.22em] mt-2 disabled:opacity-50"
            style={{ background: PALETTE.fg, color: PALETTE.bg }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              'Ajouter au journal'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Main Page ─────────────────────── */

type ViewType = 'dashboard' | 'scanner' | 'analyzing' | 'result' | 'detail';

export default function NutritionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { profile: appProfile, updateBodyweight } = useStore();
  const bodyWeight = appProfile?.body_weight || 80;

  const { meals, addMeal, removeMeal, updateMealPortion, updateMealMacros } = useNutritionStore();

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

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
        appProfile?.height || 180,
        calculateAge(appProfile?.birth_date || ''),
        appProfile?.gender || 'Homme',
        appProfile?.activity_level || 1.55,
        appProfile?.goal_program || 'maintain',
        bodyWeight
      ),
    [appProfile, bodyWeight]
  );

  const totals = useMemo(
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
      if (!response.ok) throw new Error('Analyse échouée');
      const data: NutritionResponse = await response.json();
      setScanResult(data);
      setView('result');
    } catch {
      toast.error("L'IA n'a pas pu analyser cette image.");
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
      (macros.protein * 4 + macros.carbs * 4 + macros.fat * 9) * portion
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
          image_url: image,
        });
      }
      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
      toast.success('Repas enregistré !');
      setImage(null);
      setScanResult(null);
      setView('dashboard');
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async (data: {
    weight: number;
    height: number;
    age: number;
    gender: GenderType;
    activity: number;
    goal: GoalType;
  }) => {
    setIsSaving(true);
    try {
      if (data.weight !== bodyWeight) await updateBodyweight(data.weight);
      updateProfile({
        height: data.height,
        age: data.age,
        gender: data.gender,
        activityLevel: data.activity,
        goal: data.goal,
      });
      toast.success('Paramètres mis à jour !');
      setSettingsOpen(false);
    } catch {
      toast.error('Erreur lors de la mise à jour');
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
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
      toast.success('Repas ajouté !');
      setManualOpen(false);
    } catch {
      toast.error("Erreur lors de l'ajout manuel.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    removeMeal(id);
    toast.success('Repas supprimé.');
  };

  const openMealDetail = (meal: HistoryItem) => {
    setSelectedMeal(meal);
    setView('detail');
  };

  if (!isHydrated) return null;

  /* ── Dashboard ── */
  const renderDashboard = () => (
    <div className="flex flex-col h-full" style={{ background: PALETTE.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          onClick={() => router.back()}
          className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full transition hover:bg-[#f3f3f2] active:scale-95"
          style={{ color: PALETTE.fg }}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div
          className="text-[11px] font-medium uppercase tracking-[0.28em]"
          style={{ color: PALETTE.fg }}
        >
          Nutrition
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="h-10 w-10 -mr-2 flex items-center justify-center rounded-full transition hover:bg-[#f3f3f2] active:scale-95"
          style={{ color: PALETTE.fg }}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Date strip */}
        <div className="px-5 mb-4 flex items-center justify-between">
          <div>
            <div className="text-[20px] font-medium leading-tight" style={{ color: PALETTE.fg }}>
              Aujourd&apos;hui
            </div>
            <NN
              className="text-[11px] tracking-[0.05em]"
              style={{ color: PALETTE.muted } as React.CSSProperties}
            >
              {new Date().toLocaleDateString('fr-FR', {
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
            <NL className="text-[9px] tracking-[0.2em]">
              {{ cut: 'Sèche', maintain: 'Maintien', bulk: 'Prise' }[nutritionProfile.goal]}
            </NL>
          </div>
        </div>

        {/* Ring */}
        <div className="py-2">
          <CalorieRing consumed={totals.calories} goal={targets.targetCalories} />
        </div>

        {/* Stat strip */}
        <div
          className="mx-5 mt-5 mb-7 grid grid-cols-3 border rounded-2xl overflow-hidden"
          style={{ borderColor: PALETTE.border }}
        >
          {[
            { l: 'Repas', v: meals.length, s: 'log' },
            { l: 'Brûlées', v: 412, s: 'kcal' },
            { l: 'Net', v: totals.calories - 412, s: 'kcal' },
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

        {/* Macros */}
        <div className="px-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <NL>Macronutriments</NL>
            <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
              P·G·L &nbsp; 30 / 45 / 25
            </NN>
          </div>
          <div className="space-y-5">
            <MacroBar
              label="Protéines"
              current={totals.protein}
              target={targets.targetProtein}
              shade="fg"
            />
            <MacroBar
              label="Glucides"
              current={totals.carbs}
              target={targets.targetCarbs}
              shade="mid"
            />
            <MacroBar label="Lipides" current={totals.fat} target={targets.targetFat} shade="low" />
          </div>
        </div>

        {/* Food log */}
        <div className="px-5">
          <div className="flex items-center justify-between mb-2">
            <NL>Journal du jour</NL>
            <NN className="text-[10px]" style={{ color: PALETTE.muted } as React.CSSProperties}>
              {meals.length} entrées
            </NN>
          </div>
          <div
            className="border rounded-2xl overflow-hidden"
            style={{ borderColor: PALETTE.border, background: PALETTE.surface }}
          >
            {meals.length === 0 ? (
              <div className="py-8 text-center">
                <NL>Aucun repas enregistré</NL>
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

      {/* FABs */}
      <div
        className="absolute left-0 right-0 bottom-0 px-5 pb-6 pt-10 pointer-events-none"
        style={{ background: `linear-gradient(to top, ${PALETTE.bg} 60%, transparent)` }}
      >
        <div className="pointer-events-auto flex gap-2.5">
          <button
            onClick={() => setManualOpen(true)}
            className="h-14 px-4 rounded-2xl border flex items-center gap-2 active:scale-[0.98] transition hover:bg-[#f3f3f2]"
            style={{ borderColor: PALETTE.border, background: PALETTE.surface, color: PALETTE.fg }}
          >
            <Plus size={18} strokeWidth={1.75} />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Manuel</span>
          </button>
          <button
            onClick={() => {
              setView('scanner');
            }}
            className="h-14 flex-1 rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition hover:opacity-90"
            style={{ background: PALETTE.fg, color: PALETTE.bg }}
          >
            <Camera size={18} strokeWidth={1.75} />
            <span className="text-[12px] font-medium uppercase tracking-[0.22em]">Scan repas</span>
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Scanner ── */
  const renderScanner = () => (
    <div className="absolute inset-0 flex flex-col" style={{ background: PALETTE.carbon }}>
      <div className="flex items-center justify-between px-5 pt-3 pb-4">
        <button
          onClick={() => setView('dashboard')}
          className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full text-white/70 hover:bg-white/10 transition"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-white">
          Scanner
        </div>
        <div className="h-10 w-10 -mr-2 flex items-center justify-center text-white/40">
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
              backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 8px, transparent 8px 16px)`,
            }}
          />
          {/* Rule-of-thirds grid */}
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
          {/* Corner brackets */}
          <div className="absolute inset-4 text-white/80">
            <CornerBracket position="tl" />
            <CornerBracket position="tr" />
            <CornerBracket position="bl" />
            <CornerBracket position="br" />
          </div>
          {/* Reticle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-px w-3 bg-white/40" />
            <div className="absolute h-3 w-px bg-white/40" />
            <div className="absolute h-10 w-10 rounded-full border border-white/15" />
          </div>
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <NL className="text-white/80 text-[9px] tracking-[0.22em]">Cadrer le plat</NL>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-10 pt-4">
        <div className="flex items-center justify-center gap-6 mb-6">
          <NL className="text-white/40 tracking-[0.22em]">Galerie</NL>
          <NL className="text-white tracking-[0.22em]">Scan IA</NL>
          <NL className="text-white/40 tracking-[0.22em]">Code-barres</NL>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-12 rounded-2xl border border-white/15 flex items-center justify-center text-white/70 hover:bg-white/5 transition"
          >
            <ImageIcon size={18} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative h-20 w-20 rounded-full border-2 border-white/80 flex items-center justify-center active:scale-95 transition"
          >
            <span className="h-[60px] w-[60px] rounded-full bg-white" />
          </button>
          <button
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

  /* ── Compose view ── */
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ ...cssVars, background: PALETTE.bg } as React.CSSProperties}
    >
      <div
        className="relative h-screen overflow-hidden"
        style={{ maxWidth: 480, margin: '0 auto' }}
      >
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
              toast.success('Repas mis à jour');
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
