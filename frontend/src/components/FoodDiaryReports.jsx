import React, { useEffect, useMemo, useState } from 'react';

const getStatusFromGoal = (value, goal) => {
  if (!goal) return 'Sem meta';
  const diffRatio = (value - goal) / goal;
  if (diffRatio < -0.05) return 'Abaixo da meta';
  if (diffRatio > 0.05) return 'Acima da meta';
  return 'Dentro da meta';
};

const formatNumber = (value, decimals = 0) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

function FoodDiaryReports({ userId, supabase, selectedDate, goals }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      if (!userId || !supabase) return;
      setLoading(true);
      setError(null);

      try {
        const today = new Date(selectedDate || new Date());
        const fromDate = new Date(today);
        fromDate.setDate(today.getDate() - 29);

        const todayStr = today.toISOString().slice(0, 10);
        const fromDateStr = fromDate.toISOString().slice(0, 10);

        const { data, error: dbError } = await supabase
          .from('food_diary_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('entry_date', fromDateStr)
          .lte('entry_date', todayStr)
          .order('entry_date', { ascending: true });

        if (dbError) throw dbError;
        if (!isMounted) return;
        setEntries(data || []);

        const { data: weightData, error: weightError } = await supabase
          .from('food_weight_history')
          .select('*')
          .eq('user_id', userId)
          .order('entry_date', { ascending: true })
          .limit(30);

        if (weightError) throw weightError;
        setWeightHistory(
          (weightData || []).map((item) => ({
            date: item.entry_date,
            weightKg: Number(item.weight_kg) || 0,
            recordedAt: item.recorded_at,
          })),
        );
      } catch (err) {
        console.error('Erro ao carregar relatórios do diário alimentar:', err);
        if (isMounted) setError('Não foi possível carregar os relatórios.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReports();
    return () => {
      isMounted = false;
    };
  }, [userId, supabase, selectedDate]);

  const daysRange = useMemo(() => {
    const today = new Date(selectedDate || new Date());
    const dates = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [selectedDate]);

  const dailyTotals = useMemo(() => {
    return daysRange.map((date) => {
      const dayEntries = (entries || []).filter(
        (item) => item.entry_date === date || item.entryDate === date,
      );
      const totalCalories = dayEntries.reduce(
        (sum, item) => sum + (Number(item.calories) || 0),
        0,
      );
      const totalProtein = dayEntries.reduce(
        (sum, item) => sum + (Number(item.protein) || 0),
        0,
      );
      const totalWater = dayEntries.reduce(
        (sum, item) => sum + (Number(item.water_ml ?? item.waterMl) || 0),
        0,
      );
      return { date, totalCalories, totalProtein, totalWater };
    });
  }, [daysRange, entries]);

  const calorieGoal = Number(goals?.calories) || 0;
  const proteinGoal = Number(goals?.protein) || 0;
  const waterGoalLiters = Number(goals?.water) || 0;

  const stats = useMemo(() => {
    const totalCaloriesWeek = dailyTotals.reduce(
      (sum, day) => sum + day.totalCalories,
      0,
    );
    const totalProteinWeek = dailyTotals.reduce(
      (sum, day) => sum + day.totalProtein,
      0,
    );
    const totalWaterWeek = dailyTotals.reduce((sum, day) => sum + day.totalWater, 0);
    const daysCount = Math.max(dailyTotals.length, 1);

    return {
      avgCalories: totalCaloriesWeek / daysCount,
      avgProtein: totalProteinWeek / daysCount,
      totalWaterWeek,
      totalCaloriesWeek,
      totalProteinWeek,
    };
  }, [dailyTotals]);

  const heatmapRange = useMemo(() => {
    const today = new Date(selectedDate || new Date());
    const dates = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [selectedDate]);

  const entriesByDate = useMemo(() => {
    return (entries || []).reduce((acc, item) => {
      const dateKey = item.entry_date || item.entryDate || item.date;
      if (!dateKey) return acc;
      const current = acc[dateKey] || { calories: 0, protein: 0, water: 0, items: [] };
      acc[dateKey] = {
        calories: current.calories + (Number(item.calories) || 0),
        protein: current.protein + (Number(item.protein) || 0),
        water: current.water + (Number(item.water_ml ?? item.waterMl) || 0),
        items: [...current.items, item],
      };
      return acc;
    }, {});
  }, [entries]);

  const heatmapData = useMemo(() => {
    return heatmapRange.map((date) => {
      const dayData = entriesByDate[date];
      const totalCalories = dayData?.calories || 0;
      let color = '#3a3a3a';
      if (totalCalories > 0 && totalCalories < 1000) color = '#b59f3b';
      else if (totalCalories >= 1000 && totalCalories <= 2000) color = '#50be78';
      else if (totalCalories > 2000) color = '#c0392b';
      return { date, totalCalories, color };
    });
  }, [heatmapRange, entriesByDate]);

  const foodRanking = useMemo(() => {
    const counts = (entries || []).reduce((acc, item) => {
      const foodName = item.food || item.nome || item.alimento;
      if (!foodName) return acc;
      const current = acc[foodName] || { times: 0, calories: 0 };
      acc[foodName] = {
        times: current.times + 1,
        calories: current.calories + (Number(item.calories) || 0),
      };
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([food, info]) => ({ food, times: info.times, calories: info.calories }))
      .sort((a, b) => b.times - a.times || b.calories - a.calories)
      .slice(0, 10);
  }, [entries]);

  const weightTrend = useMemo(() => {
    return weightHistory
      .slice()
      .filter((item) => item.weightKg > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [weightHistory]);

  const adherence = useMemo(() => {
    const totalDays = dailyTotals.length || 0;
    const withinCalories = calorieGoal
      ? dailyTotals.filter(
          (day) => getStatusFromGoal(day.totalCalories, calorieGoal) === 'Dentro da meta',
        ).length
      : 0;
    const withinProtein = proteinGoal
      ? dailyTotals.filter(
          (day) => getStatusFromGoal(day.totalProtein, proteinGoal) === 'Dentro da meta',
        ).length
      : 0;
    const withinWater = waterGoalLiters
      ? dailyTotals.filter(
          (day) => getStatusFromGoal(day.totalWater / 1000, waterGoalLiters) === 'Dentro da meta',
        ).length
      : 0;

    return {
      totalDays,
      withinCalories,
      withinProtein,
      withinWater,
      hasGoals: Boolean(calorieGoal || proteinGoal || waterGoalLiters),
    };
  }, [dailyTotals, calorieGoal, proteinGoal, waterGoalLiters]);

  if (loading) {
    return <p>Carregando relatórios...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  const maxCalories = Math.max(
    ...dailyTotals.map((day) => day.totalCalories || 0),
    1,
  );

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className="title" style={{ margin: 0 }}>Relatórios do diário</h4>
        <div className="muted" style={{ fontSize: 12 }}>
          Visão geral dos últimos 7 dias com base nas suas metas.
        </div>
      </div>

      <div className="sep" style={{ margin: '12px 0 16px' }}></div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 200px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 220,
          }}
        >
          <div className="muted" style={{ fontSize: 12 }}>Média de calorias (7 dias)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatNumber(stats.avgCalories, 0)} kcal
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Meta diária: {calorieGoal ? `${formatNumber(calorieGoal, 0)} kcal` : '—'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Status: <strong>{getStatusFromGoal(stats.avgCalories, calorieGoal)}</strong>
          </div>
        </div>

        <div
          style={{
            flex: '1 1 200px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 220,
          }}
        >
          <div className="muted" style={{ fontSize: 12 }}>Média de proteína (7 dias)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatNumber(stats.avgProtein, 0)} g
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Meta diária: {proteinGoal ? `${formatNumber(proteinGoal, 0)} g` : '—'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Status: <strong>{getStatusFromGoal(stats.avgProtein, proteinGoal)}</strong>
          </div>
        </div>

        <div
          style={{
            flex: '1 1 200px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 220,
          }}
        >
          <div className="muted" style={{ fontSize: 12 }}>Água consumida (7 dias)</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatNumber(stats.totalWaterWeek / 1000, 1)} L
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Meta para 7 dias:{' '}
            {waterGoalLiters
              ? `${formatNumber(waterGoalLiters * 7, 1)} L`
              : '—'}
          </div>
        </div>
      </div>

      <div className="sep" style={{ margin: '16px 0 12px' }}></div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Calorias por dia</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dailyTotals.map((day) => (
            <div key={day.date}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                <span>{new Date(day.date).toLocaleDateString('pt-BR')}</span>
                <span className="muted">{formatNumber(day.totalCalories, 0)} kcal</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min((day.totalCalories / maxCalories) * 100, 100)}%`,
                    height: '100%',
                    background: '#50be78',
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          background: '#131722',
          borderRadius: 12,
          padding: 12,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Mapa de calor – calorias (últimos 30 dias)
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {heatmapData.map((day) => (
            <div
              key={day.date}
              title={`${new Date(day.date).toLocaleDateString('pt-BR')} – ${formatNumber(day.totalCalories, 0)} kcal`}
              style={{
                height: 32,
                borderRadius: 6,
                background: day.color,
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
              }}
            >
              {formatNumber(day.totalCalories, 0)}
            </div>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          0 kcal = cinza • 1–999 = amarelo • 1000–2000 = verde • &gt;2000 = vermelho
        </div>
      </div>

      <div className="sep" style={{ margin: '12px 0 8px' }}></div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 320px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aderência às metas (7 dias)</div>
          {adherence.hasGoals ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">Dias com calorias dentro da meta</span>
                <strong>{adherence.withinCalories} de {adherence.totalDays}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">Dias com proteína dentro da meta</span>
                <strong>{adherence.withinProtein} de {adherence.totalDays}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">Dias com água dentro da meta</span>
                <strong>{adherence.withinWater} de {adherence.totalDays}</strong>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              Configure suas metas para acompanhar sua aderência.
            </div>
          )}
        </div>

        <div
          style={{
            flex: '1 1 320px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Resumo da semana</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Calorias médias (7 dias)</span>
              <strong>{formatNumber(stats.avgCalories, 0)} kcal</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Proteína média (7 dias)</span>
              <strong>{formatNumber(stats.avgProtein, 0)} g</strong>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Água média (7 dias)</span>
              <strong>{formatNumber(stats.totalWaterWeek / 7000, 1)} L</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <div
          style={{
            flex: '1 1 420px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 280,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Alimentos mais consumidos</div>
          {foodRanking.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>
                    <th style={{ padding: '4px 6px' }}>Alimento</th>
                    <th style={{ padding: '4px 6px' }}>Vezes</th>
                    <th style={{ padding: '4px 6px' }}>Calorias totais</th>
                  </tr>
                </thead>
                <tbody>
                  {foodRanking.map((item) => (
                    <tr key={item.food}>
                      <td style={{ padding: '6px 6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {item.food}
                      </td>
                      <td
                        style={{
                          padding: '6px 6px',
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {item.times}x
                      </td>
                      <td
                        style={{
                          padding: '6px 6px',
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {formatNumber(item.calories, 0)} kcal
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>
              Registre mais refeições para ver seus alimentos mais frequentes.
            </div>
          )}
        </div>

        <div
          style={{
            flex: '1 1 320px',
            background: '#131722',
            borderRadius: 12,
            padding: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Evolução do peso (últimos registros)
          </div>
          {weightTrend.length < 2 ? (
            <div className="muted" style={{ fontSize: 13 }}>
              Adicione mais registros de peso para visualizar a tendência.
            </div>
          ) : (
            <div style={{ width: '100%', height: 160 }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                {(() => {
                  const weights = weightTrend.map((item) => item.weightKg);
                  const minWeight = Math.min(...weights);
                  const maxWeight = Math.max(...weights);
                  const range = maxWeight - minWeight || 1;
                  const points = weightTrend.map((item, index) => {
                    const x = (index / Math.max(weightTrend.length - 1, 1)) * 100;
                    const y = 100 - ((item.weightKg - minWeight) / range) * 100;
                    return `${x},${y}`;
                  });
                  return (
                    <>
                      <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="#50be78"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {points.map((point, idx) => (
                        <circle key={point} cx={point.split(',')[0]} cy={point.split(',')[1]} r="2" fill="#50be78">
                          <title>
                            {`${new Date(weightTrend[idx].date).toLocaleDateString('pt-BR')} – ${formatNumber(weightTrend[idx].weightKg, 1)} kg`}
                          </title>
                        </circle>
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Tendência baseada nos últimos {weightTrend.length} registros.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FoodDiaryReports;
