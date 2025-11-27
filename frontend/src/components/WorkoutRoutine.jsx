import React, { useEffect, useMemo, useState } from 'react';
import chestImg from '../assets/muscles/Peito.png';
import backImg from '../assets/muscles/Costas.png';
import shouldersImg from '../assets/muscles/Ombros.png';
import bicepsImg from '../assets/muscles/Biceps.png';
import tricepsImg from '../assets/muscles/Triceps.png';
import absImg from '../assets/muscles/Abdomen.png';
import legsImg from '../assets/muscles/Pernas.png';
import glutesImg from '../assets/muscles/Gluteos.png';

const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Peito', image: chestImg },
  { value: 'back', label: 'Costas', image: backImg },
  { value: 'shoulders', label: 'Ombros', image: shouldersImg },
  { value: 'biceps', label: 'Bíceps', image: bicepsImg },
  { value: 'triceps', label: 'Tríceps', image: tricepsImg },
  { value: 'abs', label: 'Abdômen', image: absImg },
  { value: 'legs', label: 'Pernas', image: legsImg },
  { value: 'glutes', label: 'Glúteos', image: glutesImg }
];

const WEEK_DAYS = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo'
];

const defaultSchedule = WEEK_DAYS.map((day) => ({
  day,
  workout_id: '',
  time: '',
  reminder: false,
}));

const WorkoutRoutine = ({ apiBaseUrl = 'http://localhost:3001', profileId, pushToast }) => {
  const [workoutForm, setWorkoutForm] = useState({ name: '', muscleGroups: [] });
  const [workouts, setWorkouts] = useState([]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const hasWorkouts = useMemo(() => workouts.length > 0, [workouts]);

  const notify = (message, variant = 'info') => {
    if (typeof pushToast === 'function') {
      pushToast(message, variant);
    }
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao comunicar com o servidor.');
    }
    return data;
  };

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const data = await fetchJson(`${apiBaseUrl}/workout-routines`);
      setWorkouts(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.warn('Erro ao carregar treinos', err);
      notify('Não foi possível carregar os treinos.');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const data = await fetchJson(`${apiBaseUrl}/workout-schedule`);
      if (Array.isArray(data)) {
        setSchedule(defaultSchedule.map((slot, idx) => ({ ...slot, ...(data[idx] || {}) })));
      } else if (Array.isArray(data?.items)) {
        setSchedule(defaultSchedule.map((slot, idx) => ({ ...slot, ...(data.items[idx] || {}) })));
      }
    } catch (err) {
      console.warn('Erro ao carregar semana de treino', err);
      notify('Não foi possível carregar a semana de treino.');
    }
  };

  const toggleMuscleGroup = (group) => {
    setWorkoutForm((prev) => {
      const exists = prev.muscleGroups.includes(group);
      return {
        ...prev,
        muscleGroups: exists
          ? prev.muscleGroups.filter((item) => item !== group)
          : [...prev.muscleGroups, group],
      };
    });
  };

  const handleSaveWorkout = async () => {
    if (!workoutForm.name.trim()) {
      notify('Informe o nome do treino.', 'warning');
      return;
    }
    if (!workoutForm.muscleGroups.length) {
      notify('Selecione pelo menos um grupo muscular.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: workoutForm.name,
        muscleGroups: workoutForm.muscleGroups,
        userId: profileId,
      };
      const saved = await fetchJson(`${apiBaseUrl}/workout-routines`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setWorkoutForm({ name: '', muscleGroups: [] });
      if (saved && saved.id) {
        setWorkouts((prev) => [saved, ...prev]);
      } else {
        await loadWorkouts();
      }
      notify('Treino salvo com sucesso!', 'success');
    } catch (err) {
      console.warn('Erro ao salvar treino', err);
      notify(err.message || 'Não foi possível salvar o treino.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkout = async (id) => {
    try {
      setLoading(true);
      await fetchJson(`${apiBaseUrl}/workout-routines/${id}`, { method: 'DELETE' });
      setWorkouts((prev) => prev.filter((item) => item.id !== id));
      setSchedule((prev) => prev.map((slot) => (slot.workout_id === id ? { ...slot, workout_id: '' } : slot)));
      notify('Treino removido.', 'success');
    } catch (err) {
      console.warn('Erro ao excluir treino', err);
      notify('Não foi possível excluir o treino.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleChange = (day, field, value) => {
    setSchedule((prev) =>
      prev.map((slot) => (slot.day === day ? { ...slot, [field]: value } : slot))
    );
  };

  const handleSaveSchedule = async () => {
    try {
      setSavingSchedule(true);
      const payload = { schedule, userId: profileId };
      await fetchJson(`${apiBaseUrl}/workout-schedule`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      notify('Semana de treino salva!', 'success');
    } catch (err) {
      console.warn('Erro ao salvar semana de treino', err);
      notify(err.message || 'Não foi possível salvar a semana.', 'danger');
    } finally {
      setSavingSchedule(false);
    }
  };

  useEffect(() => {
    loadWorkouts();
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="title" style={{ margin: 0 }}>Rotina de Treino</h3>
        <div className="muted" style={{ fontSize: 13 }}>
          Gerencie treinos e a programação semanal.
        </div>
      </div>

      <div className="sep"></div>

      <div className="row" style={{ gap: 20 }}>
        <div style={{ flex: 1 }}>
          <h4 className="title" style={{ marginBottom: 12 }}>Novo Treino</h4>
          <label>Nome do treino</label>
          <input
            value={workoutForm.name}
            onChange={(e) => setWorkoutForm({ ...workoutForm, name: e.target.value })}
            placeholder="Ex.: Treino A – Peito e Tríceps"
          />

          <div className="sep" style={{ margin: '12px 0 6px' }}></div>
          <div className="muted" style={{ marginBottom: 6, fontSize: 13 }}>Grupos musculares</div>
          <div className="muscle-grid">
            {MUSCLE_GROUPS.map((group) => {
              const active = workoutForm.muscleGroups.includes(group.value);
              return (
                <button
                  key={group.value}
                  type="button"
                  className={active ? 'muscle-card active' : 'muscle-card'}
                  onClick={() => toggleMuscleGroup(group.value)}
                >
                  <div className="muscle-image-wrapper">
                    <img src={group.image} alt={group.label} className="muscle-image" />
                  </div>
                  <span className="muscle-label">{group.label}</span>
                </button>
              );
            })}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="primary" onClick={handleSaveWorkout} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar treino'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h4 className="title" style={{ marginBottom: 12 }}>Treinos cadastrados</h4>
          {!workouts.length && <div className="muted">Nenhum treino cadastrado.</div>}
          {workouts.length > 0 && (
            <div className="table">
              <div className="table-head">
                <div>Nome</div>
                <div>Grupos</div>
                <div style={{ width: 80 }}>Ações</div>
              </div>
              {workouts.map((item) => (
                <div className="table-row" key={item.id || item.name}>
                  <div>{item.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {(item.muscleGroups || []).join(', ')}
                  </div>
                  <div>
                    <button className="ghost small" onClick={() => handleDeleteWorkout(item.id)} disabled={loading}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sep" style={{ margin: '18px 0' }}></div>

      <div>
        <h4 className="title" style={{ marginBottom: 12 }}>Semana de Treino</h4>
        <div className="table">
          <div className="table-head">
            <div style={{ minWidth: 120 }}>Dia</div>
            <div style={{ minWidth: 200 }}>Treino</div>
            <div style={{ minWidth: 140 }}>Horário</div>
            <div style={{ width: 140 }}>Lembrete</div>
          </div>
          {schedule.map((slot) => (
            <div className="table-row" key={slot.day}>
              <div>{slot.day}</div>
              <div>
                <select
                  value={slot.workout_id}
                  onChange={(e) => handleScheduleChange(slot.day, 'workout_id', e.target.value)}
                >
                  <option value="">Selecione um treino</option>
                  {workouts.map((item) => (
                    <option key={item.id || item.name} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="time"
                  value={slot.time}
                  onChange={(e) => handleScheduleChange(slot.day, 'time', e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={!!slot.reminder}
                    onChange={(e) => handleScheduleChange(slot.day, 'reminder', e.target.checked)}
                  />
                  Ativar lembrete
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="primary" onClick={handleSaveSchedule} disabled={savingSchedule || !hasWorkouts}>
            {savingSchedule ? 'Salvando...' : 'Salvar semana de treino'}
          </button>
        </div>
        {!hasWorkouts && (
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Cadastre ao menos um treino para montar a semana.
          </div>
        )}
      </div>
    </section>
  );
};

export default WorkoutRoutine;
