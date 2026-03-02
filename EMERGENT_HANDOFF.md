# Gymie - Handoff para Emergent (Atualizado em 02/03/2026)

## Objetivo imediato
Atualizar e iniciar a integração com backend real em produção, mantendo todas as melhorias recentes do app.

## Status atual confirmado
- Frontend e backend estão evoluídos além do scaffold inicial do Emergent.
- Build do frontend foi validado com sucesso em 02/03/2026 (`npm -C frontend run build`).
- Tela de refeições foi atualizada com:
  - captura de foto em tempo real (camera via `getUserMedia`),
  - análise IA com foto + descrição,
  - exibição de itens reconhecidos,
  - botão para salvar aprendizado alimentar no perfil (`/api/memory/facts`).
- Fluxo de mock continua disponível para desenvolvimento local.

## Arquivos prioritários para retomar integração
- `frontend/src/pages/MealsPage.js`
- `frontend/src/pages/ChatPage.js`
- `frontend/src/pages/WorkoutPage.js`
- `frontend/src/mocks/adapter.js`
- `frontend/src/api.js`
- `backend/server.py`
- `backend/agents.py`
- `frontend/src/App.js`

## Plano de integração (ordem recomendada)

1. Configurar frontend de produção
Crie/ajuste `frontend/.env.production`:

```env
REACT_APP_USE_MOCK=false
REACT_APP_BACKEND_URL=https://SEU_BACKEND.emergent.sh
```

Regra: manter `.env` local com `REACT_APP_USE_MOCK=true` para desenvolvimento.

2. Configurar variáveis do backend
Defina no ambiente do backend:

```env
MONGO_URL=mongodb+srv://...
DB_NAME=gymie
JWT_SECRET=...
EMERGENT_LLM_KEY=...
APP_ENV=production
CORS_ORIGINS=https://SEU_FRONTEND.emergent.sh
FRONTEND_BASE_URL=https://SEU_FRONTEND.emergent.sh

# Stripe (checkout real + portal + webhook)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ELITE=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Fallback opcional com Payment Links/URL pronta
STRIPE_CHECKOUT_URL_PRO=https://buy.stripe.com/...
STRIPE_CHECKOUT_URL_ELITE=https://buy.stripe.com/...
STRIPE_PORTAL_URL=https://billing.stripe.com/p/login/...
```

Observação: `server.py` já possui parser de CORS por env (`parse_cors_origins`).

3. Subir backend e validar saúde
- Endpoint: `GET /api/health`.
- Confirmar autenticação JWT e refresh.

4. Validar endpoints críticos de integração
- `GET /api/me`
- `POST /api/onboarding/complete`
- `POST /api/chat/threads/{thread_id}/messages`
- `POST /api/meals/analyze`
- `POST /api/meals`
- `GET /api/progress/summary`
- `GET/POST /api/memory/facts`
- `GET /api/billing/plans`
- `POST /api/billing/checkout`
- `GET /api/billing/portal`
- `POST /api/billing/webhook/stripe` (sem auth, validado por assinatura Stripe)

5. Testar fluxo funcional fim a fim
- Login/registro e onboarding.
- Home com metas e check-in.
- Chat com IA real.
- Refeições: capturar foto em tempo real, analisar, registrar, salvar no perfil.
- Treino: biblioteca, sessão e conclusão.
- Progresso: gráficos e resumo.

6. Build/deploy frontend
- `npm -C frontend run build`
- Publicar build no host do frontend conectado ao backend real.

## Pontos de atenção para o Emergent
- Não remover o mock (`frontend/src/mocks/*`): ele é fallback de desenvolvimento.
- Evitar regressão nas melhorias de UI/UX já aplicadas.
- Confirmar disponibilidade do modelo configurado em `backend/agents.py` e ajustar se necessário.
- Confirmar que a análise de refeição com foto está respondendo de forma consistente em produção.
- Em produção, configurar webhook Stripe para:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  E apontar para `POST /api/billing/webhook/stripe`.

## Pendências opcionais (não bloqueantes)
- Persistir no backend o contexto `.md` do perfil (hoje pode ficar local em alguns fluxos).
- Revisar prioridade de z-index global da bottom nav em cenários de modal complexo.

## Resultado esperado após integração
- App rodando em produção sem mock.
- IA funcionando em chat e refeições com persistência de memória alimentar.
- Fluxo completo estável para uso real.
