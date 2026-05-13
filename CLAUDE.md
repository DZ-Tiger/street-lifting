@AGENTS.md
# CLAUDE.md — 9.81 Development Guide

> Codename "9.81" — the product brand. Named after Earth's gravity (9.81 m/s²) to convey an
> analytical, performance-focused identity for Street Lifting. All UI copy, manifests, and
> metadata should use "9.81" as the product name.

## 🎯 Vision & UX
- **Concept:** A performance app for Street Lifting (pull-ups, dips, muscle-ups, squats).
- **"Chalked Hands" Philosophy:** Optimized for use with chalk — no keyboard during workouts. Input should use large numeric pads and oversized buttons.
- **Design:** "Analytical Performance" style: minimalist, professional, monochrome by default (Black/White/Slate). Use Lucide React for icons (1.5px stroke).

## 🛠 Tech Stack
- **Frontend:** Next.js 15 (App Router) + TypeScript.
- **Styling:** TailwindCSS 4 + Framer Motion.
- **UI Library:** Shadcn UI (base components in `src/components/ui`).
- **State:** Zustand (`src/store/`) with persistence for nutrition data and profiles.
- **Backend:** Supabase (Auth, PostgreSQL, RLS).
- **AI:** Google Gemini SDK (`@google/generative-ai`) for the nutrition scanner.

## 🚀 Useful Commands
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint` (Aim for zero lint errors)
- **Install:** `npm install`

## 📏 Coding & Typing Standards
- **Linting:** Strict ESLint rules following Next.js recommendations. Avoid `any` types and do not ignore warnings.
- **Components:** Separate logic from presentation. Use functional components with TypeScript.
- **State:** Prefer derived calculations (`useMemo`) over redundant state.
- **Security:** Always verify Supabase RLS policies before adding new tables.
- **Images:** Use `new window.Image()` when manipulating canvas to avoid conflicts with `next/image`.

## 🧠 Algorithms & Business Logic
- **Strength (Epley 1RM):** `1RM = Load * (1 + (Reps / 30))`.
- **Nutrition (Mifflin-St Jeor BMR):**
  - Male: `(10 * weight) + (6.25 * height) - (5 * age) + 5`
  - Female: `(10 * weight) + (6.25 * height) - (5 * age) - 161`
- **TDEE:** `BMR * ActivityLevel`.
- **Macros guideline:** Protein = 2g/kg, Fat = 1g/kg, Carbs = remaining calories.

## 📁 Data Structure
- `profiles`: Physical data and reference 1RM values.
- `nutrition_logs`: Meal history with portioning (fractions or grams).
- `exercise_logs`: Sets, reps, RPE, and added weight.

## 🤖 AI / Agent Guidelines
1. **Before coding:** Read `src/store/useStore.ts` to understand how `body_weight` is used across the app.
2. **Scanner flow:** The scanning pipeline must always support: Capture → Analysis (skeleton) → Review/Edit → Save.
3. **Ergonomics:** Always ask, "Can I tap this button with chalked hands?" when evaluating UI.
4. **Typing:** If an object (e.g., `goal`) is used as a key, model it as a strict union type: `'cut' | 'maintain' | 'bulk'`.