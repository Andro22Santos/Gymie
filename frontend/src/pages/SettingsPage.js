import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  Settings,
  User,
  LogOut,
  MessageSquare,
  Check,
  ChevronRight,
  CreditCard,
  Download,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { hasFeature, normalizePlan } from '../utils/subscription';

const PLAN_LABELS = {
  free: 'Free',
  pro: 'Pro',
  elite: 'Elite',
};

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [persona, setPersona] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installSupported, setInstallSupported] = useState(false);

  const subscriptionPlan = normalizePlan(user?.profile?.subscription_plan);
  const subscriptionStatus = user?.profile?.subscription_status || 'inactive';
  const canInstallApp = hasFeature(subscriptionPlan, 'pwa_install');

  useEffect(() => {
    api.get('/api/settings/persona').then((res) => setPersona(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setInstallSupported(true);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstallSupported(false);
      toast('Gymie instalado com sucesso no dispositivo.', 'success');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [toast]);

  const changePersona = async (style) => {
    setSaving(true);
    try {
      await api.put('/api/settings/persona', { persona_style: style });
      setPersona((prev) => ({ ...prev, persona_style: style }));
      await refreshUser();
      const name = persona?.available_styles?.find((s) => s.id === style)?.name || style;
      toast(`Tom "${name}" ativado!`, 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar configuracao.', 'error');
    }
    setSaving(false);
  };

  const installApp = async () => {
    if (!canInstallApp) {
      toast('Instalacao PWA disponivel no plano Pro ou Elite.', 'info');
      return;
    }
    if (!deferredPrompt) {
      toast('Opcao de instalacao indisponivel neste navegador agora.', 'info');
      return;
    }

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } catch (err) {
      console.error(err);
      toast('Nao foi possivel iniciar a instalacao agora.', 'error');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-gymie" />
        <h1 className="text-2xl font-bold text-txt-primary">Configuracoes</h1>
      </div>

      <div className="gymie-card p-5 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gymie/10 flex items-center justify-center">
            <User size={24} className="text-gymie" />
          </div>
          <div className="flex-1">
            <p data-testid="settings-name" className="text-lg font-semibold text-txt-primary">
              {user?.name || 'Usuario'}
            </p>
            <p className="text-sm text-txt-muted">{user?.email || ''}</p>
          </div>
        </div>

        {user?.profile && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Peso', value: user.profile.weight, unit: 'kg', color: 'gymie' },
              { label: 'Meta agua', value: ((user.profile.water_goal_ml || 0) / 1000).toFixed(1), unit: 'L', color: 'sky-400' },
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

      <div className="gymie-card p-4 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-txt-primary">Plano e acesso</p>
            <p className="text-xs text-txt-muted mt-1">
              Plano atual: {PLAN_LABELS[subscriptionPlan]} ({subscriptionStatus})
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="gymie-btn-secondary py-2 px-3 flex items-center gap-2"
          >
            <CreditCard size={14} />
            Assinatura
          </button>
        </div>
      </div>

      <div className="gymie-card p-4 mb-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-txt-primary">Instalar no celular</p>
            <p className="text-xs text-txt-muted mt-1">
              Baixe o app para usar nos seus dispositivos.
            </p>
          </div>
          <button
            type="button"
            onClick={installApp}
            disabled={!installSupported || installing || !canInstallApp}
            className="gymie-btn-secondary py-2 px-3 flex items-center gap-2 disabled:opacity-50"
          >
            {installing ? <Check size={14} /> : <Download size={14} />}
            Instalar
          </button>
        </div>
        {!canInstallApp && (
          <p className="text-[11px] text-txt-disabled mt-2">
            Instalacao PWA liberada no Pro/Elite.
          </p>
        )}
      </div>

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
