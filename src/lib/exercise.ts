export type ExerciseType = 'Muscle-up' | 'Pull-up' | 'Dips' | 'Squat';

export interface PlannedExercise {
  name: string;
  sets: string;
  reps: string;
  weight: number | string;
  isMain?: boolean;
}

export interface SessionTemplate {
  title: string;
  mainExercise: ExerciseType;
  exercises: PlannedExercise[];
}

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

/** Epley 1RM: total_weight * (1 + reps / 30). */
export function calculate1RM(totalWeight: number, reps: number): number {
  if (reps <= 1) return totalWeight;
  return totalWeight * (1 + reps / 30);
}

export const motivationalMessages = [
  "The only bad session is the one you didn't do.",
  'Discipline beats motivation every time.',
  'Every rep counts toward your next record.',
  'Iron never lies.',
  'Work in silence, let your success make the noise.',
  'Strength and honor.',
  'A little more each day — that is Street Lifting.',
  'Your only opponent is the one in the mirror.',
];

export function getSessionTemplate(
  week: number,
  day: number,
  oneRepMaxes: Record<ExerciseType, number>,
  bodyWeightKg: number
): SessionTemplate {
  const step = progressionMatrix.find((s) => s.week === week) ?? progressionMatrix[0];

  const computeAddedWeight = (target1RM: number, pct: number): number => {
    const total = target1RM * pct;
    return Math.max(0, Math.round((total - bodyWeightKg) * 2) / 2);
  };

  switch (day) {
    case 1:
      return {
        title: 'Pull-up Strength',
        mainExercise: 'Pull-up',
        exercises: [
          {
            name: 'Weighted Pull-ups',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: computeAddedWeight(oneRepMaxes['Pull-up'], step.pct),
            isMain: true,
          },
          {
            name: 'Dips (Volume)',
            sets: '4',
            reps: '8-10',
            weight: computeAddedWeight(oneRepMaxes['Dips'], 0.65),
          },
          {
            name: 'Back Extension',
            sets: '3',
            reps: '10-12',
            weight: Math.round(oneRepMaxes['Squat'] * 0.4 * 2) / 2,
          },
          {
            name: 'Triceps Extension',
            sets: '3',
            reps: '12',
            weight: Math.round(oneRepMaxes['Dips'] * 0.15 * 2) / 2,
          },
        ],
      };
    case 2:
      return {
        title: 'Squat Strength',
        mainExercise: 'Squat',
        exercises: [
          {
            name: 'Back Squat',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: computeAddedWeight(oneRepMaxes['Squat'], step.pct),
            isMain: true,
          },
          {
            name: 'Bulgarian Split Squats',
            sets: '3',
            reps: '10/side',
            weight: Math.round(oneRepMaxes['Squat'] * 0.35 * 2) / 2,
          },
          {
            name: 'Leg Curl',
            sets: '3',
            reps: '10',
            weight: Math.round(oneRepMaxes['Squat'] * 0.25 * 2) / 2,
          },
          { name: 'Hanging Leg Raises', sets: '4', reps: '15', weight: 'BW' },
        ],
      };
    case 3:
      return {
        title: 'Dips Strength',
        mainExercise: 'Dips',
        exercises: [
          {
            name: 'Weighted Dips',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: computeAddedWeight(oneRepMaxes['Dips'], step.pct),
            isMain: true,
          },
          { name: 'Muscle-ups (Technique)', sets: '4', reps: '2-3', weight: 'BW' },
          {
            name: 'Pull-ups (Volume)',
            sets: '4',
            reps: '8-10',
            weight: computeAddedWeight(oneRepMaxes['Pull-up'], 0.65),
          },
          {
            name: 'Face Pulls',
            sets: '3',
            reps: '15',
            weight: Math.round(oneRepMaxes['Pull-up'] * 0.15 * 2) / 2,
          },
        ],
      };
    case 4:
      return {
        title: 'Muscle-up Focus',
        mainExercise: 'Muscle-up',
        exercises: [
          {
            name: 'Weighted Muscle-ups',
            sets: '3-5',
            reps: `${step.reps}`,
            weight: computeAddedWeight(oneRepMaxes['Muscle-up'], step.pct),
            isMain: true,
          },
          {
            name: 'Weighted Push-ups',
            sets: '3',
            reps: '10-12',
            weight: computeAddedWeight(oneRepMaxes['Dips'], 0.5),
          },
          {
            name: 'Biceps Curls',
            sets: '3',
            reps: '12',
            weight: Math.round(oneRepMaxes['Pull-up'] * 0.2 * 2) / 2,
          },
          {
            name: 'Weighted Plank',
            sets: '3',
            reps: '45s',
            weight: computeAddedWeight(oneRepMaxes['Squat'], 0.2),
          },
        ],
      };
    default:
      return { title: 'Rest', mainExercise: 'Pull-up', exercises: [] };
  }
}

const EXERCISE_NAME_NORMALIZATION: Record<string, ExerciseType> = {
  'Muscle-up': 'Muscle-up',
  Tractions: 'Pull-up',
  'Pull-up': 'Pull-up',
  Dips: 'Dips',
  Squat: 'Squat',
};

/** Maps a legacy database exercise label to the canonical English type. */
export function normalizeExerciseName(value: string): ExerciseType {
  return EXERCISE_NAME_NORMALIZATION[value] ?? 'Pull-up';
}
