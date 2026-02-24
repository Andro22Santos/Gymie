import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { Target, ChevronLeft, ChevronRight, Check, User, Ruler, Dumbbell, Droplet, Clock, MessageSquare } from 'lucide-react';

const STEPS = [
  { title: 'Perfil', icon: User },
  { title: 'Dados Fisicos', icon: Ruler },
  { title: 'Objetivo', icon: Target },
  { title: 'Dias de Treino', icon: Dumbbell },
  { title: 'Hidratacao', icon: Droplet },
  { title: 'Horarios', icon: Clock },
  { title: 'Estilo', icon: MessageSquare },
  { title: 'Confirmar', icon: Check },
];

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const DAY_LABELS = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sab', domingo: 'Dom' };

const PERSONAS = [
  { id: 'tactical', name: 'Tatico', desc: 'Estilo militar com humor leve. Missoes e vitorias operacionais.', emoji: 'radio' },
  { id: 'coach', name: 'Coach Parceiro', desc: 'Motivador e acolhedor. Celebra cada passo.', emoji: 'hands' },
  { id: 'direct', name: 'Direto', desc: 'Objetivo e pratico. Sem rodeios.', emoji: 'bolt' },
  { id: 'neutral', name: 'Neutro', desc: 'Equilibrado e informativo.', emoji: 'balance' },
];

export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    weight: '', height: '', goal: 'Emagrecimento', goal_weight: '',
    routine: { wake_up: '07:00', work_start: '09:00', lunch: '12:00', work_end: '18:00', workout: '17:30', dinner: '21:00', sleep: '23:30' },
    training_days: ['segunda', 'quarta', 'sexta'],
    water_goal_ml: 2500,
    reminder_times: ['08:00', '11:00', '12:00', '17:30', '21:15', '23:00'],
    persona_style: 'tactical',
    calorie_target: 2000, protein_target: 150, carb_target: 200, fat_target: 65,
  });

  const update = (key, val) => setData((prev) => ({ ...prev, [key]: val }));
  const updateRoutine = (key, val) => setData((prev) => ({ ...prev, routine: { ...prev.routine, [key]: val } }));

  const toggleDay = (day) => {
    setData((prev) => ({
      ...prev,
      training_days: prev.training_days.includes(day)
        ? prev.training_days.filter((d) => d !== day)
        : [...prev.training_days, day],
    }));
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        weight: parseFloat(data.weight) || null,
        height: parseFloat(data.height) || null,
        goal_weight: parseFloat(data.goal_weight) || null,
        water_goal_ml: parseInt(data.water_goal_ml) || 2500,
        calorie_target: parseInt(data.calorie_target) || 2000,
        protein_target: parseInt(data.protein_target) || 150,
        carb_target: parseInt(data.carb_target) || 200,
        fat_target: parseInt(data.fat_target) || 65,
        onboarding_completed: true,
      };
      await api.post('/api/onboarding/complete', payload);
      await refreshUser();
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, value, onChange, type = 'text', placeholder = '', suffix = '' }) => (
    <div>
      <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical px-4 py-3 outline-none transition-all"
          placeholder={placeholder}
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-muted text-sm">{suffix}</span>}
      </div>
    </div>
  );

  const TimeField = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-txt-secondary">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border-default text-txt-primary focus:border-tactical px-3 py-1.5 text-sm outline-none"
      />
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Vamos comecar configurando seu perfil.</p>
          <InputField label="Peso atual" value={data.weight} onChange={(v) => update('weight', v)} type="number" placeholder="85" suffix="kg" />
          <InputField label="Altura" value={data.height} onChange={(v) => update('height', v)} type="number" placeholder="178" suffix="cm" />
        </div>
      );
      case 1: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Seus alvos de macronutrientes diarios.</p>
          <InputField label="Calorias" value={data.calorie_target} onChange={(v) => update('calorie_target', v)} type="number" placeholder="2000" suffix="kcal" />
          <InputField label="Proteina" value={data.protein_target} onChange={(v) => update('protein_target', v)} type="number" placeholder="150" suffix="g" />
          <InputField label="Carboidrato" value={data.carb_target} onChange={(v) => update('carb_target', v)} type="number" placeholder="200" suffix="g" />
          <InputField label="Gordura" value={data.fat_target} onChange={(v) => update('fat_target', v)} type="number" placeholder="65" suffix="g" />
        </div>
      );
      case 2: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Qual e seu objetivo principal?</p>
          <InputField label="Meta de peso" value={data.goal_weight} onChange={(v) => update('goal_weight', v)} type="number" placeholder="75" suffix="kg" />
          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-2 block">Objetivo</label>
            <div className="grid grid-cols-1 gap-2">
              {['Emagrecimento', 'Recomposicao corporal', 'Ganho de massa', 'Manutencao'].map((g) => (
                <button
                  key={g}
                  onClick={() => update('goal', g)}
                  className={`text-left px-4 py-3 border transition-all text-sm ${data.goal === g ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-secondary hover:border-txt-muted'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Em quais dias voce treina?</p>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`py-3 border text-center text-sm font-ui uppercase tracking-wider transition-all ${data.training_days.includes(day) ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted hover:border-txt-muted'}`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </div>
      );
      case 4: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Defina sua meta diaria de agua.</p>
          <div className="text-center">
            <p className="font-data text-5xl text-tactical mb-2">{data.water_goal_ml}</p>
            <p className="text-txt-muted text-sm">ml / dia</p>
          </div>
          <div className="flex justify-center gap-3">
            {[2000, 2500, 3000, 3500].map((v) => (
              <button
                key={v}
                onClick={() => update('water_goal_ml', v)}
                className={`px-4 py-2 border text-sm font-data transition-all ${data.water_goal_ml === v ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted hover:border-txt-muted'}`}
              >
                {v / 1000}L
              </button>
            ))}
          </div>
        </div>
      );
      case 5: return (
        <div className="space-y-4 animate-slide-up">
          <p className="text-txt-secondary text-sm">Configure sua rotina diaria.</p>
          <div className="bg-surface border border-border-default p-4 space-y-3">
            <TimeField label="Acordar" value={data.routine.wake_up} onChange={(v) => updateRoutine('wake_up', v)} />
            <TimeField label="Trabalho" value={data.routine.work_start} onChange={(v) => updateRoutine('work_start', v)} />
            <TimeField label="Almoco" value={data.routine.lunch} onChange={(v) => updateRoutine('lunch', v)} />
            <TimeField label="Fim trabalho" value={data.routine.work_end} onChange={(v) => updateRoutine('work_end', v)} />
            <TimeField label="Treino" value={data.routine.workout} onChange={(v) => updateRoutine('workout', v)} />
            <TimeField label="Jantar" value={data.routine.dinner} onChange={(v) => updateRoutine('dinner', v)} />
            <TimeField label="Dormir" value={data.routine.sleep} onChange={(v) => updateRoutine('sleep', v)} />
          </div>
        </div>
      );
      case 6: return (
        <div className="space-y-4 animate-slide-up">
          <p className="text-txt-secondary text-sm">Escolha o estilo de conversa do seu assistente.</p>
          <div className="space-y-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => update('persona_style', p.id)}
                className={`w-full text-left p-4 border transition-all ${data.persona_style === p.id ? 'border-tactical bg-tactical/5' : 'border-border-default hover:border-txt-muted'}`}
              >
                <p className={`font-ui text-sm font-bold uppercase tracking-wider ${data.persona_style === p.id ? 'text-tactical' : 'text-txt-primary'}`}>{p.name}</p>
                <p className="text-xs text-txt-secondary mt-1">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>
      );
      case 7: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Confira seus dados antes de comecar.</p>
          <div className="bg-surface border border-border-default p-4 space-y-3 text-sm">
            <Row label="Peso" value={`${data.weight || '-'} kg`} />
            <Row label="Altura" value={`${data.height || '-'} cm`} />
            <Row label="Objetivo" value={data.goal} />
            <Row label="Meta peso" value={`${data.goal_weight || '-'} kg`} />
            <Row label="Calorias" value={`${data.calorie_target} kcal`} />
            <Row label="Proteina" value={`${data.protein_target}g`} />
            <Row label="Agua" value={`${data.water_goal_ml}ml`} />
            <Row label="Treino" value={data.training_days.map((d) => DAY_LABELS[d]).join(', ')} />
            <Row label="Persona" value={PERSONAS.find((p) => p.id === data.persona_style)?.name || 'Tatico'} />
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-8">
      <div className="max-w-sm mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className={`h-1 flex-1 transition-all duration-300 ${i <= step ? 'bg-tactical' : 'bg-border-default'}`} />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6">
          {React.createElement(STEPS[step].icon, { size: 20, className: 'text-tactical', strokeWidth: 1.5 })}
          <h2 className="font-heading text-xl font-bold uppercase tracking-tight">{STEPS[step].title}</h2>
          <span className="ml-auto font-data text-xs text-txt-muted">{step + 1}/{STEPS.length}</span>
        </div>

        {renderStep()}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              data-testid="onboarding-back"
              onClick={() => setStep(step - 1)}
              className="flex-1 border border-border-default text-txt-secondary py-3 hover:border-txt-muted transition-all flex items-center justify-center gap-2"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              data-testid="onboarding-next"
              onClick={() => setStep(step + 1)}
              className="flex-1 bg-tactical text-black font-bold uppercase tracking-wider py-3 hover:bg-tactical-dim active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              Proximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              data-testid="onboarding-complete"
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 bg-tactical text-black font-bold uppercase tracking-wider py-3 hover:bg-tactical-dim active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              {loading ? 'Salvando...' : 'Comecar Missao'} <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-txt-muted">{label}</span>
      <span className="text-txt-primary font-data">{value}</span>
    </div>
  );
}
