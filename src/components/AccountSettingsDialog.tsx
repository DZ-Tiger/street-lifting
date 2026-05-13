'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Camera, Loader2, X } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStore, AccountSnapshot } from '@/store/useStore';

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSWORD_MIN_LENGTH = 8;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function AccountSettingsDialog({ open, onOpenChange }: AccountSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 overflow-hidden"
        style={{ background: 'var(--bg)', color: 'var(--fg)' }}
      >
        {open && <AccountSettingsForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

interface AccountSettingsFormProps {
  onClose: () => void;
}

function AccountSettingsForm({ onClose }: AccountSettingsFormProps) {
  const { getAccount, updateAccount, uploadAvatar } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);

  const loading = account === null;

  useEffect(() => {
    let cancelled = false;
    getAccount()
      .then((snapshot) => {
        if (cancelled) return;
        setAccount(snapshot ?? { email: null, name: '', avatarUrl: null });
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
      let avatarUrl: string | undefined;
      if (pendingAvatar) {
        try {
          avatarUrl = await uploadAvatar(pendingAvatar);
        } catch {
          toast.error('Avatar upload failed. Other changes still saved.');
        }
      }

      const updates: Parameters<typeof updateAccount>[0] = {};
      if (name && name !== account?.name) updates.name = name;
      if (email && email !== account?.email) updates.email = email;
      if (password) updates.password = password;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

      await updateAccount(updates);

      if (updates.email && updates.email !== account?.email) {
        toast.success('Check your inbox to confirm the new email.');
      } else {
        toast.success('Account updated.');
      }
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
        className="px-5 pt-4 pb-3 flex flex-row items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <DialogTitle className="text-[14px] font-medium uppercase tracking-[0.22em]">
          Account Settings
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
        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative h-16 w-16 rounded-full overflow-hidden flex items-center justify-center transition active:opacity-80"
              style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
              aria-label="Change profile picture"
            >
              {avatarPreview ? (
                <Image src={avatarPreview} alt="Avatar" fill className="object-cover" unoptimized />
              ) : (
                <span
                  className="text-[22px] font-medium font-mono tabular-nums"
                  style={{ color: 'var(--fg)' }}
                >
                  {initials}
                </span>
              )}
              <span
                className="absolute bottom-0 right-0 h-6 w-6 rounded-full flex items-center justify-center"
                style={{ background: 'var(--fg)', color: 'var(--bg)' }}
              >
                <Camera size={11} strokeWidth={2} />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ color: 'var(--muted)' }}
              >
                Profile picture
              </div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                PNG or JPG, 2 MB max.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label
                htmlFor="account-name"
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ color: 'var(--muted)' }}
              >
                Name
              </Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="mt-1.5 h-11 text-[16px]"
              />
            </div>

            <div>
              <Label
                htmlFor="account-email"
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ color: 'var(--muted)' }}
              >
                Email
              </Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                inputMode="email"
                className="mt-1.5 h-11 text-[16px]"
              />
              <p className="mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                A confirmation link will be sent to verify the new address.
              </p>
            </div>

            <div className="pt-2 space-y-3">
              <div
                className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ color: 'var(--muted)' }}
              >
                <span>Change password</span>
                <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
              </div>
              <div>
                <Label htmlFor="account-password" className="sr-only">
                  New password
                </Label>
                <Input
                  id="account-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  className="h-11 text-[16px]"
                />
              </div>
              <div>
                <Label htmlFor="account-password-confirm" className="sr-only">
                  Confirm new password
                </Label>
                <Input
                  id="account-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="h-11 text-[16px]"
                />
              </div>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                Leave blank to keep your current password. Minimum {PASSWORD_MIN_LENGTH} characters.
              </p>
            </div>
          </div>

          <div
            className="flex gap-2 pt-2 -mx-5 px-5 pb-5"
            style={{ borderTop: '1px solid var(--border)', marginBottom: '-1.25rem' }}
          >
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-11"
              style={{ background: 'var(--fg)', color: 'var(--bg)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
