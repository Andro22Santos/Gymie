import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Trophy, Lock, ChevronLeft, Download, FileText, Dumbbell, UtensilsCrossed, Droplet, Star, Zap } from 'lucide-react';
import Confetti from '../components/Confetti';

const CATEGORY_LABELS = {
  streak: { label: 'Consistência', icon: Zap, color: 'orange-400' },
  meals: { label: 'Alimentação', icon: UtensilsCrossed, color: 'gymie' },
  workouts: { label: 'Treinos', icon: Dumbbell, color: 'purple-400' },
  water: { label: 'Hidratação', icon: Droplet, color: 'sky-400' },
  special: { label: 'Especiais', icon: Star, color: 'yellow-400' },
};

export default function AchievementsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/achievements');
      setData(res.data);
      // Trigger confetti if new achievements were unlocked
      if ((res.data.newly_unlocked || []).length > 0) {
        setTimeout(() => setCelebrate(true), 400);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async (type, format) => {
    setExporting(true);
    try {
      const response = await api.get(`/api/export/${type}?format=${format}&days=90`, {
        responseType: format === 'csv' ? 'blob' : 'json',
      });
      
      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gymie_${type}_90d.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gymie_${type}_90d.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) { console.error(err); }
    setExporting(false);
  };

  if (loading) return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton w-9 h-9 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-7 w-32" />
          <div className="skeleton h-4 w-44" />
        </div>
        <div className="skeleton w-10 h-10 rounded-gymie-sm" />
      </div>
      <div className="skeleton h-20 w-full rounded-gymie" />
      <div className="skeleton h-16 w-full rounded-gymie" />
      <div className="grid grid-cols-2 gap-2">
        {[0,1,2,3,4,5].map(i => <div key={i} className="skeleton h-28 rounded-gymie" />)}
      </div>
    </div>
  );

  const stats = data?.stats || { total: 0, unlocked: 0, percentage: 0 };
  const achievements = data?.achievements || [];
  const newlyUnlocked = data?.newly_unlocked || [];

  // Group by category
  const grouped = achievements.reduce((acc, a) => {
    const cat = a.category || 'special';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      <Confetti active={celebrate} onComplete={() => setCelebrate(false)} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-hl rounded-full transition-colors">
          <ChevronLeft size={20} className="text-txt-muted" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-txt-primary">Conquistas</h1>
          <p className="text-xs text-txt-muted">{stats.unlocked} de {stats.total} desbloqueadas</p>
        </div>
        <button 
          onClick={() => setShowExport(!showExport)}
          className="gymie-btn-secondary p-2.5"
        >
          <Download size={18} />
        </button>
      </div>

      {/* Export Panel */}
      {showExport && (
        <div className="gymie-card p-4 mb-5 animate-scale-in">
          <h3 className="text-sm font-semibold text-txt-primary mb-3 flex items-center gap-2">
            <FileText size={14} /> Exportar Dados
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { type: 'meals', label: 'Refeições', icon: UtensilsCrossed },
              { type: 'workouts', label: 'Treinos', icon: Dumbbell },
              { type: 'progress', label: 'Progresso', icon: Trophy },
            ].map((e) => (
              <div key={e.type} className="space-y-1">
                <p className="text-[10px] text-txt-muted uppercase text-center">{e.label}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleExport(e.type, 'csv')}
                    disabled={exporting}
                    className="flex-1 gymie-chip text-[10px] justify-center disabled:opacity-50"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport(e.type, 'json')}
                    disabled={exporting}
                    className="flex-1 gymie-chip text-[10px] justify-center disabled:opacity-50"
                  >
                    JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-txt-muted text-center">Últimos 90 dias</p>
        </div>
      )}

      {/* Newly Unlocked */}
      {newlyUnlocked.length > 0 && (
        <div className="gymie-card p-4 mb-5 border-gymie/50 bg-gymie/5 animate-slide-up">
          <p className="text-xs font-semibold text-gymie uppercase tracking-wider mb-2">🎉 Nova conquista!</p>
          {newlyUnlocked.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <span className="text-3xl">{a.icon}</span>
              <span className="text-lg font-semibold text-txt-primary">{a.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress Overview */}
      <div className="gymie-card p-5 mb-5 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-gymie" />
            <span className="font-semibold text-txt-primary">Progresso Geral</span>
          </div>
          <span className="text-2xl font-bold text-gymie font-data">{stats.percentage}%</span>
        </div>
        <div className="progress-bar h-3">
          <div 
            className="progress-bar-fill bg-gradient-to-r from-gymie to-orange-400" 
            style={{ width: `${stats.percentage}%` }} 
          />
        </div>
        <p className="text-xs text-txt-muted mt-2 text-center">
          {stats.unlocked} conquistas desbloqueadas
        </p>
      </div>

      {/* Achievements by Category */}
      {Object.entries(grouped).map(([category, achs]) => {
        const catInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS.special;
        const CatIcon = catInfo.icon;
        const unlockedCount = achs.filter(a => a.unlocked).length;
        
        return (
          <div key={category} className="mb-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-3">
              <CatIcon size={14} className={`text-${catInfo.color}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-txt-muted">
                {catInfo.label}
              </span>
              <span className="text-[10px] text-txt-muted">
                ({unlockedCount}/{achs.length})
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {achs.map((ach) => (
                <div
                  key={ach.id}
                  data-testid={`achievement-${ach.id}`}
                  className={`gymie-card p-4 transition-all ${
                    ach.unlocked 
                      ? 'border-gymie/30 bg-gymie/5' 
                      : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-2xl ${!ach.unlocked ? 'grayscale opacity-50' : ''}`}>
                      {ach.unlocked ? ach.icon : '🔒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${
                        ach.unlocked ? 'text-txt-primary' : 'text-txt-muted'
                      }`}>
                        {ach.name}
                      </p>
                      <p className="text-[10px] text-txt-muted mt-0.5 line-clamp-2">
                        {ach.description}
                      </p>
                      {!ach.unlocked && ach.target > 0 && (
                        <div className="mt-2">
                          <div className="progress-bar h-1.5">
                            <div 
                              className="progress-bar-fill bg-txt-muted" 
                              style={{ width: `${(ach.progress / ach.target) * 100}%` }} 
                            />
                          </div>
                          <p className="text-[9px] text-txt-muted mt-1">
                            {ach.progress}/{ach.target}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
