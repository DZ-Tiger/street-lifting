# 📜 Instructions de Développement - Street Flow

Ce document définit les règles strictes et le contexte technique pour toute modification du projet. L'agent IA doit s'y conformer avant chaque intervention.

---

## 1. 🎯 Vision & UX
- **Street Flow :** App de force pour le Street Lifting (Tractions, Dips, Muscle-up, Squat).
- **UX "Mains Sales" :** Optimisé pour l'usage avec de la magnésie. Saisie sans clavier (gros boutons, pavés numériques), timer automatique après validation, et feedback immédiat via Toasts.

---

## 2. 🛠 Stack Technique
- **Frontend :** Next.js 15 (App Router) + TypeScript.
- **Styling :** TailwindCSS 4 + Framer Motion (animations).
- **UI :** Shadcn UI (fondations dans `src/components/ui`).
- **State :** Zustand (`src/store/useStore.ts`). Toute modif de poids de corps impacte globalement les charges cibles.
- **Backend :** Supabase (Auth, RLS, PostgreSQL).

---

## 3. 🎨 Design System (Règles d'Or)
- **Héritage :** Ne jamais modifier la palette (Slate/Blue) ou les polices existantes.
- **Réutilisation :** Vérifier `src/components/ui` avant de créer un nouvel élément.
- **Mobile-First :** Priorité absolue à l'ergonomie à une main.

---

## 4. 🧠 Algorithmes & Données
- **1RM (Epley) :** `1RM = Poids_Total * (1 + (Reps / 30))`.
- **Cycle :** Progression linéaire sur 9 semaines. Charge cible = `(1RM * %_semaine) - PDC`.
- **Analytics :** Trendline via régression linéaire ; Heatmap d'assiduité basée sur `completed_sessions`.

---

## 5. 🗄 Schéma Supabase
- `profiles` : `user_id`, `body_weight`, `current_1rm_pullup`, `current_1rm_dips`, `current_1rm_muscleup`, `current_1rm_squat`.
- `completed_sessions` : `user_id`, `week_number`, `day_number`, `total_volume`.
- `exercise_logs` : `session_id`, `exercise_name`, `body_weight_used`, `added_weight`, `total_weight`, `reps`, `rpe`, `form_tags`, `calculated_1rm`.

---

## 🤖 Protocole Agent
1. **Sourcing :** Toujours lire `src/store/useStore.ts` pour comprendre l'impact des changements d'état.
2. **Standard :** Garder les fonctions de calcul pures et exportées depuis le store ou des utilitaires.
3. **Sécurité :** Vérifier que chaque requête respecte les politiques RLS (Row Level Security).