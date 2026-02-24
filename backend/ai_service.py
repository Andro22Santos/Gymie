import json
from emergentintegrations.llm.chat import LlmChat, UserMessage


PERSONA_CONFIGS = {
    "tactical": {
        "name": "Tatico",
        "system_prompt": """Voce e o QG do Shape Inexplicavel - um companheiro de habitos com personalidade tatica/militar.

ESTILO DE COMUNICACAO:
- Use vocabulario tatico: "Radio do QG", "Missao", "Combate", "Vacilo tatico", "Vitoria operacional", "Relatorio da noite", "Soldado", "Operacao"
- Tom: engajador, firme, acolhedor, com humor leve militar
- NUNCA humilhe ou julgue o usuario
- Adapte ao contexto (sono ruim, dia estressante, falhas)
- Use emojis taticos com moderacao: radio, alvo, escudo, bandeira

PRIORIDADES DE RESPOSTA:
1. Proxima acao pratica
2. Uso de contexto real do usuario
3. Tom tatico adequado
4. Clareza e brevidade
5. Seguranca (nunca diagnosticar, prescrever, ou substituir profissional)

RESTRICOES:
- NAO diagnostique doencas
- NAO prescreva medicamentos
- NAO ajuste doses de medicacao
- NAO substitua consulta profissional
- PODE: apoiar habitos, organizar rotina, gerar lembretes, orientar treino/alimentacao de forma geral""",
    },
    "coach": {
        "name": "Coach Parceiro",
        "system_prompt": """Voce e o Coach do Shape Inexplicavel - um companheiro motivador e acolhedor.

ESTILO DE COMUNICACAO:
- Tom: motivador, parceiro, celebra progresso
- Foco em: "voce consegue", "cada passo conta", "que orgulho", "vamos juntos"
- Empatico com falhas, celebra vitorias
- NUNCA humilhe ou julgue

PRIORIDADES DE RESPOSTA:
1. Proxima acao pratica
2. Contexto real do usuario
3. Motivacao e celebracao
4. Clareza

RESTRICOES: Mesmas restricoes de seguranca - NAO diagnosticar, prescrever ou substituir profissional.""",
    },
    "direct": {
        "name": "Direto",
        "system_prompt": """Voce e o assistente do Shape Inexplicavel - direto e pratico.

ESTILO: Objetivo, sem rodeios, foco em resultados. Respostas curtas e acionaveis.

PRIORIDADES: Acao pratica > Contexto > Clareza > Seguranca

RESTRICOES: NAO diagnosticar, prescrever medicamentos ou substituir profissional de saude.""",
    },
    "neutral": {
        "name": "Neutro",
        "system_prompt": """Voce e o assistente do Shape Inexplicavel - equilibrado e informativo.

ESTILO: Profissional, claro, equilibrado. Informacoes bem organizadas.

PRIORIDADES: Clareza > Acao pratica > Contexto > Seguranca

RESTRICOES: NAO diagnosticar, prescrever medicamentos ou substituir profissional de saude.""",
    },
}


def build_context_string(context: dict) -> str:
    parts = []
    name = context.get("user_name", "Usuario")
    parts.append(f"Nome do usuario: {name}")

    profile = context.get("profile", {})
    if profile:
        if profile.get("goal"):
            parts.append(f"Objetivo: {profile['goal']}")
        if profile.get("weight"):
            parts.append(f"Peso atual: {profile['weight']}kg")
        if profile.get("goal_weight"):
            parts.append(f"Meta de peso: {profile['goal_weight']}kg")
        if profile.get("water_goal_ml"):
            parts.append(f"Meta de agua: {profile['water_goal_ml']}ml")
        if profile.get("training_days"):
            parts.append(f"Dias de treino: {', '.join(profile['training_days'])}")
        if profile.get("routine"):
            r = profile["routine"]
            routine_str = ", ".join([f"{k}: {v}" for k, v in r.items()])
            parts.append(f"Rotina: {routine_str}")

    # Memory facts
    memory_facts = context.get("memory_facts", [])
    if memory_facts:
        parts.append("\n--- FATOS SOBRE O USUARIO ---")
        for f in memory_facts[:10]:
            parts.append(f"- [{f.get('category', 'geral')}] {f.get('fact', '')}")

    today = context.get("today", {})
    if today:
        parts.append(f"\n--- ESTADO DO DIA ({today.get('date', 'hoje')}) ---")
        parts.append(f"Calorias: {today.get('total_calories', 0)}/{profile.get('calorie_target', 2000) if profile else 2000}")
        parts.append(f"Proteina: {today.get('total_protein', 0)}g/{profile.get('protein_target', 150) if profile else 150}g")
        parts.append(f"Agua: {today.get('total_water_ml', 0)}ml/{today.get('water_goal_ml', 2500)}ml")

        meals = today.get("meals", [])
        if meals:
            meal_strs = [f"  - {m.get('time', '??')}: {m.get('description', '?')} ({m.get('calories', 0)} kcal)" for m in meals[-5:]]
            parts.append(f"Refeicoes de hoje ({len(meals)}):\n" + "\n".join(meal_strs))

        reminders = today.get("reminders", [])
        pending = [r for r in reminders if r.get("status") == "pending"]
        if pending:
            rem_strs = [f"  - {r.get('scheduled_at', '??')}: {r.get('label', '?')}" for r in pending[:3]]
            parts.append(f"Proximas missoes:\n" + "\n".join(rem_strs))

        checkin = today.get("checkin")
        if checkin:
            parts.append(f"Check-in: sono={checkin.get('sleep_quality', '?')}/5, energia={checkin.get('energy_level', '?')}/5, humor={checkin.get('mood', '?')}")

        # Workout sessions today
        workout_sessions = today.get("workout_sessions", [])
        if workout_sessions:
            for ws in workout_sessions:
                parts.append(f"Treino: {ws.get('plan_name', '?')} - {ws.get('status', '?')}")

    return "\n".join(parts)


def build_message_history(recent_messages: list) -> str:
    if not recent_messages:
        return ""
    parts = ["\n--- HISTORICO RECENTE ---"]
    for msg in recent_messages[-8:]:
        role = "Usuario" if msg.get("role") == "user" else "Assistente"
        content = msg.get("content", "")[:200]
        parts.append(f"{role}: {content}")
    return "\n".join(parts)


MODE_INSTRUCTIONS = {
    "companion": "Modo: Companheiro geral. Responda como parceiro de rotina, cobrindo qualquer assunto do dia.",
    "nutrition": "Modo: Alimentacao. Foque em refeicoes, macros, sugestoes de comida, e nutricao.",
    "workout": "Modo: Treino. Foque em exercicios, series, carga, e planejamento de treino.",
}


async def generate_ai_response(
    api_key: str,
    user_message: str,
    context: dict,
    persona_style: str = "tactical",
    mode: str = "companion",
    thread_id: str = "default",
) -> dict:
    persona = PERSONA_CONFIGS.get(persona_style, PERSONA_CONFIGS["tactical"])
    context_str = build_context_string(context)
    history_str = build_message_history(context.get("recent_messages", []))
    mode_instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["companion"])

    system_message = f"""{persona['system_prompt']}

{mode_instruction}

CONTEXTO DO USUARIO:
{context_str}
{history_str}

INSTRUCOES FINAIS:
- Responda em portugues brasileiro
- Seja conciso (max 3-4 paragrafos)
- Priorize acao pratica
- Use o nome do usuario
- Mantenha o tom da persona escolhida"""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"shape-{thread_id}-{persona_style}",
        system_message=system_message,
    )
    chat.with_model("openai", "gpt-5.2")

    msg = UserMessage(text=user_message)
    response = await chat.send_message(msg)

    return {
        "message_text": response,
        "tone_used": persona_style,
        "mode": mode,
    }


async def generate_reminder_message(
    api_key: str,
    reminder_type: str,
    label: str,
    persona_style: str = "tactical",
    context: dict = None,
) -> str:
    persona = PERSONA_CONFIGS.get(persona_style, PERSONA_CONFIGS["tactical"])

    if persona_style == "tactical":
        templates = {
            "meal": f"Radio do QG: Hora de {label}. Missao alimentar ativa. Reporte o que vai comer, soldado.",
            "workout": "Alerta operacional: Hora do treino. Bora pro combate muscular. Missao de hoje ativa.",
            "checkin": "Relatorio da noite solicitado. Como foi o dia, soldado? Sono, energia, humor - reporte tudo.",
            "water": "Hidratacao em baixa! Missao agua ativa. Beba pelo menos 300ml agora.",
        }
    else:
        templates = {
            "meal": f"Hora de {label}. Registre sua refeicao para manter o controle dos macros.",
            "workout": "Hora do treino. Registre sua sessao quando concluir.",
            "checkin": "Hora do check-in diario. Como esta seu sono, energia e humor?",
            "water": "Lembrete de hidratacao. Beba agua agora.",
        }

    return templates.get(reminder_type, f"Lembrete: {label}")
