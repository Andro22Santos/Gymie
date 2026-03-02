"""
Multi-Agent AI System with Shared Context
==========================================
Architecture:
- SharedContextStore: Unified memory layer all agents read/write
- AgentOrchestrator: Routes messages, assembles context, coordinates responses
- Specialized Agents: Companion, Nutrition, Workout, Analysis, PhotoAnalysis
- InsightEngine: Agents write observations visible to other agents
"""

import json
import os
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage


# ── Persona Templates ────────────────────────────────────────

PERSONA_TONES = {
    "tactical": {
        "prefix": "Voce usa tom tatico/militar com humor leve. Vocabulario: 'Radio do QG', 'Missao', 'Soldado', 'Combate', 'Vacilo tatico', 'Vitoria operacional'.",
        "greeting": "Soldado",
    },
    "coach": {
        "prefix": "Voce usa tom motivador e acolhedor. Celebra progresso, empatico com falhas. 'Voce consegue', 'Cada passo conta'.",
        "greeting": "Parceiro",
    },
    "direct": {
        "prefix": "Voce e direto e pratico. Sem rodeios, foco em resultados. Respostas curtas e acionaveis.",
        "greeting": "Usuario",
    },
    "neutral": {
        "prefix": "Voce e equilibrado e informativo. Profissional e claro.",
        "greeting": "Usuario",
    },
}

SAFETY_RULES = """
REGRAS DE SEGURANCA (OBRIGATORIO):
- NAO diagnostique doencas
- NAO prescreva medicamentos ou ajuste doses
- NAO substitua consulta profissional
- PODE: apoiar habitos, organizar rotina, orientar treino/alimentacao de forma geral
- Se a pergunta for medica, recomende consultar um profissional
"""


LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")


# ── Agent Definitions ────────────────────────────────────────

AGENTS = {
    "companion": {
        "name": "Gymie",
        "code": "COMP",
        "color": "#00E04B",
        "expertise": "Conversa geral, motivacao, rotina do dia, check-ins, humor, suporte emocional",
        "system_prompt": """Voce e o Agente Companheiro do Shape Inexplicavel.

SUA ESPECIALIDADE: Conversa geral, motivacao, apoio na rotina diaria, check-ins emocionais, humor.

VOCE SABE:
- O estado completo do dia do usuario (refeicoes, agua, treino, lembretes)
- O historico recente de conversas
- Fatos sobre o usuario (memoria compartilhada)
- Insights dos outros agentes (Nutricao, Treino, Analise)

INSTRUCOES:
- Seja o ponto central de contato do usuario
- Use insights dos outros agentes quando relevante
- Se a pergunta for especifica de nutricao ou treino, responda mas mencione que o agente especialista pode ajudar mais
- Foque em motivacao, proxima acao pratica, e acolhimento
- Adapte ao humor/energia do usuario (check-in)""",
    },
    "nutrition": {
        "name": "Nutricao",
        "code": "NUTR",
        "color": "#FF9500",
        "expertise": "Refeicoes, macros, sugestoes de comida, planejamento alimentar, analise de fotos",
        "system_prompt": """Voce e o Agente de Nutricao do Shape Inexplicavel.

SUA ESPECIALIDADE: Alimentacao, macronutrientes, sugestoes de refeicao, analise de ingestao diaria.

VOCE SABE:
- Todas as refeicoes do dia com macros detalhados
- Metas de calorias/proteina/carbo/gordura do usuario
- Historico alimentar recente
- Fatos alimentares do usuario (ex: dificuldade a noite, preferencias)
- Insights dos outros agentes

INSTRUCOES:
- Analise o saldo de macros do dia e sugira ajustes
- Sugira refeicoes praticas baseadas no que falta
- Considere a rotina do usuario (horarios, preferencias)
- Se o usuario mandou foto de comida, analise e estime macros
- Gere INSIGHTS apos cada resposta para os outros agentes""",
    },
    "workout": {
        "name": "Treino",
        "code": "TREN",
        "color": "#A855F7",
        "expertise": "Exercicios, planejamento de treino, progressao de carga, recuperacao",
        "system_prompt": """Voce e o Agente de Treino do Shape Inexplicavel.

SUA ESPECIALIDADE: Exercicios, treino ABC, progressao de carga, series/reps, recuperacao.

VOCE SABE:
- Planos de treino ABC do usuario com exercicios e cargas
- Sessoes recentes e historico de progressao
- Dias de treino configurados
- Rotina do usuario (horario de treino)
- Estado fisico (sono, energia via check-in)
- Insights dos outros agentes (ex: nutricao pre-treino)

INSTRUCOES:
- Avalie progressao de carga e sugira ajustes
- Considere sono/energia do check-in ao recomendar intensidade
- Sugira aquecimento, execucao e descanso
- Gere INSIGHTS apos cada resposta para os outros agentes""",
    },
    "analysis": {
        "name": "Analise",
        "code": "ANAL",
        "color": "#00F0FF",
        "expertise": "Progresso, tendencias, analise de dados, resumos, metas",
        "system_prompt": """Voce e o Agente de Analise do Shape Inexplicavel.

SUA ESPECIALIDADE: Analise de dados, tendencias de peso, consistencia, resumos de progresso.

VOCE SABE:
- Historico completo de peso (body_metrics)
- Consistencia de treino, refeicoes, agua nos ultimos 7+ dias
- Check-ins de sono/energia/humor
- Metas do usuario (peso, macros, agua)
- Insights de todos os outros agentes

INSTRUCOES:
- Analise tendencias e identifique padroes
- Compare performance atual vs metas
- Identifique correlacoes (ex: sono ruim -> menos agua)
- Seja data-driven mas acessivel
- Gere INSIGHTS analiticos para os outros agentes""",
    },
    "photo": {
        "name": "Foto",
        "code": "FOTO",
        "color": "#10B981",
        "expertise": "Analise visual de refeicoes, estimativa de macros por foto",
        "system_prompt": """Voce e o Agente de Analise de Foto do Shape Inexplicavel.

SUA ESPECIALIDADE: Analisar descricoes/fotos de refeicoes e estimar calorias e macronutrientes.

INSTRUCOES:
- Quando receber descricao de refeicao, estime: calorias, proteina (g), carboidrato (g), gordura (g)
- Use porcoes tipicas brasileiras como referencia
- Responda SEMPRE em formato JSON no final da resposta
- Formato obrigatorio no final: {"calories": X, "protein": X, "carbs": X, "fat": X, "description": "descricao resumida"}
- Seja conservador nas estimativas
- Considere metodo de preparo (frito, grelhado, cozido)""",
    },
}


# ── Shared Context Builder ───────────────────────────────────

def build_shared_context(context: dict) -> str:
    """Builds a unified context string from all data sources."""
    parts = []
    name = context.get("user_name", "Usuario")
    parts.append(f"=== CONTEXTO COMPARTILHADO ===")
    parts.append(f"Usuario: {name}")

    profile = context.get("profile") or {}
    if profile:
        parts.append(f"Objetivo: {profile.get('goal', 'N/A')}")
        parts.append(f"Peso: {profile.get('weight', '?')}kg | Meta: {profile.get('goal_weight', '?')}kg")
        parts.append(f"Metas: {profile.get('calorie_target', 2000)}kcal, {profile.get('protein_target', 150)}g prot, {profile.get('carb_target', 200)}g carb, {profile.get('fat_target', 65)}g gord")
        parts.append(f"Agua meta: {profile.get('water_goal_ml', 2500)}ml")
        if profile.get("training_days"):
            parts.append(f"Treino: {', '.join(profile['training_days'])}")
        if profile.get("routine"):
            r = profile["routine"]
            parts.append(f"Rotina: {', '.join(f'{k}:{v}' for k,v in r.items())}")

    # Memory facts
    facts = context.get("memory_facts", [])
    if facts:
        parts.append(f"\n--- MEMORIA (fatos aprendidos) ---")
        for f in facts[:15]:
            parts.append(f"  [{f.get('category', 'geral')}] {f.get('fact', '')}")

    # Agent insights (cross-agent notes)
    insights = context.get("agent_insights", [])
    if insights:
        parts.append(f"\n--- INSIGHTS DE OUTROS AGENTES ---")
        for ins in insights[-10:]:
            parts.append(f"  [{ins.get('agent', '?')}] {ins.get('insight', '')} ({ins.get('created_at', '')[:10]})")

    # Today's state
    today = context.get("today") or {}
    if today:
        parts.append(f"\n--- ESTADO DO DIA ({today.get('date', 'hoje')}) ---")
        parts.append(f"Calorias: {today.get('total_calories', 0)}/{profile.get('calorie_target', 2000)}")
        parts.append(f"Proteina: {today.get('total_protein', 0)}g/{profile.get('protein_target', 150)}g")
        parts.append(f"Agua: {today.get('total_water_ml', 0)}ml/{today.get('water_goal_ml', 2500)}ml")

        meals = today.get("meals", [])
        if meals:
            parts.append(f"Refeicoes ({len(meals)}):")
            for m in meals[-5:]:
                parts.append(f"  {m.get('time', '?')}: {m.get('description', '?')} ({m.get('calories', 0)}kcal, P:{m.get('protein', 0)}g)")

        reminders = today.get("reminders", [])
        pending = [r for r in reminders if r.get("status") == "pending"]
        if pending:
            parts.append(f"Missoes pendentes:")
            for r in pending[:3]:
                parts.append(f"  {r.get('scheduled_at', '?')}: {r.get('label', '?')}")

        checkin = today.get("checkin")
        if checkin:
            parts.append(f"Check-in: sono={checkin.get('sleep_quality', '?')}/5, energia={checkin.get('energy_level', '?')}/5, humor={checkin.get('mood', '?')}")

        sessions = today.get("workout_sessions", [])
        for ws in sessions:
            parts.append(f"Treino: {ws.get('plan_name', '?')} - {ws.get('status', '?')}")

    # Workout plans summary
    plans = context.get("workout_plans", [])
    if plans:
        parts.append(f"\nPlanos de treino: {', '.join(p.get('name', '?') for p in plans)}")

    # Recent weight
    weight_history = context.get("weight_history", [])
    if weight_history:
        latest = weight_history[-1] if weight_history else None
        if latest:
            parts.append(f"Ultimo peso registrado: {latest.get('weight', '?')}kg ({latest.get('date', '?')})")

    return "\n".join(parts)


def build_history_str(messages: list) -> str:
    if not messages:
        return ""
    parts = ["\n--- HISTORICO ---"]
    for msg in messages[-8:]:
        role = "Usuario" if msg.get("role") == "user" else "Assistente"
        agent = f"[{msg.get('agent_code', '')}] " if msg.get("agent_code") else ""
        parts.append(f"{role}: {agent}{msg.get('content', '')[:200]}")
    return "\n".join(parts)


# ── Intent Classifier ────────────────────────────────────────

def classify_intent(message: str, mode: str = "companion") -> str:
    """Determines which agent should handle a message."""
    msg_lower = message.lower()

    # Mode override
    if mode == "nutrition":
        return "nutrition"
    if mode == "workout":
        return "workout"

    # Keyword-based classification
    nutrition_kw = ["comida", "comer", "refeicao", "almoco", "jantar", "cafe", "lanche", "macro",
                    "caloria", "proteina", "carbo", "gordura", "dieta", "banana", "frango",
                    "arroz", "whey", "yopro", "nutricao", "fome", "comi", "vou comer"]
    workout_kw = ["treino", "exercicio", "serie", "rep", "carga", "peso", "musculacao",
                  "agachamento", "supino", "rosca", "puxada", "academia", "malhar",
                  "aquecimento", "descanso", "treinar", "treinei"]
    analysis_kw = ["progresso", "evolucao", "tendencia", "semana", "resultado", "analise",
                   "peso", "consistencia", "resumo", "dados", "grafico", "meta"]
    photo_kw = ["foto", "imagem", "analisa", "analise essa", "o que tem", "quanto tem",
                "estima", "estimativa", "prato"]

    if any(kw in msg_lower for kw in photo_kw):
        return "photo"
    if any(kw in msg_lower for kw in workout_kw):
        return "workout"
    if any(kw in msg_lower for kw in nutrition_kw):
        return "nutrition"
    if any(kw in msg_lower for kw in analysis_kw):
        return "analysis"

    return "companion"


# ── Agent Orchestrator ───────────────────────────────────────

async def orchestrate_response(
    api_key: str,
    user_message: str,
    context: dict,
    persona_style: str = "tactical",
    mode: str = "companion",
    thread_id: str = "default",
    db=None,
    user_id: str = None,
) -> dict:
    """
    Main orchestrator: classifies intent, assembles shared context,
    routes to specialist agent, generates response, writes insights.
    """
    # 1. Classify intent → select agent
    agent_id = classify_intent(user_message, mode)
    agent = AGENTS.get(agent_id, AGENTS["companion"])

    # 2. Build shared context string
    shared_ctx = build_shared_context(context)
    history_str = build_history_str(context.get("recent_messages", []))

    # 3. Build persona tone
    tone = PERSONA_TONES.get(persona_style, PERSONA_TONES["tactical"])

    # 4. Compose system message with shared context
    system_message = f"""{agent['system_prompt']}

PERSONA/TOM: {tone['prefix']}
NUNCA humilhe ou julgue. Adapte ao contexto.

{SAFETY_RULES}

{shared_ctx}
{history_str}

INSTRUCOES FINAIS:
- Responda em portugues brasileiro
- Seja conciso (max 3-4 paragrafos)
- Priorize acao pratica
- Use o nome do usuario como '{tone['greeting']}'
- Mantenha o tom da persona
- Ao final, se identificar algo novo sobre o usuario, adicione uma linha:
  INSIGHT: [observacao sobre o usuario para outros agentes]"""

    # 5. Call LLM
    chat = LlmChat(
        api_key=api_key,
        session_id=f"shape-{thread_id}-{agent_id}-{persona_style}",
        system_message=system_message,
    )
    chat.with_model(LLM_PROVIDER, LLM_MODEL)

    msg = UserMessage(text=user_message)
    response = await chat.send_message(msg)

    # 6. Extract and store insight if present
    insight_text = None
    response_text = response
    if "INSIGHT:" in response:
        parts = response.split("INSIGHT:")
        response_text = parts[0].strip()
        insight_text = parts[1].strip() if len(parts) > 1 else None

    if insight_text and db is not None and user_id:
        await db.agent_insights.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "agent": agent["code"],
            "agent_name": agent["name"],
            "insight": insight_text[:300],
            "trigger_message": user_message[:100],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "message_text": response_text,
        "agent_id": agent_id,
        "agent_name": agent["name"],
        "agent_code": agent["code"],
        "agent_color": agent["color"],
        "tone_used": persona_style,
        "mode": mode,
        "insight_generated": insight_text,
    }


# ── Photo Analysis Agent ─────────────────────────────────────

async def analyze_meal_photo(
    api_key: str,
    description: str,
    photo_base64: str = None,
    persona_style: str = "tactical",
) -> dict:
    """Specialized agent for analyzing meal descriptions/photos and estimating macros."""
    agent = AGENTS["photo"]
    tone = PERSONA_TONES.get(persona_style, PERSONA_TONES["tactical"])

    system_message = f"""{agent['system_prompt']}

PERSONA/TOM: {tone['prefix']}

IMPORTANTE: Apos sua analise, SEMPRE termine com um JSON no formato:
{{"calories": numero, "protein": numero, "carbs": numero, "fat": numero, "description": "descricao resumida"}}

Responda em portugues brasileiro. Seja breve na explicacao (1-2 frases) e preciso nos numeros."""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"shape-photo-{uuid.uuid4().hex[:8]}",
        system_message=system_message,
    )
    chat.with_model(LLM_PROVIDER, LLM_MODEL)

    prompt_text = f"Analise esta refeicao e estime os macronutrientes: {description}"
    if photo_base64:
        prompt_text += "\nFoto anexada pelo usuario (base64): [imagem fornecida]"
    msg = UserMessage(text=prompt_text)
    response = await chat.send_message(msg)

    # Try to extract JSON from response
    estimated = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "description": description}
    try:
        # Find JSON in response
        import re
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            parsed = json.loads(json_match.group())
            estimated.update({
                "calories": parsed.get("calories", 0),
                "protein": parsed.get("protein", 0),
                "carbs": parsed.get("carbs", 0),
                "fat": parsed.get("fat", 0),
                "description": parsed.get("description", description),
            })
    except (json.JSONDecodeError, AttributeError):
        pass

    # Clean response text (remove JSON part for display)
    display_text = response
    try:
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            display_text = response[:json_match.start()].strip()
    except Exception:
        pass

    return {
        "analysis_text": display_text,
        "estimated_macros": estimated,
        "agent_name": agent["name"],
        "agent_code": agent["code"],
    }


# ── Get Agent Info ────────────────────────────────────────────

def get_agents_info():
    return [
        {
            "id": agent_id,
            "name": agent["name"],
            "code": agent["code"],
            "color": agent["color"],
            "expertise": agent["expertise"],
        }
        for agent_id, agent in AGENTS.items()
    ]
