import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { 
  UtensilsCrossed, Plus, X, Trash2, Clock, Camera, Loader2, 
  Sparkles, Check, AlertCircle, ChevronDown, ChevronUp, Edit3, RefreshCw
} from 'lucide-react';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Café', emoji: '☀️' },
  { id: 'snack', label: 'Lanche', emoji: '🍎' },
  { id: 'lunch', label: 'Almoço', emoji: '🍽️' },
  { id: 'dinner', label: 'Jantar', emoji: '🌙' },
  { id: 'pre_workout', label: 'Pré-treino', emoji: '💪' },
  { id: 'post_workout', label: 'Pós-treino', emoji: '🏋️' },
];

export default function MealsPage() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: input, 2: analysis result, 3: edit details
  const [form, setForm] = useState({ 
    description: '', 
    meal_type: 'snack', 
    calories: '', 
    protein: '', 
    carbs: '', 
    fat: '', 
    time: '', 
    photo_url: '' 
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchMeals = useCallback(async () => {
    try {
      const res = await api.get('/api/meals');
      setMeals(res.data.meals || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMeals(); }, [fetchMeals]);

  const handleAnalyze = async () => {
    if (!form.description.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    
    try {
      const res = await api.post('/api/meals/analyze', {
        description: form.description,
        photo_base64: form.photo_url || null,
      });
      
      if (res.data.success !== false) {
        const macros = res.data.estimated_macros || {};
        setForm(prev => ({
          ...prev,
          calories: macros.calories?.toString() || '0',
          protein: macros.protein?.toString() || '0',
          carbs: macros.carbs?.toString() || '0',
          fat: macros.fat?.toString() || '0',
          description: macros.description || prev.description,
        }));
        setAnalysisResult({
          success: true,
          text: res.data.analysis_text,
          confidence: res.data.confidence,
          macros: macros,
        });
        setStep(2);
      } else {
        setAnalysisResult({
          success: false,
          text: res.data.analysis_text || 'Não foi possível analisar.',
        });
      }
    } catch (err) {
      console.error(err);
      setAnalysisResult({
        success: false,
        text: 'Erro ao analisar. Tente novamente.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.description) return;
    try {
      await api.post('/api/meals', {
        ...form,
        calories: parseFloat(form.calories) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
        photo_url: form.photo_url || null,
      });
      closeModal();
      fetchMeals();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/meals/${id}`);
      fetchMeals();
    } catch (err) { console.error(err); }
  };

  const openModal = () => {
    setForm({ description: '', meal_type: 'snack', calories: '', protein: '', carbs: '', fat: '', time: '', photo_url: '' });
    setAnalysisResult(null);
    setStep(1);
    setShowDetails(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setStep(1);
    setAnalysisResult(null);
    setShowDetails(false);
  };

  const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalPro = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarb = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-2 border-gymie border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 pt-5 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-txt-primary">Refeições</h1>
          <p className="text-xs text-txt-muted">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        <button
          data-testid="add-meal-btn"
          onClick={openModal}
          className="gymie-btn-primary p-2.5"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Daily Summary - Sticky */}
      <div data-testid="meals-summary" className="gymie-card p-4 mb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-txt-muted uppercase tracking-wider">Total do dia</span>
          <span className="text-xs text-txt-muted">{meals.length} refeições</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'kcal', val: Math.round(totalCal), color: 'text-gymie' },
            { label: 'prot', val: `${Math.round(totalPro)}g`, color: 'text-info' },
            { label: 'carb', val: `${Math.round(totalCarb)}g`, color: 'text-orange-400' },
            { label: 'gord', val: `${Math.round(totalFat)}g`, color: 'text-rose-400' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-bold font-data ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-txt-muted uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Meals List */}
      {meals.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-hl flex items-center justify-center">
            <UtensilsCrossed size={28} className="text-txt-muted" />
          </div>
          <p className="text-txt-secondary mb-1">Nenhuma refeição hoje</p>
          <button onClick={openModal} className="text-gymie text-sm font-medium">
            Registrar primeira refeição
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map((meal) => {
            const mealType = MEAL_TYPES.find(t => t.id === meal.meal_type);
            return (
              <div 
                key={meal.id} 
                data-testid="meal-item" 
                className="gymie-card p-4 flex items-start gap-3"
              >
                {meal.photo_url ? (
                  <div className="w-12 h-12 rounded-gymie-sm overflow-hidden flex-shrink-0">
                    <img src={meal.photo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-gymie-sm bg-surface-hl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">{mealType?.emoji || '🍽️'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium text-gymie uppercase">{mealType?.label || meal.meal_type}</span>
                    <span className="text-[10px] text-txt-muted font-data">{meal.time}</span>
                  </div>
                  <p className="text-sm text-txt-primary truncate">{meal.description}</p>
                  <div className="flex gap-3 mt-1.5 text-[11px] font-data text-txt-muted">
                    <span className="text-gymie">{meal.calories}kcal</span>
                    <span>P:{meal.protein}g</span>
                    <span>C:{meal.carbs}g</span>
                    <span>G:{meal.fat}g</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(meal.id)} 
                  className="p-2 text-txt-muted hover:text-danger transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Meal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end" onClick={closeModal}>
          <div 
            className="w-full max-w-md mx-auto bg-surface rounded-t-gymie-lg animate-slide-up max-h-[90vh] overflow-hidden flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h3 className="text-lg font-semibold">Nova refeição</h3>
              <button onClick={closeModal} className="p-2 hover:bg-surface-hl rounded-full">
                <X size={20} className="text-txt-muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Step 1: Input */}
              {step === 1 && (
                <>
                  <div>
                    <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">
                      O que você comeu?
                    </label>
                    <textarea
                      data-testid="meal-description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full gymie-input resize-none"
                      rows={3}
                      placeholder="Ex: Frango grelhado com arroz integral e salada"
                      autoFocus
                    />
                  </div>

                  {/* Photo (optional) */}
                  <div>
                    <label className="flex items-center gap-3 p-3 gymie-card cursor-pointer hover:border-border-hover transition-colors">
                      <Camera size={18} className="text-txt-muted" />
                      <span className="text-sm text-txt-secondary flex-1">
                        {form.photo_url ? 'Foto adicionada' : 'Adicionar foto (opcional)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setForm({ ...form, photo_url: ev.target.result });
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {form.photo_url && (
                        <div className="w-10 h-10 rounded-gymie-sm overflow-hidden">
                          <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Analyze Button */}
                  <button
                    data-testid="analyze-meal-btn"
                    onClick={handleAnalyze}
                    disabled={!form.description.trim() || analyzing}
                    className="w-full gymie-btn-secondary flex items-center justify-center gap-2 border-gymie/30 text-gymie"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Estimar macros com IA
                      </>
                    )}
                  </button>

                  {/* Manual entry option */}
                  <button
                    onClick={() => setStep(3)}
                    className="w-full text-center text-sm text-txt-muted hover:text-txt-secondary transition-colors"
                  >
                    Ou preencher manualmente
                  </button>
                </>
              )}

              {/* Step 2: Analysis Result */}
              {step === 2 && analysisResult && (
                <>
                  {/* Analysis Card */}
                  <div className="gymie-card-elevated p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={14} className="text-gymie" />
                      <span className="text-xs font-medium text-gymie uppercase tracking-wider">Leitura do prato</span>
                    </div>
                    
                    <p className="text-sm text-txt-secondary mb-4">{analysisResult.text}</p>

                    {/* Macro Summary */}
                    <div className="grid grid-cols-4 gap-2 p-3 bg-surface rounded-gymie-sm">
                      {[
                        { label: 'kcal', val: form.calories, color: 'text-gymie' },
                        { label: 'prot', val: `${form.protein}g`, color: 'text-info' },
                        { label: 'carb', val: `${form.carbs}g`, color: 'text-orange-400' },
                        { label: 'gord', val: `${form.fat}g`, color: 'text-rose-400' },
                      ].map((m) => (
                        <div key={m.label} className="text-center">
                          <p className={`text-base font-bold font-data ${m.color}`}>{m.val}</p>
                          <p className="text-[9px] text-txt-muted uppercase">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Confidence */}
                    {analysisResult.confidence && (
                      <p className="text-[11px] text-txt-muted mt-3 text-center">
                        Confiança da estimativa: {
                          analysisResult.confidence === 'high' ? 'alta' :
                          analysisResult.confidence === 'medium' ? 'média' : 'baixa'
                        }
                      </p>
                    )}
                  </div>

                  {/* Meal Type Selector */}
                  <div>
                    <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">
                      Tipo de refeição
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_TYPES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setForm({ ...form, meal_type: t.id })}
                          className={`gymie-chip ${form.meal_type === t.id ? 'gymie-chip-active' : ''}`}
                        >
                          <span>{t.emoji}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edit Details Toggle */}
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm text-txt-muted hover:text-txt-secondary transition-colors"
                  >
                    <Edit3 size={14} />
                    {showDetails ? 'Ocultar detalhes' : 'Ajustar valores'}
                    {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* Detailed Edit Fields */}
                  {showDetails && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-surface-hl rounded-gymie animate-scale-in">
                      {[
                        { key: 'calories', label: 'Calorias', unit: 'kcal' },
                        { key: 'protein', label: 'Proteína', unit: 'g' },
                        { key: 'carbs', label: 'Carboidrato', unit: 'g' },
                        { key: 'fat', label: 'Gordura', unit: 'g' },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="text-[10px] text-txt-muted uppercase mb-1 block">{f.label}</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={form[f.key]}
                              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                              className="w-full gymie-input py-2 pr-8 text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-txt-muted">
                              {f.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setStep(1); setAnalysisResult(null); }}
                      className="gymie-btn-ghost flex-1 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Refazer
                    </button>
                    <button
                      data-testid="meal-submit"
                      onClick={handleSubmit}
                      className="gymie-btn-primary flex-[2] flex items-center justify-center gap-2"
                    >
                      <Check size={16} />
                      Registrar
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Manual Entry */}
              {step === 3 && (
                <>
                  <div>
                    <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">
                      Descrição
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full gymie-input resize-none"
                      rows={2}
                      placeholder="O que você comeu?"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-txt-muted uppercase tracking-wider mb-2 block">
                      Tipo de refeição
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {MEAL_TYPES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setForm({ ...form, meal_type: t.id })}
                          className={`gymie-chip ${form.meal_type === t.id ? 'gymie-chip-active' : ''}`}
                        >
                          <span>{t.emoji}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'calories', label: 'Calorias', unit: 'kcal' },
                      { key: 'protein', label: 'Proteína', unit: 'g' },
                      { key: 'carbs', label: 'Carboidrato', unit: 'g' },
                      { key: 'fat', label: 'Gordura', unit: 'g' },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="text-[10px] text-txt-muted uppercase mb-1 block">{f.label}</label>
                        <div className="relative">
                          <input
                            type="number"
                            data-testid={`meal-${f.key}`}
                            value={form[f.key]}
                            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                            className="w-full gymie-input py-2.5 pr-10"
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-txt-muted">
                            {f.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="gymie-btn-ghost"
                    >
                      Voltar
                    </button>
                    <button
                      data-testid="meal-submit"
                      onClick={handleSubmit}
                      disabled={!form.description}
                      className="gymie-btn-primary flex-1"
                    >
                      Registrar refeição
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
