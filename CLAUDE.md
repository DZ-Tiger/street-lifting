@AGENTS.md
# CLAUDE.md - Street Flow Development Guide

## 🎯 Vision & UX
- **Concept :** Application de performance pour le Street Lifting (Tractions, Dips, Muscle-up, Squat).
- **Philosophie "Mains Sales" :** Optimisé pour l'usage avec de la magnésie. Zéro clavier pendant l'entraînement. Saisie via pavés numériques larges et boutons massifs.
- **Design :** Style "Analytical Performance", minimaliste, professionnel, monochrome par défaut (Noir/Blanc/Slate). Utilisation de Lucide React pour les icônes (stroke 1.5px).

## 🛠 Stack Technique
- **Frontend :** Next.js 15 (App Router) + TypeScript.
- **Style :** TailwindCSS 4 + Framer Motion.
- **UI :** Shadcn UI (fondations dans `src/components/ui`).
- **State :** Zustand (`src/store/`) avec persistance pour la nutrition et les profils.
- **Backend :** Supabase (Auth, PostgreSQL, RLS).
- **IA :** Google Gemini SDK (`@google/generative-ai`) pour le scanner de nutrition.

## 🚀 Commandes Utiles
- **Dév :** `npm run dev`
- **Build :** `npm run build`
- **Lint :** `npm run lint` (Zéro erreur tolérée !)
- **Install :** `npm install`

## 📏 Standards de Code & Typage
- **Linting :** Respect strict des règles ESLint Next.js. Pas de types `any`, pas de warnings ignorés.
- **Composants :** Séparer la logique des vues. Utiliser des composants fonctionnels avec TypeScript.
- **État :** Préférer les calculs dérivés (`useMemo`) aux états redondants.
- **Sécurité :** Vérifier systématiquement les politiques RLS de Supabase pour toute nouvelle table.
- **Images :** Utiliser `new window.Image()` pour les manipulations de canvas afin d'éviter les conflits avec `next/image`.

## 🧠 Algorithmes & Logique Métier
- **Force (1RM Epley) :** `1RM = Charge_Totale * (1 + (Reps / 30))`.
- **Nutrition (BMR Mifflin-St Jeor) :**
  - Homme : `(10 * poids) + (6.25 * taille) - (5 * age) + 5`
  - Femme : `(10 * poids) + (6.25 * taille) - (5 * age) - 161`
- **TDEE :** `BMR * ActivityLevel`.
- **Macros :** Protéines = 2g/kg, Lipides = 1g/kg, Glucides = reste des calories.

## 📁 Structure des Données
- `profiles` : Données physiques et 1RM de référence.
- `nutrition_logs` : Historique des repas avec portions (fractions ou grammes).
- `exercise_logs` : Séries, répétitions, RPE et poids ajouté.

## 🤖 Instructions pour l'IA
1. **Avant de coder :** Lire `src/store/useStore.ts` pour comprendre les impacts sur le poids de corps (`body_weight`).
2. **Scanner :** Le flux de scan doit toujours permettre : Capture -> Analyse (Skeleton) -> Validation/Édition -> Enregistrement.
3. **Ergonomie :** Toujours se demander "Puis-je cliquer sur ce bouton avec de la magnésie sur les doigts ?".
4. **Typage :** Si un objet (ex: `goal`) est utilisé comme clé, utiliser un type union strict `'cut' | 'maintain' | 'bulk'`.