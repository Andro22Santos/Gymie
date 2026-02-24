import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { TrendingDown, Minus, Dumbbell, Droplet, UtensilsCrossed, Moon, Zap, Scale, X, FileText, Loader2, Brain, Trash2 } from 'lucide-react';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';

export default function ProgressPage() {
  const [summary, setSummary] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showFactsModal, setShowFactsModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [newFact, setNewFact] = useState('');
  const [factCategory, setFactCategory] = useState('general');

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, weeklyRes, factsRes] = await Promise.all([
        api.get('/api/progress/summary'),
        api.get('/api/progress/weekly-summary'),
        api.get('/api/memory/facts'),
      ]);
      setSummary(summaryRes.data);
      const summaries = weeklyRes.data.summaries || [];
      if (summaries.length > 0) setWeeklySummary(summaries[0]);
      setFacts(factsRes.data.facts || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const logWeight = async () => {
    if (!weightInput) return;
    try {
      await api.post('/api/body-metrics', { weight: parseFloat(weightInput) });
      setShowWeightModal(false);
      setWeightInput('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const generateWeeklySummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await api.post('/api/progress/weekly-summary');
      setWeeklySummary(res.data);
    } catch (err) { console.error(err); }
    setGeneratingSummary(false);
  };

  const addFact = async () => {
    if (!newFact.trim()) return;
    try {
      await api.post('/api/memory/facts', { fact: newFact, category: factCategory });
      setNewFact('');
      fetchData();
    } catch (err) { console.error(err); }
  };

  const deleteFact = async (id) => {
    try {
      await api.delete(`/api/memory/facts/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-10 h-10 border-2 border-tactical border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const s = summary || {};
  const weightData = (s.weight_history || []).map((d) => ({
    ...d,
    label: d.date ? d.date.substring(5) : '',
  }));

  const TrendIcon = ({ value }) => {
    if (value === null || value === undefined) return <Minus size={14} className="text-txt-muted" />;
    if (value <= 0) return <TrendingDown size={14} className="text-tactical" />;
    return <Minus size={14} className="text-danger" />;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border-default px-3 py-2">
          <p className="font-data text-xs text-tactical">{payload[0].value}kg</p>
          <p className="font-data text-[10px] text-txt-muted">{payload[0].payload.label}</p>
        </div>
      );
    }
    return null;
  };

  function renderMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-tactical font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Progresso</h1>
          <p className="text-xs text-txt-muted font-data">Ultimos 7 dias</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="memory-facts-btn" onClick={() => setShowFactsModal(true)} className="bg-purple-400/10 border border-purple-400/30 text-purple-400 p-2.5 hover:bg-purple-400/20 active:scale-95 transition-all">
            <Brain size={18} />
          </button>
          <button data-testid="log-weight-btn" onClick={() => setShowWeightModal(true)} className="bg-tactical/10 border border-tactical/30 text-tactical p-2.5 hover:bg-tactical/20 active:scale-95 transition-all">
            <Scale size={18} />
          </button>
        </div>
      </div>

      {/* Weekly Summary */}
      <div data-testid="weekly-summary-card" className="bg-surface border border-tactical/20 p-5 animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-tactical" strokeWidth={1.5} />
            <span className="font-heading text-xs uppercase tracking-wider text-tactical">Relatorio Semanal</span>
          </div>
          <button
            data-testid="generate-summary-btn"
            onClick={generateWeeklySummary}
            disabled={generatingSummary}
            className="text-[10px] font-ui uppercase tracking-wider text-tactical border border-tactical/30 px-2 py-1 hover:bg-tactical/10 transition-all disabled:opacity-50 flex items-center gap-1"
          >
            {generatingSummary ? <Loader2 size={10} className="animate-spin" /> : null}
            {generatingSummary ? 'Gerando...' : weeklySummary ? 'Atualizar' : 'Gerar'}
          </button>
        </div>
        {weeklySummary ? (
          <div>
            <p className="text-sm text-txt-primary leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(weeklySummary.summary_text) }} />
            {weeklySummary.stats && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="font-data text-[10px] bg-tactical/10 text-tactical px-2 py-0.5">{weeklySummary.stats.workouts || 0} treinos</span>
                <span className="font-data text-[10px] bg-info/10 text-info px-2 py-0.5">{weeklySummary.stats.avg_water_ml || 0}ml agua/dia</span>
                <span className="font-data text-[10px] bg-orange-400/10 text-orange-400 px-2 py-0.5">{weeklySummary.stats.meals || 0} refeicoes</span>
                {weeklySummary.stats.weight_change !== null && (
                  <span className={`font-data text-[10px] px-2 py-0.5 ${weeklySummary.stats.weight_change <= 0 ? 'bg-tactical/10 text-tactical' : 'bg-danger/10 text-danger'}`}>
                    {weeklySummary.stats.weight_change > 0 ? '+' : ''}{weeklySummary.stats.weight_change}kg
                  </span>
                )}
              </div>
            )}
            <p className="font-data text-[9px] text-txt-muted mt-2">{weeklySummary.date_range?.start} a {weeklySummary.date_range?.end}</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-txt-muted">Clique em "Gerar" para criar seu relatorio semanal com IA.</p>
          </div>
        )}
      </div>

      {/* Weight Card */}
      <div data-testid="weight-card" className="bg-surface border border-border-default p-5 animate-slide-up stagger-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale size={14} className="text-tactical" strokeWidth={1.5} />
            <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Peso</span>
          </div>
          <div className="flex items-center gap-2">
            {s.weight_change !== null && s.weight_change !== undefined && (
              <span className={`font-data text-xs ${s.weight_change <= 0 ? 'text-tactical' : 'text-danger'}`}>
                {s.weight_change > 0 ? '+' : ''}{s.weight_change}kg
              </span>
            )}
            <TrendIcon value={s.weight_change} />
          </div>
        </div>
        <div className="flex items-end gap-4 mb-4">
          <div>
            <p className="font-data text-4xl text-txt-primary">{s.latest_weight || '--'}</p>
            <p className="font-data text-xs text-txt-muted">kg atual</p>
          </div>
          {s.goal_weight && (
            <div className="text-right">
              <p className="font-data text-lg text-tactical">{s.goal_weight}</p>
              <p className="font-data text-xs text-txt-muted">kg meta</p>
            </div>
          )}
        </div>
        {weightData.length > 1 && (
          <div className="h-32 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4FF00" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#D4FF00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#52525B', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#52525B', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="weight" stroke="#D4FF00" strokeWidth={2} fill="url(#weightGrad)" dot={{ r: 3, fill: '#D4FF00', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#D4FF00' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up stagger-2">
        <StatCard icon={Dumbbell} color="text-purple-400" borderColor="border-purple-400/20" label="Treinos" value={`${s.workouts_this_week || 0}/${s.training_days_target || 4}`} sub="esta semana" />
        <StatCard icon={Droplet} color="text-info" borderColor="border-info/20" label="Agua Media" value={`${s.avg_water_ml || 0}`} sub={`ml / ${s.water_goal_ml || 2500}ml meta`} />
        <StatCard icon={UtensilsCrossed} color="text-orange-400" borderColor="border-orange-400/20" label="Refeicoes" value={`${s.days_with_meals || 0}/7`} sub="dias com registro" />
        <StatCard icon={Moon} color="text-blue-400" borderColor="border-blue-400/20" label="Sono Medio" value={`${s.avg_sleep || 0}/5`} sub="qualidade" />
      </div>

      {/* Consistency Bar */}
      <div data-testid="consistency-card" className="bg-surface border border-border-default p-4 animate-slide-up stagger-3">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-tactical" strokeWidth={1.5} />
          <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Consistencia Semanal</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => {
            const filled = i < (s.checkin_days || 0);
            return (
              <div key={i} className="text-center">
                <div className={`h-8 border ${filled ? 'bg-tactical/20 border-tactical/40' : 'bg-surface-hl border-border-default'} mb-1`} />
                <span className="font-data text-[9px] text-txt-muted">{d}</span>
              </div>
            );
          })}
        </div>
        <p className="font-data text-xs text-txt-muted mt-2">{s.checkin_days || 0} de 7 dias com check-in</p>
      </div>

      {/* Energy */}
      <div className="bg-surface border border-border-default p-4 animate-slide-up stagger-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-yellow-400" strokeWidth={1.5} />
          <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Energia Media</span>
          <span className="ml-auto font-data text-sm text-yellow-400">{s.avg_energy || 0}/5</span>
        </div>
        <div className="h-2 bg-surface-hl overflow-hidden">
          <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${((s.avg_energy || 0) / 5) * 100}%` }} />
        </div>
      </div>

      {/* Log Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowWeightModal(false)}>
          <div className="w-full max-w-md bg-surface border-t border-border-default p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg uppercase tracking-tight">Registrar Peso</h3>
              <button onClick={() => setShowWeightModal(false)} className="text-txt-muted hover:text-txt-primary"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input data-testid="weight-input" type="number" step="0.1" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
                className="w-full bg-bg border border-border-default text-txt-primary text-center text-2xl font-data py-4 outline-none focus:border-tactical" placeholder="0.0" autoFocus />
              <button data-testid="weight-submit" onClick={logWeight} disabled={!weightInput}
                className="w-full bg-tactical text-black font-bold uppercase tracking-wider py-3 hover:bg-tactical-dim active:scale-[0.98] transition-all disabled:opacity-30"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Facts Modal */}
      {showFactsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowFactsModal(false)}>
          <div className="w-full max-w-md bg-surface border-t border-border-default p-6 animate-slide-up max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-purple-400" />
                <h3 className="font-heading text-lg uppercase tracking-tight">Memoria da IA</h3>
              </div>
              <button onClick={() => setShowFactsModal(false)} className="text-txt-muted hover:text-txt-primary"><X size={20} /></button>
            </div>
            <p className="text-xs text-txt-secondary mb-4">Fatos que a IA usa para personalizar suas respostas.</p>

            {/* Add fact */}
            <div className="space-y-2 mb-4">
              <textarea data-testid="fact-input" value={newFact} onChange={(e) => setNewFact(e.target.value)}
                className="w-full bg-bg border border-border-default text-txt-primary placeholder:text-txt-muted px-3 py-2 outline-none text-sm focus:border-purple-400 resize-none" rows={2}
                placeholder="Ex: Tenho dificuldade a noite com carboidratos" />
              <div className="flex gap-1 flex-wrap">
                {['general', 'nutrition', 'workout', 'routine', 'preferences'].map((c) => (
                  <button key={c} onClick={() => setFactCategory(c)}
                    className={`px-2 py-1 text-[9px] font-ui uppercase border transition-all ${factCategory === c ? 'border-purple-400 bg-purple-400/10 text-purple-400' : 'border-border-default text-txt-muted'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <button data-testid="add-fact-btn" onClick={addFact} disabled={!newFact.trim()}
                className="w-full border border-purple-400/30 text-purple-400 text-xs font-bold uppercase py-2 hover:bg-purple-400/10 transition-all disabled:opacity-30">
                + Adicionar Fato
              </button>
            </div>

            {/* Facts list */}
            <div className="space-y-1.5">
              {facts.length === 0 ? (
                <p className="text-center text-sm text-txt-muted py-4">Nenhum fato registrado.</p>
              ) : (
                facts.map((f) => (
                  <div key={f.id} data-testid="memory-fact-item" className="flex items-start gap-2 bg-bg border border-border-default px-3 py-2">
                    <div className="flex-1">
                      <span className="text-[9px] font-ui uppercase tracking-wider text-purple-400 bg-purple-400/10 px-1.5 py-0.5 inline-block mb-1">{f.category}</span>
                      <p className="text-xs text-txt-primary">{f.fact}</p>
                    </div>
                    <button onClick={() => deleteFact(f.id)} className="text-txt-muted hover:text-danger transition-colors p-0.5 mt-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, borderColor, label, value, sub }) {
  return (
    <div className={`bg-surface border ${borderColor || 'border-border-default'} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} strokeWidth={1.5} />
        <span className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary">{label}</span>
      </div>
      <p className={`font-data text-2xl ${color}`}>{value}</p>
      <p className="font-data text-[10px] text-txt-muted mt-0.5">{sub}</p>
    </div>
  );
}
