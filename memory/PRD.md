# Shape Inexplicavel - PRD

## Problem Statement
Fitness/habit companion app with AI conversational chat. Centralizes daily routine tracking (meals, water, workouts, reminders) with configurable AI persona (Tactical/Coach/Direct/Neutral).

## Architecture
- **Frontend**: React.js + Tailwind CSS (mobile-first responsive, dark theme)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 via emergentintegrations library (EMERGENT_LLM_KEY)
- **Auth**: JWT + refresh tokens
- **Charts**: Recharts (weight/progress)

## User Personas
- Brazilian fitness enthusiasts managing daily routines
- Users wanting AI-powered habit tracking with engaging tone
- Demo user: demo@shape.com / demo123

## Core Requirements
- Auth (login/signup/forgot-password)
- 8-step onboarding (profile, macros, routine, training days, water goal, schedule, persona)
- Home "Mission of the Day" dashboard with next mission, macros, water, check-in
- AI Chat with persona/mode selection and context-aware responses
- Meal tracking by text with macro logging
- Water tracking with quick add buttons
- Workout ABC (plans, sessions, exercises with sets/reps/weight, completion)
- Progress tracking (weight chart, weekly stats, consistency)
- Reminders with quick actions (complete/snooze 15min/skip)
- Settings with persona change and logout

## What's Been Implemented

### Phase 1 - Jan 24, 2026
- [x] JWT Auth (register, login, refresh, forgot-password)
- [x] 8-step Onboarding flow
- [x] Home "Missao do Dia" with real aggregated data
- [x] AI Chat with GPT-5.2 (contextual, persona-aware, markdown rendering)
- [x] Meal CRUD with macro tracking
- [x] Water tracking with progress circle
- [x] Reminders system with quick actions
- [x] Daily check-in (sleep/energy/mood)
- [x] Settings with persona configuration
- [x] Seed data for demo user
- [x] Dark tactical premium theme
- [x] Backend: 100% tests passed (21/21)

### Phase 2 - Jan 24, 2026
- [x] Workout Plans CRUD (A/B/C with exercises)
- [x] Workout Sessions (start from plan, track sets/reps/weight, complete)
- [x] Workout History tab
- [x] Create new workout plans with custom exercises
- [x] Body Metrics logging (weight)
- [x] Progress page with weight chart (Recharts AreaChart)
- [x] Weekly stats (workouts, water avg, meals, sleep quality)
- [x] Consistency bar visualization
- [x] Updated bottom nav (Hoje/Chat/Refeicoes/Treino/Progresso)
- [x] Settings accessible via gear icon on home
- [x] Seed data: ABC plans, 14 days weight history, 2 completed sessions
- [x] Backend: 100% tests passed (14/14)
- [x] Frontend: 98% tests passed

## Prioritized Backlog

### P0 (Next)
- Weekly summary report (AI-generated "Relatorio de Operacoes")
- Photo meal upload (with placeholder for analysis)
- Password reset flow (email sending)

### P1
- Memory system (facts/summaries for AI context)
- Refined persona engine (more templates, adaptive tone)
- Meal editing inline
- Workout progression tracking (weight over time per exercise)

### P2
- Push notifications (Expo/FCM)
- Google Auth integration
- Rate limiting / security hardening
- Export data (PDF/CSV)
- Social sharing of progress

## Next Tasks
1. AI weekly summary generation
2. Photo upload for meals
3. Memory/facts system for AI
4. Exercise progression charts
5. Improved onboarding with smart defaults
