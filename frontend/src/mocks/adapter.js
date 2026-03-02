/**
 * Mock Axios Adapter
 * Intercepta todas as requisições e retorna dados mockados.
 * Simula tokens JWT, banco de dados (localStorage) e respostas de IA.
 *
 * Para desativar e usar o backend real:
 *   - Remova REACT_APP_USE_MOCK=true do .env
 *   - Defina REACT_APP_BACKEND_URL=http://localhost:8000
 */

import settle from 'axios/unsafe/core/settle';
import {
  mockUser, mockDashboard, mockInsights, mockStreak,
  mockMeals, mockWorkoutPlans, mockWorkoutSessions,
  mockProgressSummary, mockWeeklySummary, mockMemoryFacts,
  mockChatThreads, mockChatMessages, mockAIResponses,
} from './data';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ── Estado em memória (persistido no localStorage) ──────────────
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(`mock_${key}`)) ?? fallback; }
  catch { return fallback; }
};
const save = (key, value) => localStorage.setItem(`mock_${key}`, JSON.stringify(value));

let state = {
  meals:           load('meals',    mockMeals),
  water_ml:        load('water_ml', 1800),
  checkin:         load('checkin',  null),
  sessions:        load('sessions', mockWorkoutSessions),
  plans:           load('plans',    mockWorkoutPlans),
  facts:           load('facts',    mockMemoryFacts),
  chatMessages:    load('chatMessages', mockChatMessages),
  weightHistory:   load('weightHistory', mockProgressSummary.weight_history),
  weeklySummary:   load('weeklySummary', mockWeeklySummary),
  reminders:       { 'rem-1': { status: 'pending' } },
};

const persist = (key) => save(key, state[key]);

// ── Token mock ──────────────────────────────────────────────────
const MOCK_ACCESS_TOKEN  = 'mock-jwt-access-gymie-2025';
const MOCK_REFRESH_TOKEN = 'mock-jwt-refresh-gymie-2025';

// ── Helpers ─────────────────────────────────────────────────────
const ok = (data, status = 200) => ({ data, status, statusText: 'OK', headers: {}, config: {} });
const err = (msg, status = 400) => { throw { response: { data: { detail: msg }, status } }; };

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const todayStr = () => new Date().toISOString().split('T')[0];

function generateAIResponse(mode, userMessage, currentState, persona) {
  const hour = new Date().getHours();
  const name = mockUser.name.split(' ')[0]; // Rafael
  const period = hour < 12 ? 'manhã' : hour < 18 ? 'tarde' : 'noite';
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Macros do dia
  const todayMeals = currentState.meals.filter((m) => m.date === todayStr());
  const calTotal  = todayMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const protTotal = todayMeals.reduce((s, m) => s + (m.protein  || 0), 0);
  const calTarget  = mockUser.profile.calorie_target  || 2800;
  const protTarget = mockUser.profile.protein_target  || 150;
  const calPct  = Math.round((calTotal  / calTarget)  * 100);
  const protPct = Math.round((protTotal / protTarget) * 100);
  const calLeft  = calTarget  - calTotal;
  const protLeft = Math.max(0, protTarget - protTotal);

  // Água
  const waterGoal = mockUser.profile.water_goal_ml || 2500;
  const waterMl   = currentState.water_ml || 0;
  const waterPct  = Math.round((waterMl / waterGoal) * 100);
  const waterLeft = Math.max(0, waterGoal - waterMl);

  // Streak
  const streak = mockStreak.current_streak;

  // Fatos memorizados do usuário
  const facts = currentState.facts || [];
  const factLactose   = facts.some(f => /lactose/i.test(f.fact));
  const factAfternoon = facts.some(f => /tarde|18h|17h|19h/i.test(f.fact));
  const factGoal      = facts.find(f => /objetivo|meta|ganhar|emagrecer/i.test(f.fact));
  const anyFact       = facts[0];

  // Intenção da mensagem
  const msg        = (userMessage || '').toLowerCase();
  const isGreeting     = /\b(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e a[ií]|tudo bem)\b/.test(msg);
  const asksProtein    = /proteína|proteina|\bprot\b/.test(msg);
  const asksWater      = /água|agua|hidrat/.test(msg);
  const asksCal        = /caloria|kcal/.test(msg);
  const asksWorkout    = /treino|exerc[íi]cio|academia|muscula/.test(msg);
  const asksStreak     = /sequ[êe]ncia|streak|dias seguidos/.test(msg);
  const asksSubst      = /não tenho|nao tenho|em casa|sem (halter|barra|máquina|halteres|aparelho|equipamento)|alternativa|substituir|substituição/.test(msg);

  // Mapa de substituições de equipamentos → bodyweight
  const SUBST_MAP = {
    'supino':            { alt: 'Flexão de Peito',        how: 'Varie a inclinação (pés elevados = ênfase superior, normal = medial). 4×12 com 2s de descida.' },
    'halter|halteres':   { alt: 'Garrafa d\'água ou mochila', how: 'Garrafas de 1-2L = 1-2kg. Para cargas maiores, mochila com livros ou garrafas extras.' },
    'barra':             { alt: 'Flexão + Remada com mochila', how: 'Flexão para peito/tríceps e remada pendendo abaixo de uma mesa para costas.' },
    'leg press':         { alt: 'Agachamento Búlgaro',    how: 'Um pé apoiado atrás numa cadeira. 4×10/lado — mais difícil que parece, ativa glúteo e quad.' },
    'cadeira extensora': { alt: 'Afundo em caminhada',    how: '3×12 por perna. Mesmo padrão de movimento, sem máquina.' },
    'puxada|pulldown':   { alt: 'Remada Invertida',       how: 'Deitado sob uma mesa firme, puxe o corpo para cima. Escápulas, bíceps e dorsal trabalhando.' },
    'rosca':             { alt: 'Flexão fechada (diamante)', how: 'Mãos próximas no chão — foco em bíceps e tríceps com peso corporal.' },
    'tríceps|triceps':   { alt: 'Mergulho em cadeira',    how: 'Apoie as mãos em duas cadeiras, desça o corpo. 3×12.' },
  };

  // ── Companion ───────────────────────────────────────────────────
  if (mode === 'companion') {
    if (isGreeting) {
      let reply;
      if (persona === 'motivador')
        reply = `${greeting}, ${name}! 💪 Dia **${streak}** de sequência — você está absurdo! ${period === 'manhã' ? 'Começar assim é coisa de atleta.' : period === 'tarde' ? 'A tarde é sua!' : 'Mesmo de noite, aqui firme — isso é consistência.'} Bora!`;
      else if (persona === 'tatico')
        reply = `${greeting}, ${name}. Streak: **${streak} dias**. Macros: ${calPct}% cal, ${protPct}% prot, água ${waterPct}%. O que otimizamos agora?`;
      else if (persona === 'cientifico')
        reply = `${greeting}, ${name}. ${streak} dias consecutivos é estatisticamente significativo — você já passou do limiar crítico de 7 dias. Macros atuais: ${calTotal} kcal / ${protTotal}g prot.`;
      else
        reply = `${greeting}, ${name}! Dia **${streak}** sem quebrar a corrente. ${period === 'manhã' ? 'Ótimo início de dia.' : period === 'tarde' ? 'Tarde produtiva?' : 'De olho nos hábitos até de noite — isso é dedicação.'} O que você precisa?`;
      if (anyFact)
        reply += ` Lembro que você **${anyFact.fact.toLowerCase()}** — já considerei isso no seu contexto.`;
      return reply;
    }
    if (asksStreak)
      return `Você está na sua **${streak}ª sequência** consecutiva! ${streak >= 14 ? 'Duas semanas completas — o hábito já está se formando no automatismo.' : streak >= 7 ? 'Uma semana cheia — a inércia agora joga a seu favor.' : 'Continue, cada dia é um tijolo.'} Maior sequência histórica: **${mockStreak.longest_streak} dias**.`;
    if (asksWater)
      return waterPct >= 80
        ? `Hidratação excelente — **${waterPct}%** da meta (${(waterMl / 1000).toFixed(1)}L). Siga assim.`
        : `Hidratação em **${waterPct}%**. Faltam ${(waterLeft / 1000).toFixed(1)}L. ${period === 'noite' ? 'Amanhã beba antes das 18h para fechar mais fácil.' : 'Coloca um copo na sua frente agora.'}`;
    return pick([
      `São **${hour}h** (${period}). Você está com ${calPct}% das calorias e ${waterPct}% de água. ${calPct < 80 && period === 'noite' ? 'Ainda dá pra fechar o dia certo.' : 'Dentro do esperado.'}`,
      `Streak de **${streak} dias**, ${calPct}% das calorias, ${waterPct}% de água — ${calPct > 80 && waterPct > 70 ? 'você está no caminho certo, ' + name + '.' : 'alguns pontos pra ajustar, ' + name + '.'}`,
      `${name}, ${persona === 'tatico' ? `proteína em ${protPct}% (${protLeft}g restam). Prioridade: feche esse gap.` : persona === 'motivador' ? 'cada escolha hoje é um tijolo na sua melhor versão. Continue!' : 'sua consistência ao longo dos dias é o que realmente transforma o corpo.'}`,
    ]);
  }

  // ── Nutrition ───────────────────────────────────────────────────
  if (mode === 'nutrition') {
    if (asksProtein || (isGreeting && protPct < 80)) {
      if (persona === 'tatico')
        return `Proteína: **${protTotal}g / ${protTarget}g** (${protPct}%). Faltam **${protLeft}g**. Opções diretas: frango 200g (+46g), atum 150g (+35g), whey (+25g).`;
      if (persona === 'cientifico')
        return `Ingestão proteica: **${protTotal}g** de ${protTarget}g (${protPct}%). Para síntese máxima, distribua os ${protLeft}g restantes em 2-3 refeições — leucina threshold ~3g por dose.`;
      return `Ainda faltam **${protLeft}g de proteína** para fechar a meta hoje. ${period === 'noite' ? 'Uma refeição proteica agora resolve.' : 'Distribua ao longo do dia.'}`;
    }
    if (asksWater)
      return waterPct >= 100
        ? `Meta de água atingida! ${(waterGoal / 1000).toFixed(1)}L. Em dias de treino intenso adicione 300-500ml extras.`
        : `Água: **${waterPct}%** da meta, faltam ${(waterLeft / 1000).toFixed(1)}L. ${period === 'noite' ? 'Última chance do dia — recupera antes de dormir.' : 'Um copo agora e crie o hábito horário.'}`;
    if (asksCal)
      return calLeft > 0
        ? `Calorias: **${calTotal} / ${calTarget} kcal** (${calPct}%). Ainda há **${calLeft} kcal** disponíveis. ${period === 'noite' ? 'Se treinou hoje, use para recuperação.' : 'Distribua nas próximas refeições.'}`
        : `Atingiu **${calPct}%** das calorias. Excedente de ${Math.abs(calLeft)} kcal — ${calPct < 115 ? 'dentro do aceitável para dia de treino.' : 'vale ajustar amanhã.'}`;
    const mealCount = todayMeals.length;
    return persona === 'tatico'
      ? `Balanço: **${calTotal} kcal** (${calPct}%), **${protTotal}g prot** (${protPct}%), água **${waterPct}%**. ${mealCount} refeições registradas hoje.`
      : `${mealCount} refeições hoje. Calorias em **${calPct}%** e proteína em **${protPct}%**. ${protPct < 70 ? 'Proteína abaixo — priorize nas próximas refeições.' : 'Está dentro do planejado!'}`;
  }

  // ── Workout ─────────────────────────────────────────────────────
  if (mode === 'workout') {
    if (asksSubst) {
      const subKey = Object.keys(SUBST_MAP).find(k => new RegExp(k, 'i').test(msg));
      if (subKey) {
        const s = SUBST_MAP[subKey];
        return `Sem problema! Para **${subKey.split('|')[0]}** em casa: **${s.alt}** — ${s.how}`;
      }
      return `Treino em casa funciona perfeitamente! Principais substituições:\n**Supino → Flexão de Peito** · **Puxada → Remada Invertida** · **Leg press → Agachamento Búlgaro** · **Halter → Garrafa d'água cheia**\n\nQual exercício específico você quer substituir?`;
    }
    if (asksWorkout || isGreeting) {
      const completed = currentState.sessions?.find(
        (s) => ((s.date || (s.created_at || '').slice(0, 10)) === todayStr()) && s.status === 'completed'
      );
      if (completed)
        return persona === 'motivador'
          ? `Treino de hoje **concluído** — missão cumprida! 🏆 Agora recupera: sono + ${protLeft > 0 ? protLeft + 'g de proteína' : 'boa refeição proteica'} + hidratação.`
          : `Sessão concluída hoje. Para recuperação ideal: 7-9h de sono, proteína elevada e hidratação em dia. Você fez sua parte.`;
      return persona === 'tatico'
        ? `Nenhuma sessão concluída hoje. ${period === 'manhã' ? 'Janela anabólica matinal ativa.' : period === 'tarde' ? 'Pico de força costuma ser 15h-18h.' : 'Última janela do dia.'} Acesse a aba Treino para iniciar.`
        : `Nenhum treino hoje ainda. ${period === 'noite' ? 'Ainda dá tempo!' : `A ${period} é um ótimo momento.`} Qual grupo muscular você quer focar?`;
    }
    return pick([
      `Com **${streak} dias de sequência**, seu corpo está adaptado. Se as cargas parecerem fáceis, é sinal de que a progressão chegou.`,
      `Foco no controle excêntrico (fase de descida, ~3s). ${persona === 'cientifico' ? 'Há evidências de maior dano muscular e hipertrofia com fase excêntrica controlada.' : 'Maximiza o estímulo sem precisar aumentar a carga.'}`,
      `Respeite o descanso entre séries. ${period === 'noite' ? 'À noite o sistema nervoso está mais fatigado — sinais de cansaço precoce são normais.' : 'Fique atento ao que o corpo sinaliza.'}`,
    ]);
  }

  // Fallback
  return pick(mockAIResponses[mode] || mockAIResponses.companion);
}

let msgCounter = 100;
const nextId = (prefix = 'id') => `${prefix}-${++msgCounter}-${Date.now()}`;

// ── Router principal ─────────────────────────────────────────────
export default async function mockAdapter(config) {
  const resolve = (response) => new Promise((res, rej) => settle(res, rej, response));

  await delay(200 + Math.random() * 200);

  const method = (config.method || 'get').toUpperCase();
  const url    = config.url?.replace(config.baseURL || '', '') || '';
  const body   = (() => { try { return JSON.parse(config.data); } catch { return {}; } })();

  try {
    const data = await route(method, url, body);
    return resolve(ok(data));
  } catch (e) {
    if (e?.response) {
      return resolve({ ...e.response, headers: {}, config });
    }
    return resolve({ data: { detail: 'Erro mock' }, status: 500, headers: {}, config });
  }
}

async function route(method, url, body) {

  // ── Auth ───────────────────────────────────────────────────────
  if (method === 'POST' && url.endsWith('/api/auth/login')) {
    await delay(300);
    return { access_token: MOCK_ACCESS_TOKEN, refresh_token: MOCK_REFRESH_TOKEN };
  }

  if (method === 'POST' && url.endsWith('/api/auth/register')) {
    await delay(400);
    return { access_token: MOCK_ACCESS_TOKEN, refresh_token: MOCK_REFRESH_TOKEN };
  }

  if (method === 'POST' && url.endsWith('/api/auth/refresh')) {
    return { access_token: MOCK_ACCESS_TOKEN };
  }

  if (method === 'POST' && url.endsWith('/api/auth/forgot-password')) {
    return { message: 'E-mail enviado (mock)' };
  }

  // ── User ───────────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/me')) {
    return mockUser;
  }

  if (method === 'POST' && (url.endsWith('/api/onboarding') || url.endsWith('/api/onboarding/complete'))) {
    if (body) Object.assign(mockUser.profile, body);
    mockUser.profile.onboarding_completed = true;
    localStorage.setItem('gymie_measurements', JSON.stringify({ goal: body?.goal, ...body }));
    return mockUser;
  }

  if (method === 'PUT' && url.endsWith('/api/profile')) {
    if (body) Object.assign(mockUser.profile, body);
    return mockUser;
  }

  // ── Dashboard & Insights ───────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/dashboard/today')) {
    const totalCal = state.meals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalProt = state.meals.reduce((s, m) => s + (m.protein || 0), 0);
    return {
      ...mockDashboard,
      macros: {
        calories: { current: totalCal, target: 2800 },
        protein:  { current: totalProt, target: 180 },
        carbs:    { current: state.meals.reduce((s, m) => s + (m.carbs || 0), 0), target: 320 },
        fat:      { current: state.meals.reduce((s, m) => s + (m.fat || 0), 0), target: 80 },
      },
      water: { current_ml: state.water_ml, goal_ml: 2500 },
      checkin: state.checkin,
    };
  }

  if (method === 'GET' && url.endsWith('/api/agents/insights')) {
    const waterPct  = Math.round((state.water_ml / 2500) * 100);
    const totalCal  = state.meals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalProt = state.meals.reduce((s, m) => s + (m.protein || 0), 0);
    const calPct    = Math.round((totalCal / 2800) * 100);
    const protPct   = Math.round((totalProt / 180) * 100);
    const actionable = [];
    if (waterPct < 80)  actionable.push({ type: 'water',   message: `Faltam ${Math.round((2500 - state.water_ml) / 100) * 100}ml para bater sua meta de água hoje.`, color: '#38bdf8', priority: waterPct < 50 ? 'high' : 'medium' });
    if (protPct < 80)   actionable.push({ type: 'protein', message: `Você está ${180 - totalProt}g abaixo da meta de proteína.`, color: '#f97316', priority: 'high' });
    return { context_summary: { water_pct: waterPct, calories_pct: calPct, protein_pct: protPct, has_workout: state.sessions.some(s => s.status === 'completed' && s.date === new Date().toISOString().split('T')[0]), has_checkin: !!state.checkin }, actionable };
  }

  if (method === 'GET' && url.endsWith('/api/streak')) {
    return mockStreak;
  }

  // ── Reminders ──────────────────────────────────────────────────
  if (method === 'POST' && url.includes('/api/reminders/') && url.endsWith('/action')) {
    const id = url.split('/').slice(-2)[0];
    if (state.reminders[id]) state.reminders[id].status = body.action;
    mockDashboard.next_mission = null;
    return { ok: true };
  }

  // ── Check-in ───────────────────────────────────────────────────
  if (method === 'POST' && url.endsWith('/api/checkins')) {
    state.checkin = { ...body, date: new Date().toISOString().split('T')[0] };
    persist('checkin');
    return state.checkin;
  }

  // ── Água ───────────────────────────────────────────────────────
  if (method === 'POST' && url.endsWith('/api/water')) {
    state.water_ml = Math.min(state.water_ml + (body.amount_ml || 300), 4000);
    persist('water_ml');
    return { current_ml: state.water_ml, goal_ml: 2500 };
  }

  if (method === 'GET' && url.endsWith('/api/water')) {
    return { logs: [{ amount_ml: state.water_ml, date: new Date().toISOString().split('T')[0] }], total_ml: state.water_ml };
  }

  // ── Refeições ──────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/meals')) {
    return { meals: state.meals };
  }

  if (method === 'POST' && url.endsWith('/api/meals')) {
    const meal = { id: nextId('meal'), date: new Date().toISOString().split('T')[0], ...body };
    state.meals = [meal, ...state.meals];
    persist('meals');
    return meal;
  }

  if (method === 'POST' && url.endsWith('/api/meals/analyze')) {
    await delay(1000);
    const desc = (body.description || '').toLowerCase();
    let macros = { calories: 350, protein: 25, carbs: 35, fat: 12 };
    let analysisText = `Analisei **${body.description}** e estimei os macros com base em porção típica.`;
    let confidence = 'medium';

    if (desc.includes('frango') || desc.includes('peito de frango')) {
      macros = { calories: 310, protein: 42, carbs: 4, fat: 5 };
      analysisText = `Frango grelhado identificado. Proteína de alta qualidade com gordura mínima — excelente escolha para a meta de ganho de massa.`;
      confidence = 'high';
    } else if (desc.includes('ovo') || desc.includes('omelete')) {
      macros = { calories: 280, protein: 22, carbs: 2, fat: 18 };
      analysisText = `Ovos identificados. Fonte completa de aminoácidos essenciais e gorduras saudáveis.`;
      confidence = 'high';
    } else if (desc.includes('whey') || desc.includes('shake')) {
      macros = { calories: 200, protein: 28, carbs: 14, fat: 3 };
      analysisText = `Shake proteico identificado. Absorção rápida — ideal dentro de 30 min pós-treino.`;
      confidence = 'high';
    } else if (desc.includes('arroz') || desc.includes('macarrão') || desc.includes('massa')) {
      macros = { calories: 390, protein: 9, carbs: 80, fat: 4 };
      analysisText = `Carboidrato complexo identificado. Boa fonte de energia para o treino — controle a porção.`;
      confidence = 'medium';
    } else if (desc.includes('salada') || desc.includes('legume') || desc.includes('vegetal')) {
      macros = { calories: 120, protein: 5, carbs: 18, fat: 3 };
      analysisText = `Refeição leve e rica em micronutrientes identificada. Volume alto com baixa caloria — ótimo para saciedade.`;
      confidence = 'medium';
    } else if (desc.includes('iogurte') || desc.includes('cottage')) {
      macros = { calories: 180, protein: 20, carbs: 12, fat: 4 };
      analysisText = `Lácteo proteico identificado. Caseína de digestão lenta — bom para lanches e pré-sono.`;
      confidence = 'high';
    } else if (desc.includes('banana') || desc.includes('fruta')) {
      macros = { calories: 140, protein: 2, carbs: 34, fat: 0 };
      analysisText = `Fruta identificada. Carboidrato simples de rápida absorção — ótimo pré-treino ou lanche.`;
      confidence = 'medium';
    }

    return {
      success: true,
      estimated_macros: { ...macros, description: body.description },
      analysis_text: analysisText,
      confidence,
    };
  }

  if (method === 'PUT' && url.match(/\/api\/meals\/[^/]+$/) && !url.endsWith('/analyze')) {
    const id = url.split('/').pop();
    state.meals = state.meals.map((m) => m.id === id ? { ...m, ...body } : m);
    persist('meals');
    return state.meals.find((m) => m.id === id);
  }

  if (method === 'DELETE' && url.match(/\/api\/meals\/[^/]+$/)) {
    const id = url.split('/').pop();
    state.meals = state.meals.filter((m) => m.id !== id);
    persist('meals');
    return { ok: true };
  }

  // ── Treinos ────────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/workout-plans')) {
    return { plans: state.plans };
  }

  if (method === 'POST' && url.endsWith('/api/workout-plans')) {
    const plan = { id: nextId('plan'), ...body };
    state.plans = [plan, ...state.plans];
    persist('plans');
    return plan;
  }

  if (method === 'DELETE' && url.match(/\/api\/workout-plans\/[^/]+$/)) {
    const id = url.split('/').pop();
    state.plans = state.plans.filter((p) => p.id !== id);
    persist('plans');
    return { ok: true };
  }

  if (method === 'GET' && url.endsWith('/api/workout-sessions')) {
    return { sessions: state.sessions };
  }

  if (method === 'POST' && url.endsWith('/api/workout-sessions')) {
    const plan = state.plans.find((p) => p.id === body.plan_id) || state.plans[0];
    const session = {
      id: nextId('session'),
      plan_id: body.plan_id,
      plan_name: plan?.name || 'Treino',
      date: new Date().toISOString().split('T')[0],
      status: 'active',
      exercises: (plan?.exercises || []).map((ex) => ({
        ...ex,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          set_number: i + 1, reps: ex.reps, weight_kg: ex.weight_kg, completed: false,
        })),
      })),
    };
    state.sessions = [session, ...state.sessions];
    persist('sessions');
    return session;
  }

  if (method === 'PUT' && url.match(/\/api\/workout-sessions\/[^/]+$/)) {
    const id = url.split('/').pop();
    state.sessions = state.sessions.map((s) => s.id === id ? { ...s, ...body } : s);
    persist('sessions');
    return state.sessions.find((s) => s.id === id);
  }

  if (method === 'DELETE' && url.match(/\/api\/workout-sessions\/[^/]+$/)) {
    const id = url.split('/').pop();
    state.sessions = state.sessions.filter((s) => s.id !== id);
    persist('sessions');
    return { ok: true };
  }

  if (method === 'GET' && url.includes('/api/progress/exercise-history')) {
    const name = new URLSearchParams(url.split('?')[1]).get('exercise_name');
    return {
      exercise_name: name,
      history: [
        { date: '2025-01-15', weight_kg: 70, reps: '10' },
        { date: '2025-01-22', weight_kg: 72.5, reps: '10' },
        { date: '2025-01-29', weight_kg: 75, reps: '10' },
        { date: '2025-02-05', weight_kg: 77.5, reps: '8' },
        { date: '2025-02-12', weight_kg: 80, reps: '8' },
      ],
    };
  }

  // ── Progresso ──────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/progress/summary')) {
    // Workout frequency by day of week (0=Sun, 1=Mon...)
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    state.sessions.filter((s) => s.status === 'completed').forEach((s) => {
      const d = new Date(s.date || (s.created_at || '').slice(0, 10));
      if (!isNaN(d)) dayCounts[d.getDay()]++;
    });
    // Reorder Mon→Sun
    const workout_by_day = [1,2,3,4,5,6,0].map((i) => ({ day: dayNames[i], count: dayCounts[i] }));
    return {
      ...mockProgressSummary,
      weight_history: state.weightHistory,
      calorie_target: mockUser.profile.calorie_target || 2800,
      protein_target: mockUser.profile.protein_target || 150,
      workout_by_day,
    };
  }

  if (method === 'GET' && url.endsWith('/api/progress/weekly-summary')) {
    return { summaries: state.weeklySummary ? [state.weeklySummary] : [] };
  }

  if (method === 'POST' && url.endsWith('/api/progress/weekly-summary')) {
    await delay(1200);
    return state.weeklySummary || mockWeeklySummary;
  }

  if (method === 'POST' && url.endsWith('/api/body-metrics')) {
    const entry = { date: new Date().toISOString().split('T')[0], weight: body.weight };
    state.weightHistory = [...state.weightHistory.filter((h) => h.date !== entry.date), entry]
      .sort((a, b) => a.date.localeCompare(b.date));
    persist('weightHistory');
    return entry;
  }

  // ── Memória / Fatos ────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/memory/facts')) {
    return { facts: state.facts };
  }

  if (method === 'POST' && url.endsWith('/api/memory/facts')) {
    const fact = { id: nextId('fact'), ...body, created_at: new Date().toISOString().split('T')[0] };
    state.facts = [fact, ...state.facts];
    persist('facts');
    return fact;
  }

  if (method === 'DELETE' && url.match(/\/api\/memory\/facts\/[^/]+$/)) {
    const id = url.split('/').pop();
    state.facts = state.facts.filter((f) => f.id !== id);
    persist('facts');
    return { ok: true };
  }

  // ── Chat ───────────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/chat/threads')) {
    return { threads: mockChatThreads };
  }

  if (method === 'POST' && url.endsWith('/api/chat/threads')) {
    const thread = { id: nextId('thread'), title: 'Nova conversa', created_at: new Date().toISOString() };
    mockChatThreads.push(thread);
    state.chatMessages[thread.id] = [];
    return thread;
  }

  if (method === 'GET' && url.match(/\/api\/chat\/threads\/[^/]+\/messages$/)) {
    const threadId = url.split('/')[3];
    const msgs = state.chatMessages[threadId] || load('chatMessages', mockChatMessages)[threadId] || [];
    return { messages: msgs };
  }

  if (method === 'POST' && url.match(/\/api\/chat\/threads\/[^/]+\/messages$/)) {
    const threadId = url.split('/')[3];
    await delay(600);

    const mode = body.mode || 'companion';
    const userMsg = {
      id: nextId('msg'), role: 'user',
      content: body.content,
      image_base64: body.image_base64 || null,
      has_audio: !!body.audio_base64,
      created_at: new Date().toISOString(),
    };

    // Determine AI response by content type
    let aiContent;
    if (body.image_base64) {
      if (mode === 'nutrition')
        aiContent = 'Foto recebida! Analisando o que vejo...\n\nIdentifiquei uma refeição com **proteína + carboidratos + vegetais** — composição equilibrada. Estimativa: ~380 kcal, ~30g proteína. Quer que eu registre essa refeição?';
      else if (mode === 'workout')
        aiContent = 'Imagem recebida! Se for de um exercício, posso avaliar a execução ou sugerir variações. Me conta o que você está fazendo.';
      else
        aiContent = 'Imagem recebida! Pode me contar mais sobre o que você está mostrando? Uso esse contexto para te ajudar melhor.';
    } else if (body.audio_base64) {
      aiContent = `Recebi seu áudio! ${generateAIResponse(mode, body.content || '', state, mockUser.profile.persona_style)}`;
    } else {
      aiContent = generateAIResponse(mode, body.content, state, mockUser.profile.persona_style);
      // Hint user context if loaded and message mentions restrictions
      const userCtx = localStorage.getItem('gymie_user_context');
      if (userCtx && /lesão|machucado|restrição|alergia|histórico|intoler/i.test(body.content || '')) {
        aiContent += '\n\n*(Considerei seu contexto pessoal carregado no Perfil)*';
      }
    }

    const aiMsg = {
      id: nextId('msg'),
      role: 'assistant',
      content: aiContent,
      agent_id: mode,
      agent_name: mode === 'nutrition' ? 'NutriBot' : mode === 'workout' ? 'TrainBot' : 'Gymie',
      agent_color: mode === 'nutrition' ? '#FB923C' : mode === 'workout' ? '#A855F7' : '#00E04B',
      created_at: new Date().toISOString(),
    };

    if (!state.chatMessages[threadId]) state.chatMessages[threadId] = [];
    state.chatMessages[threadId] = [...state.chatMessages[threadId], userMsg, aiMsg];
    persist('chatMessages');

    return { user_message: userMsg, ai_message: aiMsg };
  }

  // ── Settings ───────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/settings')) {
    return { ...mockUser.profile };
  }

  if (method === 'PUT' && url.endsWith('/api/settings')) {
    Object.assign(mockUser.profile, body);
    return { ...mockUser.profile };
  }

  if (method === 'GET' && url.includes('/api/settings/persona')) {
    return {
      persona_style: mockUser.profile.persona_style,
      available_styles: [
        { id: 'tatico',     name: 'Tático',      description: 'Direto, técnico e focado em dados' },
        { id: 'motivador',  name: 'Motivador',   description: 'Energético, positivo e encorajador' },
        { id: 'cientifico', name: 'Científico',  description: 'Baseado em evidências e preciso' },
        { id: 'amigo',      name: 'Amigo',       description: 'Casual, próximo e bem-humorado' },
      ],
    };
  }

  if (method === 'PUT' && url.includes('/api/settings/persona')) {
    if (body?.persona_style) mockUser.profile.persona_style = body.persona_style;
    return { persona_style: mockUser.profile.persona_style };
  }

  if (method === 'POST' && url.match(/\/api\/workout-sessions\/[^/]+\/complete$/)) {
    const id = url.split('/')[3];
    state.sessions = state.sessions.map((s) =>
      s.id === id ? { ...s, status: 'completed', completed_at: new Date().toISOString() } : s
    );
    persist('sessions');
    return { ok: true };
  }

  if (method === 'POST' && url.endsWith('/api/achievements/check')) {
    return { new_achievements: [] };
  }

  // ── Conquistas ─────────────────────────────────────────────────
  if (method === 'GET' && url.endsWith('/api/achievements')) {
    const completedSessions = state.sessions.filter((s) => s.status === 'completed').length;
    const achievements = [
      // Streak
      { id: 'streak_3',  name: 'Consistente',    description: '3 dias seguidos',          icon: '⚡', category: 'streak',   unlocked: true,  progress: 12, target: 3 },
      { id: 'streak_7',  name: 'Semana Perfeita', description: '7 dias seguidos',          icon: '🔥', category: 'streak',   unlocked: true,  progress: 12, target: 7 },
      { id: 'streak_14', name: 'Duas Semanas',    description: '14 dias seguidos',         icon: '💪', category: 'streak',   unlocked: false, progress: 12, target: 14 },
      { id: 'streak_30', name: 'Mês de Foco',     description: '30 dias seguidos',         icon: '🏆', category: 'streak',   unlocked: false, progress: 12, target: 30 },
      // Treinos
      { id: 'workout_1',  name: 'Primeiro Passo',  description: 'Complete seu 1º treino',  icon: '🎯', category: 'workouts', unlocked: completedSessions >= 1,  progress: Math.min(completedSessions, 1),  target: 1 },
      { id: 'workout_10', name: '10 Treinos',       description: 'Complete 10 treinos',     icon: '🏋️', category: 'workouts', unlocked: completedSessions >= 10, progress: Math.min(completedSessions, 10), target: 10 },
      { id: 'workout_30', name: '30 Treinos',       description: 'Complete 30 treinos',     icon: '💎', category: 'workouts', unlocked: completedSessions >= 30, progress: Math.min(completedSessions, 30), target: 30 },
      { id: 'workout_50', name: 'Meio Caminho',     description: 'Complete 50 treinos',     icon: '👑', category: 'workouts', unlocked: completedSessions >= 50, progress: Math.min(completedSessions, 50), target: 50 },
      // Refeições
      { id: 'meals_1',    name: 'Primeira Refeição', description: 'Registre sua 1ª refeição', icon: '🥗', category: 'meals', unlocked: state.meals.length >= 1,  progress: Math.min(state.meals.length, 1),  target: 1 },
      { id: 'meals_10',   name: 'Nutrido',           description: 'Registre 10 refeições',    icon: '🍽️', category: 'meals', unlocked: state.meals.length >= 10, progress: Math.min(state.meals.length, 10), target: 10 },
      { id: 'meals_50',   name: 'Chef Saudável',     description: 'Registre 50 refeições',    icon: '👨‍🍳', category: 'meals', unlocked: state.meals.length >= 50, progress: Math.min(state.meals.length, 50), target: 50 },
      // Água
      { id: 'water_1',  name: 'Hidratado',      description: 'Bata a meta de água em 1 dia',   icon: '💧', category: 'water', unlocked: state.water_ml >= 2500, progress: Math.min(state.water_ml, 2500), target: 2500 },
      { id: 'water_3L', name: 'Fonte de Saúde', description: 'Beba 3L em um único dia',        icon: '🌊', category: 'water', unlocked: state.water_ml >= 3000, progress: Math.min(state.water_ml, 3000), target: 3000 },
      { id: 'water_max', name: 'Oceano',         description: 'Registre o máximo diário (4L)', icon: '🏖️', category: 'water', unlocked: state.water_ml >= 4000, progress: Math.min(state.water_ml, 4000), target: 4000 },
      // Especiais
      { id: 'special_onboard', name: 'Pronto para Vencer', description: 'Completou o onboarding',     icon: '🚀', category: 'special', unlocked: true,              progress: 1, target: 1 },
      { id: 'special_checkin', name: 'Auto-Conhecimento',  description: 'Fez o check-in do dia',      icon: '🧠', category: 'special', unlocked: !!state.checkin,   progress: state.checkin ? 1 : 0, target: 1 },
      { id: 'special_export',  name: 'Analítico',          description: 'Exportou seus dados',        icon: '📊', category: 'special', unlocked: false,             progress: 0, target: 1 },
      { id: 'special_perfect', name: 'Dia Perfeito',       description: 'Bateu todas as metas em 1 dia', icon: '⭐', category: 'special', unlocked: false,          progress: 0, target: 1 },
    ];
    const unlocked = achievements.filter((a) => a.unlocked).length;
    // Detect newly unlocked since last visit
    const seenKey = 'gymie_seen_achievements';
    const seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
    const newlyUnlocked = achievements.filter((a) => a.unlocked && !seen.includes(a.id));
    localStorage.setItem(seenKey, JSON.stringify(achievements.filter((a) => a.unlocked).map((a) => a.id)));
    return {
      achievements,
      stats: { total: achievements.length, unlocked, percentage: Math.round((unlocked / achievements.length) * 100) },
      newly_unlocked: newlyUnlocked,
    };
  }

  // ── Exportação ─────────────────────────────────────────────────
  if (method === 'GET' && url.includes('/api/export/')) {
    const type   = url.split('/api/export/')[1].split('?')[0];
    const params = new URLSearchParams(url.split('?')[1] || '');
    const format = params.get('format') || 'csv';
    if (format === 'csv') {
      const headers = { meals: 'data,tipo,descricao,calorias,proteina,carbs,gordura', workouts: 'data,treino,status,exercicios', progress: 'data,peso' };
      const rows = {
        meals:    state.meals.map((m) => `${m.date},${m.meal_type},"${m.description}",${m.calories},${m.protein},${m.carbs},${m.fat}`),
        workouts: state.sessions.map((s) => `${s.date},"${s.plan_name}",${s.status},${(s.exercises || []).length}`),
        progress: state.weightHistory.map((h) => `${h.date},${h.weight}`),
      };
      return [headers[type] || 'data', ...(rows[type] || [])].join('\n');
    }
    return { type, data: type === 'meals' ? state.meals : type === 'workouts' ? state.sessions : state.weightHistory, exported_at: new Date().toISOString() };
  }

  // Fallback
  console.warn(`[MockAdapter] Rota não mapeada: ${method} ${url}`);
  return { ok: true, message: 'mock fallback' };
}
