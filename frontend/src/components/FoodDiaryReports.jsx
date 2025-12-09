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
        fromDate.setDate(today.getDate() - 6);

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

  const calorieGoal = Number(goals?.calories) || 0;
  const proteinGoal = Number(goals?.protein) || 0;
  const waterGoalLiters = Number(goals?.water) || 0;

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

      <div className="table">
        <div className="table-row table-head">
          <div>Data</div>
          <div>Calorias</div>
          <div>Proteína</div>
          <div>Água</div>
          <div>Status</div>
        </div>
        {dailyTotals.map((day) => {
          const calorieStatus = getStatusFromGoal(day.totalCalories, calorieGoal);
          const proteinStatus = getStatusFromGoal(day.totalProtein, proteinGoal);
          return (
            <div className="table-row" key={day.date}>
              <div>{new Date(day.date).toLocaleDateString('pt-BR')}</div>
              <div>{formatNumber(day.totalCalories, 0)} kcal</div>
              <div>{formatNumber(day.totalProtein, 0)} g</div>
              <div>{formatNumber(day.totalWater / 1000, 1)} L</div>
              <div style={{ fontSize: 12 }}>
                <div>Calorias: {calorieStatus}</div>
                <div>Proteína: {proteinStatus}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FoodDiaryReports;
