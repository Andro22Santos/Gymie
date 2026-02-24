import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { Settings, User, LogOut, MessageSquare, Check } from 'lucide-react';

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
    <div className="px-4 pt-6 pb-4 space-y-6">
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-tactical" strokeWidth={1.5} />
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Configuracoes</h1>
      </div>

      {/* Profile */}
      <div className="bg-surface border border-border-default p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-tactical/10 border border-tactical/30 flex items-center justify-center">
            <User size={24} className="text-tactical" strokeWidth={1.5} />
          </div>
          <div>
            <p data-testid="settings-name" className="font-ui text-lg font-bold text-txt-primary">{user?.name || 'Usuario'}</p>
            <p className="font-data text-xs text-txt-muted">{user?.email || ''}</p>
          </div>
        </div>
        {user?.profile && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="text-center bg-bg border border-border-default p-2">
              <p className="font-data text-sm text-tactical">{user.profile.weight || '-'}</p>
              <p className="text-[9px] text-txt-muted uppercase font-heading">Peso (kg)</p>
            </div>
            <div className="text-center bg-bg border border-border-default p-2">
              <p className="font-data text-sm text-info">{user.profile.water_goal_ml || '-'}</p>
              <p className="text-[9px] text-txt-muted uppercase font-heading">Meta agua</p>
            </div>
            <div className="text-center bg-bg border border-border-default p-2">
              <p className="font-data text-sm text-orange-400">{user.profile.calorie_target || '-'}</p>
              <p className="text-[9px] text-txt-muted uppercase font-heading">Calorias</p>
            </div>
          </div>
        )}
      </div>

      {/* Persona */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={14} className="text-tactical" strokeWidth={1.5} />
          <h2 className="font-heading text-xs uppercase tracking-wider text-txt-secondary">Estilo de Conversa</h2>
        </div>
        {persona?.available_styles?.map((style) => (
          <button
            key={style.id}
            data-testid={`persona-${style.id}`}
            onClick={() => changePersona(style.id)}
            disabled={saving}
            className={`w-full text-left p-4 border mb-2 transition-all ${persona?.persona_style === style.id ? 'border-tactical bg-tactical/5' : 'border-border-default hover:border-txt-muted'}`}
          >
            <div className="flex items-center justify-between">
              <p className={`font-ui text-sm font-bold uppercase tracking-wider ${persona?.persona_style === style.id ? 'text-tactical' : 'text-txt-primary'}`}>
                {style.name}
              </p>
              {persona?.persona_style === style.id && <Check size={16} className="text-tactical" />}
            </div>
            <p className="text-xs text-txt-secondary mt-1">{style.description}</p>
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        data-testid="logout-btn"
        onClick={logout}
        className="w-full border border-danger/30 text-danger py-3 flex items-center justify-center gap-2 hover:bg-danger/10 transition-all"
      >
        <LogOut size={16} /> <span className="font-ui text-sm uppercase tracking-wider">Sair</span>
      </button>

      <p className="text-center text-[10px] text-txt-muted font-data mt-4">Shape Inexplicavel v1.0.0</p>
    </div>
  );
}
