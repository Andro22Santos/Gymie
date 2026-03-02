import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, Loader2, Sparkles } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { normalizePlan } from '../utils/subscription';
import { useToast } from '../context/ToastContext';

const FALLBACK_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price_label: 'R$ 0',
    description: 'Base para iniciar no Gymie.',
    features: ['Planos manuais', 'Registro de refeicoes', 'Progresso'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_label: 'R$ 29/m',
    description: 'Recursos de IA para treino e nutricao.',
    features: ['Treino com IA', 'Foto de refeicao com IA', 'Lista de alimentos'],
  },
  {
    id: 'elite',
    name: 'Elite',
    price_label: 'R$ 59/m',
    description: 'Plano completo para automacao total.',
    features: ['Tudo do Pro', 'Recursos em tempo real', 'Prioridade'],
  },
];

export default function BillingPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState('');

  const currentPlan = normalizePlan(user?.profile?.subscription_plan);
  const currentStatus = user?.profile?.subscription_status || 'inactive';

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/billing/plans');
      const serverPlans = res.data?.plans;
      if (Array.isArray(serverPlans) && serverPlans.length > 0) {
        setPlans(serverPlans);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const startCheckout = async (planId) => {
    if (!planId || planId === 'free') return;
    setCheckoutLoading(planId);
    try {
      const res = await api.post('/api/billing/checkout', { plan: planId });
      const checkoutUrl = res.data?.checkout_url;
      if (!checkoutUrl) {
        toast('URL de checkout nao configurada.', 'error');
        return;
      }
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error(err);
      toast('Nao foi possivel iniciar o checkout agora.', 'error');
    } finally {
      setCheckoutLoading('');
    }
  };

  const refreshBilling = async () => {
    try {
      await refreshUser();
      toast('Status de assinatura atualizado.', 'success');
    } catch (err) {
      console.error(err);
      toast('Nao foi possivel atualizar agora.', 'error');
    }
  };

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="gymie-btn-ghost p-2 flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          Voltar
        </button>
        <h1 className="text-xl font-bold text-txt-primary flex items-center gap-2">
          <CreditCard size={18} className="text-gymie" />
          Assinatura
        </h1>
      </div>

      <div className="gymie-card p-4 mb-4">
        <p className="text-xs uppercase tracking-wider text-txt-muted">Plano atual</p>
        <p className="text-lg font-semibold text-txt-primary mt-1">{currentPlan.toUpperCase()}</p>
        <p className="text-xs text-txt-muted mt-1">Status: {currentStatus}</p>
        <button type="button" onClick={refreshBilling} className="text-xs text-gymie mt-2 hover:opacity-80">
          Atualizar status
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="gymie-card p-4 flex items-center gap-2 text-sm text-txt-muted">
            <Loader2 size={16} className="animate-spin" />
            Carregando planos...
          </div>
        ) : (
          plans.map((plan) => {
            const planId = normalizePlan(plan.id);
            const isCurrent = planId === currentPlan;
            return (
              <div
                key={planId}
                className={`gymie-card p-4 ${isCurrent ? 'border-gymie/40 bg-gymie/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-txt-primary flex items-center gap-2">
                      {plan.name || planId.toUpperCase()}
                      {planId !== 'free' && <Sparkles size={12} className="text-gymie" />}
                    </p>
                    <p className="text-xs text-txt-muted mt-1">{plan.description}</p>
                  </div>
                  <p className="text-sm font-semibold text-gymie">{plan.price_label || '-'}</p>
                </div>
                <div className="mt-3 space-y-1.5">
                  {(plan.features || []).map((feature) => (
                    <p key={feature} className="text-xs text-txt-secondary flex items-center gap-1.5">
                      <Check size={11} className="text-gymie" />
                      {feature}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => startCheckout(planId)}
                  disabled={isCurrent || checkoutLoading === planId || planId === 'free'}
                  className="w-full mt-3 gymie-btn-primary disabled:opacity-40"
                >
                  {isCurrent
                    ? 'Plano atual'
                    : checkoutLoading === planId
                      ? 'Abrindo checkout...'
                      : `Assinar ${plan.name || planId.toUpperCase()}`}
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-txt-muted mt-4">
        Checkout e controle de acesso integrados para Stripe.
      </p>
    </div>
  );
}
