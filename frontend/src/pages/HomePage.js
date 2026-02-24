import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { Target, MessageSquare, UtensilsCrossed, Droplet, Dumbbell, Clock, Check, X, Timer, ChevronRight, Zap, Moon, Smile } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkin, setCheckin] = useState({ sleep_quality: 3, energy_level: 3, mood: 'neutro' });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/api/dashboard/today');
      setDashboard(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleReminderAction = async (reminderId, action) => {
    try {
      await api.post(`/api/reminders/${reminderId}/action`, { action });
      fetchDashboard();
    } catch (err) { console.error(err); }
  };

  const handleCheckin = async () => {
    try {
      await api.post('/api/checkins', checkin);
      setCheckinOpen(false);
      fetchDashboard();
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-10 h-10 border-2 border-tactical border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const d = dashboard;
  const name = d?.name || user?.name || 'Soldado';
  const macros = d?.macros || {};
  const water = d?.water || { current_ml: 0, goal_ml: 2500 };
  const reminders = d?.reminders || [];
  const nextMission = d?.next_mission;

  const MacroBar = ({ label, current, target, color }) => {
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    return (
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-heading uppercase tracking-wider text-txt-secondary">{label}</span>
          <span className="font-data text-[10px] text-txt-muted">{Math.round(current)}/{target}</span>
        </div>
        <div className="h-1.5 bg-surface-hl overflow-hidden">
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    );
  };

  const waterPct = water.goal_ml > 0 ? Math.min((water.current_ml / water.goal_ml) * 100, 100) : 0;

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      {/* Header */}
      <div className="animate-slide-up">
        <p className="font-data text-[10px] text-txt-muted uppercase tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 data-testid="home-greeting" className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
          {d?.persona_style === 'tactical' ? `Bom dia, ${name}` : `Ola, ${name}`}
        </h1>
        <p className="text-sm text-txt-secondary mt-1">
          {d?.persona_style === 'tactical' ? 'Relatorio de operacoes do dia.' : 'Seu resumo do dia.'}
        </p>
      </div>

      {/* Next Mission */}
      {nextMission && (
        <div data-testid="next-mission-card" className="bg-surface border-l-4 border-tactical p-5 animate-slide-up stagger-1 animate-pulse-glow">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-tactical" strokeWidth={1.5} />
            <span className="font-heading text-xs uppercase tracking-wider text-tactical">Proxima Missao</span>
          </div>
          <p className="text-lg font-ui font-bold text-txt-primary">{nextMission.label}</p>
          <p className="font-data text-sm text-txt-muted mt-1">{nextMission.scheduled_at}</p>
          <div className="flex gap-2 mt-3">
            <button data-testid="mission-complete" onClick={() => handleReminderAction(nextMission.id, 'completed')} className="flex-1 bg-tactical/10 border border-tactical/30 text-tactical text-xs font-bold uppercase py-2 flex items-center justify-center gap-1 hover:bg-tactical/20 transition-all">
              <Check size={14} /> Cumpri
            </button>
            <button data-testid="mission-snooze" onClick={() => handleReminderAction(nextMission.id, 'snoozed')} className="flex-1 bg-surface border border-border-default text-txt-secondary text-xs py-2 flex items-center justify-center gap-1 hover:border-txt-muted transition-all">
              <Timer size={14} /> +15min
            </button>
            <button data-testid="mission-skip" onClick={() => handleReminderAction(nextMission.id, 'skipped')} className="bg-surface border border-border-default text-txt-muted text-xs px-3 py-2 hover:border-danger hover:text-danger transition-all">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Macros */}
      <div data-testid="macros-card" className="bg-surface border border-border-default p-4 space-y-3 animate-slide-up stagger-2">
        <div className="flex items-center gap-2 mb-1">
          <UtensilsCrossed size={14} className="text-tactical" strokeWidth={1.5} />
          <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Macros do Dia</span>
          <span className="ml-auto font-data text-[10px] text-txt-muted">{d?.meals_count || 0} refeicoes</span>
        </div>
        <MacroBar label="Calorias" current={macros.calories?.current || 0} target={macros.calories?.target || 2000} color="#D4FF00" />
        <MacroBar label="Proteina" current={macros.protein?.current || 0} target={macros.protein?.target || 150} color="#00F0FF" />
        <MacroBar label="Carboidrato" current={macros.carbs?.current || 0} target={macros.carbs?.target || 200} color="#FF9500" />
        <MacroBar label="Gordura" current={macros.fat?.current || 0} target={macros.fat?.target || 65} color="#FF3B30" />
      </div>

      {/* Water */}
      <div data-testid="water-card" className="bg-surface border border-border-default p-4 animate-slide-up stagger-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplet size={14} className="text-info" strokeWidth={1.5} />
            <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Hidratacao</span>
          </div>
          <span className="font-data text-xs text-info">{water.current_ml}ml / {water.goal_ml}ml</span>
        </div>
        <div className="h-2 bg-surface-hl overflow-hidden mb-3">
          <div className="h-full bg-info transition-all duration-500" style={{ width: `${waterPct}%` }} />
        </div>
        <div className="flex gap-2">
          {[200, 300, 500].map((ml) => (
            <button
              key={ml}
              data-testid={`water-add-${ml}`}
              onClick={async () => { await api.post('/api/water', { amount_ml: ml }); fetchDashboard(); }}
              className="flex-1 bg-info/10 border border-info/20 text-info text-xs font-data py-2 hover:bg-info/20 transition-all"
            >
              +{ml}ml
            </button>
          ))}
        </div>
      </div>

      {/* Check-in */}
      {!d?.checkin ? (
        <button
          data-testid="checkin-open"
          onClick={() => setCheckinOpen(true)}
          className="w-full bg-surface border border-border-default p-4 text-left animate-slide-up stagger-4 hover:border-tactical/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <Smile size={14} className="text-tactical" strokeWidth={1.5} />
            <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Check-in do Dia</span>
            <ChevronRight size={14} className="ml-auto text-txt-muted" />
          </div>
          <p className="text-sm text-txt-muted mt-1">Como esta seu sono, energia e humor?</p>
        </button>
      ) : (
        <div data-testid="checkin-done" className="bg-surface border border-tactical/20 p-4 animate-slide-up stagger-4">
          <div className="flex items-center gap-2 mb-2">
            <Check size={14} className="text-tactical" />
            <span className="font-heading text-xs uppercase tracking-wider text-tactical">Check-in Registrado</span>
          </div>
          <div className="flex gap-4 text-xs text-txt-secondary">
            <span>Sono: {d.checkin.sleep_quality}/5</span>
            <span>Energia: {d.checkin.energy_level}/5</span>
            <span>Humor: {d.checkin.mood}</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 animate-slide-up stagger-5">
        {[
          { icon: MessageSquare, label: 'Chat', path: '/chat', color: 'text-tactical' },
          { icon: UtensilsCrossed, label: 'Refeicao', path: '/meals', color: 'text-orange-400' },
          { icon: Droplet, label: 'Agua', path: '/water', color: 'text-info' },
          { icon: Dumbbell, label: 'Treino', path: '/settings', color: 'text-purple-400' },
        ].map((a) => (
          <button
            key={a.label}
            data-testid={`quick-${a.label.toLowerCase()}`}
            onClick={() => navigate(a.path)}
            className="bg-surface border border-border-default p-3 flex flex-col items-center gap-1.5 hover:border-txt-muted active:scale-95 transition-all"
          >
            <a.icon size={18} className={a.color} strokeWidth={1.5} />
            <span className="text-[10px] font-ui uppercase tracking-wider text-txt-muted">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Reminders Timeline */}
      {reminders.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-txt-muted" strokeWidth={1.5} />
            <span className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Timeline do Dia</span>
          </div>
          <div className="space-y-1">
            {reminders.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 py-2 px-3 border-l-2 ${r.status === 'completed' ? 'border-tactical/40 opacity-60' : r.status === 'skipped' ? 'border-danger/40 opacity-40' : 'border-border-default'}`}>
                <span className="font-data text-xs text-txt-muted w-12">{r.scheduled_at}</span>
                <span className={`text-sm flex-1 ${r.status === 'completed' ? 'text-txt-muted line-through' : 'text-txt-primary'}`}>{r.label}</span>
                {r.status === 'completed' && <Check size={14} className="text-tactical" />}
                {r.status === 'skipped' && <X size={14} className="text-danger" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {checkinOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setCheckinOpen(false)}>
          <div className="w-full max-w-md bg-surface border-t border-border-default p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg uppercase tracking-tight mb-4">Check-in do Dia</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-txt-secondary uppercase tracking-wider font-heading mb-2 block">Qualidade do Sono</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setCheckin({ ...checkin, sleep_quality: v })} className={`flex-1 py-2 border text-sm font-data ${checkin.sleep_quality === v ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-txt-secondary uppercase tracking-wider font-heading mb-2 block">Nivel de Energia</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} onClick={() => setCheckin({ ...checkin, energy_level: v })} className={`flex-1 py-2 border text-sm font-data ${checkin.energy_level === v ? 'border-info bg-info/10 text-info' : 'border-border-default text-txt-muted'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-txt-secondary uppercase tracking-wider font-heading mb-2 block">Humor</label>
                <div className="flex gap-2">
                  {['pessimo', 'ruim', 'neutro', 'bom', 'otimo'].map((m) => (
                    <button key={m} onClick={() => setCheckin({ ...checkin, mood: m })} className={`flex-1 py-2 border text-[10px] font-ui uppercase ${checkin.mood === m ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              data-testid="checkin-submit"
              onClick={handleCheckin}
              className="w-full bg-tactical text-black font-bold uppercase tracking-wider py-3 mt-6 hover:bg-tactical-dim active:scale-[0.98] transition-all"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              Registrar Check-in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
