import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type ExerciseType = 'Muscle-up' | 'Tractions' | 'Dips' | 'Squat';

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
  goal_program: string;
  gender: 'Homme' | 'Femme';
  activity_level?: number;
}

export const calculateAge = (birthDate: string): number => {
  if (!birthDate) return 25;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

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

interface SupabaseState {
  profile: UserProfile | null;
  exerciseLogs: ExerciseLog[];
  completedSessions: CompletedSession[];
  loading: boolean;

  // Actions
  fetchProfile: () => Promise<void>;
  fetchTrainingLogs: () => Promise<void>;
  updatePerformance: (
    exercise: ExerciseType,
    bw: number,
    lest: number,
    reps: number,
    rpe: number,
    form_tags: string[],
    week: number,
    day: number
  ) => Promise<{ isPR: boolean; new1RM: number; logId: string }>;
  updateLogFeedback: (logId: string, rpe: number, form_tags: string[]) => Promise<void>;
  updateBodyweight: (bw: number) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (data: {
    body_weight: number;
    current_1rm_muscleup: number;
    current_1rm_pullup: number;
    current_1rm_dips: number;
    current_1rm_squat: number;
    birth_date: string;
    height: number;
    goal_program: string;
    gender: 'Homme' | 'Femme';
    activity_level?: number;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

export const calculate1RM = (total_weight: number, reps: number) => {
  if (reps === 1) return total_weight;
  return total_weight * (1 + reps / 30);
};

export interface ProgressionStep {
  week: number;
  pct: number;
  reps: number;
  isDeload: boolean;
}

export const progressionMatrix: ProgressionStep[] = [
  { week: 1, pct: 0.75, reps: 5, isDeload: false },
  { week: 2, pct: 0.8, reps: 4, isDeload: false },
  { week: 3, pct: 0.85, reps: 3, isDeload: false },
  { week: 4, pct: 0.65, reps: 5, isDeload: true },
  { week: 5, pct: 0.825, reps: 3, isDeload: false },
  { week: 6, pct: 0.85, reps: 3, isDeload: false },
  { week: 7, pct: 0.9, reps: 2, isDeload: false },
  { week: 8, pct: 0.7, reps: 3, isDeload: true },
  { week: 9, pct: 1.0, reps: 1, isDeload: false },
];

// Types pour les séances
export interface PlannedExercise {
  name: string;
  sets: string;
  reps: string;
  weight: number | string; // number (kg) or string ("BW")
  isMain?: boolean;
}

export const getSessionTemplate = (
  week: number,
  day: number,
  r1RMs: Record<ExerciseType, number>,
  bw: number
): { title: string; mainExercise: ExerciseType; exercises: PlannedExercise[] } => {
  const step = progressionMatrix.find((s) => s.week === week) || progressionMatrix[0];

  const calcLest = (target1RM: number, pct: number) => {
    const total = target1RM * pct;
    return Math.max(0, Math.round((total - bw) * 2) / 2);
  };

  switch (day) {
    case 1:
      return {
        title: 'Force Tractions',
        mainExercise: 'Tractions',
        exercises: [
          {
            name: 'Tractions Lestées',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: calcLest(r1RMs['Tractions'], step.pct),
            isMain: true,
          },
          { name: 'Dips (Volume)', sets: '4', reps: '8-10', weight: calcLest(r1RMs['Dips'], 0.65) },
          {
            name: 'Back Extension',
            sets: '3',
            reps: '10-12',
            weight: Math.round(r1RMs['Squat'] * 0.4 * 2) / 2,
          },
          {
            name: 'Triceps Extension',
            sets: '3',
            reps: '12',
            weight: Math.round(r1RMs['Dips'] * 0.15 * 2) / 2,
          },
        ],
      };
    case 2:
      return {
        title: 'Force Squat',
        mainExercise: 'Squat',
        exercises: [
          {
            name: 'Back Squat',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: calcLest(r1RMs['Squat'], step.pct),
            isMain: true,
          },
          {
            name: 'Fentes Bulgares',
            sets: '3',
            reps: '10/j',
            weight: Math.round(r1RMs['Squat'] * 0.35 * 2) / 2,
          },
          {
            name: 'Leg Curl',
            sets: '3',
            reps: '10',
            weight: Math.round(r1RMs['Squat'] * 0.25 * 2) / 2,
          },
          { name: 'Relevés de jambes', sets: '4', reps: '15', weight: 'BW' },
        ],
      };
    case 3:
      return {
        title: 'Force Dips',
        mainExercise: 'Dips',
        exercises: [
          {
            name: 'Dips Lestés',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: calcLest(r1RMs['Dips'], step.pct),
            isMain: true,
          },
          { name: 'Muscle-ups (Tech)', sets: '4', reps: '2-3', weight: 'BW' },
          {
            name: 'Tractions (Volume)',
            sets: '4',
            reps: '8-10',
            weight: calcLest(r1RMs['Tractions'], 0.65),
          },
          {
            name: 'Facepulls',
            sets: '3',
            reps: '15',
            weight: Math.round(r1RMs['Tractions'] * 0.15 * 2) / 2,
          },
        ],
      };
    case 4:
      return {
        title: 'Focus Muscle-up',
        mainExercise: 'Muscle-up',
        exercises: [
          {
            name: 'Muscle-ups Lestés',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: calcLest(r1RMs['Muscle-up'], step.pct),
            isMain: true,
          },
          {
            name: 'Pompes Lestées',
            sets: '3',
            reps: '10-12',
            weight: calcLest(r1RMs['Dips'], 0.5),
          },
          {
            name: 'Biceps Curls',
            sets: '3',
            reps: '12',
            weight: Math.round(r1RMs['Tractions'] * 0.2 * 2) / 2,
          },
          { name: 'Gainage Lesté', sets: '3', reps: '45s', weight: calcLest(r1RMs['Squat'], 0.2) },
        ],
      };
    default:
      return { title: 'Repos', mainExercise: 'Tractions', exercises: [] };
  }
};

export const motivationalMessages = [
  "La seule mauvaise séance est celle que tu n'as pas faite.",
  'La discipline bat la motivation à chaque fois.',
  'Chaque répétition compte vers ton futur record.',
  'Le fer ne ment jamais.',
  'Travaille en silence, laisse ton succès faire du bruit.',
  'Force et Honneur.',
  "Un peu plus chaque jour, c'est ça le Street Lifting.",
  'Ton seul adversaire est celui dans le miroir.',
];

export const useStore = create<SupabaseState>((set, get) => ({
  profile: null,
  exerciseLogs: [],
  completedSessions: [],
  loading: false,

  fetchProfile: async () => {
    set({ loading: true });
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        if (error) console.warn('Error fetching user in store:', error.message);
        return set({ profile: null, loading: false });
      }

      // Tentative de récupération du profil (plusieurs essais car le trigger peut être lent)
      let profileData = null;
      let retries = 3;

      while (retries > 0 && !profileData) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data) {
          profileData = data;
        } else {
          retries--;
          if (retries > 0) await new Promise((res) => setTimeout(res, 500));
        }
      }

      if (profileData) {
        set({ profile: profileData, loading: false });
      } else {
        // Si vraiment rien après les retours, on tente l'insertion manuelle
        const newProfile = {
          user_id: user.id,
          body_weight: 75,
          current_1rm_muscleup: 90,
          current_1rm_pullup: 115,
          current_1rm_dips: 135,
          current_1rm_squat: 140,
          onboarding_completed: false,
          birth_date: '2000-01-01',
          height: 180,
          goal_program: 'maintenance',
          gender: 'Homme',
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          // Probablement déjà inséré entre temps
          const { data: finalData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          set({ profile: finalData as UserProfile, loading: false });
        } else {
          set({ profile: insertedData as UserProfile, loading: false });
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      set({ profile: null, loading: false });
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
      set({ exerciseLogs: logsRes.data });
    }
    if (!sessionsRes.error && sessionsRes.data) {
      set({ completedSessions: sessionsRes.data });
    }
  },

  updatePerformance: async (exercise, bw, lest, reps, rpe, form_tags, week, day) => {
    const { profile } = get();
    if (!profile) return { isPR: false, new1RM: 0, logId: '' };

    const totalWeight = bw + lest;
    const new1RM = calculate1RM(totalWeight, reps);
    const exerciseKeyMap: Record<ExerciseType, keyof UserProfile> = {
      'Muscle-up': 'current_1rm_muscleup',
      Tractions: 'current_1rm_pullup',
      Dips: 'current_1rm_dips',
      Squat: 'current_1rm_squat',
    };

    const currentMax = profile[exerciseKeyMap[exercise]] as number;
    const isPR = new1RM > currentMax;
    const updatedValue = Math.max(currentMax, new1RM);
    const dateStr = new Date().toISOString();
    const totalVolume = totalWeight * reps;

    // 1. Session log
    const { data: sessionData } = await supabase
      .from('completed_sessions')
      .insert({
        user_id: profile.user_id,
        week_number: week,
        day_number: day,
        date: dateStr,
        total_volume: totalVolume,
      })
      .select('id')
      .single();

    // 2. Exercise log
    const { data: logData } = await supabase
      .from('exercise_logs')
      .insert({
        session_id: sessionData?.id,
        user_id: profile.user_id,
        date: dateStr,
        exercise_name: exercise,
        body_weight_used: bw,
        added_weight: lest,
        total_weight: totalWeight,
        reps: reps,
        rpe: rpe,
        form_tags: form_tags,
        calculated_1rm: new1RM,
        is_pr: isPR,
      })
      .select('id')
      .single();

    // 3. Update Profile
    const { error } = await supabase
      .from('profiles')
      .update({
        body_weight: bw,
        [exerciseKeyMap[exercise]]: updatedValue,
      })
      .eq('user_id', profile.user_id);

    if (!error) {
      set({
        profile: {
          ...profile,
          body_weight: bw,
          [exerciseKeyMap[exercise]]: updatedValue,
        },
      });
      // Refresh logs
      get().fetchTrainingLogs();
    }

    return { isPR, new1RM, logId: logData?.id || '' };
  },

  updateLogFeedback: async (logId: string, rpe: number, form_tags: string[]) => {
    if (!logId) return;
    await supabase.from('exercise_logs').update({ rpe, form_tags }).eq('id', logId);
    get().fetchTrainingLogs();
  },

  updateBodyweight: async (bw: number) => {
    const { profile } = get();
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({ body_weight: bw })
      .eq('user_id', profile.user_id);

    if (!error) {
      set({ profile: { ...profile, body_weight: bw } });
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const { profile } = get();
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', profile.user_id);

    if (!error) {
      set({ profile: { ...profile, ...updates } });
    } else {
      console.error('Error updating profile:', error);
      throw error;
    }
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
