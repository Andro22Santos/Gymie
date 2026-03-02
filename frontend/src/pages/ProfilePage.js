import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  ArrowLeft, Scale, Target, Flame, Droplet,
  Trophy, TrendingUp, Settings, Upload, FileText,
  CheckCircle, X, ChevronRight,
} from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [contextFile, setContextFile] = useState(null);

  useEffect(() => {
    const existing = localStorage.getItem('gymie_user_context');
    if (existing) {
      const name = localStorage.getItem('gymie_user_context_name') || 'contexto.md';
      setContextFile({ name, size: existing.length });
    }
  }, []);

  const handleMdUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(md|txt)$/i) && !file.type.includes('markdown') && !file.type.includes('text/plain')) {
      toast('Envie um arquivo .md (Markdown)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      localStorage.setItem('gymie_user_context', content);
      localStorage.setItem('gymie_user_context_name', file.name);
      setContextFile({ name: file.name, size: content.length });
      toast('Contexto carregado! A IA agora sabe mais sobre você.', 'success', 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const removeContext = () => {
    localStorage.removeItem('gymie_user_context');
    localStorage.removeItem('gymie_user_context_name');
    setContextFile(null);
    toast('Contexto removido', 'info');
  };

  const profile = user?.profile || {};
  const initials = (user?.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-surface-hl rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-txt-muted" />
        </button>
        <h1 className="text-2xl font-bold text-txt-primary flex-1">Meu Perfil</h1>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-surface-hl rounded-full transition-colors"
          title="Configurações"
        >
          <Settings size={18} className="text-txt-muted" />
        </button>
      </div>

      {/* Avatar + name */}
      <div className="gymie-card p-6 mb-4 flex flex-col items-center text-center animate-slide-up">
        <div className="w-20 h-20 rounded-full bg-gymie/15 border-2 border-gymie/30 flex items-center justify-center mb-3">
          <span className="text-2xl font-bold text-gymie font-heading">{initials}</span>
        </div>
        <h2 className="text-xl font-bold text-txt-primary">{user?.name || 'Usuário'}</h2>
        <p className="text-sm text-txt-muted mt-0.5">{user?.email || ''}</p>
        {profile.goal && (
          <span className="mt-2 text-xs px-3 py-1 rounded-full bg-gymie/10 text-gymie font-medium">
            {profile.goal}
          </span>
        )}
      </div>

      {/* Body stats */}
      <div className="gymie-card p-5 mb-4 animate-slide-up stagger-1">
        <div className="flex items-center gap-2 mb-4">
          <Scale size={14} className="text-gymie" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-muted">Medidas Corporais</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Peso',   value: profile.weight, unit: 'kg',   color: '#00E04B' },
            { label: 'Altura', value: profile.height, unit: 'cm',   color: '#FB923C' },
            { label: 'Idade',  value: profile.age,    unit: 'anos', color: '#A855F7' },
          ].map((s) => (
            <div key={s.label} className="bg-surface-hl rounded-gymie-sm p-3 text-center">
              <p className="text-xl font-bold font-data" style={{ color: s.color }}>
                {s.value || '—'}
              </p>
              <p className="text-[10px] text-txt-muted mt-0.5">{s.label}</p>
              {s.value && <p className="text-[9px] text-txt-disabled">{s.unit}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Daily targets */}
      <div className="gymie-card p-5 mb-4 animate-slide-up stagger-2">
        <div className="flex items-center gap-2 mb-4">
          <Target size={14} className="text-gymie" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-muted">Metas Diárias</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Calorias', value: profile.calorie_target,                            unit: 'kcal', color: '#FB923C', Icon: Flame   },
            { label: 'Proteína', value: profile.protein_target,                            unit: 'g',    color: '#00E04B', Icon: Target  },
            { label: 'Água',     value: ((profile.water_goal_ml || 0) / 1000).toFixed(1), unit: 'L',    color: '#38BDF8', Icon: Droplet },
          ].map(({ label, value, unit, color, Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-gymie-sm flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <p className="text-sm text-txt-secondary flex-1">{label}</p>
              <span className="text-sm font-bold font-data text-txt-primary">
                {value || '—'} <span className="text-[10px] text-txt-muted font-normal">{unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Macros */}
      {(profile.protein_target || profile.carbs_target || profile.fat_target) && (
        <div className="gymie-card p-5 mb-4 animate-slide-up stagger-3">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={14} className="text-gymie" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-muted">Macros / Dia</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Proteína', value: profile.protein_target, unit: 'g', color: '#00E04B' },
              { label: 'Carbs',    value: profile.carbs_target,   unit: 'g', color: '#FB923C' },
              { label: 'Gordura',  value: profile.fat_target,     unit: 'g', color: '#FACC15' },
            ].map((m) => (
              <div key={m.label} className="bg-surface-hl rounded-gymie-sm p-3">
                <p className="text-lg font-bold font-data" style={{ color: m.color }}>
                  {m.value || '—'}
                </p>
                <p className="text-[9px] text-txt-muted mt-0.5">{m.label} ({m.unit})</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Context Upload */}
      <div className="gymie-card p-5 mb-4 animate-slide-up stagger-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={14} className="text-gymie" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-txt-muted">Contexto para IA</h3>
          <span className="text-[9px] bg-surface-elevated text-txt-disabled px-1.5 py-0.5 rounded-full ml-auto">
            Opcional
          </span>
        </div>
        <p className="text-xs text-txt-muted mt-2 mb-4 leading-relaxed">
          Envie um <strong className="text-txt-secondary">.md</strong> com informações suas: histórico
          médico, preferências alimentares, lesões, rotina. A IA lerá esse contexto em todas as conversas.
        </p>

        {contextFile ? (
          <div className="flex items-center gap-3 p-3 bg-gymie/5 border border-gymie/20 rounded-gymie-sm">
            <CheckCircle size={16} className="text-gymie flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gymie truncate">{contextFile.name}</p>
              <p className="text-[10px] text-txt-muted">
                {(contextFile.size / 1024).toFixed(1)} KB · IA já tem seu contexto
              </p>
            </div>
            <button
              onClick={removeContext}
              className="p-1.5 hover:bg-surface-hl rounded-full transition-colors flex-shrink-0"
            >
              <X size={14} className="text-txt-muted" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-5 px-4 border border-dashed border-border-hover rounded-gymie-sm flex flex-col items-center justify-center gap-2 text-sm text-txt-muted hover:border-gymie/40 hover:text-gymie hover:bg-gymie/5 transition-all"
          >
            <Upload size={22} />
            <span>Selecionar arquivo .md</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={handleMdUpload}
        />
        <p className="text-[10px] text-txt-disabled mt-3 text-center">
          Salvo localmente no dispositivo. Nada enviado a servidores externos.
        </p>
      </div>

      {/* Quick links */}
      <div className="space-y-2 animate-slide-up stagger-5">
        {[
          { label: 'Ver Progresso',  Icon: TrendingUp, path: '/progress',     color: '#00E04B' },
          { label: 'Conquistas',     Icon: Trophy,     path: '/achievements', color: '#FACC15' },
          { label: 'Configurações',  Icon: Settings,   path: '/settings',     color: '#A855F7' },
        ].map(({ label, Icon, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="w-full gymie-card p-4 flex items-center gap-3 hover:border-border-hover transition-all"
          >
            <div
              className="w-8 h-8 rounded-gymie-sm flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon size={16} style={{ color }} />
            </div>
            <span className="text-sm text-txt-primary flex-1 text-left">{label}</span>
            <ChevronRight size={16} className="text-txt-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
