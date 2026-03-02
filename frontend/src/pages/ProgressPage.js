import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { TrendingDown, TrendingUp, Minus, Dumbbell, Droplet, UtensilsCrossed, Moon, Scale, X, FileText, Loader2, Brain, Trash2, Plus, Sparkles } from 'lucide-react';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, BarChart, Bar, Cell } from 'recharts';
import { useToast } from '../context/ToastContext';

export default function ProgressPage() {
  const toast = useToast();
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
      toast('Peso registrado com sucesso!', 'success');
    } catch (err) { console.error(err); toast('Erro ao registrar peso', 'error'); }
  };

  const generateWeeklySummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await api.post('/api/progress/weekly-summary');
      setWeeklySummary(res.data);
      toast('Resumo semanal gerado!', 'success');
    } catch (err) { console.error(err); toast('Erro ao gerar resumo', 'error'); }
    setGeneratingSummary(false);
  };

  const addFact = async () => {
    if (!newFact.trim()) return;
    try {
      await api.post('/api/memory/facts', { fact: newFact, category: factCategory });
      setNewFact('');
      fetchData();
      toast('Informação salva na memória do Gymie!', 'success');
    } catch (err) { console.error(err); toast('Erro ao salvar informação', 'error'); }
  };

  const deleteFact = async (id) => {
    try {
      await api.delete(`/api/memory/facts/${id}`);
      fetchData();
      toast('Informação removida', 'info');
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-2">
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-4 w-20" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton w-10 h-10 rounded-gymie-sm" />
          <div className="skeleton w-10 h-10 rounded-gymie-sm" />
        </div>
      </div>
      {/* Weekly summary skeleton */}
      <div className="skeleton h-36 w-full rounded-gymie" />
      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-gymie" />)}
      </div>
      {/* Chart skeleton */}
      <div className="skeleton h-48 w-full rounded-gymie" />
    </div>
  );

  const s = summary || {};
  const weightData = (s.weight_history || []).map((d) => ({
    ...d,
    label: d.date ? d.date.substring(5) : '',
  }));

  const TrendIcon = ({ value, inverted }) => {
    if (value === null || value === undefined) return <Minus size={14} className="text-txt-muted" />;
    const isGood = inverted ? value > 0 : value <= 0;
    if (isGood) return <TrendingDown size={14} className="text-success" />;
    return <TrendingUp size={14} className="text-danger" />;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-border-default rounded-gymie-sm px-3 py-2">
          <p className="font-data text-sm text-gymie">{payload[0].value}kg</p>
          <p className="font-data text-[10px] text-txt-muted">{payload[0].payload.label}</p>
        </div>
      );
    }
    return null;
  };

  function renderMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gymie font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-txt-primary">Progresso</h1>
          <p className="text-xs text-txt-muted">Últimos 7 dias</p>
        </div>
        <div className="flex gap-2">
          <button 
            data-testid="memory-facts-btn" 
            onClick={() => setShowFactsModal(true)} 
            className="gymie-btn-secondary p-2.5 border-purple-400/30 text-purple-400"
          >
            <Brain size={18} />
          </button>
          <button 
            data-testid="log-weight-btn" 
            onClick={() => setShowWeightModal(true)} 
            className="gymie-btn-primary p-2.5"
          >
            <Scale size={18} />
          </button>
        </div>
      </div>

      {/* Weekly Summary */}
      <div data-testid="weekly-summary-card" className="gymie-card p-5 mb-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gymie/10 flex items-center justify-center">
              <Sparkles size={14} className="text-gymie" />
            </div>
            <span className="text-sm font-semibold text-txt-primary">Resumo da semana</span>
          </div>
          <button
            data-testid="generate-summary-btn"
            onClick={generateWeeklySummary}
            disabled={generatingSummary}
            className="gymie-chip text-[10px] disabled:opacity-50"
          >
            {generatingSummary ? <Loader2 size={10} className="animate-spin" /> : null}
            {generatingSummary ? 'Gerando...' : weeklySummary ? 'Atualizar' : 'Gerar com IA'}
          </button>
        </div>
        
        {weeklySummary ? (
          <div>
            <p 
              className="text-sm text-txt-secondary leading-relaxed" 
              dangerouslySetInnerHTML={{ __html: renderMarkdown(weeklySummary.summary_text) }} 
            />
            {weeklySummary.stats && (
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="gymie-chip bg-purple-400/10 text-purple-400 border-purple-400/20">
                  <Dumbbell size={10} /> {weeklySummary.stats.workouts || 0} treinos
                </span>
                <span className="gymie-chip bg-sky-400/10 text-sky-400 border-sky-400/20">
                  <Droplet size={10} /> {((weeklySummary.stats.avg_water_ml || 0) / 1000).toFixed(1)}L/dia
                </span>
                <span className="gymie-chip bg-orange-400/10 text-orange-400 border-orange-400/20">
                  <UtensilsCrossed size={10} /> {weeklySummary.stats.meals || 0} refeições
                </span>
                {weeklySummary.stats.weight_change !== null && (
                  <span className={`gymie-chip ${weeklySummary.stats.weight_change <= 0 ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
                    <Scale size={10} /> {weeklySummary.stats.weight_change > 0 ? '+' : ''}{weeklySummary.stats.weight_change}kg
                  </span>
                )}
              </div>
            )}
            <p className="text-[10px] text-txt-muted mt-3">
              {weeklySummary.date_range?.start} a {weeklySummary.date_range?.end}
            </p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-txt-muted">Gere seu resumo semanal com IA</p>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5 animate-slide-up stagger-1">
        {[
          { 
            icon: Scale, 
            label: 'Peso atual', 
            value: s.current_weight ? `${s.current_weight}kg` : '--',
            change: s.weight_change,
            color: 'gymie'
          },
          { 
            icon: Dumbbell, 
            label: 'Treinos', 
            value: s.weekly_stats?.workouts ?? 0,
            color: 'purple-400'
          },
          { 
            icon: Droplet, 
            label: 'Água média', 
            value: s.weekly_stats?.avg_water_ml ? `${((s.weekly_stats.avg_water_ml) / 1000).toFixed(1)}L` : '--',
            color: 'sky-400'
          },
          { 
            icon: Moon, 
            label: 'Sono médio', 
            value: s.weekly_stats?.avg_sleep ? `${s.weekly_stats.avg_sleep.toFixed(1)}/5` : '--',
            color: 'purple-400'
          },
        ].map((stat, idx) => (
          <div key={idx} className="gymie-card p-4">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={16} className={`text-${stat.color}`} />
              {stat.change !== undefined && stat.change !== null && (
                <span className={`text-xs font-data ${stat.change <= 0 ? 'text-success' : 'text-danger'}`}>
                  {stat.change > 0 ? '+' : ''}{stat.change}kg
                </span>
              )}
            </div>
            <p className={`text-xl font-bold font-data text-${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-txt-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Weight Chart */}
      {weightData.length > 0 && (
        <div data-testid="weight-card" className="gymie-card p-5 animate-slide-up stagger-2">
          <div className="flex items-center gap-2 mb-4">
            <Scale size={14} className="text-gymie" />
            <span className="text-sm font-semibold text-txt-primary">Histórico de peso</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E04B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00E04B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#525252', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#525252', fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="weight" stroke="#00E04B" strokeWidth={2} fill="url(#weightGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Nutrição semanal média */}
      <div className="gymie-card p-5 mt-5 animate-slide-up stagger-2">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed size={14} className="text-orange-400" />
          <span className="text-sm font-semibold text-txt-primary">Nutrição — média semanal</span>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Calorias', val: s.avg_weekly_calories || 0, target: s.calorie_target || 2800, unit: 'kcal', color: '#00E04B' },
            { label: 'Proteína', val: s.avg_weekly_protein || 0,  target: s.protein_target || 150,   unit: 'g',    color: '#F97316' },
            { label: 'Hidratação', val: s.water_adherence_pct || 0, target: 100, unit: '%', color: '#38BDF8' },
          ].map((m) => {
            const pct = Math.min((m.val / m.target) * 100, 100);
            return (
              <div key={m.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-txt-secondary">{m.label}</span>
                  <span className="text-xs font-data" style={{ color: m.color }}>
                    {m.val}<span className="text-txt-muted text-[10px]"> / {m.target}{m.unit}</span>
                    <span className="text-txt-muted text-[10px] ml-1">({Math.round(pct)}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-surface-hl rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: m.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-4">
          <span className="gymie-chip bg-purple-400/10 text-purple-400 border-purple-400/20 text-[10px]">
            <Dumbbell size={9} /> {s.workout_count_30d || 0} treinos/mês
          </span>
          <span className="gymie-chip bg-gymie/10 text-gymie border-gymie/20 text-[10px]">
            {s.checkin_count_30d || 0} check-ins/mês
          </span>
        </div>
      </div>

      {/* Workout Frequency by Day */}
      {(s.workout_by_day || []).some((d) => d.count > 0) && (
        <div className="gymie-card p-5 mt-5 animate-slide-up stagger-3">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell size={14} className="text-purple-400" />
            <span className="text-sm font-semibold text-txt-primary">Frequência de treino</span>
            <span className="text-[10px] text-txt-muted ml-auto">por dia da semana</span>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.workout_by_day} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <XAxis dataKey="day" tick={{ fill: '#525252', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#525252', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-surface border border-border-default rounded-gymie-sm px-3 py-1.5">
                      <p className="font-data text-sm text-purple-400">{payload[0].value} treino{payload[0].value !== 1 ? 's' : ''}</p>
                      <p className="font-data text-[10px] text-txt-muted">{payload[0].payload.day}</p>
                    </div>
                  ) : null}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(s.workout_by_day || []).map((entry, index) => (
                    <Cell key={index} fill={entry.count > 0 ? '#A855F7' : '#2A2A2A'} fillOpacity={entry.count > 0 ? 0.8 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Consistency */}
      <div className="gymie-card p-5 mt-5 animate-slide-up stagger-3">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-success" />
          <span className="text-sm font-semibold text-txt-primary">Consistência</span>
        </div>
        <div className="flex gap-1">
          {(s.consistency_bar || [1,1,1,0,1,0,1]).map((c, i) => (
            <div 
              key={i} 
              className={`flex-1 h-8 rounded-sm transition-all ${c ? 'bg-success/30' : 'bg-surface-hl'}`} 
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-txt-muted">
          <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
        </div>
      </div>

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowWeightModal(false)}>
          <div className="w-full max-w-sm bg-surface rounded-gymie-lg p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Registrar peso</h3>
              <button onClick={() => setShowWeightModal(false)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>
            <div className="mb-6">
              <label className="text-xs text-txt-muted uppercase tracking-wider mb-2 block">Peso (kg)</label>
              <input
                data-testid="weight-input"
                type="number"
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full gymie-input text-center text-2xl font-data"
                placeholder="70.0"
                autoFocus
              />
            </div>
            <button data-testid="save-weight" onClick={logWeight} className="w-full gymie-btn-primary">
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Memory Facts Modal */}
      {showFactsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end" onClick={() => setShowFactsModal(false)}>
          <div 
            className="w-full max-w-md mx-auto bg-surface rounded-t-gymie-lg p-6 pb-safe animate-slide-up max-h-[80vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-purple-400" />
                <h3 className="text-lg font-semibold">Memória do Gymie</h3>
              </div>
              <button onClick={() => setShowFactsModal(false)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>
            
            <p className="text-xs text-txt-muted mb-4">
              Informações que o Gymie usa para personalizar suas respostas.
            </p>

            {/* Add new fact */}
            <div className="mb-5 p-4 bg-surface-hl rounded-gymie">
              <input
                data-testid="new-fact-input"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                className="w-full gymie-input mb-3"
                placeholder="Ex: Sou vegetariano"
              />
              <div className="flex gap-2">
                {['general', 'health', 'preference', 'restriction'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFactCategory(cat)}
                    className={`gymie-chip text-[10px] capitalize ${factCategory === cat ? 'gymie-chip-active' : ''}`}
                  >
                    {cat === 'general' ? 'Geral' : cat === 'health' ? 'Saúde' : cat === 'preference' ? 'Preferência' : 'Restrição'}
                  </button>
                ))}
              </div>
              <button
                data-testid="add-fact-btn"
                onClick={addFact}
                disabled={!newFact.trim()}
                className="w-full gymie-btn-secondary mt-3 disabled:opacity-40"
              >
                <Plus size={14} className="inline mr-1" /> Adicionar
              </button>
            </div>

            {/* Facts list */}
            {facts.length === 0 ? (
              <p className="text-center text-txt-muted py-6">Nenhuma informação salva</p>
            ) : (
              <div className="space-y-2">
                {facts.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 p-3 gymie-card">
                    <div className="flex-1">
                      <p className="text-sm text-txt-primary">{f.fact}</p>
                      <p className="text-[10px] text-txt-muted mt-1 capitalize">{f.category}</p>
                    </div>
                    <button onClick={() => deleteFact(f.id)} className="p-1.5 text-txt-muted hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
