// ── Mock Database ────────────────────────────────────────────────
// Simula o MongoDB localmente. Todos os dados são mantidos em memória
// e no localStorage para persistência entre reloads.

const today = () => new Date().toISOString().split('T')[0];

export const mockUser = {
  id: 'mock-user-1',
  name: 'Rafael Silva',
  email: 'rafael@gymie.app',
  profile: {
    onboarding_completed: true,
    weight: 78,
    height: 178,
    goal: 'ganho_massa',
    goal_weight: 82,
    water_goal_ml: 2500,
    calorie_target: 2800,
    persona_style: 'tatico',
    training_days: ['seg', 'ter', 'qui', 'sex'],
  },
};

export const mockDashboard = {
  name: 'Rafael Silva',
  macros: {
    calories: { current: 1840, target: 2800 },
    protein:  { current: 112,  target: 180 },
    carbs:    { current: 210,  target: 320 },
    fat:      { current: 55,   target: 80 },
  },
  water: { current_ml: 1800, goal_ml: 2500 },
  next_mission: {
    id: 'rem-1',
    label: 'Treino B — Costas + Bíceps',
    scheduled_at: '18:00',
  },
  checkin: null,
};

export const mockInsights = {
  context_summary: {
    water_pct: 72,
    calories_pct: 66,
    protein_pct: 62,
    has_workout: false,
    has_checkin: false,
  },
  actionable: [
    { type: 'water',   message: 'Faltam 700ml para bater sua meta de água hoje.', color: '#38bdf8', priority: 'medium' },
    { type: 'protein', message: 'Você está 68g abaixo da sua meta de proteína.', color: '#f97316', priority: 'high' },
  ],
};

export const mockStreak = {
  current_streak: 12,
  longest_streak: 15,
};

export const mockMeals = [
  { id: 'm1', description: 'Frango grelhado com arroz integral', meal_type: 'lunch',     calories: 520, protein: 42, carbs: 55, fat: 8,  time: '12:30', date: today() },
  { id: 'm2', description: 'Omelete de 4 ovos',                  meal_type: 'breakfast', calories: 320, protein: 28, carbs: 2,  fat: 22, time: '07:00', date: today() },
  { id: 'm3', description: 'Iogurte grego + banana',             meal_type: 'snack',     calories: 220, protein: 18, carbs: 28, fat: 4,  time: '10:00', date: today() },
  { id: 'm4', description: 'Whey protein + leite',               meal_type: 'post_workout', calories: 280, protein: 30, carbs: 20, fat: 5, time: '19:30', date: today() },
];

export const mockWorkoutPlans = [
  {
    id: 'plan-A',
    name: 'Treino A — Peito + Tríceps',
    plan_type: 'A',
    exercises: [
      { name: 'Supino Reto', sets: 4, reps: '10-12', weight_kg: 80, rest_seconds: 90 },
      { name: 'Crucifixo Inclinado', sets: 3, reps: '12', weight_kg: 22, rest_seconds: 60 },
      { name: 'Tríceps Corda', sets: 3, reps: '15', weight_kg: 35, rest_seconds: 60 },
      { name: 'Tríceps Testa', sets: 3, reps: '12', weight_kg: 30, rest_seconds: 60 },
    ],
  },
  {
    id: 'plan-B',
    name: 'Treino B — Costas + Bíceps',
    plan_type: 'B',
    exercises: [
      { name: 'Puxada Frontal', sets: 4, reps: '10-12', weight_kg: 70, rest_seconds: 90 },
      { name: 'Remada Curvada', sets: 4, reps: '10', weight_kg: 75, rest_seconds: 90 },
      { name: 'Rosca Direta', sets: 3, reps: '12', weight_kg: 40, rest_seconds: 60 },
      { name: 'Rosca Martelo', sets: 3, reps: '12', weight_kg: 18, rest_seconds: 60 },
    ],
  },
  {
    id: 'plan-C',
    name: 'Treino C — Pernas',
    plan_type: 'C',
    exercises: [
      { name: 'Agachamento Livre', sets: 5, reps: '8-10', weight_kg: 100, rest_seconds: 120 },
      { name: 'Leg Press 45°', sets: 4, reps: '12', weight_kg: 180, rest_seconds: 90 },
      { name: 'Cadeira Extensora', sets: 3, reps: '15', weight_kg: 60, rest_seconds: 60 },
      { name: 'Mesa Flexora', sets: 3, reps: '12', weight_kg: 50, rest_seconds: 60 },
    ],
  },
];

export const mockWorkoutSessions = [];

export const mockProgressSummary = {
  weight_history: [
    { date: '2024-10-01', weight: 84 },
    { date: '2024-11-01', weight: 82 },
    { date: '2024-12-01', weight: 81 },
    { date: '2025-01-01', weight: 79.5 },
    { date: '2025-02-01', weight: 78.5 },
    { date: today(),       weight: 78 },
  ],
  avg_weekly_calories: 2480,
  avg_weekly_protein: 158,
  avg_sleep_quality: 3.8,
  avg_energy_level: 3.5,
  workout_count_30d: 18,
  checkin_count_30d: 22,
  water_adherence_pct: 74,
};

export const mockWeeklySummary = {
  week: '2025-W08',
  generated_at: new Date().toISOString(),
  summary_text: '**Semana sólida, Rafael!** Você completou 4 dos 5 treinos planejados e ficou dentro da meta calórica em 5 dias. Destaque para a proteína — 158g/dia em média, acima dos 150g que consideramos o mínimo para seu objetivo de ganho de massa. Hidratação foi o ponto mais fraco: 74% da meta. Para a próxima semana, foque em atingir os 2,5L diários, principalmente nos dias de treino.',
  stats: {
    workouts_done: 4,
    workouts_planned: 5,
    avg_calories: 2480,
    avg_protein: 158,
    checkins: 5,
  },
};

export const mockMemoryFacts = [
  { id: 'fact-1', fact: 'Prefere treinar à tarde, às 18h.', category: 'rotina', created_at: '2025-01-15' },
  { id: 'fact-2', fact: 'Tem intolerância à lactose (evitar laticínios em excesso).', category: 'saude', created_at: '2025-01-16' },
  { id: 'fact-3', fact: 'Objetivo principal: ganhar 4kg de massa muscular até julho.', category: 'meta', created_at: '2025-01-20' },
];

export const mockChatThreads = [
  { id: 'thread-1', title: 'Conversa principal', created_at: new Date().toISOString() },
];

const welcomeMsg = () => {
  const h = new Date().getHours();
  const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const period = h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite';
  return `${g}, Rafael! Pronto pra mais uma boa ${period}? Estou aqui pra ajudar com treino, alimentação ou uma dose de motivação. O que você precisa?`;
};

export const mockChatMessages = {
  'thread-1': [
    {
      id: 'msg-1',
      role: 'assistant',
      content: welcomeMsg(),
      agent_id: 'companion',
      agent_name: 'Gymie',
      agent_color: '#00E04B',
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
  ],
};

// Respostas mock da IA por modo
export const mockAIResponses = {
  companion: [
    'Você está no caminho certo! Lembre-se: consistência supera intensidade. Cada dia conta.',
    'Com 12 dias de sequência, você já está construindo um hábito sólido. Continue assim!',
    'Sua progressão de carga no supino está excelente. O corpo está respondendo bem.',
  ],
  nutrition: [
    'Baseado no seu consumo hoje, ainda faltam **68g de proteína**. Uma boa opção seria um filé de frango (200g) com queijo cottage.',
    'Sua ingestão de carboidratos está ótima para o treino de hoje. Hidratação é o ponto de atenção.',
    'Para o pós-treino, whey + banana é uma combinação eficiente para recuperação muscular.',
  ],
  workout: [
    'No Treino B de hoje, foque em aumentar 2.5kg no supino. Você está pronto para essa progressão.',
    'Lembre-se de aquecer bem antes do agachamento — pelo menos 10 minutos de mobilidade.',
    'Sua recuperação entre as sessões parece boa pelo check-in de energia. Pode treinar em ritmo normal.',
  ],
};
