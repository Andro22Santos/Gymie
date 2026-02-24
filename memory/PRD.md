# Gymie - PRD (Product Requirements Document)

## Problem Statement
Gymie é um app companheiro de hábitos fitness com IA conversacional. Centraliza o acompanhamento de rotina diária (refeições, água, treinos, lembretes) com uma persona de IA configurável. Diferencial: tom + rotina + execução + contexto compartilhado.

## Architecture
- **Frontend**: React.js + Tailwind CSS (mobile-first, dark premium theme)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI GPT-5.2 via emergentintegrations
- **Auth**: JWT + Google OAuth (Emergent Auth)
- **Charts**: Recharts

## User Personas
- Brasileiros fitness enthusiasts
- Pessoas que querem tracking de hábitos com IA engajadora
- Demo user: demo@shape.com / demo123

## What's Been Implemented

### Phase 1 - Core Features (Jan 24, 2026)
- [x] JWT Auth (register, login, refresh, forgot-password)
- [x] 8-step Onboarding flow
- [x] Home "Missão do Dia" with real aggregated data
- [x] AI Chat with GPT-5.2 (contextual, persona-aware)
- [x] Meal CRUD with macro tracking
- [x] Water tracking with progress
- [x] Reminders system with quick actions
- [x] Daily check-in (sleep/energy/mood)
- [x] Settings with persona configuration

### Phase 2 - Workout & Progress (Jan 24, 2026)
- [x] Workout Plans CRUD (A/B/C)
- [x] Workout Sessions tracking
- [x] Body Metrics logging
- [x] Progress page with weight chart
- [x] Weekly stats and consistency bar

### Phase 3 - AI Features (Jan 24, 2026)
- [x] AI Weekly Summary with GPT-5.2
- [x] Memory Facts system for AI context
- [x] Photo upload for meals
- [x] Exercise progression tracking

### Phase 4 - Multi-Mode AI (Feb 24, 2026)
- [x] Multi-Mode AI System (Gymie, Alimentação, Treino)
- [x] Shared context between modes
- [x] Context bar in chat (água%, calorias%, proteína%)
- [x] Debug panel for orchestration
- [x] Actionable Insights (water, protein, workout alerts)
- [x] AI Meal Analysis with humanized response

### Phase 5 - UX/UI Premium + Backlog (Feb 24, 2026)
- [x] **Complete UX/UI refactoring** - Dark premium theme with amber/gold accent
- [x] **Google Auth** - Emergent Google Auth integration
- [x] **Push Notifications** - Architecture ready (mock implementation)
- [x] **Rate Limiting** - slowapi middleware on critical endpoints
- [x] Renamed to "Gymie" throughout the app
- [x] New design system: gymie-card, gymie-btn-primary, gymie-chip, gymie-input
- [x] "Resumo primeiro, detalhe depois" flow in meals
- [x] Humanized microcopy ("Leitura do prato" instead of "Diagnóstico")
- [x] Mobile-first improvements

## Test Results Summary
- Phase 1: Backend 100%, Frontend 95%
- Phase 2: Backend 100%, Frontend 98%
- Phase 3: Backend 100%, Frontend 95%
- Phase 4: Backend 100%, Frontend 100%
- Phase 5 (UX/UI): Frontend 100%

## Prioritized Backlog

### P0 (Next)
- Real Push Notifications with Firebase (currently mocked)
- Password reset email sending

### P1
- React Native migration
- Exercise editing inline
- Export data (PDF/CSV)

### P2
- Social sharing
- Community features
- Fitness tracker integration
- Custom workout templates

## New Features This Session

### Google Auth
- Endpoint: `POST /api/auth/google/session`
- Flow: User clicks "Continuar com Google" → redirects to Emergent Auth → returns with session_id → backend validates and creates/links user
- Maintains existing email/password auth

### Push Notifications (Mock)
- Endpoints: `/api/push/register`, `/api/push/tokens`, `/api/push/test`
- Architecture ready for FCM integration
- TODO in `/app/backend/push_notifications.py` with instructions

### Rate Limiting
- `POST /api/auth/register`: 5/minute
- `POST /api/auth/login`: 10/minute
- `POST /api/chat/threads/{id}/messages`: 30/minute
- `POST /api/meals/analyze`: 20/minute

### UX/UI Design System
New Tailwind classes:
- `gymie-card` - Standard card with subtle border
- `gymie-card-elevated` - Elevated card
- `gymie-btn-primary` - Primary amber button
- `gymie-btn-secondary` - Secondary button
- `gymie-btn-ghost` - Ghost button
- `gymie-chip` - Pill-shaped chip
- `gymie-input` - Form input
- `gymie-glass` - Glassmorphism effect

Color palette:
- `gymie` (#F5A623) - Primary amber/gold
- `gymie-dim` (#D4901F) - Hover state
- `gymie-glow` - Glow effect

## API Reference

### New Endpoints
- `POST /api/auth/google/session` - Exchange Google session for JWT
- `POST /api/push/register` - Register push token
- `DELETE /api/push/unregister` - Remove push token
- `GET /api/push/tokens` - List user's tokens
- `GET /api/push/log` - Notification history (debug)
- `POST /api/push/test` - Send test notification

## Credentials
- Demo: demo@shape.com / demo123

## Technical Notes

### Push Notifications Setup (TODO)
1. Create Firebase project
2. Generate service account key
3. Set `FIREBASE_CREDENTIALS_PATH` env var
4. Uncomment FCM code in `/app/backend/push_notifications.py`

### Rate Limiting
Using slowapi library. Limits per IP address.
Config in server.py with `@limiter.limit()` decorator.
