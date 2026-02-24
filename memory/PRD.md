# Shape Inexplicavel - PRD

## Problem Statement
Fitness/habit companion app with AI conversational chat. Centralizes daily routine tracking (meals, water, workouts, reminders) with configurable AI persona (Tactical/Coach/Direct/Neutral).

## Architecture
- **Frontend**: React.js + Tailwind CSS (mobile-first responsive, dark theme)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 via emergentintegrations library (EMERGENT_LLM_KEY)
- **Auth**: JWT + refresh tokens

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
- Reminders with quick actions (complete/snooze 15min/skip)
- Settings with persona change and logout

## What's Been Implemented (Phase 1) - Jan 24, 2026
- [x] JWT Auth (register, login, refresh, forgot-password)
- [x] 8-step Onboarding flow
- [x] Home "Missao do Dia" with real aggregated data
- [x] AI Chat with GPT-5.2 (contextual, persona-aware)
- [x] Meal CRUD with macro tracking
- [x] Water tracking with progress circle
- [x] Reminders system with quick actions
- [x] Daily check-in (sleep/energy/mood)
- [x] Settings with persona configuration
- [x] Seed data for demo user
- [x] Dark tactical premium theme
- [x] Bottom tab navigation
- [x] Backend: 100% tests passed (21/21)
- [x] Frontend: 95% tests passed

## Prioritized Backlog

### P0 (Next)
- Workout ABC (plans, sessions, exercises, completion)
- Progress page (weight chart, weekly consistency, hydration average)
- Weekly summary generation

### P1
- Photo meal upload (with placeholder for analysis)
- Memory system (facts/summaries for AI context)
- Refined persona engine (more templates, adaptive tone)
- Password reset flow (email sending)

### P2
- Push notifications (Expo/FCM)
- Timeline component on home page
- Meal editing inline
- Workout history and trends
- Rate limiting / security hardening
- Google Auth integration (placeholder ready)

## Next Tasks
1. Implement Workout ABC module (plans, sessions, exercises)
2. Build Progress page with weight chart and weekly stats
3. Add photo upload for meals
4. Implement memory/facts system for AI
5. Weekly summary auto-generation
