import { clsx, type ClassValue } from 'clsx';
import { useSyncExternalStore } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const subscribeNoop = () => () => {};

/** True after client-side hydration. Avoids setState-in-effect lint violations. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

export function calculateTrendline(data: { x: number; y: number }[]) {
  const n = data.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (const point of data) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

export function calculateAge(birthDate: string): number {
  if (!birthDate) return 25;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 25;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_QUALITY = 0.8;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_IMAGE_DIMENSION) {
            height *= MAX_IMAGE_DIMENSION / width;
            width = MAX_IMAGE_DIMENSION;
          }
        } else if (height > MAX_IMAGE_DIMENSION) {
          width *= MAX_IMAGE_DIMENSION / height;
          height = MAX_IMAGE_DIMENSION;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      };
      img.onerror = () => reject(new Error('Image decode failed'));
    };
    reader.onerror = () => reject(new Error('File read failed'));
  });
}
