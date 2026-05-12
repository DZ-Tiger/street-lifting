'use client';
import { useEffect } from 'react';

export const SKIN_STORAGE_KEY = 'street-flow-skin';

export const SKINS = {
  mono: {
    '--bg': '#ffffff',
    '--surface': '#fcfcfc',
    '--surface-2': '#f3f3f2',
    '--border': '#e7e6e3',
    '--muted': '#8a8884',
    '--ink-3': '#b8b6b1',
    '--ink-2': '#5a5854',
    '--fg': '#0f0f0e',
    '--carbon': '#0c0c0b',
    '--carbon-2': '#161614',
  },
  carbon: {
    '--bg': '#0f0f0e',
    '--surface': '#151513',
    '--surface-2': '#1c1c1a',
    '--border': '#272724',
    '--muted': '#7c7a76',
    '--ink-3': '#36352f',
    '--ink-2': '#a8a59f',
    '--fg': '#f7f6f3',
    '--carbon': '#000',
    '--carbon-2': '#0a0a09',
  },
  sand: {
    '--bg': '#f6f3ec',
    '--surface': '#fbf9f3',
    '--surface-2': '#ede9df',
    '--border': '#d8d3c5',
    '--muted': '#8a8472',
    '--ink-3': '#b9b1a0',
    '--ink-2': '#5d574a',
    '--fg': '#191813',
    '--carbon': '#191813',
    '--carbon-2': '#23211b',
  },
} as const;

export type SkinKey = keyof typeof SKINS;

export function applySkin(skin: SkinKey) {
  const root = document.documentElement;
  const palette = SKINS[skin];
  Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));
}

/** Reads the stored skin preference and applies CSS vars to :root on mount. */
export function useSkin() {
  useEffect(() => {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored && stored in SKINS) {
      applySkin(stored as SkinKey);
    }
  }, []);
}
