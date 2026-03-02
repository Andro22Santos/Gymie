export const PLAN_ORDER = ['free', 'pro', 'elite'];

export const PLAN_FEATURES = {
  free: [
    'chat',
    'manual_meals',
    'manual_workout_plans',
    'progress_tracking',
  ],
  pro: [
    'chat',
    'manual_meals',
    'manual_workout_plans',
    'progress_tracking',
    'ai_workout_builder',
    'ai_meal_photo_analysis',
    'pantry_memory',
    'pwa_install',
  ],
  elite: [
    'chat',
    'manual_meals',
    'manual_workout_plans',
    'progress_tracking',
    'ai_workout_builder',
    'ai_meal_photo_analysis',
    'pantry_memory',
    'pwa_install',
    'realtime_features',
  ],
};

export function normalizePlan(plan) {
  const value = String(plan || '').toLowerCase().trim();
  return PLAN_ORDER.includes(value) ? value : 'free';
}

export function getPlanFeatures(plan) {
  return PLAN_FEATURES[normalizePlan(plan)] || PLAN_FEATURES.free;
}

export function hasFeature(plan, feature) {
  return getPlanFeatures(plan).includes(feature);
}
