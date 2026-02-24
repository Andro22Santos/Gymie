import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Dumbbell, Plus, Play, Check, ChevronDown, ChevronUp, X, Clock, Trash2, Trophy, TrendingUp, Loader2 } from 'lucide-react';

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
      <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const completedToday = sessions.filter((s) => s.status === 'completed' && s.date === new Date().toISOString().split('T')[0]);

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
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
          { id: 'session', label: 'Sessão', disabled: !activeSession, badge: activeSession },
          { id: 'history', label: 'Histórico' },
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
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hl flex items-center justify-center">
                <Dumbbell size={28} className="text-txt-muted" />
              </div>
              <p className="text-txt-secondary mb-1">Nenhum plano criado</p>
              <button onClick={() => setShowAddPlan(true)} className="text-purple-400 text-sm font-medium">
                Criar primeiro plano
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
                    <p className="text-xs text-txt-muted">{plan.exercises.length} exercícios</p>
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
                        <p className="text-sm text-txt-primary">{ex.name}</p>
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
            <p className="text-xs text-txt-muted">Sessão em andamento</p>
          </div>

          {/* Exercises */}
          {activeSession.exercises.map((ex, exIdx) => {
            const allDone = ex.sets.every((s) => s.completed);
            return (
              <div 
                key={exIdx} 
                data-testid={`session-exercise-${exIdx}`} 
                className={`gymie-card p-4 ${allDone ? 'border-purple-400/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`font-semibold ${allDone ? 'text-purple-400' : 'text-txt-primary'}`}>{ex.name}</p>
                    <p className="text-[11px] text-txt-muted">{ex.target_sets}x{ex.target_reps} • Descanso: {ex.rest_seconds}s</p>
                  </div>
                  {allDone && <Check size={18} className="text-purple-400" />}
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-medium text-txt-muted uppercase tracking-wider px-1">
                    <span>Série</span><span>Reps</span><span>Peso</span><span></span>
                  </div>
                  {ex.sets.map((set, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                      <span className="text-xs text-txt-muted text-center font-data">{set.set_number}</span>
                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                        className="gymie-input py-1.5 text-center text-sm"
                      />
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
                
                <button
                  onClick={() => fetchExerciseHistory(ex.name)}
                  className="w-full mt-3 py-2 text-xs text-txt-muted hover:text-purple-400 flex items-center justify-center gap-1 transition-colors"
                >
                  <TrendingUp size={12} /> Ver histórico
                </button>
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
          {completedToday.length === 0 && sessions.filter(s => s.status === 'completed').length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hl flex items-center justify-center">
                <Clock size={28} className="text-txt-muted" />
              </div>
              <p className="text-txt-secondary">Nenhum treino concluído</p>
            </div>
          ) : (
            sessions.filter(s => s.status === 'completed').slice(0, 10).map((s) => (
              <div key={s.id} className="gymie-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-gymie-sm bg-success/10 flex items-center justify-center">
                      <Check size={14} className="text-success" />
                    </div>
                    <div>
                      <p className="font-semibold text-txt-primary">{s.plan_name}</p>
                      <p className="text-xs text-txt-muted">{s.date}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-txt-muted">
                  <span>{s.exercises.length} exercícios</span>
                  <span>{s.exercises.reduce((a, e) => a + e.sets.filter(st => st.completed).length, 0)} séries</span>
                </div>
              </div>
            ))
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
              <p className="text-center text-txt-muted py-8">Sem histórico</p>
            )}
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Novo plano</h3>
              <button onClick={() => setShowAddPlan(false)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
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
                    placeholder="Ex: Peito e Tríceps"
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
                <p className="text-xs text-txt-muted uppercase tracking-wider mb-3">Adicionar exercício</p>
                <input
                  data-testid="exercise-name"
                  value={newExercise.name}
                  onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                  className="w-full gymie-input mb-3"
                  placeholder="Nome do exercício"
                />
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] text-txt-muted mb-1 block">Séries</label>
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
                  <p className="text-xs text-txt-muted uppercase tracking-wider">Exercícios ({newPlan.exercises.length})</p>
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
