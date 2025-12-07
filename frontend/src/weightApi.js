import { supabase } from './supabaseClient';

// Salva/atualiza o perfil de metas + altura/peso atual
export async function saveWeightProfile({
  userId,
  calorieGoal,
  proteinGoal,
  waterGoalLiters,
  heightCm,
  weightKg,
}) {
  const { data, error } = await supabase
    .from('food_diary_profile')
    .upsert(
      {
        user_id: userId,
        calorie_goal: calorieGoal,
        protein_goal: proteinGoal,
        water_goal_l: waterGoalLiters,
        height_cm: heightCm || null,
        weight_kg: weightKg || null,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar perfil de peso no Supabase', error);
    throw error;
  }

  return data;
}

// Registra uma entrada no histórico de peso
export async function saveWeightEntry({ userId, entryDate, weightKg }) {
  const { data, error } = await supabase
    .from('food_weight_history')
    .insert([
      {
        user_id: userId, // OBRIGATÓRIO, NOT NULL
        entry_date: entryDate, // string 'YYYY-MM-DD'
        weight_kg: weightKg, // número
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar histórico de peso no Supabase', error);
    throw error;
  }

  return data;
}

// Busca o histórico de peso do usuário (para mostrar na tela)
export async function fetchWeightHistory(userId) {
  const { data, error } = await supabase
    .from('food_weight_history')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Erro ao buscar histórico de peso no Supabase', error);
    throw error;
  }

  return data || [];
}
