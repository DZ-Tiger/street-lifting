# 🤖 CONTEXTE SYSTÈME : STREET FLOW (Instructions Agent)

**RÈGLE ABSOLUE :** Ce document est la source de vérité stricte du projet. L'agent IA DOIT s'y conformer intégralement avant, pendant et après chaque génération de code.

---

## 1. 🎯 VISION & UX (Contraintes d'Interface)
- **Application :** Suivi de force pour Street Lifting (Tractions, Dips, Muscle-up, Squat).
- **Ergonomie "Mains Sales" (Critique) :** Conçu pour un usage avec de la magnésie sur les mains. Zéro clavier requis pendant l'entraînement. Saisie via pavés numériques et gros boutons.
- **Flow :** Validation d'une série -> Lancement automatique du timer de repos -> Feedback visuel immédiat (Toasts).
- **Responsive :** Mobile-First strict. Priorité absolue à la navigation à une main.

---

## 2. 🛠 STACK TECHNIQUE & QUALITÉ
- **Core :** Next.js 15 (App Router) + TypeScript strict.
- **Linting (CONTRAINTE STRICTE) :** **ESLint est obligatoire**. Le code généré DOIT respecter les règles ESLint standards de Next.js/TypeScript. Zéro erreur, zéro avertissement toléré (pas de types `any` implicites, dépendances de hooks exhaustives).
- **UI & Style :** TailwindCSS 4 + Shadcn UI (`src/components/ui`) + Framer Motion (animations).
- **State Management :** Zustand (`src/store/useStore.ts`). *Note : Toute modification du Poids de Corps (PDC) impacte globalement toutes les charges cibles.*
- **Backend :** Supabase (Auth, RLS, PostgreSQL).

---

## 3. 🎨 DESIGN SYSTEM
- **Réutilisation :** Toujours vérifier la présence d'un composant dans `src/components/ui` AVANT d'en créer un nouveau.
- **Sanctuarisation :** NE JAMAIS modifier la palette de couleurs (Slate/Blue) ni les polices existantes sans instruction explicite de l'utilisateur.

---

## 4. 🧠 ALGORITHMES & LOGIQUE MÉTIER
- **Calcul 1RM (Formule d'Epley) :** `1RM = Poids_Total * (1 + (Reps / 30))`
- **Cycle de Progression (9 semaines) :** `Charge Cible = (1RM * %_semaine) - PDC`
- **Analytics :** - Tendance : Trendline via régression linéaire.
  - Assiduité : Heatmap basée sur la table `completed_sessions`.

---

## 5. 🗄 DATA (Schéma Supabase)
- `profiles` : `user_id`, `body_weight`, `age`, `height`, `goal_program`, `gender`, `current_1rm_pullup`, `current_1rm_dips`, `current_1rm_muscleup`, `current_1rm_squat`
- `completed_sessions` : `user_id`, `week_number`, `day_number`, `total_volume`
- `exercise_logs` : `session_id`, `exercise_name`, `body_weight_used`, `added_weight`, `total_weight`, `reps`, `rpe`, `form_tags`, `calculated_1rm`

---

## 6. ⚙️ PROTOCOLE D'EXÉCUTION (Agent IA)
1. **Sourcing d'État :** Lire systématiquement `src/store/useStore.ts` pour évaluer les effets de bord d'un changement de composant.
2. **Fonctions Pures :** Garder les fonctions de calcul abstraites, pures et exportées depuis des utilitaires ou le store.
3. **Sécurité DB :** Garantir que chaque requête Supabase générée respecte les politiques RLS (Row Level Security).
4. **Validation Pre-Commit :** Vérifier que le code proposé ne déclenchera aucune erreur ESLint ni de conflit TypeScript.
