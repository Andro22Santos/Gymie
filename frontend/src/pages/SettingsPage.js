import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { Settings, User, LogOut, MessageSquare, Check, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const [persona, setPersona] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/settings/persona').then((res) => setPersona(res.data)).catch(console.error);
  }, []);

  const changePersona = async (style) => {
    setSaving(true);
    try {
      await api.put('/api/settings/persona', { persona_style: style });
      setPersona((prev) => ({ ...prev, persona_style: style }));
      await refreshUser();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-gymie" />
        <h1 className="text-2xl font-bold text-txt-primary">Configurações</h1>
      </div>

      {/* Profile Card */}
      <div className="gymie-card p-5 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gymie/10 flex items-center justify-center">
            <User size={24} className="text-gymie" />
          </div>
          <div className="flex-1">
            <p data-testid="settings-name" className="text-lg font-semibold text-txt-primary">{user?.name || 'Usuário'}</p>
            <p className="text-sm text-txt-muted">{user?.email || ''}</p>
          </div>
        </div>
        {user?.profile && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Peso', value: user.profile.weight, unit: 'kg', color: 'gymie' },
              { label: 'Meta água', value: ((user.profile.water_goal_ml || 0) / 1000).toFixed(1), unit: 'L', color: 'sky-400' },
              { label: 'Calorias', value: user.profile.calorie_target, unit: 'kcal', color: 'orange-400' },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 bg-surface-hl rounded-gymie-sm">
                <p className={`text-lg font-bold font-data text-${s.color}`}>{s.value || '-'}</p>
                <p className="text-[9px] text-txt-muted uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Persona Selection */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={14} className="text-gymie" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-muted">Tom do Gymie</h2>
        </div>
        <div className="space-y-2">
          {persona?.available_styles?.map((style) => {
            const isActive = persona?.persona_style === style.id;
            return (
              <button
                key={style.id}
                data-testid={`persona-${style.id}`}
                onClick={() => changePersona(style.id)}
                disabled={saving}
                className={`w-full gymie-card p-4 text-left transition-all ${isActive ? 'border-gymie bg-gymie/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${isActive ? 'text-gymie' : 'text-txt-primary'}`}>
                      {style.name}
                    </p>
                    <p className="text-xs text-txt-muted mt-0.5">{style.description}</p>
                  </div>
                  {isActive ? (
                    <div className="w-6 h-6 rounded-full bg-gymie/20 flex items-center justify-center">
                      <Check size={14} className="text-gymie" />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-txt-muted" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout */}
      <button
        data-testid="logout-btn"
        onClick={logout}
        className="w-full gymie-card p-4 flex items-center justify-center gap-2 text-danger hover:bg-danger/5 transition-all"
      >
        <LogOut size={16} /> 
        <span className="font-medium">Sair da conta</span>
      </button>

      <p className="text-center text-[10px] text-txt-muted mt-6">Gymie v2.0.0</p>
    </div>
  );
}
