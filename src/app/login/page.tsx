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

/* CHALK wordmark */
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
        CHALK
      </div>
      <AN
        className="text-[8px] uppercase tracking-[0.28em]"
        style={{ color: 'var(--muted)' } as React.CSSProperties}
      >
        street · lift
      </AN>
    </div>
  </div>
);

/* Subtle grid + radial gradient backdrop */
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

/* Bottom-rule text field */
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
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--fg)')}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'var(--border)')}
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
    className="flex items-start gap-2.5 text-left"
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

/* Primary CTA button */
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

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
        <Wordmark />
        <button
          onClick={onSwitch}
          className="h-9 px-3 rounded-full border text-[10px] font-medium uppercase tracking-[0.18em] transition"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          Créer un compte
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="px-5 pt-6 pb-7">
          <AL>Connexion</AL>
          <div className="mt-2 text-[32px] font-medium leading-[1.04] tracking-tight">
            Reprenez votre
            <br />
            <span style={{ color: 'var(--muted)' }}>cycle de force.</span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <AN className="text-[10px]" style={{ color: 'var(--muted)' } as React.CSSProperties}>
              Cycle 4 · sem. 4 / 9
            </AN>
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: 'var(--muted)', opacity: 0.6 }}
            />
            <AN className="text-[10px]" style={{ color: 'var(--muted)' } as React.CSSProperties}>
              312 séances
            </AN>
          </div>
        </div>

        {/* Form */}
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
            placeholder="vous@email.com"
          />
          <Field
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            right={
              <button
                type="button"
                className="text-[9px] uppercase tracking-[0.18em] transition"
                style={{ color: 'var(--muted)' }}
              >
                Oublié
              </button>
            }
          />

          <div className="pt-1">
            <CheckboxField checked={remember} onChange={setRemember}>
              Rester connecté sur cet appareil
            </CheckboxField>
          </div>

          <CTA type="submit" loading={loading}>
            Se connecter
          </CTA>
        </form>

        {/* Providers */}
        <div className="px-5 mt-7">
          <Divider>ou continuer avec</Divider>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <ProviderButton icon={<AppleGlyph />} label="Apple" />
            <ProviderButton icon={<GoogleGlyph />} label="Google" />
          </div>
        </div>

        {/* Stats foot */}
        <div className="px-5 mt-8 mb-6">
          <div
            className="border rounded-2xl grid grid-cols-3 divide-x overflow-hidden"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
            }}
          >
            {[
              { value: '14 820', label: 'athlètes' },
              { value: '1.2 M', label: 'séries' },
              { value: '9 sem.', label: 'cycle' },
            ].map((s, i) => (
              <div
                key={s.label}
                className="px-3 py-3 text-center"
                style={i > 0 ? { borderLeft: '1px solid var(--border)' } : undefined}
              >
                <AN
                  className="block text-[16px] font-medium leading-none"
                  style={{ color: 'var(--fg)' } as React.CSSProperties}
                >
                  {s.value}
                </AN>
                <AL className="text-[8px] tracking-[0.22em] mt-1.5 block">{s.label}</AL>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-10 text-center">
          <AL className="text-[9px] tracking-[0.22em]">v 2.4 · conditions · confidentialité</AL>
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
    className="h-10 px-3.5 rounded-full border text-[11px] font-medium transition"
    style={{
      background: active ? 'var(--fg)' : 'transparent',
      borderColor: active ? 'var(--fg)' : 'var(--border)',
      color: active ? 'var(--bg)' : 'var(--muted)',
    }}
  >
    {children}
  </button>
);

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
  const [level, setLevel] = useState('intermediaire');
  const [goal, setGoal] = useState('force');
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
    Traction: `+${Math.round(bw * 0.2)} kg`,
    Dips: `+${Math.round(bw * 0.3)} kg`,
    Squat: `${Math.round(bw * 1.1)} kg`,
  };

  return (
    <div
      className="relative flex flex-col h-full"
      style={{ background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <AuthBackdrop />

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
        <button
          onClick={step === 1 ? onSwitch : back}
          className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full transition"
          style={{ color: 'var(--fg)' }}
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <StepIndicator step={step} />
        <div className="h-10 w-10" />
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-5">
          <AL>
            Étape {step} / 3 · {step === 1 ? 'compte' : step === 2 ? 'profil' : 'objectif'}
          </AL>
          <div className="mt-2 text-[28px] font-medium leading-[1.05] tracking-tight">
            {step === 1 && (
              <>
                Créez votre <span style={{ color: 'var(--muted)' }}>compte.</span>
              </>
            )}
            {step === 2 && (
              <>
                Calibrons les <span style={{ color: 'var(--muted)' }}>baselines.</span>
              </>
            )}
            {step === 3 && (
              <>
                Définissez votre <span style={{ color: 'var(--muted)' }}>objectif.</span>
              </>
            )}
          </div>
        </div>

        {/* Step 1 — Compte */}
        {step === 1 && (
          <div className="px-5 space-y-5">
            <Field label="Nom complet" value={name} onChange={setName} autoComplete="name" />
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="vous@email.com"
            />
            <Field
              label="Mot de passe"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              placeholder="8 caractères minimum"
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
                J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité.
              </CheckboxField>
            </div>
          </div>
        )}

        {/* Step 2 — Profil */}
        {step === 2 && (
          <div className="px-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Poids"
                value={weight}
                onChange={setWeight}
                right={<AL className="text-[9px]">kg</AL>}
              />
              <Field
                label="Taille"
                value={height}
                onChange={setHeight}
                right={<AL className="text-[9px]">cm</AL>}
              />
            </div>
            <div>
              <AL className="block mb-2">Niveau actuel</AL>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: 'debutant', l: 'Débutant' },
                  { k: 'intermediaire', l: 'Intermédiaire' },
                  { k: 'avance', l: 'Avancé' },
                  { k: 'elite', l: 'Élite' },
                ].map((o) => (
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
                <AL>1RM estimés · auto</AL>
                <AN className="text-[9px]" style={{ color: 'var(--muted)' } as React.CSSProperties}>
                  modifiable plus tard
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
                    <AL className="text-[8px] tracking-[0.22em] mt-1 block">{label} · kg</AL>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Objectif */}
        {step === 3 && (
          <div className="px-5 space-y-3">
            {[
              { k: 'force', l: 'Force pure', d: 'Cycle 9 sem. · 5×5 · charges lourdes' },
              {
                k: 'skill',
                l: 'Skill calisthénie',
                d: 'Muscle-up · front lever · planche',
              },
              { k: 'hybride', l: 'Hybride', d: 'Force + skill, semaines alternées' },
              { k: 'endurance', l: 'Endurance', d: 'Volume haut · charges modérées' },
            ].map((o) => {
              const active = goal === o.k;
              return (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setGoal(o.k)}
                  className="w-full text-left p-4 rounded-2xl border transition flex items-start gap-3"
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

        {/* CTA */}
        <div className="px-5 mt-7 pb-6">
          <CTA onClick={handleSubmit} loading={loading}>
            {step === 3 ? 'Lancer mon cycle' : 'Continuer'}
          </CTA>
          {step === 1 && (
            <button
              onClick={onSwitch}
              className="w-full mt-3 h-10 text-[11px] uppercase tracking-[0.18em] transition"
              style={{ color: 'var(--muted)' }}
            >
              Déjà membre · se connecter
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/');
    });
  }, [router]);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Connecté !');
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
      toast.success('Vérifiez vos emails pour confirmer votre compte !');
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
