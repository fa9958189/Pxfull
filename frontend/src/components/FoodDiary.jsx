import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gp-workout-food-diary';
const BLOCKS = 10;

const defaultGoals = {
  calories: 2000,
  protein: 120,
  water: 2.5
};

const defaultBody = {
  heightCm: '',
  weightKg: ''
};

const buildUserKey = (userId) => userId || 'default';

const readFromStorage = (userKey) => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        entriesByDate: {},
        goals: defaultGoals,
        body: defaultBody
      };
    }
    const parsed = JSON.parse(raw);
    const state = parsed[userKey] || {};
    return {
      entriesByDate: state.entriesByDate || {},
      goals: { ...defaultGoals, ...(state.goals || {}) },
      body: { ...defaultBody, ...(state.body || {}) }
    };
  } catch (err) {
    console.warn('Erro ao ler diário alimentar', err);
    return {
      entriesByDate: {},
      goals: defaultGoals,
      body: defaultBody
    };
  }
};

const writeToStorage = (userKey, state) => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[userKey] = {
      entriesByDate: state.entriesByDate,
      goals: state.goals,
      body: state.body
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (err) {
    console.warn('Erro ao salvar diário alimentar', err);
  }
};

const renderBlocks = (current, goal) => {
  if (!goal || goal <= 0) return '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜';
  const ratio = Math.max(0, Math.min(1, current / goal));
  const filled = Math.round(ratio * BLOCKS);
  const empty = BLOCKS - filled;
  return '⬛'.repeat(filled) + '⬜'.repeat(empty);
};

const formatNumber = (value, decimals = 0) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

function FoodDiary({ userId }) {
  const userKey = buildUserKey(userId);

  const initialState = useMemo(() => readFromStorage(userKey), [userKey]);

  const [entriesByDate, setEntriesByDate] = useState(initialState.entriesByDate);
  const [goals, setGoals] = useState(initialState.goals);
  const [body, setBody] = useState(initialState.body);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [form, setForm] = useState({
    mealType: 'Almoço',
    food: '',
    quantity: '',
    calories: '',
    protein: '',
    waterMl: '',
    time: '',
    notes: ''
  });

  // Salva no localStorage sempre que algo muda
  useEffect(() => {
    writeToStorage(userKey, { entriesByDate, goals, body });
  }, [userKey, entriesByDate, goals, body]);

  const dayEntries = entriesByDate[selectedDate] || [];

  const totals = useMemo(() => {
    const totalCalories = dayEntries.reduce(
      (sum, item) => sum + (Number(item.calories) || 0),
      0
    );
    const totalProtein = dayEntries.reduce(
      (sum, item) => sum + (Number(item.protein) || 0),
      0
    );
    const totalWaterMl = dayEntries.reduce(
      (sum, item) => sum + (Number(item.waterMl) || 0),
      0
    );
    const totalWaterLiters = totalWaterMl / 1000;
    return { totalCalories, totalProtein, totalWaterMl, totalWaterLiters };
  }, [dayEntries]);

  const bmi = useMemo(() => {
    const h = Number(body.heightCm);
    const w = Number(body.weightKg);
    if (!h || !w) return null;
    const value = w / Math.pow(h / 100, 2);
    let label = 'Peso normal';
    if (value < 18.5) label = 'Abaixo do peso';
    else if (value >= 25 && value < 30) label = 'Sobrepeso';
    else if (value >= 30) label = 'Obesidade';
    return { value, label };
  }, [body.heightCm, body.weightKg]);

  const handleChangeForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddEntry = (event) => {
    event.preventDefault();
    if (!form.food && !form.calories) {
      return;
    }

    const payload = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      mealType: form.mealType,
      food: form.food,
      quantity: form.quantity,
      calories: form.calories ? Number(form.calories) : 0,
      protein: form.protein ? Number(form.protein) : 0,
      waterMl: form.waterMl ? Number(form.waterMl) : 0,
      time: form.time,
      notes: form.notes,
      createdAt: new Date().toISOString()
    };

    setEntriesByDate((prev) => {
      const existing = prev[selectedDate] || [];
      return {
        ...prev,
        [selectedDate]: [payload, ...existing]
      };
    });

    setForm((prev) => ({
      ...prev,
      food: '',
      quantity: '',
      calories: '',
      protein: '',
      waterMl: '',
      notes: ''
    }));
  };

  const handleGoalChange = (field, value) => {
    setGoals((prev) => ({
      ...prev,
      [field]: value === '' ? '' : Number(value)
    }));
  };

  const handleBodyChange = (field, value) => {
    setBody((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const todayCaloriesText = `Hoje você comeu ${formatNumber(
    totals.totalCalories,
    0
  )} kcal`;

  return (
    <div className="food-diary">
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'center' }}
      >
        <h4 className="title" style={{ margin: 0 }}>
          Diário alimentar
        </h4>
        <div className="muted" style={{ fontSize: 12 }}>
          Registre o que comeu e acompanhe suas metas diárias.
        </div>
      </div>

      <div className="sep" style={{ margin: '10px 0 14px' }}></div>

      <div className="food-diary-grid">
        {/* LADO ESQUERDO – Formulário + lista do dia */}
        <div className="food-diary-left">
          <form
            onSubmit={handleAddEntry}
            className="food-diary-form"
            autoComplete="off"
          >
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Data</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Refeição</label>
                <select
                  value={form.mealType}
                  onChange={(e) => handleChangeForm('mealType', e.target.value)}
                >
                  <option>Café da manhã</option>
                  <option>Almoço</option>
                  <option>Jantar</option>
                  <option>Lanche</option>
                  <option>Pós-treino</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Alimento</label>
              <input
                type="text"
                placeholder="Ex.: Arroz, frango grelhado, iogurte..."
                value={form.food}
                onChange={(e) => handleChangeForm('food', e.target.value)}
              />
            </div>

            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Quantidade</label>
                <input
                  type="text"
                  placeholder="Ex.: 100 g, 1 unidade, 1 copo"
                  value={form.quantity}
                  onChange={(e) => handleChangeForm('quantity', e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Calorias (kcal)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.calories}
                  onChange={(e) => handleChangeForm('calories', e.target.value)}
                  placeholder="Ex.: 250"
                />
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Proteína (g) – opcional</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.protein}
                  onChange={(e) => handleChangeForm('protein', e.target.value)}
                  placeholder="Ex.: 25"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Água (ml) – opcional</label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={form.waterMl}
                  onChange={(e) => handleChangeForm('waterMl', e.target.value)}
                  placeholder="Ex.: 250"
                />
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Horário</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => handleChangeForm('time', e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Observações</label>
              <textarea
                rows="2"
                placeholder="Ex.: refeição pré-treino, comi com pressa, etc."
                value={form.notes}
                onChange={(e) => handleChangeForm('notes', e.target.value)}
              ></textarea>
            </div>

            <div
              className="row"
              style={{
                justifyContent: 'flex-end',
                marginTop: 8
              }}
            >
              <button type="submit" className="primary">
                Adicionar refeição
              </button>
            </div>
          </form>

          <div className="food-diary-entries">
            {dayEntries.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>
                Nenhuma refeição registrada para este dia.
              </div>
            )}

            {dayEntries.map((item) => (
              <div key={item.id} className="food-diary-entry">
                <div className="food-diary-entry-header">
                  <span>
                    <strong>{item.mealType}</strong>{' '}
                    {item.time && (
                      <span className="muted">– {item.time}</span>
                    )}
                  </span>
                  <span>{formatNumber(item.calories, 0)} kcal</span>
                </div>
                <div className="food-diary-entry-meta">
                  {item.food && <span>{item.food}</span>}
                  {item.quantity && (
                    <span className="muted">• {item.quantity}</span>
                  )}
                  {item.protein ? (
                    <span className="muted">
                      • {formatNumber(item.protein, 0)} g proteína
                    </span>
                  ) : null}
                  {item.waterMl ? (
                    <span className="muted">
                      • {formatNumber(item.waterMl / 1000, 2)} L água
                    </span>
                  ) : null}
                </div>
                {item.notes && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* LADO DIREITO – Resumo, metas e dados corporais */}
        <aside className="food-diary-right">
          <div className="food-diary-summary-card">
            <h5 className="title" style={{ margin: 0, fontSize: 14 }}>
              Resumo do dia
            </h5>
            <div className="muted" style={{ fontSize: 13 }}>
              {todayCaloriesText}
            </div>
            <div className="food-diary-meta-list">
              <div className="food-diary-meta-row">
                <div>
                  Calorias:{' '}
                  <strong>
                    {formatNumber(totals.totalCalories, 0)} /{' '}
                    {formatNumber(goals.calories || 0, 0)} kcal
                  </strong>
                </div>
                <div className="food-diary-bar">
                  {renderBlocks(totals.totalCalories, goals.calories || 1)}
                </div>
              </div>

              <div className="food-diary-meta-row">
                <div>
                  Proteína:{' '}
                  <strong>
                    {formatNumber(totals.totalProtein, 0)} /{' '}
                    {formatNumber(goals.protein || 0, 0)} g
                  </strong>
                </div>
                <div className="food-diary-bar">
                  {renderBlocks(totals.totalProtein, goals.protein || 1)}
                </div>
              </div>

              <div className="food-diary-meta-row">
                <div>
                  Água:{' '}
                  <strong>
                    {formatNumber(totals.totalWaterLiters, 2)} /{' '}
                    {formatNumber(goals.water || 0, 2)} L
                  </strong>
                </div>
                <div className="food-diary-bar">
                  {renderBlocks(totals.totalWaterLiters, goals.water || 1)}
                </div>
              </div>
            </div>
          </div>

          <div className="food-diary-summary-card">
            <h5 className="title" style={{ margin: 0, fontSize: 14 }}>
              Metas diárias
            </h5>
            <div className="field">
              <label>Meta de calorias (kcal/dia)</label>
              <input
                type="number"
                min="0"
                value={goals.calories}
                onChange={(e) =>
                  handleGoalChange('calories', e.target.value)
                }
              />
            </div>
            <div className="field">
              <label>Meta de proteína (g/dia)</label>
              <input
                type="number"
                min="0"
                value={goals.protein}
                onChange={(e) =>
                  handleGoalChange('protein', e.target.value)
                }
              />
            </div>
            <div className="field">
              <label>Meta de água (L/dia)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={goals.water}
                onChange={(e) => handleGoalChange('water', e.target.value)}
              />
            </div>
          </div>

          <div className="food-diary-summary-card">
            <h5 className="title" style={{ margin: 0, fontSize: 14 }}>
              Altura e peso
            </h5>
            <div className="field">
              <label>Altura (cm)</label>
              <input
                type="number"
                min="0"
                value={body.heightCm}
                onChange={(e) =>
                  handleBodyChange('heightCm', e.target.value)
                }
              />
            </div>
            <div className="field">
              <label>Peso atual (kg)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={body.weightKg}
                onChange={(e) =>
                  handleBodyChange('weightKg', e.target.value)
                }
              />
            </div>
            {bmi && (
              <div className="muted" style={{ fontSize: 13 }}>
                IMC:{' '}
                <strong>{formatNumber(bmi.value, 1)}</strong> – {bmi.label}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default FoodDiary;
