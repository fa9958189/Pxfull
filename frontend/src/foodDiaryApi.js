const getSupabaseClient = (supabaseClient) => {
  if (supabaseClient) return supabaseClient;

  const { supabaseUrl, supabaseAnonKey, authSchema } = window.APP_CONFIG || {};
  if (!window.supabase || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase não configurado corretamente.');
  }

  if (!getSupabaseClient.cached) {
    getSupabaseClient.cached = window.supabase.createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          storageKey: 'gp-react-session',
          schema: authSchema || 'public',
        },
      },
    );
  }

  return getSupabaseClient.cached;
};

const normalizeMealFromDb = (item) => ({
  id: item.id,
  mealType: item.refeicao || '',
  food: item.alimento || '',
  quantity: item.quantidade || '',
  calories: item.calorias != null ? Number(item.calorias) : 0,
  protein: item.proteina != null ? Number(item.proteina) : 0,
  waterMl: item.agua != null ? Number(item.agua) : 0,
  time: item.horario || '',
  notes: item.observacoes || '',
  date: item.entry_date,
  createdAt: item.created_at,
});

export const saveMeal = async (userId, mealData, supabaseClient) => {
  const supabase = getSupabaseClient(supabaseClient);
  const payload = {
    user_id: userId,
    entry_date: mealData.entry_date || mealData.date,
    refeicao: mealData.mealType || mealData.refeicao || '',
    alimento: mealData.food || mealData.alimento || '',
    quantidade: mealData.quantity ?? mealData.quantidade ?? '',
    calorias: mealData.calories ?? mealData.calorias ?? null,
    proteina: mealData.protein ?? mealData.proteina ?? null,
    agua: mealData.waterMl ?? mealData.agua ?? null,
    horario: mealData.time ?? mealData.horario ?? null,
    observacoes: mealData.notes ?? mealData.observacoes ?? null,
  };

  const { data, error } = await supabase
    .from('food_diary_entries')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return normalizeMealFromDb(data);
};

export const fetchMealsByDate = async (userId, date, supabaseClient) => {
  const supabase = getSupabaseClient(supabaseClient);
  const { data, error } = await supabase
    .from('food_diary_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeMealFromDb);
};

export const updateMeal = async (entryId, newData, supabaseClient) => {
  const supabase = getSupabaseClient(supabaseClient);
  const payload = {
    refeicao: newData.mealType ?? newData.refeicao ?? '',
    alimento: newData.food ?? newData.alimento ?? '',
    quantidade: newData.quantity ?? newData.quantidade ?? '',
    calorias: newData.calories ?? newData.calorias ?? null,
    proteina: newData.protein ?? newData.proteina ?? null,
    agua: newData.waterMl ?? newData.agua ?? null,
    horario: newData.time ?? newData.horario ?? null,
    observacoes: newData.notes ?? newData.observacoes ?? null,
    entry_date: newData.entry_date || newData.date,
  };

  const { data, error } = await supabase
    .from('food_diary_entries')
    .update(payload)
    .eq('id', entryId)
    .select()
    .single();

  if (error) throw error;
  return normalizeMealFromDb(data);
};

export const deleteMeal = async (entryId, supabaseClient) => {
  const supabase = getSupabaseClient(supabaseClient);
  const { error } = await supabase
    .from('food_diary_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw error;
};
