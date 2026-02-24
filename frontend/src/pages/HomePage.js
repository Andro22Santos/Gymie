import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { 
  Target, MessageSquare, UtensilsCrossed, Droplet, Dumbbell, 
  Check, X, Clock, ChevronRight, Moon, Battery, Smile, 
  Settings, Flame, TrendingUp, AlertCircle, Plus, Zap
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkin, setCheckin] = useState({ sleep_quality: 3, energy_level: 3, mood: 'neutro' });
  const [actionableInsights, setActionableInsights] = useState([]);
  const [streak, setStreak] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, insightsRes, streakRes] = await Promise.all([
        api.get('/api/dashboard/today'),
        api.get('/api/agents/insights'),
        api.get('/api/streak'),
      ]);
      setDashboard(dashRes.data);
      setActionableInsights(insightsRes.data.actionable || []);
      setStreak(streakRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
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

  const handleAddWater = async (ml) => {
    try {
      await api.post('/api/water', { amount_ml: ml });
      fetchDashboard();
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-2 border-gymie border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const d = dashboard;
  const name = (d?.name || user?.name || 'Usuário').split(' ')[0];
  const macros = d?.macros || {};
  const water = d?.water || { current_ml: 0, goal_ml: 2500 };
  const nextMission = d?.next_mission;
  
  // Calculate percentages
  const calPct = macros.calories?.target > 0 ? Math.min((macros.calories?.current || 0) / macros.calories.target * 100, 100) : 0;
  const protPct = macros.protein?.target > 0 ? Math.min((macros.protein?.current || 0) / macros.protein.target * 100, 100) : 0;
  const waterPct = water.goal_ml > 0 ? Math.min(water.current_ml / water.goal_ml * 100, 100) : 0;

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="px-4 pt-5 pb-24 space-y-5 max-w-md mx-auto">
      {/* Header with Streak */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <p className="text-xs text-txt-muted font-medium">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <h1 data-testid="home-greeting" className="text-2xl font-bold text-txt-primary mt-0.5">
            {greeting}, {name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Streak Badge */}
          {streak && streak.current_streak > 0 && (
            <div 
              data-testid="streak-badge"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 animate-pulse-glow"
            >
              <Zap size={14} className="text-orange-400" />
              <span className="text-sm font-bold text-orange-400 font-data">{streak.current_streak}</span>
              <span className="text-[10px] text-orange-400/80">dias</span>
            </div>
          )}
          <button 
            data-testid="settings-btn" 
            onClick={() => navigate('/settings')} 
            className="p-2 rounded-full hover:bg-surface-hl transition-colors"
          >
            <Settings size={20} className="text-txt-muted" />
          </button>
        </div>
      </div>

      {/* Streak Card (when streak is significant) */}
      {streak && streak.current_streak >= 3 && (
        <div 
          data-testid="streak-card"
          className="gymie-card p-4 animate-slide-up relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-transparent to-orange-500/5" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Zap size={24} className="text-orange-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-orange-400 font-data">{streak.current_streak}</span>
                <span className="text-sm text-txt-secondary">dias de foco</span>
              </div>
              <p className="text-xs text-txt-muted mt-0.5">
                {streak.current_streak >= streak.longest_streak 
                  ? '🏆 Seu melhor momento!' 
                  : `Recorde: ${streak.longest_streak} dias`
                }
              </p>
            </div>
            <button
              onClick={() => navigate('/achievements')}
              className="gymie-btn-secondary py-2 px-3 text-xs border-orange-400/30 text-orange-400"
            >
              🏆 Ver conquistas
            </button>
          </div>
        </div>
      )}

      {/* Main Mission Card */}
      {nextMission && (
        <div 
          data-testid="next-mission-card" 
          className="gymie-card p-5 animate-slide-up stagger-1 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gymie/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gymie/15 flex items-center justify-center">
                <Target size={16} className="text-gymie" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gymie">Próxima Missão</p>
                <p className="text-xs text-txt-muted font-data">{nextMission.scheduled_at}</p>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-txt-primary mb-4">{nextMission.label}</h2>
            <div className="flex gap-2">
              <button 
                data-testid="mission-complete" 
                onClick={() => handleReminderAction(nextMission.id, 'completed')} 
                className="flex-1 gymie-btn-primary flex items-center justify-center gap-2 py-2.5"
              >
                <Check size={16} /> Feito
              </button>
              <button 
                data-testid="mission-snooze" 
                onClick={() => handleReminderAction(nextMission.id, 'snoozed')} 
                className="gymie-btn-secondary flex items-center justify-center gap-2 py-2.5 px-4"
              >
                <Clock size={14} /> +15min
              </button>
              <button 
                data-testid="mission-skip" 
                onClick={() => handleReminderAction(nextMission.id, 'skipped')} 
                className="gymie-btn-ghost px-3 py-2.5"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up stagger-2">
        {/* Calories */}
        <button 
          onClick={() => navigate('/meals')}
          className="gymie-card p-4 text-left touch-feedback"
        >
          <div className="flex items-center justify-between mb-2">
            <Flame size={16} className="text-gymie" />
            <span className="text-[10px] font-data text-txt-muted">{Math.round(calPct)}%</span>
          </div>
          <p className="text-lg font-bold text-txt-primary font-data">{Math.round(macros.calories?.current || 0)}</p>
          <p className="text-[10px] text-txt-muted">kcal</p>
          <div className="progress-bar mt-2">
            <div className="progress-bar-fill bg-gymie" style={{ width: `${calPct}%` }} />
          </div>
        </button>

        {/* Protein */}
        <button 
          onClick={() => navigate('/meals')}
          className="gymie-card p-4 text-left touch-feedback"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={16} className="text-info" />
            <span className="text-[10px] font-data text-txt-muted">{Math.round(protPct)}%</span>
          </div>
          <p className="text-lg font-bold text-txt-primary font-data">{Math.round(macros.protein?.current || 0)}g</p>
          <p className="text-[10px] text-txt-muted">proteína</p>
          <div className="progress-bar mt-2">
            <div className="progress-bar-fill bg-info" style={{ width: `${protPct}%` }} />
          </div>
        </button>

        {/* Water */}
        <button 
          onClick={() => handleAddWater(300)}
          className="gymie-card p-4 text-left touch-feedback group"
        >
          <div className="flex items-center justify-between mb-2">
            <Droplet size={16} className="text-sky-400" />
            <Plus size={14} className="text-txt-muted group-hover:text-sky-400 transition-colors" />
          </div>
          <p className="text-lg font-bold text-txt-primary font-data">{(water.current_ml / 1000).toFixed(1)}L</p>
          <p className="text-[10px] text-txt-muted">de {(water.goal_ml / 1000).toFixed(1)}L</p>
          <div className="progress-bar mt-2">
            <div className="progress-bar-fill bg-sky-400" style={{ width: `${waterPct}%` }} />
          </div>
        </button>
      </div>

      {/* Insights */}
      {actionableInsights.length > 0 && (
        <div className="space-y-2 animate-slide-up stagger-3">
          {actionableInsights.slice(0, 2).map((insight, idx) => (
            <div 
              key={idx}
              data-testid={`home-insight-${insight.type}`}
              className="gymie-card p-3 flex items-center gap-3"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${insight.color}15` }}
              >
                <AlertCircle size={14} style={{ color: insight.color }} />
              </div>
              <p className="text-sm text-txt-secondary flex-1">{insight.message}</p>
              {insight.priority === 'high' && (
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-danger/20 text-danger">!</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="animate-slide-up stagger-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-muted mb-3">Ações rápidas</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: MessageSquare, label: 'Gymie', path: '/chat', color: 'text-gymie', bg: 'bg-gymie/10' },
            { icon: UtensilsCrossed, label: 'Refeição', path: '/meals', color: 'text-orange-400', bg: 'bg-orange-400/10' },
            { icon: Droplet, label: 'Água', action: () => handleAddWater(500), color: 'text-sky-400', bg: 'bg-sky-400/10' },
            { icon: Dumbbell, label: 'Treino', path: '/workout', color: 'text-purple-400', bg: 'bg-purple-400/10' },
          ].map((a, idx) => (
            <button
              key={idx}
              data-testid={`quick-${a.label.toLowerCase()}`}
              onClick={() => a.action ? a.action() : navigate(a.path)}
              className="gymie-card p-3 flex flex-col items-center gap-2 touch-feedback"
            >
              <div className={`w-10 h-10 rounded-full ${a.bg} flex items-center justify-center`}>
                <a.icon size={18} className={a.color} />
              </div>
              <span className="text-[10px] font-medium text-txt-muted">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CTA - Falar com Gymie */}
      <button
        onClick={() => navigate('/chat')}
        className="w-full gymie-card p-4 flex items-center gap-4 touch-feedback animate-slide-up stagger-5"
      >
        <div className="w-12 h-12 rounded-full bg-gymie/15 flex items-center justify-center animate-pulse-glow">
          <MessageSquare size={20} className="text-gymie" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-txt-primary">Falar com Gymie</p>
          <p className="text-xs text-txt-muted">Dúvidas, motivação ou ajuda</p>
        </div>
        <ChevronRight size={20} className="text-txt-muted" />
      </button>

      {/* Check-in Card */}
      {!d?.checkin ? (
        <button
          data-testid="checkin-open"
          onClick={() => setCheckinOpen(true)}
          className="w-full gymie-card p-4 flex items-center gap-4 touch-feedback animate-slide-up stagger-6"
        >
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Smile size={18} className="text-purple-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-txt-primary">Check-in do dia</p>
            <p className="text-xs text-txt-muted">Como você está hoje?</p>
          </div>
          <ChevronRight size={18} className="text-txt-muted" />
        </button>
      ) : (
        <div data-testid="checkin-done" className="gymie-card p-4 animate-slide-up stagger-6">
          <div className="flex items-center gap-2 mb-3">
            <Check size={14} className="text-success" />
            <span className="text-xs font-medium text-success">Check-in registrado</span>
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-txt-secondary">
              <Moon size={12} /> {d.checkin.sleep_quality}/5
            </div>
            <div className="flex items-center gap-1.5 text-txt-secondary">
              <Battery size={12} /> {d.checkin.energy_level}/5
            </div>
            <div className="flex items-center gap-1.5 text-txt-secondary">
              <Smile size={12} /> {d.checkin.mood}
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {checkinOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end" onClick={() => setCheckinOpen(false)}>
          <div 
            className="w-full max-w-md mx-auto bg-surface rounded-t-gymie-lg p-6 pb-safe animate-slide-up" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Check-in do dia</h3>
              <button onClick={() => setCheckinOpen(false)} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Sleep */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Moon size={16} className="text-purple-400" />
                  <label className="text-sm font-medium text-txt-secondary">Qualidade do sono</label>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button 
                      key={v} 
                      onClick={() => setCheckin({ ...checkin, sleep_quality: v })} 
                      className={`flex-1 py-3 rounded-gymie-sm text-sm font-medium transition-all ${
                        checkin.sleep_quality === v 
                          ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400' 
                          : 'bg-surface-hl border border-transparent text-txt-muted hover:border-border-hover'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Battery size={16} className="text-gymie" />
                  <label className="text-sm font-medium text-txt-secondary">Nível de energia</label>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button 
                      key={v} 
                      onClick={() => setCheckin({ ...checkin, energy_level: v })} 
                      className={`flex-1 py-3 rounded-gymie-sm text-sm font-medium transition-all ${
                        checkin.energy_level === v 
                          ? 'bg-gymie/20 border border-gymie/40 text-gymie' 
                          : 'bg-surface-hl border border-transparent text-txt-muted hover:border-border-hover'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Smile size={16} className="text-success" />
                  <label className="text-sm font-medium text-txt-secondary">Humor</label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {['péssimo', 'ruim', 'neutro', 'bom', 'ótimo'].map((m) => (
                    <button 
                      key={m} 
                      onClick={() => setCheckin({ ...checkin, mood: m })} 
                      className={`flex-1 min-w-[60px] py-2.5 rounded-gymie-sm text-xs font-medium capitalize transition-all ${
                        checkin.mood === m 
                          ? 'bg-success/20 border border-success/40 text-success' 
                          : 'bg-surface-hl border border-transparent text-txt-muted hover:border-border-hover'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              data-testid="checkin-submit"
              onClick={handleCheckin}
              className="w-full gymie-btn-primary mt-6"
            >
              Salvar check-in
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
