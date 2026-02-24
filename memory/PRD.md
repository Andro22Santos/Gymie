# Shape Inexplicavel - PRD

## Problem Statement
Fitness/habit companion app with AI conversational chat. Centralizes daily routine tracking (meals, water, workouts, reminders) with configurable AI persona (Tactical/Coach/Direct/Neutral). Differentiator: tone + routine + execution + shared context, not just generic chat.

## Architecture
- **Frontend**: React.js + Tailwind CSS (mobile-first responsive, dark theme)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (collections: users, user_profiles, meals, water_logs, reminders, chat_threads, chat_messages, daily_checkins, workout_plans, workout_sessions, body_metrics, memory_facts, weekly_summaries, agent_insights)
- **AI**: OpenAI GPT-5.2 via emergentintegrations library (EMERGENT_LLM_KEY)
- **Auth**: JWT + refresh tokens
- **Charts**: Recharts (weight/progress)

## User Personas
- Brazilian fitness enthusiasts managing daily routines
- Users wanting AI-powered habit tracking with engaging tone
- Demo user: demo@shape.com / demo123

## What's Been Implemented

### Phase 1 - Jan 24, 2026
- [x] JWT Auth (register, login, refresh, forgot-password)
- [x] 8-step Onboarding flow
- [x] Home "Missao do Dia" with real aggregated data
- [x] AI Chat with GPT-5.2 (contextual, persona-aware, markdown rendering)
- [x] Meal CRUD with macro tracking
- [x] Water tracking with progress circle + quick add
- [x] Reminders system with quick actions (complete/snooze/skip)
- [x] Daily check-in (sleep/energy/mood)
- [x] Settings with persona configuration (Tactical/Coach/Direct/Neutral)
- [x] Seed data for demo user
- [x] Dark tactical premium theme

### Phase 2 - Jan 24, 2026
- [x] Workout Plans CRUD (A/B/C with exercises)
- [x] Workout Sessions (start from plan, track sets/reps/weight, complete)
- [x] Workout History tab
- [x] Body Metrics logging (weight)
- [x] Progress page with weight chart (Recharts AreaChart)
- [x] Weekly stats (workouts, water avg, meals, sleep quality)
- [x] Consistency bar visualization
- [x] Updated bottom nav (Hoje/Chat/Refeicoes/Treino/Progresso)

### Phase 3 - Jan 24, 2026
- [x] AI Weekly Summary ("Relatorio de Operacoes da Semana") with GPT-5.2
- [x] Memory Facts system (CRUD per user, categories, integrated in AI context)
- [x] Photo upload for meals (base64 storage)
- [x] Exercise progression tracking (weight/reps/volume over time per exercise)
- [x] Weekly summary with auto-stats (treinos, agua, peso, check-ins)

### Phase 4 - Feb 24, 2026
- [x] Multi-Mode AI System (not isolated agents - 1 shared context)
  - Companheiro (COMP): Motivação, rotina, check-ins
  - Alimentação (NUTR): Refeições, macros, sugestões
  - Treino (TREN): Exercícios, carga, recuperação
- [x] Mode selector in ChatPage with clear "Modo: X" display
- [x] Shared context note: "Todos os modos compartilham seu contexto"
- [x] Debug panel for orchestration validation (status, persona, fatos, decisions)
- [x] Actionable Insights (HomePage + ChatPage)
  - Water below goal alerts
  - Protein deficit warnings
  - Workout day reminders
  - Next mission notifications
  - Check-in reminders
- [x] AI Meal Analysis with standardized contract
  - success, analysis_text, estimated_macros, confidence, suggestions
  - Auto-fills macro fields in meal form
- [x] Smart routing: messages about "macros" → NUTR, "treino" → TREN
- [x] BottomNav z-index fix (90) - no modal overlap

## Test Results Summary
- Phase 1: Backend 100% (21/21), Frontend 95%
- Phase 2: Backend 100% (14/14), Frontend 98%
- Phase 3: Backend 100% (25/25), Frontend 95%
- Phase 4: Backend 100% (11/11), Frontend 100%

## Prioritized Backlog

### P0 (Next - Phase 5)
- Push notifications (Expo/FCM)
- Password reset flow (email sending)

### P1
- Google Auth integration
- Refined persona engine (adaptive tone based on user behavior patterns)
- Meal editing inline
- Export data (PDF/CSV)
- Rate limiting / security hardening

### P2
- React Native migration
- Social sharing of progress
- Community features
- Integration with fitness trackers
- Custom workout templates

## Next Tasks
1. Push notifications implementation (Expo/FCM)
2. Google Auth
3. Data export
4. Mobile app migration

## API Reference (Phase 4)

### New/Updated Endpoints
- `GET /api/agents/insights` - Returns actionable insights + context_summary
- `GET /api/agents/debug` - Debug info for orchestration validation
- `POST /api/meals/analyze` - AI meal analysis with standardized contract
- `GET /api/agents/classify` - Test message classification

### Standardized Meal Analysis Contract
```json
{
  "success": true,
  "analysis_text": "...",
  "estimated_macros": {
    "calories": 610,
    "protein": 42,
    "carbs": 68,
    "fat": 18,
    "fiber": 0,
    "description": "..."
  },
  "confidence": "medium",
  "suggestions": [],
  "agent_name": "Foto",
  "agent_code": "FOTO",
  "analyzed_at": "2026-02-24T..."
}
```
