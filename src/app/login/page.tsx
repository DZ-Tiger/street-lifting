'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useSkin } from '@/lib/useSkin';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';

/* ─────────────────────── Micro-components ─────────────────────── */

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
        street lift
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

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  right,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
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
        autoComplete={autoComplete}
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

const CheckboxField = ({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-start gap-2.5 text-left min-h-[44px]"
  >
    <span
      className="mt-[2px] h-4 w-4 rounded-[4px] border flex items-center justify-center shrink-0 transition"
      style={{
        background: checked ? 'var(--fg)' : 'transparent',
        borderColor: checked ? 'var(--fg)' : 'var(--border)',
      }}
    >
      {checked && <Check size={10} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
    </span>
    <span className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
      {children}
    </span>
  </button>
);

const Divider = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-3 my-1">
    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    <AL className="text-[9px] tracking-[0.22em]">{children}</AL>
    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
  </div>
);

const ProviderButton = ({ icon, label }: { icon: ReactNode; label: string }) => (
  <button
    type="button"
    className="h-12 rounded-2xl border flex items-center justify-center gap-3 transition"
    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--fg)' }}
  >
    {icon}
    <span className="text-[12px] font-medium tracking-tight">{label}</span>
  </button>
);

const AppleGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.9 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-3 1.4-3.1-.1 0-2.8-1.1-2.8-4.2zM13.9 4.7c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3-1.4z" />
  </svg>
);

const GoogleGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.3-1 2.3-2 3v2.5h3.3c1.9-1.8 3-4.4 3-7.3z"
    />
    <path
      fill="currentColor"
      d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6C4.7 19.9 8.1 22 12 22z"
    />
    <path
      fill="currentColor"
      d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3C2.4 8.8 2 10.3 2 12s.4 3.2 1 4.6L6.4 14z"
    />
    <path
      fill="currentColor"
      d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.9 14.7 2 12 2 8.1 2 4.7 4.1 3 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"
    />
  </svg>
);

const CTA = ({
  onClick,
  type = 'button',
  children,
  loading = false,
}: {
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: ReactNode;
  loading?: boolean;
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={loading}
    className="w-full h-14 rounded-2xl flex items-center justify-center gap-3 transition active:scale-[0.99] disabled:opacity-60"
    style={{ background: 'var(--fg)', color: 'var(--bg)' }}
  >
    <span className="text-[12px] font-medium uppercase tracking-[0.22em]">{children}</span>
    {!loading && <ArrowRight size={16} strokeWidth={2} />}
  </button>
);

/* ─────────────────────── Login Screen ─────────────────────── */

const LoginScreen = ({
  onLogin,
  onSwitch,
  loading,
}: {
  onLogin: (email: string, password: string) => void;
  onSwitch: () => void;
  loading: boolean;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  return (
    <div
      className="relative flex flex-col h-full"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <AuthBackdrop />

      <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
        <Wordmark />
        <button
          type="button"
          onClick={onSwitch}
          className="min-h-[44px] px-3 rounded-full border text-[10px] font-medium uppercase tracking-[0.18em] transition"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          Create account
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="px-5 pt-6 pb-7">
          <AL>Sign in</AL>
          <div className="mt-2 text-[32px] font-medium leading-[1.04] tracking-tight">
            Resume your
            <br />
            <span style={{ color: 'var(--muted)' }}>strength cycle.</span>
          </div>
        </div>

        <form
          className="px-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(email, password);
          }}
        >
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            placeholder="you@email.com"
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            right={
              <button
                type="button"
                className="text-[9px] uppercase tracking-[0.18em] transition min-h-[44px]"
                style={{ color: 'var(--muted)' }}
              >
                Forgot
              </button>
            }
          />

          <div className="pt-1">
            <CheckboxField checked={remember} onChange={setRemember}>
              Stay signed in on this device
            </CheckboxField>
          </div>

          <CTA type="submit" loading={loading}>
            Sign in
          </CTA>
        </form>

        <div className="px-5 mt-7">
          <Divider>or continue with</Divider>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <ProviderButton icon={<AppleGlyph />} label="Apple" />
            <ProviderButton icon={<GoogleGlyph />} label="Google" />
          </div>
        </div>

        <div className="px-5 pb-10 pt-10 text-center">
          <AL className="text-[9px] tracking-[0.22em]">v 2.4 · terms · privacy</AL>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Sign Up Screen ─────────────────────── */

const StepIndicator = ({ step }: { step: number }) => (
  <div className="flex items-center gap-2">
    {[1, 2, 3].map((s) => {
      const done = step > s;
      const active = step === s;
      return (
        <div key={s} className="flex items-center gap-2">
          <div
            className="h-5 w-5 rounded-full border flex items-center justify-center transition"
            style={{
              background: done ? 'var(--fg)' : 'transparent',
              borderColor: active || done ? 'var(--fg)' : 'var(--border)',
              color: done ? 'var(--bg)' : active ? 'var(--fg)' : 'var(--muted)',
            }}
          >
            {done ? (
              <Check size={9} strokeWidth={3} />
            ) : (
              <AN className="text-[9px] font-medium">{s}</AN>
            )}
          </div>
          {s < 3 && (
            <div
              className="h-px w-6"
              style={{ background: done ? 'var(--fg)' : 'var(--border)' }}
            />
          )}
        </div>
      );
    })}
  </div>
);

const Chip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-[44px] px-3.5 rounded-full border text-[11px] font-medium transition"
    style={{
      background: active ? 'var(--fg)' : 'transparent',
      borderColor: active ? 'var(--fg)' : 'var(--border)',
      color: active ? 'var(--bg)' : 'var(--muted)',
    }}
  >
    {children}
  </button>
);

const LEVEL_OPTIONS = [
  { k: 'beginner', l: 'Beginner' },
  { k: 'intermediate', l: 'Intermediate' },
  { k: 'advanced', l: 'Advanced' },
  { k: 'elite', l: 'Elite' },
];

const GOAL_OPTIONS = [
  { k: 'strength', l: 'Pure strength', d: '9-week cycle · 5×5 · heavy loads' },
  { k: 'skill', l: 'Calisthenics skill', d: 'Muscle-up · front lever · planche' },
  { k: 'hybrid', l: 'Hybrid', d: 'Strength + skill, alternating weeks' },
  { k: 'endurance', l: 'Endurance', d: 'High volume · moderate loads' },
];

const SignupScreen = ({
  onSignup,
  onSwitch,
  loading,
}: {
  onSignup: (email: string, password: string) => void;
  onSwitch: () => void;
  loading: boolean;
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [weight, setWeight] = useState('80');
  const [height, setHeight] = useState('178');
  const [level, setLevel] = useState('intermediate');
  const [goal, setGoal] = useState('strength');
  const [terms, setTerms] = useState(false);

  const next = () => setStep((s) => Math.min(3, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = () => {
    if (step < 3) {
      next();
    } else {
      onSignup(email, password);
    }
  };

  const bw = parseFloat(weight) || 80;
  const estimated1RMs = {
    'Pull-up': `+${Math.round(bw * 0.2)} kg`,
    Dips: `+${Math.round(bw * 0.3)} kg`,
    Squat: `${Math.round(bw * 1.1)} kg`,
  };

  return (
    <div
      className="relative flex flex-col h-full"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <AuthBackdrop />

      <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
        <button
          type="button"
          aria-label="Back"
          onClick={step === 1 ? onSwitch : back}
          className="h-11 w-11 -ml-2 flex items-center justify-center rounded-full transition"
          style={{ color: 'var(--fg)' }}
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <StepIndicator step={step} />
        <div className="h-11 w-11" />
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-5">
          <AL>
            Step {step} / 3 · {step === 1 ? 'account' : step === 2 ? 'profile' : 'goal'}
          </AL>
          <div className="mt-2 text-[28px] font-medium leading-[1.05] tracking-tight">
            {step === 1 && (
              <>
                Create your <span style={{ color: 'var(--muted)' }}>account.</span>
              </>
            )}
            {step === 2 && (
              <>
                Calibrate your <span style={{ color: 'var(--muted)' }}>baselines.</span>
              </>
            )}
            {step === 3 && (
              <>
                Define your <span style={{ color: 'var(--muted)' }}>goal.</span>
              </>
            )}
          </div>
        </div>

        {step === 1 && (
          <div className="px-5 space-y-5">
            <Field label="Full name" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@email.com"
            />
            <Field
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              placeholder="8 characters min"
              right={
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-[3px] w-4 rounded-full transition"
                      style={{
                        background: password.length > i * 2 ? 'var(--fg)' : 'var(--border)',
                      }}
                    />
                  ))}
                </div>
              }
            />
            <div className="pt-1">
              <CheckboxField checked={terms} onChange={setTerms}>
                I agree to the terms of use and the privacy policy.
              </CheckboxField>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="px-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Weight"
                value={weight}
                onChange={setWeight}
                right={<AL className="text-[9px]">kg</AL>}
              />
              <Field
                label="Height"
                value={height}
                onChange={setHeight}
                right={<AL className="text-[9px]">cm</AL>}
              />
            </div>
            <div>
              <AL className="block mb-2">Current level</AL>
              <div className="flex flex-wrap gap-2">
                {LEVEL_OPTIONS.map((o) => (
                  <Chip key={o.k} active={level === o.k} onClick={() => setLevel(o.k)}>
                    {o.l}
                  </Chip>
                ))}
              </div>
            </div>
            <div
              className="border rounded-2xl p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <AL>Estimated 1RM · auto</AL>
                <AN className="text-[9px]" style={{ color: 'var(--muted)' } as React.CSSProperties}>
                  editable later
                </AN>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(estimated1RMs) as [string, string][]).map(([label, val]) => (
                  <div
                    key={label}
                    className="px-2 py-2 rounded-lg border text-center"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <AN
                      className="block text-[16px] font-medium leading-none"
                      style={{ color: 'var(--fg)' } as React.CSSProperties}
                    >
                      {val}
                    </AN>
                    <AL className="text-[8px] tracking-[0.22em] mt-1 block">{label}</AL>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="px-5 space-y-3">
            {GOAL_OPTIONS.map((o) => {
              const active = goal === o.k;
              return (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setGoal(o.k)}
                  className="w-full text-left p-4 rounded-2xl border transition flex items-start gap-3 min-h-[44px]"
                  style={{
                    borderColor: active ? 'var(--fg)' : 'var(--border)',
                    background: active ? 'var(--surface-2)' : 'var(--surface)',
                  }}
                >
                  <span
                    className="mt-[2px] h-4 w-4 rounded-full border flex items-center justify-center shrink-0"
                    style={{ borderColor: active ? 'var(--fg)' : 'var(--border)' }}
                  >
                    {active && (
                      <span className="h-2 w-2 rounded-full" style={{ background: 'var(--fg)' }} />
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium leading-tight">{o.l}</div>
                    <AN
                      className="block mt-0.5 text-[10px]"
                      style={{ color: 'var(--muted)' } as React.CSSProperties}
                    >
                      {o.d}
                    </AN>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="px-5 mt-7 pb-6">
          <CTA onClick={handleSubmit} loading={loading}>
            {step === 3 ? 'Start my cycle' : 'Continue'}
          </CTA>
          {step === 1 && (
            <button
              type="button"
              onClick={onSwitch}
              className="w-full mt-3 min-h-[44px] text-[11px] uppercase tracking-[0.18em] transition"
              style={{ color: 'var(--muted)' }}
            >
              Already a member · sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Page ─────────────────────── */

export default function LoginPage() {
  useSkin();

  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (user && !error) {
          router.push('/');
        } else if (error) {
          // If there's an error (like invalid refresh token), sign out to clear local state
          console.warn('Login page auth check error, clearing session:', error.message);
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error('Unexpected auth error in login page:', err);
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed in');
      router.push('/');
    }
    setLoading(false);
  };

  const handleSignup = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Check your inbox to confirm your account.');
      setMode('login');
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="relative w-full max-w-[390px]"
        style={{ height: '100svh', maxHeight: '844px' }}
      >
        {mode === 'login' ? (
          <LoginScreen onLogin={handleLogin} onSwitch={() => setMode('signup')} loading={loading} />
        ) : (
          <SignupScreen
            onSignup={handleSignup}
            onSwitch={() => setMode('login')}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
