import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Droplet, Trash2, Plus } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function WaterPage() {
  const toast = useToast();
  const [data, setData] = useState({ logs: [], total_ml: 0, goal_ml: 2500 });
  const [loading, setLoading] = useState(true);

  const fetchWater = useCallback(async () => {
    try {
      const res = await api.get('/api/water');
      setData(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchWater(); }, [fetchWater]);

  const addWater = async (ml) => {
    try {
      await api.post('/api/water', { amount_ml: ml });
      fetchWater();
      toast(`+${ml}ml registrado! 💧`, 'success');
    } catch (err) { console.error(err); toast('Erro ao registrar água', 'error'); }
  };

  const deleteWater = async (id) => {
    try {
      await api.delete(`/api/water/${id}`);
      fetchWater();
      toast('Registro removido', 'info');
    } catch (err) { console.error(err); }
  };

  const pct = data.goal_ml > 0 ? Math.min((data.total_ml / data.goal_ml) * 100, 100) : 0;

  if (loading) return (
    <div className="px-4 pt-6 pb-4 space-y-6 max-w-md mx-auto">
      <div className="space-y-1">
        <div className="skeleton h-7 w-36" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="flex justify-center py-6">
        <div className="skeleton w-40 h-40 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0,1,2,3].map(i => <div key={i} className="skeleton h-16" />)}
      </div>
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Hidratacao</h1>
        <p className="text-xs text-txt-muted font-data">{new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      {/* Progress Circle */}
      <div data-testid="water-progress" className="flex flex-col items-center py-6">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#121212" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none" stroke="#00F0FF" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - pct / 100)}`}
              strokeLinecap="butt"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-data text-3xl text-info">{data.total_ml}</span>
            <span className="font-data text-xs text-txt-muted">/ {data.goal_ml}ml</span>
          </div>
        </div>
        <p className="font-data text-sm text-txt-secondary mt-3">{Math.round(pct)}% da meta</p>
      </div>

      {/* Quick Add Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {[200, 300, 500, 1000].map((ml) => (
          <button
            key={ml}
            data-testid={`water-quick-${ml}`}
            onClick={() => addWater(ml)}
            className="bg-info/10 border border-info/20 text-info py-3 flex flex-col items-center gap-1 hover:bg-info/20 active:scale-95 transition-all"
          >
            <Plus size={16} />
            <span className="font-data text-xs">{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}</span>
          </button>
        ))}
      </div>

      {/* Logs */}
      <div>
        <h2 className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-3">Historico de Hoje</h2>
        {data.logs.length === 0 ? (
          <div className="text-center py-8">
            <Droplet size={28} className="text-txt-muted mx-auto mb-2" strokeWidth={1} />
            <p className="text-sm text-txt-muted">Nenhum registro ainda.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {data.logs.map((log) => (
              <div key={log.id} data-testid="water-log-item" className="flex items-center justify-between bg-surface border border-border-default px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Droplet size={14} className="text-info" />
                  <span className="font-data text-sm text-info">{log.amount_ml}ml</span>
                  <span className="font-data text-[10px] text-txt-muted">{log.time}</span>
                </div>
                <button onClick={() => deleteWater(log.id)} className="text-txt-muted hover:text-danger transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
