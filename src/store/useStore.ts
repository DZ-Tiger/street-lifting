import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type ExerciseType = 'Muscle-up' | 'Tractions' | 'Dips' | 'Squat';

export interface UserProfile {
  user_id: string;
  current_bodyweight: number;
  max_muscleup: number;
  max_pullup: number;
  max_dip: number;
  max_squat: number;
}

export interface TrainingLog {
  user_id: string;
  date: string;
  exercise_type: ExerciseType;
  weight_added: number;
  reps_done: number;
  calculated_1rm: number;
}

interface SupabaseState {
  profile: UserProfile | null;
  loading: boolean;

  // Actions
  fetchProfile: () => Promise<void>;
  updatePerformance: (
    exercise: ExerciseType,
    bw: number,
    lest: number,
    reps: number
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

export const calculate1RM = (bw: number, lest: number, reps: number) => {
  if (reps === 1) return bw + lest;
  return (bw + lest) * (1 + reps / 30);
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

export const useStore = create<SupabaseState>((set, get) => ({
  profile: null,
  loading: false,

  fetchProfile: async () => {
    set({ loading: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return set({ profile: null, loading: false });

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    }

    if (data) {
      set({ profile: data, loading: false });
    } else {
      // Initialiser un profil si inexistant
      const newProfile = {
        user_id: user.id,
        current_bodyweight: 75,
        max_muscleup: 90,
        max_pullup: 115,
        max_dip: 135,
        max_squat: 140,
      };
      await supabase.from('profiles').insert(newProfile);
      set({ profile: newProfile as UserProfile, loading: false });
    }
  },

  updatePerformance: async (exercise, bw, lest, reps) => {
    const { profile } = get();
    if (!profile) return;

    const new1RM = calculate1RM(bw, lest, reps);
    const exerciseKeyMap: Record<ExerciseType, keyof UserProfile> = {
      'Muscle-up': 'max_muscleup',
      Tractions: 'max_pullup',
      Dips: 'max_dip',
      Squat: 'max_squat',
    };

    const updatedValue = Math.max(profile[exerciseKeyMap[exercise]] as number, new1RM);

    // 1. Log the training
    await supabase.from('training_logs').insert({
      user_id: profile.user_id,
      date: new Date().toISOString(),
      exercise_type: exercise,
      weight_added: lest,
      reps_done: reps,
      calculated_1rm: new1RM,
    });

    // 2. Update Profile
    const { error } = await supabase
      .from('profiles')
      .update({
        current_bodyweight: bw,
        [exerciseKeyMap[exercise]]: updatedValue,
      })
      .eq('user_id', profile.user_id);

    if (!error) {
      set({
        profile: {
          ...profile,
          current_bodyweight: bw,
          [exerciseKeyMap[exercise]]: updatedValue,
        },
      });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null });
  },
}));
