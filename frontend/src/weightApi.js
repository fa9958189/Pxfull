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

const normalizeWeightEntry = (item) => ({
  id: item.id,
  date: item.entry_date,
  weightKg: Number(
    item.weight_value ?? item.weight ?? item.weightkg ?? item.weight_kg ?? 0,
  ),
  recordedAt: item.created_at,
});

export const saveWeightEntry = async (
  userId,
  weightValue,
  entryDate,
  supabaseClient,
) => {
  const supabase = getSupabaseClient(supabaseClient);
  const payload = {
    user_id: userId,
    weight_value: weightValue,
    entry_date: entryDate,
  };

  const { data, error } = await supabase
    .from('food_weight_history')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return normalizeWeightEntry(data);
};

export const fetchWeightHistory = async (userId, supabaseClient) => {
  const supabase = getSupabaseClient(supabaseClient);
  const { data, error } = await supabase
    .from('food_weight_history')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []).map(normalizeWeightEntry);
};
