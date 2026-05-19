'use client';

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Camera, Loader2, X, Shield, Info } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStore, AccountSnapshot, UserProfile } from '@/store/useStore';
import { Gender, GoalType } from '@/lib/nutrition';
import { ExerciseType } from '@/lib/exercise';

/* ─────────────────────── Micro-components ─────────────────────── */

const AL = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span
    className={`text-[10px] font-medium uppercase tracking-[0.16em] ${className}`}
    style={{ color: 'var(--muted)' }}
  >
    {children}
  </span>
);

/* ─────────────────────── Component ─────────────────────── */

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSWORD_MIN_LENGTH = 8;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const PROGRAMS: { id: GoalType; label: string }[] = [
  { id: 'cut', label: 'CUT' },
  { id: 'bulk', label: 'BULK' },
  { id: 'maintain', label: 'MAINTAIN' },
];

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'MALE' },
  { id: 'female', label: 'FEMALE' },
];

const ONE_RM_FIELDS: { label: string; key: ExerciseType }[] = [
  { label: 'Pull-up', key: 'Pull-up' },
  { label: 'Dips', key: 'Dips' },
  { label: 'Muscle-up', key: 'Muscle-up' },
  { label: 'Squat', key: 'Squat' },
];

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 overflow-hidden flex flex-col h-[90svh] sm:h-auto max-h-[90svh]"
        style={{ background: 'var(--bg)', color: 'var(--fg)' }}
      >
        {open && <ProfileSettingsForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ProfileSettingsForm({ onClose }: ProfileSettingsFormProps) {
  const { getAccount, updateAccount, uploadAvatar, profile, updateProfile, updateOneRepMax } =
    useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // Account State
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);

  // Athletic State (local copies for the form)
  const [weight, setWeight] = useState<number>(profile?.body_weight || 75);
  const [height, setHeight] = useState<number>(profile?.height || 175);
  const [birthDate, setBirthDate] = useState<string>(profile?.birth_date || '2000-01-01');
  const [gender, setGender] = useState<Gender>(profile?.gender || 'male');
  const [goal, setGoal] = useState<GoalType>(profile?.goal_program || 'maintain');
  const [activity, setActivity] = useState<number>(profile?.activity_level || 1.55);
  const [rms, setRms] = useState<Record<ExerciseType, number>>({
    'Pull-up': profile?.current_1rm_pullup || 0,
    Dips: profile?.current_1rm_dips || 0,
    'Muscle-up': profile?.current_1rm_muscleup || 0,
    Squat: profile?.current_1rm_squat || 0,
  });

  const loading = account === null;

  useEffect(() => {
    let cancelled = false;
    getAccount()
      .then((snapshot) => {
        if (cancelled) return;
        setAccount(snapshot ?? { email: null, name: '', avatarUrl: null, isOAuth: false });
        setName(snapshot?.name ?? '');
        setEmail(snapshot?.email ?? '');
        setAvatarPreview(snapshot?.avatarUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load account info.');
      });
    return () => {
      cancelled = true;
    };
  }, [getAccount]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (account?.isOAuth) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error('Image is too large (2 MB max).');
      return;
    }
    setPendingAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (password && password.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password && password !== passwordConfirm) {
      toast.error('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      // 1. Save Avatar
      let avatarUrl: string | undefined;
      if (pendingAvatar && !account?.isOAuth) {
        try {
          avatarUrl = await uploadAvatar(pendingAvatar);
        } catch {
          toast.error('Avatar upload failed.');
        }
      }

      // 2. Save Account Info
      const accountUpdates: Parameters<typeof updateAccount>[0] = {};
      if (name && name !== account?.name) accountUpdates.name = name;
      if (email && email !== account?.email && !account?.isOAuth) accountUpdates.email = email;
      if (password) accountUpdates.password = password;
      if (avatarUrl !== undefined) accountUpdates.avatarUrl = avatarUrl;

      if (Object.keys(accountUpdates).length > 0) {
        await updateAccount(accountUpdates);
      }

      // 3. Save Athletic Profile
      const profileUpdates: Partial<UserProfile> = {};
      if (weight !== profile?.body_weight) profileUpdates.body_weight = weight;
      if (height !== profile?.height) profileUpdates.height = height;
      if (birthDate !== profile?.birth_date) profileUpdates.birth_date = birthDate;
      if (gender !== profile?.gender) profileUpdates.gender = gender;
      if (goal !== profile?.goal_program) profileUpdates.goal_program = goal;
      if (activity !== profile?.activity_level) profileUpdates.activity_level = activity;

      if (Object.keys(profileUpdates).length > 0) {
        await updateProfile(profileUpdates);
      }

      // 4. Save 1RMs
      for (const exo of ONE_RM_FIELDS) {
        const val = rms[exo.key];
        const key = `current_1rm_${exo.key.toLowerCase().replace('-', '')}` as keyof UserProfile;
        const currentVal = profile ? profile[key] : undefined;
        if (val !== currentVal) {
          await updateOneRepMax(exo.key, val);
        }
      }

      toast.success('Settings updated');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (name || email || '?').slice(0, 1).toUpperCase();

  return (
    <>
      <DialogHeader
        className="px-5 pt-4 pb-3 flex flex-row items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <DialogTitle className="text-[14px] font-medium uppercase tracking-[0.22em]">
          Profile Settings
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-11 -mr-2 rounded-full flex items-center justify-center transition hover:opacity-70"
          style={{ color: 'var(--fg)' }}
          aria-label="Close"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </DialogHeader>

      {loading ? (
        <div className="px-5 py-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--fg)' }} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="account" className="w-full h-full flex flex-col">
            <TabsList
              className="w-full h-12 bg-transparent border-b rounded-none px-5 gap-6 shrink-0 flex items-center justify-start"
              style={{ borderColor: 'var(--border)' }}
            >
              <TabsTrigger
                value="account"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-[var(--fg)] rounded-none px-0 h-full text-[10px] uppercase tracking-widest font-bold"
              >
                Account
              </TabsTrigger>
              <TabsTrigger
                value="athletic"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-[var(--fg)] rounded-none px-0 h-full text-[10px] uppercase tracking-widest font-bold"
              >
                Athletic
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-[var(--fg)] rounded-none px-0 h-full text-[10px] uppercase tracking-widest font-bold"
              >
                Maxes
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0">
              <TabsContent value="account" className="p-5 space-y-5 mt-0 outline-none w-full">
                {/* Avatar Section */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => !account?.isOAuth && fileRef.current?.click()}
                    className={`relative h-16 w-16 rounded-full overflow-hidden flex items-center justify-center shrink-0 transition ${account?.isOAuth ? 'cursor-default' : 'active:opacity-80'}`}
                    style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
                  >
                    {avatarPreview ? (
                      <Image
                        src={avatarPreview}
                        alt="Avatar"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-[22px] font-medium font-mono">{initials}</span>
                    )}
                    {!account?.isOAuth && (
                      <span
                        className="absolute bottom-0 right-0 h-6 w-6 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--fg)', color: 'var(--bg)' }}
                      >
                        <Camera size={11} strokeWidth={2} />
                      </span>
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <div className="flex-1 min-w-0">
                    <AL>Profile picture</AL>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                      {account?.isOAuth ? 'Managed by Google/Apple.' : 'PNG or JPG, 2 MB max.'}
                    </p>
                  </div>
                </div>

                {/* Account Fields */}
                <div className="space-y-4">
                  <div>
                    <AL className="block mb-1.5">Username</AL>
                    <Input
                      value={name}
                      disabled={account?.isOAuth}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Username"
                      className="h-11 text-[16px] bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors disabled:opacity-50"
                    />
                  </div>

                  <div className="relative">
                    <AL className="block mb-1.5">Email</AL>
                    <Input
                      type="email"
                      value={email}
                      disabled={account?.isOAuth}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="h-11 text-[16px] bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors disabled:opacity-50"
                    />
                    {account?.isOAuth && (
                      <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                        <Shield
                          size={14}
                          className="shrink-0 mt-0.5"
                          style={{ color: 'var(--muted)' }}
                        />
                        <span
                          className="text-[11px] leading-relaxed"
                          style={{ color: 'var(--muted)' }}
                        >
                          Your username, email, and profile picture are managed by Google/Apple.
                        </span>
                      </div>
                    )}
                  </div>

                  {!account?.isOAuth && (
                    <div className="pt-2 space-y-4">
                      <AL className="block">Change password</AL>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        className="h-11 text-[16px] bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors"
                      />
                      <Input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        className="h-11 text-[16px] bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors"
                      />
                      <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        Leave blank to keep your current password. Min {PASSWORD_MIN_LENGTH}{' '}
                        characters.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="athletic" className="p-5 space-y-6 mt-0 outline-none w-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <AL className="block mb-1.5">Weight (kg)</AL>
                    <Input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="h-11 text-[16px] font-mono bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors"
                    />
                  </div>
                  <div>
                    <AL className="block mb-1.5">Height (cm)</AL>
                    <Input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="h-11 text-[16px] font-mono bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <AL className="block mb-1.5">Birth Date</AL>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="h-11 text-[16px] bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors"
                  />
                </div>

                <div>
                  <AL className="block mb-2">Gender</AL>
                  <div className="flex gap-2">
                    {GENDERS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGender(g.id)}
                        className={`flex-1 h-10 rounded-xl border text-[10px] font-bold transition ${gender === g.id ? 'bg-fg text-bg border-fg' : 'border-border text-muted'}`}
                        style={{
                          background: gender === g.id ? 'var(--fg)' : 'transparent',
                          color: gender === g.id ? 'var(--bg)' : 'var(--muted)',
                          borderColor: gender === g.id ? 'var(--fg)' : 'var(--border)',
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <AL className="block mb-2">Goal Program</AL>
                  <div className="grid grid-cols-3 gap-2">
                    {PROGRAMS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setGoal(p.id)}
                        className={`h-10 rounded-xl border text-[10px] font-bold transition ${goal === p.id ? 'bg-fg text-bg border-fg' : 'border-border text-muted'}`}
                        style={{
                          background: goal === p.id ? 'var(--fg)' : 'transparent',
                          color: goal === p.id ? 'var(--bg)' : 'var(--muted)',
                          borderColor: goal === p.id ? 'var(--fg)' : 'var(--border)',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <AL className="block mb-2">Activity Level</AL>
                  <div className="grid grid-cols-3 gap-2">
                    {[1.2, 1.55, 1.75].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setActivity(v)}
                        className={`h-10 rounded-xl border text-[10px] font-bold transition ${activity === v ? 'bg-fg text-bg border-fg' : 'border-border text-muted'}`}
                        style={{
                          background: activity === v ? 'var(--fg)' : 'transparent',
                          color: activity === v ? 'var(--bg)' : 'var(--muted)',
                          borderColor: activity === v ? 'var(--fg)' : 'var(--border)',
                        }}
                      >
                        {v === 1.2 ? 'LOW' : v === 1.55 ? 'MOD' : 'HIGH'}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="p-5 space-y-5 mt-0 outline-none w-full">
                <div className="grid grid-cols-1 gap-4">
                  {ONE_RM_FIELDS.map((exo) => (
                    <div key={exo.key}>
                      <AL className="block mb-1.5">{exo.label} 1RM (kg)</AL>
                      <Input
                        type="number"
                        step="0.5"
                        value={rms[exo.key]}
                        onChange={(e) => setRms({ ...rms, [exo.key]: Number(e.target.value) })}
                        className="h-11 text-[18px] font-mono bg-transparent border-b rounded-none border-x-0 border-t-0 px-0 focus-visible:ring-0 focus-visible:border-[var(--fg)] transition-colors"
                      />
                    </div>
                  ))}
                </div>
                <div
                  className="flex items-center gap-2 p-3 rounded-xl border border-dashed"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Info size={14} className="text-muted" />
                  <p className="text-[10px] text-muted">
                    Updates to these values will affect your next session targets immediately.
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}

      <div className="p-5 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[12px]"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </Button>
      </div>
    </>
  );
}

interface ProfileSettingsFormProps {
  onClose: () => void;
}
