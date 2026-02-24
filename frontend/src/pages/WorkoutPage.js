import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Dumbbell, Plus, Play, Check, ChevronDown, ChevronUp, X, Clock, Weight, RotateCcw, Trophy, TrendingUp } from 'lucide-react';

export default function WorkoutPage() {
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('plans');
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', plan_type: 'A', exercises: [] });
  const [newExercise, setNewExercise] = useState({ name: '', sets: 3, reps: '12', weight_kg: 0, rest_seconds: 60 });
  const [exerciseHistory, setExerciseHistory] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);

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

  const toggleSetComplete = (exIdx, setIdx) => {
    setActiveSession((prev) => {
      const exercises = [...prev.exercises];
      const sets = [...exercises[exIdx].sets];
      sets[setIdx] = { ...sets[setIdx], completed: !sets[setIdx].completed };
      exercises[exIdx] = { ...exercises[exIdx], sets };
      return { ...prev, exercises };
    });
  };

  const saveSession = async () => {
    if (!activeSession) return;
    try {
      await api.put(`/api/workout-sessions/${activeSession.id}`, {
        exercises: activeSession.exercises,
      });
    } catch (err) { console.error(err); }
  };

  const completeSession = async () => {
    if (!activeSession) return;
    try {
      await api.put(`/api/workout-sessions/${activeSession.id}`, { exercises: activeSession.exercises });
      await api.post(`/api/workout-sessions/${activeSession.id}/complete`);
      setActiveSession(null);
      setTab('plans');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const addExerciseToPlan = () => {
    if (!newExercise.name) return;
    setNewPlan((prev) => ({ ...prev, exercises: [...prev.exercises, { ...newExercise, weight_kg: parseFloat(newExercise.weight_kg) || 0 }] }));
    setNewExercise({ name: '', sets: 3, reps: '12', weight_kg: 0, rest_seconds: 60 });
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

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const completedToday = sessions.filter((s) => s.status === 'completed' && s.date === new Date().toISOString().split('T')[0]);
  const totalCompleted = completedToday.reduce((acc, s) => {
    const total = s.exercises.reduce((a, e) => a + e.sets.filter((st) => st.completed).length, 0);
    return acc + total;
  }, 0);

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Treino</h1>
          <p className="text-xs text-txt-muted font-data">{new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <button data-testid="add-plan-btn" onClick={() => setShowAddPlan(true)} className="bg-purple-500/20 border border-purple-500/30 text-purple-400 p-2.5 hover:bg-purple-500/30 active:scale-95 transition-all">
          <Plus size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'plans', label: 'Planos' },
          { id: 'session', label: 'Sessao Ativa', disabled: !activeSession },
          { id: 'history', label: 'Historico' },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`workout-tab-${t.id}`}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            className={`px-3 py-1.5 text-xs font-ui uppercase tracking-wider border transition-all ${
              tab === t.id ? 'border-purple-400 bg-purple-400/10 text-purple-400' : t.disabled ? 'border-border-default text-txt-muted/30 cursor-not-allowed' : 'border-border-default text-txt-muted hover:border-txt-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div className="space-y-3 animate-fade-in">
          {plans.length === 0 ? (
            <div className="text-center py-12">
              <Dumbbell size={32} className="text-txt-muted mx-auto mb-3" strokeWidth={1} />
              <p className="text-sm text-txt-muted">Nenhum plano criado.</p>
              <button onClick={() => setShowAddPlan(true)} className="text-purple-400 text-sm mt-2">Criar plano</button>
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} data-testid={`plan-card-${plan.plan_type}`} className="bg-surface border border-border-default overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-hl transition-colors"
                  onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                >
                  <div className="w-10 h-10 bg-purple-400/10 border border-purple-400/30 flex items-center justify-center font-heading text-lg font-bold text-purple-400">
                    {plan.plan_type}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-ui font-bold text-txt-primary">{plan.name}</p>
                    <p className="text-[10px] font-data text-txt-muted">{plan.exercises.length} exercicios</p>
                  </div>
                  <button
                    data-testid={`start-plan-${plan.plan_type}`}
                    onClick={(e) => { e.stopPropagation(); startSession(plan.id); }}
                    className="bg-purple-400/10 border border-purple-400/30 text-purple-400 px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1 hover:bg-purple-400/20 transition-all"
                  >
                    <Play size={12} /> Iniciar
                  </button>
                  {expandedPlan === plan.id ? <ChevronUp size={16} className="text-txt-muted" /> : <ChevronDown size={16} className="text-txt-muted" />}
                </div>
                {expandedPlan === plan.id && (
                  <div className="border-t border-border-default px-4 py-3 space-y-2 bg-bg/50">
                    {plan.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-default/50 last:border-0">
                        <div>
                          <p className="text-sm text-txt-primary">{ex.name}</p>
                          <p className="text-[10px] font-data text-txt-muted">{ex.notes || ''}</p>
                        </div>
                        <div className="flex gap-3 text-[10px] font-data text-txt-secondary">
                          <span>{ex.sets}x{ex.reps}</span>
                          {ex.weight_kg > 0 && <span>{ex.weight_kg}kg</span>}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => deletePlan(plan.id)} className="text-danger text-xs mt-2 hover:text-danger/80">Excluir plano</button>
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
          <div className="bg-surface border-l-4 border-purple-400 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell size={14} className="text-purple-400" />
              <span className="font-heading text-xs uppercase tracking-wider text-purple-400">{activeSession.plan_name}</span>
            </div>
            <p className="font-data text-xs text-txt-muted">Sessao ativa</p>
          </div>

          {activeSession.exercises.map((ex, exIdx) => {
            const allDone = ex.sets.every((s) => s.completed);
            return (
              <div key={exIdx} data-testid={`session-exercise-${exIdx}`} className={`bg-surface border ${allDone ? 'border-purple-400/30' : 'border-border-default'} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-sm font-ui font-bold ${allDone ? 'text-purple-400' : 'text-txt-primary'}`}>{ex.name}</p>
                    <p className="text-[10px] font-data text-txt-muted">{ex.target_sets}x{ex.target_reps} | Descanso: {ex.rest_seconds}s</p>
                  </div>
                  {allDone && <Check size={16} className="text-purple-400" />}
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 gap-2 text-[9px] font-heading uppercase tracking-wider text-txt-muted px-1">
                    <span>Serie</span><span>Reps</span><span>Peso (kg)</span><span></span>
                  </div>
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                      <span className="font-data text-xs text-txt-muted text-center">{set.set_number}</span>
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                        className="bg-bg border border-border-default text-txt-primary text-center text-xs py-1.5 outline-none focus:border-purple-400"
                      />
                      <input
                        type="number"
                        value={set.weight_kg || ''}
                        onChange={(e) => updateSet(exIdx, setIdx, 'weight_kg', parseFloat(e.target.value) || 0)}
                        className="bg-bg border border-border-default text-txt-primary text-center text-xs py-1.5 outline-none focus:border-purple-400"
                      />
                      <button
                        onClick={() => toggleSetComplete(exIdx, setIdx)}
                        className={`py-1.5 text-xs border flex items-center justify-center transition-all ${set.completed ? 'border-purple-400 bg-purple-400/10 text-purple-400' : 'border-border-default text-txt-muted hover:border-purple-400/50'}`}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <button data-testid="save-session" onClick={saveSession} className="flex-1 border border-border-default text-txt-secondary py-3 text-xs font-bold uppercase tracking-wider hover:border-txt-muted transition-all flex items-center justify-center gap-1">
              <RotateCcw size={14} /> Salvar
            </button>
            <button
              data-testid="complete-session"
              onClick={completeSession}
              className="flex-1 bg-purple-400 text-black py-3 text-xs font-bold uppercase tracking-wider hover:bg-purple-300 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              <Trophy size={14} /> Concluir Treino
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-2 animate-fade-in">
          {sessions.filter((s) => s.status === 'completed').length === 0 ? (
            <div className="text-center py-12">
              <Clock size={28} className="text-txt-muted mx-auto mb-2" strokeWidth={1} />
              <p className="text-sm text-txt-muted">Nenhuma sessao concluida.</p>
            </div>
          ) : (
            sessions.filter((s) => s.status === 'completed').map((s) => {
              const totalSets = s.exercises.reduce((a, e) => a + e.sets.filter((st) => st.completed).length, 0);
              return (
                <div key={s.id} data-testid="session-history-item" className="bg-surface border border-border-default p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-400/10 border border-purple-400/30 flex items-center justify-center font-heading text-lg font-bold text-purple-400">
                    {s.plan_type}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-ui font-bold text-txt-primary">{s.plan_name}</p>
                    <p className="text-[10px] font-data text-txt-muted">{s.date} | {totalSets} series concluidas</p>
                  </div>
                  <Check size={16} className="text-purple-400" />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowAddPlan(false)}>
          <div className="w-full max-w-md bg-surface border-t border-border-default p-6 animate-slide-up max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg uppercase tracking-tight">Novo Plano</h3>
              <button onClick={() => setShowAddPlan(false)} className="text-txt-muted hover:text-txt-primary"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary mb-1 block">Nome do plano</label>
                <input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} className="w-full bg-bg border border-border-default text-txt-primary px-3 py-2 outline-none text-sm focus:border-purple-400" placeholder="Ex: Treino A - Peito + Triceps" />
              </div>
              <div>
                <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary mb-1 block">Tipo</label>
                <div className="flex gap-2">
                  {['A', 'B', 'C', 'D'].map((t) => (
                    <button key={t} onClick={() => setNewPlan({ ...newPlan, plan_type: t })} className={`w-10 h-10 border text-sm font-bold ${newPlan.plan_type === t ? 'border-purple-400 bg-purple-400/10 text-purple-400' : 'border-border-default text-txt-muted'}`}>{t}</button>
                  ))}
                </div>
              </div>

              {newPlan.exercises.length > 0 && (
                <div className="space-y-1">
                  <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary block">Exercicios adicionados</label>
                  {newPlan.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between bg-bg border border-border-default px-3 py-2 text-xs">
                      <span className="text-txt-primary">{ex.name}</span>
                      <span className="font-data text-txt-muted">{ex.sets}x{ex.reps} {ex.weight_kg}kg</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-border-default p-3 space-y-2">
                <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary block">Adicionar exercicio</label>
                <input value={newExercise.name} onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })} className="w-full bg-bg border border-border-default text-txt-primary px-3 py-2 outline-none text-sm focus:border-purple-400" placeholder="Nome do exercicio" />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-txt-muted">Series</label>
                    <input type="number" value={newExercise.sets} onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) || 3 })} className="w-full bg-bg border border-border-default text-txt-primary text-center text-xs py-1.5 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-txt-muted">Reps</label>
                    <input value={newExercise.reps} onChange={(e) => setNewExercise({ ...newExercise, reps: e.target.value })} className="w-full bg-bg border border-border-default text-txt-primary text-center text-xs py-1.5 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] text-txt-muted">Peso (kg)</label>
                    <input type="number" value={newExercise.weight_kg} onChange={(e) => setNewExercise({ ...newExercise, weight_kg: e.target.value })} className="w-full bg-bg border border-border-default text-txt-primary text-center text-xs py-1.5 outline-none" />
                  </div>
                </div>
                <button onClick={addExerciseToPlan} className="w-full border border-purple-400/30 text-purple-400 text-xs py-2 hover:bg-purple-400/10 transition-all">+ Adicionar exercicio</button>
              </div>

              <button data-testid="save-plan-btn" onClick={savePlan} disabled={!newPlan.name || newPlan.exercises.length === 0}
                className="w-full bg-purple-400 text-black font-bold uppercase tracking-wider py-3 hover:bg-purple-300 active:scale-[0.98] transition-all disabled:opacity-30"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                Salvar Plano
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
