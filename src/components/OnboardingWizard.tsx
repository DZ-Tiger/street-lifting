'use client';

import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { calculate1RM, ExerciseType } from '@/lib/exercise';
import { Gender, GoalType, ActivityLevel } from '@/lib/nutrition';
import { Check, ChevronLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/* ─────────────────────── Micro-components (DA Consistency) ─────────────────────── */

const AL = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span
    className={`text-[10px] font-medium uppercase tracking-[0.16em] ${className}`}
    style={{ color: 'var(--muted)' }}
  >
    {children}
  </span>
);

const AN = ({
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
    style={{ fontFeatureSettings: '"tnum" 1', ...style }}
  >
    {children}
  </span>
);

const Wordmark = () => (
  <div className="flex items-center gap-2.5">
    <div className="relative h-7 w-7">
      <div className="absolute inset-0 rounded-[6px] border" style={{ borderColor: 'var(--fg)' }} />
      <div className="absolute inset-[5px] rounded-[2px]" style={{ background: 'var(--fg)' }} />
    </div>
    <div>
      <div
        className="text-[14px] font-medium tracking-tight leading-none"
        style={{ color: 'var(--fg)' }}
      >
        9.81
      </div>
      <AN
        className="text-[8px] uppercase tracking-[0.28em]"
        style={{ color: 'var(--muted)' } as React.CSSProperties}
      >
        onboarding
      </AN>
    </div>
  </div>
);

const AuthBackdrop = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.06]"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: 'var(--fg)' }}
    >
      <defs>
        <pattern id="auth-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-grid)" />
    </svg>
    <div
      className="absolute -top-12 -right-12 h-40 w-40 rounded-full"
      style={{
        background: 'radial-gradient(closest-side, var(--fg) 0%, transparent 70%)',
        opacity: 0.06,
      }}
    />
  </div>
);

const CTA = ({
  onClick,
  type = 'button',
  children,
  loading = false,
  disabled = false,
}: {
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={loading || disabled}
    className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 transition active:scale-[0.99] disabled:opacity-30"
    style={{ background: 'var(--fg)', color: 'var(--bg)' }}
  >
    <span className="text-[12px] font-medium uppercase tracking-[0.22em]">{children}</span>
    {!loading && <ArrowRight size={16} strokeWidth={2} />}
  </button>
);

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  right,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  right?: ReactNode;
}) => {
  const id = `f-${label.replace(/\s+/g, '')}`;
  return (
    <label htmlFor={id} className="block">
      <div className="flex items-center justify-between mb-1.5">
        <AL>{label}</AL>
        {right}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent outline-none py-2.5 text-[16px] font-mono tabular-nums transition-colors border-b"
        style={{
          color: 'var(--fg)',
          borderBottomColor: 'var(--border)',
          fontFeatureSettings: '"tnum" 1',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--fg)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border)';
        }}
      />
    </label>
  );
};

/* ─────────────────────── Config ─────────────────────── */

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Athlete M' },
  { id: 'female', label: 'Athlete F' },
];

const PROGRAMS: { id: GoalType; label: string; d: string }[] = [
  { id: 'cut', label: 'CUT', d: 'Fat loss' },
  { id: 'bulk', label: 'BULK', d: 'Muscle gain' },
  { id: 'maintain', label: 'MAINTAIN', d: 'Stability' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: 1.2, label: 'SEDENTARY', sub: '0 sessions' },
  { value: 1.55, label: 'MODERATE', sub: '1–3 sessions' },
  { value: 1.75, label: 'ACTIVE', sub: '4+ sessions' },
];

type ExerciseConfig = {
  enabled: boolean;
  mode: 'known' | 'estimate';
  max: number;
  addedWeight: number;
  reps: number;
};

type ExercisesState = Record<ExerciseType, ExerciseConfig>;

/* ─────────────────────── Main Component ─────────────────────── */

export function OnboardingWizard() {
  const router = useRouter();
  const { completeOnboarding, profile } = useStore();

  const [step, setStep] = useState(1);
  const [bodyWeight, setBodyWeight] = useState<number>(profile?.body_weight || 75);
  const [birthDate, setBirthDate] = useState<string>(profile?.birth_date || '2000-01-01');
  const [height, setHeight] = useState<number>(profile?.height || 175);
  const [goalProgram, setGoalProgram] = useState<GoalType>(profile?.goal_program || 'maintain');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (profile?.activity_level as ActivityLevel) || 1.55
  );
  const [gender, setGender] = useState<Gender>(profile?.gender || 'male');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [exercises, setExercises] = useState<ExercisesState>({
    'Pull-up': {
      enabled: true,
      mode: 'estimate',
      max: profile?.current_1rm_pullup || 0,
      addedWeight: 0,
      reps: 0,
    },
    Dips: {
      enabled: true,
      mode: 'estimate',
      max: profile?.current_1rm_dips || 0,
      addedWeight: 0,
      reps: 0,
    },
    'Muscle-up': {
      enabled: true,
      mode: 'estimate',
      max: profile?.current_1rm_muscleup || 0,
      addedWeight: 0,
      reps: 0,
    },
    Squat: {
      enabled: true,
      mode: 'estimate',
      max: profile?.current_1rm_squat || 0,
      addedWeight: 0,
      reps: 0,
    },
  });

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

  const handleComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const getFinal1RM = (exo: ExerciseType): number => {
      const config = exercises[exo];
      if (!config.enabled) return 0;
      if (config.mode === 'known') return config.max;
      if (config.addedWeight > 0 && config.reps > 0) {
        return Math.round(calculate1RM(bodyWeight + config.addedWeight, config.reps) * 2) / 2;
      }
      return config.max || 0;
    };

    try {
      await completeOnboarding({
        body_weight: bodyWeight,
        current_1rm_pullup: getFinal1RM('Pull-up'),
        current_1rm_dips: getFinal1RM('Dips'),
        current_1rm_muscleup: getFinal1RM('Muscle-up'),
        current_1rm_squat: getFinal1RM('Squat'),
        birth_date: birthDate,
        height,
        goal_program: goalProgram,
        gender,
        activity_level: activityLevel,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error('Configuration error');
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-5">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          <Check size={32} strokeWidth={3} />
        </div>
        <AL>Success</AL>
        <div className="mt-2 text-[32px] font-medium leading-none tracking-tight">
          System
          <br />
          <span style={{ color: 'var(--muted)' }}>calibrated.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-[100svh] max-h-[844px] w-full max-w-[390px] mx-auto overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <AuthBackdrop />

      <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
        {step > 1 ? (
          <button
            onClick={prevStep}
            className="h-11 w-11 -ml-2 flex items-center justify-center rounded-full transition"
            style={{ color: 'var(--fg)' }}
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <Wordmark />
        <div className="w-9" />
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 pb-10">
        <div className="pt-4 pb-7">
          <AL>Step {step} of 3</AL>
          <div className="mt-2 text-[28px] font-medium leading-[1.05] tracking-tight">
            {step === 1 && (
              <>
                Your <span style={{ color: 'var(--muted)' }}>vitals.</span>
              </>
            )}
            {step === 2 && (
              <>
                Your <span style={{ color: 'var(--muted)' }}>strength.</span>
              </>
            )}
            {step === 3 && (
              <>
                Your <span style={{ color: 'var(--muted)' }}>goal.</span>
              </>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-3">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id)}
                    className="h-12 rounded-2xl border text-[12px] font-medium transition"
                    style={{
                      borderColor: gender === g.id ? 'var(--fg)' : 'var(--border)',
                      background: gender === g.id ? 'var(--surface-2)' : 'transparent',
                      color: gender === g.id ? 'var(--fg)' : 'var(--muted)',
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Weight"
                  type="number"
                  value={bodyWeight}
                  onChange={(v) => setBodyWeight(Number(v))}
                  right={<AL>kg</AL>}
                />
                <Field
                  label="Height"
                  type="number"
                  value={height}
                  onChange={(v) => setHeight(Number(v))}
                  right={<AL>cm</AL>}
                />
              </div>

              <Field label="Birth date" type="date" value={birthDate} onChange={setBirthDate} />

              <div className="pt-4">
                <CTA onClick={nextStep}>Next step</CTA>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="space-y-4">
                {(Object.keys(exercises) as ExerciseType[]).map((exo) => {
                  const config = exercises[exo];
                  return (
                    <div
                      key={exo}
                      className="p-4 rounded-2xl border transition"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <AL>{exo}</AL>
                        <button
                          onClick={() => updateExercise(exo, 'enabled', !config.enabled)}
                          className="text-[9px] uppercase tracking-widest font-bold"
                          style={{ color: config.enabled ? 'var(--fg)' : 'var(--muted)' }}
                        >
                          {config.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      {config.enabled && (
                        <div className="space-y-4">
                          <div
                            className="flex gap-2 p-1 bg-white/50 rounded-xl border"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <button
                              onClick={() => updateExercise(exo, 'mode', 'estimate')}
                              className="flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-lg transition"
                              style={{
                                background:
                                  config.mode === 'estimate' ? 'var(--fg)' : 'transparent',
                                color: config.mode === 'estimate' ? 'var(--bg)' : 'var(--muted)',
                              }}
                            >
                              Estimate
                            </button>
                            <button
                              onClick={() => updateExercise(exo, 'mode', 'known')}
                              className="flex-1 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-lg transition"
                              style={{
                                background: config.mode === 'known' ? 'var(--fg)' : 'transparent',
                                color: config.mode === 'known' ? 'var(--bg)' : 'var(--muted)',
                              }}
                            >
                              Direct
                            </button>
                          </div>

                          {config.mode === 'estimate' ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <AL className="text-[8px]">Added kg</AL>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateExercise(
                                        exo,
                                        'addedWeight',
                                        Math.max(0, config.addedWeight - 1)
                                      )
                                    }
                                    className="h-8 w-8 rounded-lg border flex items-center justify-center"
                                    style={{ borderColor: 'var(--border)' }}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <AN className="flex-1 text-center text-lg">
                                    {config.addedWeight}
                                  </AN>
                                  <button
                                    onClick={() =>
                                      updateExercise(exo, 'addedWeight', config.addedWeight + 1)
                                    }
                                    className="h-8 w-8 rounded-lg border flex items-center justify-center"
                                    style={{ borderColor: 'var(--border)' }}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <AL className="text-[8px]">Reps</AL>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateExercise(exo, 'reps', Math.max(0, config.reps - 1))
                                    }
                                    className="h-8 w-8 rounded-lg border flex items-center justify-center"
                                    style={{ borderColor: 'var(--border)' }}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <AN className="flex-1 text-center text-lg">{config.reps}</AN>
                                  <button
                                    onClick={() => updateExercise(exo, 'reps', config.reps + 1)}
                                    className="h-8 w-8 rounded-lg border flex items-center justify-center"
                                    style={{ borderColor: 'var(--border)' }}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <AL className="text-[8px]">Total 1RM (kg)</AL>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() =>
                                    updateExercise(exo, 'max', Math.max(0, config.max - 2.5))
                                  }
                                  className="h-10 w-10 rounded-xl border flex items-center justify-center"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <Minus size={14} />
                                </button>
                                <AN className="flex-1 text-center text-2xl">{config.max}</AN>
                                <button
                                  onClick={() => updateExercise(exo, 'max', config.max + 2.5)}
                                  className="h-10 w-10 rounded-xl border flex items-center justify-center"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4">
                <CTA onClick={nextStep}>Confirm baselines</CTA>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-7"
            >
              <div className="space-y-3">
                <AL>Primary objective</AL>
                <div className="grid grid-cols-1 gap-2">
                  {PROGRAMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setGoalProgram(p.id)}
                      className="w-full text-left p-4 rounded-2xl border transition flex items-center justify-between"
                      style={{
                        borderColor: goalProgram === p.id ? 'var(--fg)' : 'var(--border)',
                        background: goalProgram === p.id ? 'var(--surface-2)' : 'var(--surface)',
                      }}
                    >
                      <div>
                        <div className="text-[14px] font-medium tracking-tight">{p.label}</div>
                        <AL className="text-[9px] opacity-60">{p.d}</AL>
                      </div>
                      {goalProgram === p.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <AL>Activity level</AL>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIVITY_LEVELS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setActivityLevel(a.value)}
                      className="p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1"
                      style={{
                        borderColor: activityLevel === a.value ? 'var(--fg)' : 'var(--border)',
                        background: activityLevel === a.value ? 'var(--surface-2)' : 'transparent',
                        color: activityLevel === a.value ? 'var(--fg)' : 'var(--muted)',
                      }}
                    >
                      <span className="text-[10px] font-bold">{a.label}</span>
                      <span className="text-[8px] opacity-60 font-mono">{a.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <CTA onClick={handleComplete} loading={isSubmitting}>
                  Finish setup
                </CTA>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
