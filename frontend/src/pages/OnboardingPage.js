import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  Target, ChevronLeft, ChevronRight, Check,
  User, Ruler, Dumbbell, Droplet, Clock, MessageSquare, Zap,
} from 'lucide-react';

// ── Fórmula Mifflin-St Jeor (simplificado, sexo masculino por padrão) ──
function calcMacros(weight, height, goal, trainingDays) {
  const w = parseFloat(weight) || 80;
  const h = parseFloat(height) || 175;
  const age = 30; // valor padrão
  const bmr = 10 * w + 6.25 * h - 5 * age + 5;
  const activityMap = { 0: 1.2, 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.55, 5: 1.725, 6: 1.725, 7: 1.9 };
  const tdee = bmr * (activityMap[trainingDays] ?? 1.55);
  const goalAdj = { 'Emagrecimento': -400, 'Recomposicao corporal': 0, 'Ganho de massa': 350, 'Manutencao': 0 };
  const calories = Math.round(tdee + (goalAdj[goal] ?? 0));
  const protein  = Math.round(w * (goal === 'Ganho de massa' ? 2.2 : 1.8));
  const fat      = Math.round(w * 0.9);
  const carbs    = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { calories, protein, carbs: Math.max(carbs, 80), fat };
}

const STEPS = [
  { title: 'Perfil',        icon: User },
  { title: 'Objetivo',      icon: Target },
  { title: 'Seus Macros',   icon: Zap },
  { title: 'Dias de Treino', icon: Dumbbell },
  { title: 'Hidratação',    icon: Droplet },
  { title: 'Horários',      icon: Clock },
  { title: 'Estilo IA',     icon: MessageSquare },
  { title: 'Confirmar',     icon: Check },
];

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const DAY_LABELS = { segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb', domingo: 'Dom' };

const PERSONAS = [
  { id: 'tactical', name: 'Tático',         desc: 'Estilo militar com humor leve. Missões e vitórias operacionais.', emoji: '🎯' },
  { id: 'coach',    name: 'Coach Parceiro', desc: 'Motivador e acolhedor. Celebra cada passo.',                     emoji: '🙌' },
  { id: 'direct',   name: 'Direto',         desc: 'Objetivo e prático. Sem rodeios.',                               emoji: '⚡' },
  { id: 'neutral',  name: 'Neutro',         desc: 'Equilibrado e informativo.',                                     emoji: '⚖️' },
];

// ── Componentes puros fora do render (evita perda de foco) ──────
function InputField({ label, value, onChange, type = 'text', placeholder = '', suffix = '', autoFocus = false }) {
  return (
    <div>
      <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full bg-surface border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical focus:ring-1 focus:ring-tactical/30 px-4 py-3 outline-none transition-all rounded-gymie-sm"
          placeholder={placeholder}
          inputMode={type === 'number' ? 'decimal' : 'text'}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-txt-muted text-sm pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-txt-secondary">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border-default text-txt-primary focus:border-tactical px-3 py-1.5 text-sm outline-none rounded-gymie-sm"
      />
    </div>
  );
}

function MacroTag({ label, value, unit, color }) {
  return (
    <div className="flex-1 text-center p-3 bg-surface-hl rounded-gymie-sm">
      <p className={`text-lg font-bold font-data ${color}`}>{value}</p>
      <p className="text-[9px] text-txt-muted uppercase">{unit}</p>
      <p className="text-[10px] text-txt-secondary mt-0.5">{label}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-txt-muted text-sm">{label}</span>
      <span className="text-txt-primary font-data text-sm">{value}</span>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────
export default function OnboardingPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    weight: '', height: '', goal: 'Ganho de massa', goal_weight: '',
    routine: { wake_up: '07:00', work_start: '09:00', lunch: '12:00', work_end: '18:00', workout: '17:30', dinner: '21:00', sleep: '23:30' },
    training_days: ['segunda', 'quarta', 'sexta'],
    water_goal_ml: 2500,
    persona_style: 'tactical',
    calorie_target: 2500, protein_target: 160, carb_target: 280, fat_target: 72,
  });

  const update = useCallback((key, val) => setData((prev) => ({ ...prev, [key]: val })), []);
  const updateRoutine = useCallback((key, val) => setData((prev) => ({ ...prev, routine: { ...prev.routine, [key]: val } })), []);

  const toggleDay = useCallback((day) => {
    setData((prev) => ({
      ...prev,
      training_days: prev.training_days.includes(day)
        ? prev.training_days.filter((d) => d !== day)
        : [...prev.training_days, day],
    }));
  }, []);

  // Avançar step: no step 1→2, calcula macros automaticamente
  const handleNext = () => {
    if (step === 1) {
      const m = calcMacros(data.weight, data.height, data.goal, data.training_days.length);
      setData((prev) => ({
        ...prev,
        calorie_target: m.calories,
        protein_target: m.protein,
        carb_target: m.carbs,
        fat_target: m.fat,
      }));
    }
    setStep((s) => s + 1);
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

  const handleSkip = async () => {
    setLoading(true);
    try {
      const m = calcMacros(data.weight || '80', data.height || '175', data.goal, data.training_days.length);
      const payload = {
        ...data,
        weight: parseFloat(data.weight) || 80,
        height: parseFloat(data.height) || 175,
        goal_weight: null,
        water_goal_ml: 2500,
        calorie_target: m.calories,
        protein_target: m.protein,
        carb_target: m.carbs,
        fat_target: m.fat,
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

  const renderStep = () => {
    switch (step) {
      // Step 0 — Perfil
      case 0: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Vamos começar configurando seu perfil físico.</p>
          <InputField label="Peso atual" value={data.weight} onChange={(v) => update('weight', v)} type="number" placeholder="80" suffix="kg" autoFocus />
          <InputField label="Altura" value={data.height} onChange={(v) => update('height', v)} type="number" placeholder="175" suffix="cm" />
        </div>
      );

      // Step 1 — Objetivo
      case 1: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Qual é seu objetivo principal?</p>
          <InputField label="Meta de peso" value={data.goal_weight} onChange={(v) => update('goal_weight', v)} type="number" placeholder="75" suffix="kg" autoFocus />
          <div>
            <label className="font-heading text-xs uppercase tracking-wider text-txt-secondary mb-2 block">Objetivo</label>
            <div className="grid grid-cols-1 gap-2">
              {['Emagrecimento', 'Recomposicao corporal', 'Ganho de massa', 'Manutencao'].map((g) => (
                <button
                  key={g}
                  onClick={() => update('goal', g)}
                  className={`text-left px-4 py-3 border transition-all text-sm rounded-gymie-sm ${data.goal === g ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-secondary hover:border-txt-muted'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

      // Step 2 — Macros (calculados automaticamente, editáveis)
      case 2: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Calculei suas metas com base no seu perfil. Você pode ajustar se quiser.</p>
          <div className="flex gap-2 mb-2">
            <MacroTag label="Calorias" value={data.calorie_target} unit="kcal" color="text-gymie" />
            <MacroTag label="Proteína" value={data.protein_target} unit="g" color="text-orange-400" />
            <MacroTag label="Carbs" value={data.carb_target} unit="g" color="text-sky-400" />
            <MacroTag label="Gordura" value={data.fat_target} unit="g" color="text-purple-400" />
          </div>
          <InputField label="Calorias" value={String(data.calorie_target)} onChange={(v) => update('calorie_target', v)} type="number" suffix="kcal" />
          <InputField label="Proteína" value={String(data.protein_target)} onChange={(v) => update('protein_target', v)} type="number" suffix="g" />
          <InputField label="Carboidratos" value={String(data.carb_target)} onChange={(v) => update('carb_target', v)} type="number" suffix="g" />
          <InputField label="Gordura" value={String(data.fat_target)} onChange={(v) => update('fat_target', v)} type="number" suffix="g" />
        </div>
      );

      // Step 3 — Dias de treino
      case 3: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Em quais dias você treina?</p>
          <div className="grid grid-cols-4 gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`py-3 border text-center text-sm font-ui uppercase tracking-wider transition-all rounded-gymie-sm ${data.training_days.includes(day) ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted hover:border-txt-muted'}`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
          <p className="text-xs text-txt-muted">{data.training_days.length} dias selecionados</p>
        </div>
      );

      // Step 4 — Hidratação
      case 4: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Defina sua meta diária de água.</p>
          <div className="text-center">
            <p className="font-data text-5xl text-tactical mb-1">{(data.water_goal_ml / 1000).toFixed(1)}</p>
            <p className="text-txt-muted text-sm">litros por dia</p>
          </div>
          <div className="flex justify-center gap-3">
            {[1500, 2000, 2500, 3000, 3500].map((v) => (
              <button
                key={v}
                onClick={() => update('water_goal_ml', v)}
                className={`px-3 py-2 border text-sm font-data transition-all rounded-gymie-sm ${data.water_goal_ml === v ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted hover:border-txt-muted'}`}
              >
                {v / 1000}L
              </button>
            ))}
          </div>
        </div>
      );

      // Step 5 — Horários
      case 5: return (
        <div className="space-y-4 animate-slide-up">
          <p className="text-txt-secondary text-sm">Configure sua rotina diária para os lembretes.</p>
          <div className="bg-surface border border-border-default p-4 space-y-3 rounded-gymie">
            <TimeField label="Acordar"     value={data.routine.wake_up}    onChange={(v) => updateRoutine('wake_up', v)} />
            <TimeField label="Trabalho"    value={data.routine.work_start} onChange={(v) => updateRoutine('work_start', v)} />
            <TimeField label="Almoço"      value={data.routine.lunch}      onChange={(v) => updateRoutine('lunch', v)} />
            <TimeField label="Fim trabalho" value={data.routine.work_end}  onChange={(v) => updateRoutine('work_end', v)} />
            <TimeField label="Treino"      value={data.routine.workout}    onChange={(v) => updateRoutine('workout', v)} />
            <TimeField label="Jantar"      value={data.routine.dinner}     onChange={(v) => updateRoutine('dinner', v)} />
            <TimeField label="Dormir"      value={data.routine.sleep}      onChange={(v) => updateRoutine('sleep', v)} />
          </div>
        </div>
      );

      // Step 6 — Estilo IA
      case 6: return (
        <div className="space-y-4 animate-slide-up">
          <p className="text-txt-secondary text-sm">Escolha como o Gymie vai conversar com você.</p>
          <div className="space-y-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => update('persona_style', p.id)}
                className={`w-full text-left p-4 border transition-all rounded-gymie ${data.persona_style === p.id ? 'border-tactical bg-tactical/5' : 'border-border-default hover:border-txt-muted'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{p.emoji}</span>
                  <div>
                    <p className={`font-ui text-sm font-bold uppercase tracking-wider ${data.persona_style === p.id ? 'text-tactical' : 'text-txt-primary'}`}>{p.name}</p>
                    <p className="text-xs text-txt-secondary mt-0.5">{p.desc}</p>
                  </div>
                  {data.persona_style === p.id && <Check size={16} className="text-tactical ml-auto" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      );

      // Step 7 — Resumo
      case 7: return (
        <div className="space-y-5 animate-slide-up">
          <p className="text-txt-secondary text-sm">Confira seus dados antes de começar.</p>
          <div className="bg-surface border border-border-default p-4 space-y-1 rounded-gymie">
            <Row label="Peso atual"     value={data.weight     ? `${data.weight} kg`      : '—'} />
            <Row label="Altura"         value={data.height     ? `${data.height} cm`      : '—'} />
            <Row label="Objetivo"       value={data.goal} />
            <Row label="Meta de peso"   value={data.goal_weight ? `${data.goal_weight} kg` : '—'} />
            <div className="border-t border-border-default my-2" />
            <Row label="Calorias/dia"   value={`${data.calorie_target} kcal`} />
            <Row label="Proteína"       value={`${data.protein_target}g`} />
            <Row label="Carboidratos"   value={`${data.carb_target}g`} />
            <Row label="Gordura"        value={`${data.fat_target}g`} />
            <div className="border-t border-border-default my-2" />
            <Row label="Água/dia"       value={`${(data.water_goal_ml / 1000).toFixed(1)}L`} />
            <Row label="Dias de treino" value={data.training_days.map((d) => DAY_LABELS[d]).join(', ') || '—'} />
            <Row label="Estilo Gymie"   value={PERSONAS.find((p) => p.id === data.persona_style)?.name || 'Tático'} />
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-8">
      <div className="max-w-sm mx-auto">
        {/* Progresso */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 transition-all duration-300 rounded-full ${i <= step ? 'bg-tactical' : 'bg-border-default'}`} />
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
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 border border-border-default text-txt-secondary py-3 hover:border-txt-muted transition-all flex items-center justify-center gap-2 rounded-gymie-sm"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              data-testid="onboarding-next"
              onClick={handleNext}
              className="flex-1 bg-tactical text-black font-bold uppercase tracking-wider py-3 hover:bg-tactical-dim active:scale-[0.98] transition-all flex items-center justify-center gap-2 rounded-gymie-sm"
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              data-testid="onboarding-complete"
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 bg-tactical text-black font-bold uppercase tracking-wider py-3 hover:bg-tactical-dim active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-gymie-sm"
            >
              {loading ? 'Salvando...' : 'Começar'} <Check size={16} />
            </button>
          )}
        </div>

        {/* Pular configuração — só aparece antes do último step */}
        {step < STEPS.length - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={handleSkip}
              disabled={loading}
              className="text-xs text-txt-disabled hover:text-txt-muted transition-colors disabled:opacity-50"
            >
              Pular e configurar depois
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
