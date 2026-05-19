import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  ExerciseType,
  calculate1RM,
  normalizeExerciseName,
  getSessionTemplate,
  progressionMatrix,
  motivationalMessages,
} from '@/lib/exercise';
import { Gender, GoalType, ActivityLevel, normalizeGender, normalizeGoal } from '@/lib/nutrition';
import { calculateAge } from '@/lib/utils';

export type {
  ExerciseType,
  SessionTemplate,
  PlannedExercise,
  ProgressionStep,
} from '@/lib/exercise';
export { calculate1RM, getSessionTemplate, progressionMatrix, motivationalMessages };
export { calculateAge };

export interface UserProfile {
  user_id: string;
  body_weight: number;
  current_1rm_muscleup: number;
  current_1rm_pullup: number;
  current_1rm_dips: number;
  current_1rm_squat: number;
  onboarding_completed: boolean;
  birth_date: string;
  height: number;
  goal_program: GoalType;
  gender: Gender;
  activity_level: number;
  display_name?: string;
}

interface RawProfile extends Omit<UserProfile, 'goal_program' | 'gender' | 'activity_level'> {
  goal_program: string | null;
  gender: string | null;
  activity_level: number | null;
}

function normalizeProfile(raw: RawProfile): UserProfile {
  return {
    ...raw,
    gender: normalizeGender(raw.gender),
    goal_program: normalizeGoal(raw.goal_program),
    activity_level: raw.activity_level ?? 1.55,
  };
}

export interface CompletedSession {
  id?: string;
  user_id: string;
  week_number: number;
  day_number: number;
  date: string;
  total_volume: number;
}

export interface ExerciseLog {
  id?: string;
  session_id?: string;
  user_id: string;
  date: string;
  exercise_name: ExerciseType;
  body_weight_used: number;
  added_weight: number;
  total_weight: number;
  reps: number;
  rpe: number | null;
  form_tags: string[] | null;
  calculated_1rm: number;
  is_pr: boolean;
}

const EXERCISE_TO_PROFILE_COLUMN: Record<ExerciseType, keyof UserProfile> = {
  'Muscle-up': 'current_1rm_muscleup',
  'Pull-up': 'current_1rm_pullup',
  Dips: 'current_1rm_dips',
  Squat: 'current_1rm_squat',
};

const DEFAULT_PROFILE_VALUES = {
  body_weight: 75,
  current_1rm_muscleup: 90,
  current_1rm_pullup: 115,
  current_1rm_dips: 135,
  current_1rm_squat: 140,
  onboarding_completed: false,
  birth_date: '2000-01-01',
  height: 180,
  goal_program: 'maintain' as GoalType,
  gender: 'male' as Gender,
  activity_level: 1.55,
} satisfies Omit<UserProfile, 'user_id'>;

const FETCH_RETRY_COUNT = 3;
const FETCH_RETRY_DELAY_MS = 500;

export interface AccountSnapshot {
  email: string | null;
  name: string;
  avatarUrl: string | null;
  isOAuth: boolean;
}

export interface AccountUpdate {
  name?: string;
  email?: string;
  password?: string;
  avatarUrl?: string | null;
}

interface SupabaseState {
  profile: UserProfile | null;
  exerciseLogs: ExerciseLog[];
  completedSessions: CompletedSession[];
  loading: boolean;
  avatarUrl: string | null;

  fetchProfile: () => Promise<void>;
  fetchTrainingLogs: () => Promise<void>;
  updatePerformance: (
    exercise: ExerciseType,
    bodyWeight: number,
    addedWeight: number,
    reps: number,
    rpe: number,
    formTags: string[],
    week: number,
    day: number
  ) => Promise<{ isPR: boolean; new1RM: number; logId: string }>;
  updateLogFeedback: (logId: string, rpe: number, formTags: string[]) => Promise<void>;
  updateBodyweight: (bodyWeight: number) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateOneRepMax: (exercise: ExerciseType, value: number) => Promise<void>;
  getAccount: () => Promise<AccountSnapshot | null>;
  updateAccount: (updates: AccountUpdate) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  completeOnboarding: (data: {
    body_weight: number;
    current_1rm_muscleup: number;
    current_1rm_pullup: number;
    current_1rm_dips: number;
    current_1rm_squat: number;
    birth_date: string;
    height: number;
    goal_program: GoalType;
    gender: Gender;
    activity_level: ActivityLevel;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useStore = create<SupabaseState>((set, get) => ({
  profile: null,
  exerciseLogs: [],
  completedSessions: [],
  loading: false,
  avatarUrl: null,

  fetchProfile: async () => {
    set({ loading: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ profile: null, avatarUrl: null, loading: false });
      return;
    }

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;
    const displayName =
      typeof meta.display_name === 'string'
        ? meta.display_name
        : typeof meta.full_name === 'string'
          ? meta.full_name
          : typeof meta.given_name === 'string'
            ? meta.given_name
            : typeof meta.name === 'string'
              ? meta.name
              : undefined;

    set({ avatarUrl: avatar });

    let raw: RawProfile | null = null;
    let retries = FETCH_RETRY_COUNT;

    while (retries > 0 && !raw) {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();

      if (data) {
        raw = data as RawProfile;
      } else {
        retries--;
        if (retries > 0) await new Promise((res) => setTimeout(res, FETCH_RETRY_DELAY_MS));
      }
    }

    if (raw) {
      // If profile exists but display_name is missing and we have one from OAuth, sync it
      if (!raw.display_name && displayName) {
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('user_id', user.id);
        raw.display_name = displayName;
      }
      set({ profile: normalizeProfile(raw), loading: false });
      return;
    }

    const seedProfile: RawProfile = {
      user_id: user.id,
      ...DEFAULT_PROFILE_VALUES,
      display_name: displayName,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert(seedProfile)
      .select()
      .single();

    if (insertError) {
      const { data: final } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      set({
        profile: final ? normalizeProfile(final as RawProfile) : null,
        loading: false,
      });
    } else {
      set({ profile: normalizeProfile(inserted as RawProfile), loading: false });
    }
  },

  fetchTrainingLogs: async () => {
    const { profile } = get();
    if (!profile) return;

    const [logsRes, sessionsRes] = await Promise.all([
      supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('date', { ascending: false }),
      supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('date', { ascending: false }),
    ]);

    if (!logsRes.error && logsRes.data) {
      const normalized: ExerciseLog[] = logsRes.data.map((log) => ({
        ...(log as ExerciseLog),
        exercise_name: normalizeExerciseName((log as ExerciseLog).exercise_name),
      }));
      set({ exerciseLogs: normalized });
    }
    if (!sessionsRes.error && sessionsRes.data) {
      set({ completedSessions: sessionsRes.data as CompletedSession[] });
    }
  },

  updatePerformance: async (exercise, bodyWeight, addedWeight, reps, rpe, formTags, week, day) => {
    const { profile } = get();
    if (!profile) return { isPR: false, new1RM: 0, logId: '' };

    const totalWeight = bodyWeight + addedWeight;
    const new1RM = calculate1RM(totalWeight, reps);
    const profileColumn = EXERCISE_TO_PROFILE_COLUMN[exercise];
    const currentMax = profile[profileColumn] as number;
    const isPR = new1RM > currentMax;
    const updatedMax = Math.max(currentMax, new1RM);
    const dateIso = new Date().toISOString();
    const totalVolume = totalWeight * reps;

    const { data: sessionData } = await supabase
      .from('completed_sessions')
      .insert({
        user_id: profile.user_id,
        week_number: week,
        day_number: day,
        date: dateIso,
        total_volume: totalVolume,
      })
      .select('id')
      .single();

    const { data: logData } = await supabase
      .from('exercise_logs')
      .insert({
        session_id: sessionData?.id,
        user_id: profile.user_id,
        date: dateIso,
        exercise_name: exercise,
        body_weight_used: bodyWeight,
        added_weight: addedWeight,
        total_weight: totalWeight,
        reps,
        rpe,
        form_tags: formTags,
        calculated_1rm: new1RM,
        is_pr: isPR,
      })
      .select('id')
      .single();

    const { error } = await supabase
      .from('profiles')
      .update({
        body_weight: bodyWeight,
        [profileColumn]: updatedMax,
      })
      .eq('user_id', profile.user_id);

    if (!error) {
      set({
        profile: {
          ...profile,
          body_weight: bodyWeight,
          [profileColumn]: updatedMax,
        },
      });
      get().fetchTrainingLogs();
    }

    return { isPR, new1RM, logId: logData?.id ?? '' };
  },

  updateLogFeedback: async (logId, rpe, formTags) => {
    if (!logId) return;
    await supabase.from('exercise_logs').update({ rpe, form_tags: formTags }).eq('id', logId);
    get().fetchTrainingLogs();
  },

  updateBodyweight: async (bodyWeight) => {
    const { profile } = get();
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({ body_weight: bodyWeight })
      .eq('user_id', profile.user_id);

    if (!error) {
      set({ profile: { ...profile, body_weight: bodyWeight } });
    }
  },

  updateProfile: async (updates) => {
    const { profile } = get();
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', profile.user_id);

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    set({ profile: { ...profile, ...updates } });
  },

  updateOneRepMax: async (exercise, value) => {
    const { profile } = get();
    if (!profile) return;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Invalid 1RM value');
    }

    const column = EXERCISE_TO_PROFILE_COLUMN[exercise];
    const { error } = await supabase
      .from('profiles')
      .update({ [column]: value })
      .eq('user_id', profile.user_id);

    if (error) {
      console.error('Error updating 1RM:', error);
      throw error;
    }

    set({ profile: { ...profile, [column]: value } });
  },

  getAccount: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const providers = (user.app_metadata?.providers ?? []) as string[];
    return {
      email: user.email ?? null,
      name:
        typeof metadata.display_name === 'string'
          ? metadata.display_name
          : typeof metadata.full_name === 'string'
            ? metadata.full_name
            : typeof metadata.name === 'string'
              ? metadata.name
              : '',
      avatarUrl: typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null,
      isOAuth: providers.length > 0 && !providers.includes('email'),
    };
  },

  updateAccount: async ({ name, email, password, avatarUrl }) => {
    const payload: {
      email?: string;
      password?: string;
      data?: Record<string, string | null>;
    } = {};
    const metadataPatch: Record<string, string | null> = {};

    if (typeof name === 'string') {
      metadataPatch.display_name = name;
      metadataPatch.name = name; // Maintain for compatibility
    }
    if (avatarUrl !== undefined) metadataPatch.avatar_url = avatarUrl;
    if (Object.keys(metadataPatch).length > 0) payload.data = metadataPatch;
    if (email) payload.email = email;
    if (password) payload.password = password;

    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.auth.updateUser(payload);
    if (error) {
      console.error('Error updating account:', error);
      throw error;
    }

    // Sync with local profile state if name changed
    if (typeof name === 'string') {
      const { profile } = get();
      if (profile) {
        set({ profile: { ...profile, display_name: name } });
      }
    }

    if ('avatar_url' in metadataPatch) {
      set({ avatarUrl: metadataPatch.avatar_url ?? null });
    }
  },

  uploadAvatar: async (file) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      console.error('Avatar upload failed:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  },

  completeOnboarding: async (data) => {
    const { profile } = get();
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        onboarding_completed: true,
      })
      .eq('user_id', profile.user_id);

    if (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }

    set({
      profile: {
        ...profile,
        ...data,
        onboarding_completed: true,
      },
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, exerciseLogs: [], completedSessions: [] });
  },
}));
