import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { UtensilsCrossed, Plus, X, Trash2, Clock, Camera, Image } from 'lucide-react';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Cafe da manha' },
  { id: 'snack', label: 'Lanche' },
  { id: 'lunch', label: 'Almoco' },
  { id: 'dinner', label: 'Jantar' },
  { id: 'pre_workout', label: 'Pre-treino' },
  { id: 'post_workout', label: 'Pos-treino' },
];

export default function MealsPage() {
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ description: '', meal_type: 'snack', calories: '', protein: '', carbs: '', fat: '', time: '' });

  const fetchMeals = useCallback(async () => {
    try {
      const res = await api.get('/api/meals');
      setMeals(res.data.meals || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMeals(); }, [fetchMeals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description) return;
    try {
      await api.post('/api/meals', {
        ...form,
        calories: parseFloat(form.calories) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
      });
      setModalOpen(false);
      setForm({ description: '', meal_type: 'snack', calories: '', protein: '', carbs: '', fat: '', time: '' });
      fetchMeals();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/meals/${id}`);
      fetchMeals();
    } catch (err) { console.error(err); }
  };

  const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalPro = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarb = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-10 h-10 border-2 border-tactical border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Refeicoes</h1>
          <p className="text-xs text-txt-muted font-data">{new Date().toLocaleDateString('pt-BR')}</p>
        </div>
        <button
          data-testid="add-meal-btn"
          onClick={() => setModalOpen(true)}
          className="bg-tactical text-black p-2.5 hover:bg-tactical-dim active:scale-95 transition-all"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Summary */}
      <div data-testid="meals-summary" className="grid grid-cols-4 gap-2">
        {[
          { label: 'Calorias', val: `${Math.round(totalCal)}`, unit: 'kcal', color: 'text-tactical' },
          { label: 'Proteina', val: `${Math.round(totalPro)}`, unit: 'g', color: 'text-info' },
          { label: 'Carbo', val: `${Math.round(totalCarb)}`, unit: 'g', color: 'text-orange-400' },
          { label: 'Gordura', val: `${Math.round(totalFat)}`, unit: 'g', color: 'text-danger' },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border-default p-3 text-center">
            <p className={`font-data text-lg ${s.color}`}>{s.val}</p>
            <p className="text-[10px] font-heading uppercase tracking-wider text-txt-muted">{s.unit}</p>
            <p className="text-[9px] text-txt-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Meals List */}
      {meals.length === 0 ? (
        <div className="text-center py-12">
          <UtensilsCrossed size={32} className="text-txt-muted mx-auto mb-3" strokeWidth={1} />
          <p className="text-sm text-txt-muted">Nenhuma refeicao registrada hoje.</p>
          <button onClick={() => setModalOpen(true)} className="text-tactical text-sm mt-2 hover:text-tactical-dim">
            Adicionar refeicao
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {meals.map((meal) => (
            <div key={meal.id} data-testid="meal-item" className="bg-surface border border-border-default p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={12} className="text-txt-muted" />
                  <span className="font-data text-[10px] text-txt-muted">{meal.time}</span>
                  <span className="text-[10px] font-ui uppercase tracking-wider text-tactical bg-tactical/10 px-1.5 py-0.5">
                    {MEAL_TYPES.find((t) => t.id === meal.meal_type)?.label || meal.meal_type}
                  </span>
                </div>
                <p className="text-sm text-txt-primary">{meal.description}</p>
                <div className="flex gap-3 mt-1.5 text-[10px] font-data text-txt-muted">
                  <span>{meal.calories}kcal</span>
                  <span>P:{meal.protein}g</span>
                  <span>C:{meal.carbs}g</span>
                  <span>G:{meal.fat}g</span>
                </div>
              </div>
              <button onClick={() => handleDelete(meal.id)} className="text-txt-muted hover:text-danger transition-colors p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Meal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md bg-surface border-t border-border-default p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg uppercase tracking-tight">Nova Refeicao</h3>
              <button onClick={() => setModalOpen(false)} className="text-txt-muted hover:text-txt-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary mb-1 block">Descricao</label>
                <textarea
                  data-testid="meal-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-bg border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical px-3 py-2 outline-none text-sm resize-none"
                  rows={2}
                  placeholder="Ex: Frango grelhado + arroz + salada"
                />
              </div>
              <div>
                <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary mb-1 block">Tipo</label>
                <div className="flex gap-1 flex-wrap">
                  {MEAL_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm({ ...form, meal_type: t.id })}
                      className={`px-2 py-1 text-[10px] font-ui uppercase border transition-all ${form.meal_type === t.id ? 'border-tactical bg-tactical/10 text-tactical' : 'border-border-default text-txt-muted'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'calories', label: 'Calorias', unit: 'kcal' },
                  { key: 'protein', label: 'Proteina', unit: 'g' },
                  { key: 'carbs', label: 'Carbo', unit: 'g' },
                  { key: 'fat', label: 'Gordura', unit: 'g' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="font-heading text-[10px] uppercase tracking-wider text-txt-secondary mb-1 block">{f.label}</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full bg-bg border border-border-default text-txt-primary placeholder:text-txt-muted focus:border-tactical px-3 py-2 pr-8 outline-none text-sm"
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-txt-muted">{f.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                data-testid="meal-submit"
                type="submit"
                className="w-full bg-tactical text-black font-bold uppercase tracking-wider py-3 hover:bg-tactical-dim active:scale-[0.98] transition-all"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                Registrar Refeicao
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
