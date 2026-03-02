import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api';
import { Dumbbell, Plus, Play, Check, ChevronDown, ChevronUp, X, Clock, Trash2, Trophy, TrendingUp, Loader2, Info, Sparkles, Search } from 'lucide-react';
import exercises from '../data/exercises';
import exercisePack1000 from '../data/exercisePack1000';
import { useToast } from '../context/ToastContext';
import Confetti from '../components/Confetti';

const LIBRARY_PAGE_SIZE = 80;

function normalizeExerciseKey(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const mergedExerciseLookup = (() => {
  const map = {};

  exercisePack1000.forEach((item) => {
    const key = normalizeExerciseKey(item.name);
    if (!key) return;
    if (!map[key]) {
      map[key] = item;
      return;
    }
    const prev = map[key];
    map[key] = {
      ...prev,
      ...item,
      gifs: Array.from(new Set([...(prev.gifs || []), ...(item.gifs || [])])),
      instructions: prev.instructions?.length ? prev.instructions : (item.instructions || []),
      tips: prev.tips?.length ? prev.tips : (item.tips || []),
    };
  });

  Object.values(exercises).forEach((item) => {
    const key = normalizeExerciseKey(item.name);
    if (!key) return;
    if (!map[key]) {
      map[key] = item;
      return;
    }
    const prev = map[key];
    map[key] = {
      ...prev,
      ...item,
      gifs: Array.from(new Set([...(item.gifs || []), ...(prev.gifs || [])])),
      instructions: item.instructions?.length ? item.instructions : (prev.instructions || []),
      tips: item.tips?.length ? item.tips : (prev.tips || []),
    };
  });

  return map;
})();

const mergedExerciseCatalog = Object.values(mergedExerciseLookup).sort((a, b) => {
  const byGroup = (a.group || '').localeCompare(b.group || '', 'pt-BR');
  if (byGroup !== 0) return byGroup;
  return (a.name || '').localeCompare(b.name || '', 'pt-BR');
});

// Busca dados do exercÃ­cio pelo nome (com fuzzy matching)
function findExercise(name) {
  if (!name) return null;
  const key = normalizeExerciseKey(name);
  if (mergedExerciseLookup[key]) return mergedExerciseLookup[key];
  // Fuzzy: "Supino Reto" â†’ "Supino Reto com Barra", "Agachamento Livre com Barra" â†’ "Agachamento Livre"
  const allKeys = Object.keys(mergedExerciseLookup);
  const match = allKeys.find(k => k.startsWith(key) || key.startsWith(k + ' '));
  return match ? mergedExerciseLookup[match] : null;
}

// Templates de treino ABC gerados por "IA" (mock)
const AI_TEMPLATES = {
  'Ganho de massa': [
    {
      name: 'Treino A â€” Peito + TrÃ­ceps',
      plan_type: 'A',
      exercises: [
        { name: 'Supino Reto com Barra', sets: 4, reps: '8-10', weight_kg: 60, rest_seconds: 90 },
        { name: 'Supino Inclinado com Halteres', sets: 3, reps: '10-12', weight_kg: 22, rest_seconds: 75 },
        { name: 'Crucifixo Inclinado com Halteres', sets: 3, reps: '12', weight_kg: 14, rest_seconds: 60 },
        { name: 'TrÃ­ceps Testa com Barra', sets: 3, reps: '12', weight_kg: 20, rest_seconds: 60 },
        { name: 'Mergulho em Paralelas', sets: 3, reps: '10', weight_kg: 0, rest_seconds: 60 },
      ],
    },
    {
      name: 'Treino B â€” Costas + BÃ­ceps',
      plan_type: 'B',
      exercises: [
        { name: 'Barra Fixa Supinada', sets: 4, reps: '8', weight_kg: 0, rest_seconds: 90 },
        { name: 'Remada Alta com Barra', sets: 4, reps: '10', weight_kg: 50, rest_seconds: 75 },
        { name: 'Rosca Direta com Barra', sets: 3, reps: '10-12', weight_kg: 30, rest_seconds: 60 },
        { name: 'Rosca Martelo com Halteres', sets: 3, reps: '12', weight_kg: 14, rest_seconds: 60 },
      ],
    },
    {
      name: 'Treino C â€” Pernas + Ombros',
      plan_type: 'C',
      exercises: [
        { name: 'Agachamento Livre com Barra', sets: 4, reps: '8-10', weight_kg: 80, rest_seconds: 120 },
        { name: 'Leg Press 45', sets: 3, reps: '12', weight_kg: 160, rest_seconds: 90 },
        { name: 'Desenvolvimento com Barra', sets: 3, reps: '10', weight_kg: 40, rest_seconds: 75 },
        { name: 'ElevaÃ§Ã£o Lateral com Halteres', sets: 3, reps: '15', weight_kg: 10, rest_seconds: 60 },
      ],
    },
  ],
  'Emagrecimento': [
    {
      name: 'Treino A â€” Full Body Hiit',
      plan_type: 'A',
      exercises: [
        { name: 'Agachamento Livre com Barra', sets: 4, reps: '15', weight_kg: 40, rest_seconds: 45 },
        { name: 'Supino Reto com Barra', sets: 4, reps: '15', weight_kg: 40, rest_seconds: 45 },
        { name: 'Remada Alta com Barra', sets: 4, reps: '15', weight_kg: 30, rest_seconds: 45 },
        { name: 'FlexÃ£o de BraÃ§o', sets: 3, reps: '20', weight_kg: 0, rest_seconds: 30 },
      ],
    },
  ],
  'default': [
    {
      name: 'Treino A â€” Superior',
      plan_type: 'A',
      exercises: [
        { name: 'Supino Reto com Barra', sets: 3, reps: '12', weight_kg: 50, rest_seconds: 60 },
        { name: 'Remada Alta com Barra', sets: 3, reps: '12', weight_kg: 40, rest_seconds: 60 },
        { name: 'Desenvolvimento com Barra', sets: 3, reps: '12', weight_kg: 30, rest_seconds: 60 },
      ],
    },
  ],
};

function pickRandom(items, count) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, count));
}

function buildPlanExercise(entry, idx) {
  return {
    name: entry.name,
    sets: idx < 2 ? 4 : 3,
    reps: idx < 2 ? '8-12' : '10-15',
    weight_kg: 0,
    rest_seconds: idx < 2 ? 90 : 60,
  };
}

function selectByGroups(groups, count) {
  const normalizedGroups = groups.map(normalizeExerciseKey);
  const pool = mergedExerciseCatalog.filter((item) =>
    normalizedGroups.includes(normalizeExerciseKey(item.group))
  );
  const picked = pickRandom(pool, count);
  return picked.map(buildPlanExercise);
}

function buildAiTemplatesFromLibrary(goal) {
  if (goal === 'Emagrecimento') {
    return [
      {
        name: 'Treino A â€” Full Body + Cardio',
        plan_type: 'A',
        exercises: [
          ...selectByGroups(['Pernas', 'Membros Inferiores', 'GlÃºteos'], 2),
          ...selectByGroups(['Peitoral', 'Costas', 'Ombros'], 2),
          ...selectByGroups(['Cardio', 'Calistenia'], 2),
        ].slice(0, 6),
      },
    ];
  }

  return [
    {
      name: 'Treino A â€” Peito + TrÃ­ceps',
      plan_type: 'A',
      exercises: [
        ...selectByGroups(['Peitoral'], 3),
        ...selectByGroups(['TrÃ­ceps', 'Ombros'], 2),
      ].slice(0, 5),
    },
    {
      name: 'Treino B â€” Costas + BÃ­ceps',
      plan_type: 'B',
      exercises: [
        ...selectByGroups(['Costas', 'TrapÃ©zio'], 3),
        ...selectByGroups(['BÃ­ceps', 'AntebraÃ§o'], 2),
      ].slice(0, 5),
    },
    {
      name: 'Treino C â€” Pernas + Core',
      plan_type: 'C',
      exercises: [
        ...selectByGroups(['Pernas', 'Membros Inferiores', 'GlÃºteos', 'Panturrilhas'], 4),
        ...selectByGroups(['Abdominais', 'Lombar'], 1),
      ].slice(0, 5),
    },
  ];
}

export default function WorkoutPage() {
  const toast = useToast();
  const [confetti, setConfetti] = useState(false);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('plans');
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', plan_type: 'A', exercises: [] });
  const [newExercise, setNewExercise] = useState({ name: '', sets: 3, reps: '12', weight_kg: 0, rest_seconds: 60 });
  const [restTimer, setRestTimer] = useState(null); // { total, remaining, exName }
  const restIntervalRef = useRef(null);
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseInfo, setExerciseInfo] = useState(null); // instruÃ§Ãµes
  const [generatingAI, setGeneratingAI] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryGroup, setLibraryGroup] = useState('');
  const [libraryLimit, setLibraryLimit] = useState(LIBRARY_PAGE_SIZE);
  const [showPlanLibraryPicker, setShowPlanLibraryPicker] = useState(false);
  const [planLibrarySearch, setPlanLibrarySearch] = useState('');
  const [planLibraryGroup, setPlanLibraryGroup] = useState('');
  const [planLibraryLimit, setPlanLibraryLimit] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, sessionsRes] = await Promise.all([
        api.get('/api/workout-plans'),
        api.get('/api/workout-sessions'),
      ]);
      setPlans(plansRes.data.plans || []);
      const allSessions = sessionsRes.data.sessions || [];
      setSessions(allSessions);
      const active = allSessions.find((s) => s.status === 'active');
      if (active) { setActiveSession(active); setTab('session'); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cleanup rest timer on unmount
  useEffect(() => () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); }, []);

  const startRestTimer = (seconds, exName) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestTimer({ total: seconds, remaining: seconds, exName });
    restIntervalRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev || prev.remaining <= 1) {
          clearInterval(restIntervalRef.current);
          navigator.vibrate?.([100, 50, 100]);
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  };

  const skipRestTimer = () => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestTimer(null);
  };

  const fetchExerciseHistory = async (exerciseName) => {
    try {
      const res = await api.get(`/api/progress/exercise-history?exercise_name=${encodeURIComponent(exerciseName)}`);
      setExerciseHistory(res.data);
      setSelectedExercise(exerciseName);
    } catch (err) { console.error(err); }
  };

  const startSession = async (planId) => {
    try {
      const res = await api.post('/api/workout-sessions', { plan_id: planId });
      setActiveSession(res.data);
      setTab('session');
    } catch (err) { console.error(err); }
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setActiveSession((prev) => {
      const exercises = [...prev.exercises];
      const sets = [...exercises[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      exercises[exIdx] = { ...exercises[exIdx], sets };
      return { ...prev, exercises };
    });
  };

  const adjustSetRepsRT = (exIdx, setIdx, delta) => {
    const current = parseInt(activeSession?.exercises?.[exIdx]?.sets?.[setIdx]?.reps, 10) || 0;
    const next = Math.max(0, current + delta);
    updateSet(exIdx, setIdx, 'reps', next);
    if (delta > 0) navigator.vibrate?.(12);
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    navigator.vibrate?.(25);
    // Capture before state update to know direction and rest time
    const wasCompleted = activeSession?.exercises[exIdx]?.sets[setIdx]?.completed;
    const restSeconds = activeSession?.exercises[exIdx]?.rest_seconds || 60;
    const exName = activeSession?.exercises[exIdx]?.name || '';
    setActiveSession((prev) => {
      const exercises = [...prev.exercises];
      const sets = [...exercises[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], completed: !sets[setIdx].completed };
      exercises[exIdx] = { ...exercises[exIdx], sets };
      return { ...prev, exercises };
    });
    // Start rest timer only when completing (not uncompleting)
    if (!wasCompleted) startRestTimer(restSeconds, exName);
  };

  const completeSession = async () => {
    if (!activeSession) return;
    try {
      await api.put(`/api/workout-sessions/${activeSession.id}`, { exercises: activeSession.exercises });
      await api.post(`/api/workout-sessions/${activeSession.id}/complete`);
      navigator.vibrate?.([60, 30, 120, 30, 60]); // celebraÃ§Ã£o hÃ¡ptica
      setConfetti(true);
      toast('Treino finalizado! IncrÃ­vel! ðŸ†', 'success', 3500);
      setActiveSession(null);
      setTab('history');
      fetchData();
    } catch (err) { console.error(err); toast('Erro ao finalizar treino', 'error'); }
  };

  const addExerciseToPlan = () => {
    if (!newExercise.name) return;
    setNewPlan((prev) => ({ ...prev, exercises: [...prev.exercises, { ...newExercise, weight_kg: parseFloat(newExercise.weight_kg) || 0 }] }));
    setNewExercise({ name: '', sets: 3, reps: '12', weight_kg: 0, rest_seconds: 60 });
  };

  const addExerciseFromLibrary = (exercise) => {
    const payload = {
      name: exercise.name,
      sets: parseInt(newExercise.sets, 10) || 3,
      reps: newExercise.reps || '12',
      weight_kg: parseFloat(newExercise.weight_kg) || 0,
      rest_seconds: parseInt(newExercise.rest_seconds, 10) || 60,
    };
    setNewPlan((prev) => ({ ...prev, exercises: [...prev.exercises, payload] }));
    toast(`"${exercise.name}" adicionado ao plano`, 'success');
  };

  const createPlanFromLibraryExercise = (exercise) => {
    if (!exercise?.name) return;
    setNewPlan({
      name: `Plano ${exercise.group || 'Biblioteca'}`,
      plan_type: 'A',
      exercises: [
        {
          name: exercise.name,
          sets: 3,
          reps: '12',
          weight_kg: 0,
          rest_seconds: 60,
        },
      ],
    });
    setNewExercise({ name: '', sets: 3, reps: '12', weight_kg: 0, rest_seconds: 60 });
    setShowAddPlan(true);
    setShowPlanLibraryPicker(true);
    setPlanLibrarySearch('');
    setPlanLibraryGroup(exercise.group || '');
    setExerciseInfo(null);
    toast(`Plano iniciado com "${exercise.name}"`, 'success');
  };

  const savePlan = async () => {
    if (!newPlan.name || newPlan.exercises.length === 0) return;
    try {
      await api.post('/api/workout-plans', newPlan);
      setShowAddPlan(false);
      setNewPlan({ name: '', plan_type: 'A', exercises: [] });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deletePlan = async (planId) => {
    try {
      await api.delete(`/api/workout-plans/${planId}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const generateAIPlans = async () => {
    setGeneratingAI(true);
    await new Promise((r) => setTimeout(r, 1200));
    const stored = localStorage.getItem('gymie_measurements');
    const goal = stored ? JSON.parse(stored)?.goal : null;
    const generated = buildAiTemplatesFromLibrary(goal);
    const fallback = AI_TEMPLATES[goal] || AI_TEMPLATES.default;
    const templates = generated.every((t) => (t.exercises || []).length >= 3) ? generated : fallback;
    try {
      for (const t of templates) {
        await api.post('/api/workout-plans', t);
      }
      fetchData();
      toast(`Treino ABC gerado para "${goal || 'vocÃª'}" usando a biblioteca da IA! ðŸ’ª`, 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar treino', 'error'); }
    setGeneratingAI(false);
    setShowAddPlan(false);
  };

  const completedToday = sessions.filter((s) => s.status === 'completed' && s.date === new Date().toISOString().split('T')[0]);

  // Biblioteca â€” dados derivados
  const allExercises = useMemo(() => mergedExerciseCatalog, []);
  const libraryGroups = useMemo(() => (
    [...new Set(allExercises.map((e) => e.group).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  ), [allExercises]);
  const filteredExercises = useMemo(() => {
    const searchKey = normalizeExerciseKey(librarySearch);
    return allExercises.filter((ex) => {
      const nameKey = normalizeExerciseKey(ex.name);
      const groupKey = normalizeExerciseKey(ex.group);
      const matchSearch = !searchKey || nameKey.includes(searchKey) || groupKey.includes(searchKey);
      const matchGroup = !libraryGroup || ex.group === libraryGroup;
      return matchSearch && matchGroup;
    });
  }, [allExercises, librarySearch, libraryGroup]);
  const visibleExercises = useMemo(
    () => filteredExercises.slice(0, libraryLimit),
    [filteredExercises, libraryLimit]
  );
  const libraryMediaCount = useMemo(
    () => allExercises.reduce((acc, ex) => acc + (ex.gifs?.length || 0), 0),
    [allExercises]
  );
  const planLibraryFiltered = useMemo(() => {
    const searchKey = normalizeExerciseKey(planLibrarySearch);
    return allExercises.filter((ex) => {
      const nameKey = normalizeExerciseKey(ex.name);
      const groupKey = normalizeExerciseKey(ex.group);
      const matchSearch = !searchKey || nameKey.includes(searchKey) || groupKey.includes(searchKey);
      const matchGroup = !planLibraryGroup || ex.group === planLibraryGroup;
      return matchSearch && matchGroup;
    });
  }, [allExercises, planLibrarySearch, planLibraryGroup]);
  const planLibraryVisible = useMemo(
    () => planLibraryFiltered.slice(0, planLibraryLimit),
    [planLibraryFiltered, planLibraryLimit]
  );

  useEffect(() => {
    setLibraryLimit(LIBRARY_PAGE_SIZE);
  }, [librarySearch, libraryGroup]);

  useEffect(() => {
    setPlanLibraryLimit(30);
  }, [planLibrarySearch, planLibraryGroup]);

  useEffect(() => {
    if (showAddPlan) return;
    setShowPlanLibraryPicker(false);
    setPlanLibrarySearch('');
    setPlanLibraryGroup('');
  }, [showAddPlan]);

  if (loading) return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-2">
          <div className="skeleton h-7 w-24" />
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="skeleton w-10 h-10 rounded-gymie-sm" />
      </div>
      <div className="flex gap-2">
        {[0,1,2].map(i => <div key={i} className="skeleton h-8 w-20 rounded-full" />)}
      </div>
      {[0,1,2].map(i => <div key={i} className="skeleton h-20 w-full rounded-gymie" />)}
    </div>
  );

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      {/* Confetti celebration */}
      <Confetti active={confetti} onComplete={() => setConfetti(false)} />

      {/* Rest Timer â€” fixed above BottomNav */}
      {restTimer && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-[90]">
          <div className="gymie-card p-4 flex items-center gap-4 border-purple-400/30 shadow-xl animate-slide-up bg-surface/95 backdrop-blur-sm">
            {/* Circular countdown SVG */}
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="28" cy="28" r="22" fill="none" stroke="#1A1A1A" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="22"
                  fill="none"
                  stroke="#A855F7"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={138.23}
                  strokeDashoffset={138.23 * (1 - restTimer.remaining / restTimer.total)}
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-400 font-data">{restTimer.remaining}s</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-txt-primary">Descanso</p>
              <p className="text-xs text-txt-muted truncate">{restTimer.exName}</p>
            </div>
            <button
              onClick={skipRestTimer}
              className="gymie-chip text-xs border-purple-400/30 text-purple-400 flex-shrink-0"
            >
              Pular
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-txt-primary">Treino</h1>
          <p className="text-xs text-txt-muted">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        <button 
          data-testid="add-plan-btn" 
          onClick={() => setShowAddPlan(true)} 
          className="gymie-btn-secondary p-2.5 border-purple-400/30 text-purple-400"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'plans', label: 'Planos' },
          { id: 'session', label: 'SessÃ£o', disabled: !activeSession, badge: activeSession },
          { id: 'history', label: 'HistÃ³rico' },
          { id: 'library', label: 'Biblioteca' },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`workout-tab-${t.id}`}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            className={`gymie-chip ${
              tab === t.id ? 'gymie-chip-active border-purple-400/40 text-purple-400 bg-purple-400/15' : 
              t.disabled ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {t.label}
            {t.badge && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div className="space-y-3 animate-fade-in">
          {plans.length === 0 ? (
            <div className="text-center py-10 animate-fade-in">
              <div className="text-6xl mb-4">ðŸ’ª</div>
              <h3 className="text-lg font-semibold text-txt-primary mb-1">Pronto pra treinar?</h3>
              <p className="text-sm text-txt-muted mb-6 max-w-[260px] mx-auto">
                Crie seu plano ou deixe a IA montar um ABC automÃ¡tico usando a nova biblioteca com {allExercises.length} exercÃ­cios em GIF.
              </p>
              <button
                onClick={generateAIPlans}
                disabled={generatingAI}
                className="gymie-btn-primary px-6 py-2.5 mb-3 w-full flex items-center justify-center gap-2"
              >
                {generatingAI
                  ? <><Loader2 size={14} className="animate-spin" /> Gerando treino...</>
                  : <><Sparkles size={14} /> Gerar plano com IA</>}
              </button>
              <button
                onClick={() => setShowAddPlan(true)}
                className="w-full text-sm text-txt-muted hover:text-txt-secondary transition-colors py-2"
              >
                Ou criar plano manualmente â†’
              </button>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} data-testid={`plan-card-${plan.plan_type}`} className="gymie-card overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-hl transition-colors"
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                >
                  <div className="w-11 h-11 rounded-gymie-sm bg-purple-400/10 flex items-center justify-center font-bold text-lg text-purple-400">
                    {plan.plan_type}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-txt-primary">{plan.name}</p>
                    <p className="text-xs text-txt-muted">{plan.exercises.length} exercÃ­cios</p>
                  </div>
                  <button
                    data-testid={`start-plan-${plan.plan_type}`}
                    onClick={(e) => { e.stopPropagation(); startSession(plan.id); }}
                    className="gymie-btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
                  >
                    <Play size={12} /> Iniciar
                  </button>
                  {expandedPlan === plan.id ? <ChevronUp size={16} className="text-txt-muted" /> : <ChevronDown size={16} className="text-txt-muted" />}
                </div>
                {expandedPlan === plan.id && (
                  <div className="border-t border-border-subtle px-4 py-3 space-y-2 bg-surface-hl/50">
                    {plan.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-txt-primary">{ex.name}</p>
                          {findExercise(ex.name) && (
                            <button
                              onClick={() => setExerciseInfo(findExercise(ex.name))}
                              className="text-txt-disabled hover:text-gymie transition-colors"
                            >
                              <Info size={12} />
                            </button>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs font-data text-txt-muted">
                          <span>{ex.sets}x{ex.reps}</span>
                          {ex.weight_kg > 0 && <span>{ex.weight_kg}kg</span>}
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => deletePlan(plan.id)} 
                      className="flex items-center gap-1 text-danger text-xs mt-2 hover:opacity-80"
                    >
                      <Trash2 size={12} /> Excluir plano
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Session Tab */}
      {tab === 'session' && activeSession && (
        <div className="space-y-4 animate-fade-in">
          {/* Session Header */}
          <div className="gymie-card p-4 border-l-4 border-l-purple-400">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell size={14} className="text-purple-400" />
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">{activeSession.plan_name}</span>
            </div>
            <p className="text-xs text-txt-muted">SessÃ£o em andamento</p>
          </div>

          {/* Exercises */}
          {activeSession.exercises.map((ex, exIdx) => {
            const allDone = ex.sets.every((s) => s.completed);
            const repsDone = ex.sets.reduce((acc, s) => acc + (parseInt(s.reps, 10) || 0), 0);
            return (
              <div 
                key={exIdx} 
                data-testid={`session-exercise-${exIdx}`} 
                className={`gymie-card p-4 ${allDone ? 'border-purple-400/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`font-semibold ${allDone ? 'text-purple-400' : 'text-txt-primary'}`}>{ex.name}</p>
                    <p className="text-[11px] text-txt-muted">{ex.target_sets}x{ex.target_reps} â€¢ Descanso: {ex.rest_seconds}s â€¢ RT: {repsDone} reps</p>
                  </div>
                  {allDone && <Check size={18} className="text-purple-400" />}
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-txt-muted uppercase tracking-wider px-1">
                    <span>SÃ©rie</span><span>Reps RT</span><span>Peso</span><span></span>
                  </div>
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                      <span className="text-xs text-txt-muted text-center font-data">{set.set_number}</span>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => adjustSetRepsRT(exIdx, setIdx, -1)}
                          className="w-7 h-7 rounded-gymie-sm bg-surface-hl text-txt-muted hover:bg-surface-elevated"
                          title="Diminuir repetiÃ§Ã£o"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={set.reps || 0}
                          onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value, 10) || 0)}
                          className="gymie-input py-1.5 px-1 text-center text-sm w-12"
                        />
                        <button
                          onClick={() => adjustSetRepsRT(exIdx, setIdx, 1)}
                          className="w-7 h-7 rounded-gymie-sm bg-gymie/20 text-gymie hover:bg-gymie/30"
                          title="Adicionar repetiÃ§Ã£o"
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="number"
                        value={set.weight_kg || ''}
                        onChange={(e) => updateSet(exIdx, setIdx, 'weight_kg', parseFloat(e.target.value) || 0)}
                        className="gymie-input py-1.5 text-center text-sm"
                      />
                      <button
                        onClick={() => toggleSetComplete(exIdx, setIdx)}
                        className={`p-2 rounded-gymie-sm transition-all ${
                          set.completed 
                            ? 'bg-purple-400/20 text-purple-400' 
                            : 'bg-surface-hl text-txt-muted hover:bg-surface-elevated'
                        }`}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => fetchExerciseHistory(ex.name)}
                    className="flex-1 py-2 text-xs text-txt-muted hover:text-purple-400 flex items-center justify-center gap-1 transition-colors border border-border-subtle rounded-gymie-sm"
                  >
                    <TrendingUp size={12} /> HistÃ³rico
                  </button>
                  {findExercise(ex.name) && (
                    <button
                      onClick={() => setExerciseInfo(findExercise(ex.name))}
                      className="flex-1 py-2 text-xs text-txt-muted hover:text-gymie flex items-center justify-center gap-1 transition-colors border border-border-subtle rounded-gymie-sm"
                    >
                      <Info size={12} /> InstruÃ§Ãµes
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Complete Button - Sticky */}
          <div className="sticky bottom-20 pt-4">
            <button
              data-testid="complete-session"
              onClick={completeSession}
              className="w-full gymie-btn-primary py-4 flex items-center justify-center gap-2 text-base"
            >
              <Trophy size={18} /> Finalizar treino
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-3 animate-fade-in">
          {sessions.filter(s => s.status === 'completed').length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hl flex items-center justify-center">
                <Clock size={28} className="text-txt-muted" />
              </div>
              <p className="text-txt-secondary">Nenhum treino concluÃ­do</p>
              <p className="text-xs text-txt-muted mt-1">Finalize uma sessÃ£o para ver o histÃ³rico</p>
            </div>
          ) : (
            sessions.filter(s => s.status === 'completed').slice(0, 20).map((s) => {
              const completedSets = s.exercises.reduce((a, e) => a + e.sets.filter(st => st.completed).length, 0);
              const totalSets    = s.exercises.reduce((a, e) => a + e.sets.length, 0);
              const isExpanded   = expandedHistory === s.id;
              return (
                <div key={s.id} className="gymie-card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-hl transition-colors"
                    onClick={() => setExpandedHistory(isExpanded ? null : s.id)}
                  >
                    <div className="w-9 h-9 rounded-gymie-sm bg-success/10 flex items-center justify-center flex-shrink-0">
                      <Check size={14} className="text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-txt-primary truncate">{s.plan_name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-txt-muted font-data">{s.date}</span>
                        <span className="text-[11px] text-txt-muted">{completedSets}/{totalSets} sÃ©ries</span>
                        <span className="text-[11px] text-txt-muted">{s.exercises.length} ex.</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-txt-muted flex-shrink-0" /> : <ChevronDown size={16} className="text-txt-muted flex-shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border-subtle px-4 py-3 space-y-2 bg-surface-hl/40">
                      {s.exercises.map((ex, i) => {
                        const done = ex.sets.filter(st => st.completed);
                        const maxWeight = Math.max(...ex.sets.map(st => st.weight_kg || 0), 0);
                        return (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${done.length === ex.sets.length ? 'bg-success' : 'bg-txt-disabled'}`} />
                              <p className="text-sm text-txt-primary">{ex.name}</p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-data text-txt-muted">
                              <span>{done.length}/{ex.sets.length} sÃ©ries</span>
                              {maxWeight > 0 && <span className="text-txt-secondary">{maxWeight}kg</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Library Tab */}
      {tab === 'library' && (
        <div className="animate-fade-in">
          {/* IA + volume da biblioteca */}
          <div className="gymie-card-elevated p-4 mb-4 border-gymie/25 bg-gradient-to-br from-gymie/10 via-gymie/5 to-surface">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-gymie-sm bg-gymie/20 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-gymie" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-txt-primary">Biblioteca da IA ({allExercises.length} exercÃ­cios)</p>
                <p className="text-xs text-txt-secondary mt-1 leading-relaxed">
                  O Gymie usa esta base para sugerir substituiÃ§Ãµes e gerar treinos/planos automaticamente.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-surface-hl rounded-gymie-sm p-2 text-center">
                <p className="text-sm font-bold font-data text-gymie">{allExercises.length}</p>
                <p className="text-[10px] text-txt-muted">ExercÃ­cios</p>
              </div>
              <div className="bg-surface-hl rounded-gymie-sm p-2 text-center">
                <p className="text-sm font-bold font-data text-gymie">{libraryGroups.length}</p>
                <p className="text-[10px] text-txt-muted">Grupos</p>
              </div>
              <div className="bg-surface-hl rounded-gymie-sm p-2 text-center">
                <p className="text-sm font-bold font-data text-gymie">{libraryMediaCount}</p>
                <p className="text-[10px] text-txt-muted">MÃ­dias</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none" />
            <input
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Buscar por exercÃ­cio ou grupo..."
              className="w-full gymie-input pl-9"
            />
          </div>

          {/* Group filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
            {['', ...libraryGroups].map((g) => (
              <button
                key={g || '__all__'}
                onClick={() => setLibraryGroup(g)}
                className={`gymie-chip flex-shrink-0 ${
                  libraryGroup === g
                    ? 'gymie-chip-active border-gymie/40 text-gymie bg-gymie/15'
                    : ''
                }`}
              >
                {g || 'Todos'}
              </button>
            ))}
          </div>

          {/* Exercise grid */}
          {filteredExercises.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">ðŸ”</div>
              <p className="text-txt-muted text-sm">Nenhum exercÃ­cio encontrado</p>
              <p className="text-[11px] text-txt-disabled mt-1">Tente outro termo ou limpe o filtro por grupo</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {visibleExercises.map((ex, idx) => (
                <button
                  key={`${ex.group}-${ex.name}-${idx}`}
                  onClick={() => setExerciseInfo(ex)}
                  className="gymie-card p-0 text-left hover:border-gymie/30 transition-all overflow-hidden"
                >
                  {/* GIF preview */}
                  <div className="w-full h-28 bg-surface-hl overflow-hidden">
                    {ex.gifs?.length > 0 ? (
                      <img
                        src={ex.gifs[0]}
                        alt={ex.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Dumbbell size={28} className="text-txt-disabled" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-txt-primary leading-snug mb-1.5 line-clamp-2">{ex.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-medium text-gymie bg-gymie/10 px-1.5 py-0.5 rounded-full">{ex.group}</span>
                      <span className="text-[9px] text-txt-disabled">{ex.difficulty}</span>
                    </div>
                  </div>
                </button>
                ))}
              </div>
              {filteredExercises.length > visibleExercises.length && (
                <button
                  onClick={() => setLibraryLimit((prev) => prev + LIBRARY_PAGE_SIZE)}
                  className="w-full mt-4 py-2.5 gymie-btn-secondary border-gymie/30 text-gymie text-sm"
                >
                  Carregar mais ({visibleExercises.length}/{filteredExercises.length})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Exercise History Modal */}
      {selectedExercise && exerciseHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end" onClick={() => setSelectedExercise(null)}>
          <div 
            className="w-full max-w-md mx-auto bg-surface rounded-t-gymie-lg p-6 pb-safe animate-slide-up max-h-[70vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedExercise}</h3>
              <button onClick={() => setSelectedExercise(null)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>
            {exerciseHistory.history?.length > 0 ? (
              <div className="space-y-3">
                {exerciseHistory.history.slice(0, 5).map((h, i) => (
                  <div key={i} className="gymie-card p-3">
                    <p className="text-xs text-txt-muted mb-2">{h.date}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-txt-secondary">Peso: <span className="text-txt-primary font-semibold">{h.max_weight}kg</span></span>
                      <span className="text-txt-secondary">Reps: <span className="text-txt-primary font-semibold">{h.total_reps}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-txt-muted py-8">Sem histÃ³rico</p>
            )}
          </div>
        </div>
      )}

      {/* Exercise Instructions Modal */}
      {exerciseInfo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-end" onClick={() => setExerciseInfo(null)}>
          <div
            className="w-full max-w-md mx-auto bg-surface rounded-t-gymie-lg p-6 pb-safe animate-slide-up max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-txt-primary">{exerciseInfo.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gymie">{exerciseInfo.group}</span>
                  <span className="text-txt-muted">Â·</span>
                  <span className="text-xs text-txt-muted">{exerciseInfo.difficulty}</span>
                </div>
              </div>
              <button onClick={() => setExerciseInfo(null)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>

            {/* GIF demonstraÃ§Ã£o */}
            {exerciseInfo.gifs?.length > 0 && (
              <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
                {exerciseInfo.gifs.slice(0, 2).map((gif, i) => (
                  <img
                    key={i}
                    src={gif}
                    alt={`${exerciseInfo.name} - view ${i + 1}`}
                    className="h-40 w-auto rounded-gymie object-cover flex-shrink-0 bg-surface-hl"
                  />
                ))}
              </div>
            )}

            {/* Como executar */}
            {exerciseInfo.instructions?.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gymie mb-3">Como executar</p>
                <ol className="space-y-2">
                  {exerciseInfo.instructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-txt-secondary">
                      <span className="w-5 h-5 rounded-full bg-gymie/15 text-gymie flex-shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Dicas */}
            {exerciseInfo.tips?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-txt-muted mb-3">Dicas</p>
                <ul className="space-y-2">
                  {exerciseInfo.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-txt-muted flex gap-2">
                      <span className="text-gymie mt-0.5">-</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border-subtle">
              <button
                onClick={() => createPlanFromLibraryExercise(exerciseInfo)}
                className="w-full gymie-btn-primary flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Adicionar ao treino agora
              </button>
              <p className="text-[11px] text-txt-muted text-center mt-2">
                Cria um novo plano ja com este exercicio e abre a biblioteca para continuar montando.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end" onClick={() => setShowAddPlan(false)}>
          <div 
            className="w-full max-w-md mx-auto bg-surface rounded-t-gymie-lg p-6 pb-safe animate-slide-up max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Novo plano</h3>
              <button onClick={() => setShowAddPlan(false)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>

            {/* Gerar com IA */}
            <button
              onClick={generateAIPlans}
              disabled={generatingAI}
              className="w-full mb-5 py-3 px-4 border border-gymie/30 bg-gymie/5 text-gymie rounded-gymie flex items-center justify-center gap-2 text-sm font-medium hover:bg-gymie/10 transition-all disabled:opacity-60"
            >
              {generatingAI
                ? <><Loader2 size={16} className="animate-spin" /> Gerando treino ABC com IA...</>
                : <><Sparkles size={16} /> Gerar Treino ABC com IA</>
              }
            </button>
            <p className="text-[11px] text-txt-muted text-center -mt-3 mb-4">
              A IA usa a biblioteca de exercÃ­cios em GIF para montar o plano automaticamente.
            </p>
            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 h-px bg-border-default" />
              <span className="text-xs text-txt-muted">ou crie manualmente</span>
              <div className="flex-1 h-px bg-border-default" />
            </div>

            <div className="space-y-4">
              {/* Plan name and type */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-txt-muted uppercase tracking-wider mb-2 block">Nome</label>
                  <input
                    data-testid="plan-name"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    className="w-full gymie-input"
                    placeholder="Ex: Peito e TrÃ­ceps"
                  />
                </div>
                <div>
                  <label className="text-xs text-txt-muted uppercase tracking-wider mb-2 block">Tipo</label>
                  <div className="flex gap-1">
                    {['A', 'B', 'C'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewPlan({ ...newPlan, plan_type: t })}
                        className={`w-10 h-11 rounded-gymie-sm font-bold transition-all ${
                          newPlan.plan_type === t 
                            ? 'bg-purple-400/20 border border-purple-400/40 text-purple-400' 
                            : 'bg-surface-hl text-txt-muted'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add exercise */}
              <div className="p-4 bg-surface-hl rounded-gymie">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-txt-muted uppercase tracking-wider">Adicionar exercÃ­cio</p>
                  <button
                    type="button"
                    onClick={() => setShowPlanLibraryPicker((v) => !v)}
                    className="text-[11px] text-gymie hover:opacity-80 transition-opacity"
                  >
                    {showPlanLibraryPicker ? 'Fechar biblioteca' : 'Escolher da biblioteca'}
                  </button>
                </div>

                {showPlanLibraryPicker && (
                  <div className="mb-3 p-3 rounded-gymie-sm border border-border-subtle bg-surface">
                    <div className="relative mb-2">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none" />
                      <input
                        value={planLibrarySearch}
                        onChange={(e) => setPlanLibrarySearch(e.target.value)}
                        placeholder="Buscar exercÃ­cio da biblioteca..."
                        className="w-full gymie-input pl-8 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
                      {['', ...libraryGroups].map((g) => (
                        <button
                          key={`plan-lib-${g || 'all'}`}
                          onClick={() => setPlanLibraryGroup(g)}
                          className={`gymie-chip flex-shrink-0 text-[10px] ${planLibraryGroup === g ? 'gymie-chip-active border-gymie/40 text-gymie bg-gymie/15' : ''}`}
                        >
                          {g || 'Todos'}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {planLibraryVisible.map((ex, idx) => (
                        <div key={`plan-lib-item-${idx}-${ex.name}`} className="flex items-center gap-2 p-2 rounded-gymie-sm bg-surface-hl">
                          <div className="w-10 h-10 rounded-gymie-sm overflow-hidden bg-bg flex-shrink-0">
                            {ex.gifs?.[0]
                              ? <img src={ex.gifs[0]} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                              : <div className="w-full h-full flex items-center justify-center"><Dumbbell size={12} className="text-txt-disabled" /></div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-txt-primary truncate">{ex.name}</p>
                            <p className="text-[10px] text-txt-muted">{ex.group}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addExerciseFromLibrary(ex)}
                            className="gymie-btn-secondary py-1 px-2 text-[11px]"
                          >
                            <Plus size={12} className="inline mr-1" /> Add
                          </button>
                        </div>
                      ))}
                    </div>
                    {planLibraryFiltered.length > planLibraryVisible.length && (
                      <button
                        type="button"
                        onClick={() => setPlanLibraryLimit((prev) => prev + 30)}
                        className="w-full mt-2 text-[11px] text-gymie hover:opacity-80"
                      >
                        Carregar mais ({planLibraryVisible.length}/{planLibraryFiltered.length})
                      </button>
                    )}
                  </div>
                )}

                <input
                  data-testid="exercise-name"
                  value={newExercise.name}
                  onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                  className="w-full gymie-input mb-3"
                  placeholder="Nome do exercÃ­cio"
                />
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] text-txt-muted mb-1 block">SÃ©ries</label>
                    <input
                      type="number"
                      value={newExercise.sets}
                      onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) || 0 })}
                      className="w-full gymie-input py-2 text-center text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-txt-muted mb-1 block">Reps</label>
                    <input
                      value={newExercise.reps}
                      onChange={(e) => setNewExercise({ ...newExercise, reps: e.target.value })}
                      className="w-full gymie-input py-2 text-center text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-txt-muted mb-1 block">Peso</label>
                    <input
                      type="number"
                      value={newExercise.weight_kg}
                      onChange={(e) => setNewExercise({ ...newExercise, weight_kg: e.target.value })}
                      className="w-full gymie-input py-2 text-center text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-txt-muted mb-1 block">Desc.</label>
                    <input
                      type="number"
                      value={newExercise.rest_seconds}
                      onChange={(e) => setNewExercise({ ...newExercise, rest_seconds: parseInt(e.target.value) || 60 })}
                      className="w-full gymie-input py-2 text-center text-sm"
                    />
                  </div>
                </div>
                <button
                  data-testid="add-exercise"
                  onClick={addExerciseToPlan}
                  disabled={!newExercise.name}
                  className="w-full gymie-btn-secondary py-2 text-sm disabled:opacity-40"
                >
                  <Plus size={14} className="inline mr-1" /> Adicionar
                </button>
              </div>

              {/* Exercise list */}
              {newPlan.exercises.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-txt-muted uppercase tracking-wider">ExercÃ­cios ({newPlan.exercises.length})</p>
                  {newPlan.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-hl rounded-gymie-sm">
                      <span className="text-sm text-txt-primary">{ex.name}</span>
                      <span className="text-xs text-txt-muted">{ex.sets}x{ex.reps} @ {ex.weight_kg}kg</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                data-testid="save-plan"
                onClick={savePlan}
                disabled={!newPlan.name || newPlan.exercises.length === 0}
                className="w-full gymie-btn-primary disabled:opacity-40"
              >
                Salvar plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

