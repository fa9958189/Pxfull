import React, { useEffect, useMemo, useState } from 'react';
import musclePlaceholder from '../assets/muscles/fototeste.png';

const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Peito', image: musclePlaceholder },
  { value: 'back', label: 'Costas', image: musclePlaceholder },
  { value: 'shoulders', label: 'Ombros', image: musclePlaceholder },
  { value: 'biceps', label: 'Bíceps', image: musclePlaceholder },
  { value: 'triceps', label: 'Tríceps', image: musclePlaceholder },
  { value: 'abs', label: 'Abdômen', image: musclePlaceholder },
  { value: 'legs', label: 'Pernas', image: musclePlaceholder },
  { value: 'glutes', label: 'Glúteos', image: musclePlaceholder }
];

const SPORTS = [
  { value: 'swimming', label: 'Natação', image: musclePlaceholder },
  { value: 'volleyball', label: 'Vôlei', image: musclePlaceholder },
  { value: 'boxing', label: 'Boxe', image: musclePlaceholder },
  { value: 'jiujitsu', label: 'Jiu-jítsu', image: musclePlaceholder },
  { value: 'soccer', label: 'Futebol', image: musclePlaceholder },
  { value: 'running', label: 'Corrida', image: musclePlaceholder },
  { value: 'beachtennis', label: 'Beach Tennis', image: musclePlaceholder }
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
  reminder: false
}));

const WorkoutRoutine = ({ apiBaseUrl = 'http://localhost:3001', pushToast }) => {
  const [workoutForm, setWorkoutForm] = useState({ name: '', muscleGroups: [] });
  const [selectedSports, setSelectedSports] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [userId, setUserId] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);

  const normalizeWorkoutFromApi = (item) => {
    const rawGroups =
      Array.isArray(item.muscleGroups)
        ? item.muscleGroups
        : typeof item.muscle_groups === 'string'
          ? item.muscle_groups.split(',').map((g) => g.trim()).filter(Boolean)
          : [];

    const rawSports = Array.isArray(item.sports)
      ? item.sports
      : typeof item.sports === 'string'
        ? item.sports.split(',').map((s) => s.trim()).filter(Boolean)
        : typeof item.sports_list === 'string'
          ? item.sports_list.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

    return {
      ...item,
      muscleGroups: rawGroups,
      sports: rawSports,
    };
  };

  const muscleMap = useMemo(
    () =>
      MUSCLE_GROUPS.reduce(
        (acc, group) => ({
          ...acc,
          [group.value]: group,
        }),
        {}
      ),
    []
  );

  const sportsMap = useMemo(
    () =>
      SPORTS.reduce(
        (acc, sport) => ({
          ...acc,
          [sport.value]: sport,
        }),
        {}
      ),
    []
  );

  const supabase = useMemo(() => {
    const { supabaseUrl, supabaseAnonKey, authSchema } = window.APP_CONFIG || {};
    if (!supabaseUrl || !supabaseAnonKey || !window.supabase) return null;

    return window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: 'gp-react-session',
        schema: authSchema || 'public'
      }
    });
  }, []);

  const hasWorkouts = useMemo(() => workouts.length > 0, [workouts]);

  // Detalhes dos músculos do treino selecionado (pra usar no modal)
  const selectedMuscleDetails = useMemo(() => {
    if (!selectedWorkout || !Array.isArray(selectedWorkout.muscleGroups)) return [];

    return MUSCLE_GROUPS.filter((group) =>
      selectedWorkout.muscleGroups.includes(group.value)
    );
  }, [selectedWorkout]);

  const selectedSportsDetails = useMemo(() => {
    if (!selectedWorkout || !Array.isArray(selectedWorkout.sports)) return [];

    const sportsValues = selectedWorkout.sports.map((sport) => String(sport).trim());

    return SPORTS.filter((sport) => sportsValues.includes(sport.value));
  }, [selectedWorkout]);

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
      if (!userId) {
        notify('Perfil do usuário não carregado.', 'warning');
        return;
      }
      setLoading(true);
      const data = await fetchJson(`${apiBaseUrl}/workout-routines?user_id=${userId}`);
      const raw = Array.isArray(data) ? data : data?.items || [];
      const normalized = raw.map(normalizeWorkoutFromApi);
      setWorkouts(normalized);
    } catch (err) {
      console.error('Erro ao carregar treinos', err);
      notify('Não foi possível carregar os treinos.');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async () => {
    try {
      if (!userId) {
        notify('Perfil do usuário não carregado.', 'warning');
        return;
      }
      const data = await fetchJson(`${apiBaseUrl}/workout-schedule?user_id=${userId}`);
      if (Array.isArray(data)) {
        setSchedule(defaultSchedule.map((slot, idx) => ({ ...slot, ...(data[idx] || {}) })));
      } else if (Array.isArray(data?.items)) {
        setSchedule(defaultSchedule.map((slot, idx) => ({ ...slot, ...(data.items[idx] || {}) })));
      }
    } catch (err) {
      console.error('Erro ao carregar semana de treino', err);
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
          : [...prev.muscleGroups, group]
      };
    });
  };

  const toggleSport = (sportValue) => {
    setSelectedSports((prev) => {
      const exists = prev.includes(sportValue);
      return exists ? prev.filter((item) => item !== sportValue) : [...prev, sportValue];
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
        sports: selectedSports,
        userId,
        user_id: userId
      };
      const saved = await fetchJson(`${apiBaseUrl}/workout-routines`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setWorkoutForm({ name: '', muscleGroups: [] });
      setSelectedSports([]);
      if (saved && saved.id) {
        setWorkouts((prev) => [normalizeWorkoutFromApi(saved), ...prev]);
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
      await fetchJson(`${apiBaseUrl}/workout-routines/${id}?user_id=${userId}`, {
        method: 'DELETE'
      });
      setWorkouts((prev) => prev.filter((item) => item.id !== id));
      setSchedule((prev) =>
        prev.map((slot) => (slot.workout_id === id ? { ...slot, workout_id: '' } : slot))
      );
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
      const payload = { schedule, userId, user_id: userId };
      await fetchJson(`${apiBaseUrl}/workout-schedule`, {
        method: 'POST',
        body: JSON.stringify(payload)
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
    if (!supabase) return;

    const fetchUserId = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user?.id) {
          notify('Usuário não autenticado.', 'warning');
          return;
        }

        setUserId(user.id);
      } catch (err) {
        console.error('Erro ao buscar usuário autenticado', err);
        notify('Não foi possível carregar o usuário.', 'danger');
      }
    };

    fetchUserId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    loadWorkouts();
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="title" style={{ margin: 0 }}>Rotina de Treino</h3>
        <div className="muted" style={{ fontSize: 13 }}>
          Gerencie treinos e a programação semanal.
        </div>
      </div>

      <div className="sep"></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* NOVO TREINO */}
        <div>
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

          <div className="muted" style={{ margin: '14px 0 6px', fontSize: 13 }}>
            Esportes / atividades
          </div>
          <div className="muscle-grid">
            {SPORTS.map((sport) => {
              const active = selectedSports.includes(sport.value);
              return (
                <button
                  key={sport.value}
                  type="button"
                  className={active ? 'muscle-card active' : 'muscle-card'}
                  onClick={() => toggleSport(sport.value)}
                >
                  <div className="muscle-image-wrapper">
                    <img src={sport.image} alt={sport.label} className="muscle-image" />
                  </div>
                  <span className="muscle-label">{sport.label}</span>
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

        {/* TREINOS CADASTRADOS */}
        <div>
          <h4 className="title" style={{ marginBottom: 12 }}>Treinos cadastrados</h4>
          {!workouts.length && <div className="muted">Nenhum treino cadastrado.</div>}
          {workouts.length > 0 && (
            <div className="table">
              {workouts.map((item) => (
                <div className="table-row" key={item.id || item.name}>
                  <div>{item.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {(item.muscleGroups || [])
                      .map((group) => muscleMap[group]?.label || group)
                      .join(', ')}
                  </div>
                  {(item.sports || []).length > 0 && (
                    <div className="muted" style={{ fontSize: 13 }}>
                      {`Esportes: ${(item.sports || [])
                        .map((sport) => sportsMap[sport]?.label || sport)
                        .join(', ')}`}
                    </div>
                  )}
                  <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="ghost small"
                      onClick={() => {
                        setSelectedWorkout(item);
                        setShowWorkoutModal(true);
                      }}
                      disabled={loading}
                    >
                      Ver treino
                    </button>
                    <button
                      className="ghost small"
                      onClick={() => handleDeleteWorkout(item.id)}
                      disabled={loading}
                    >
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

      {/* SEMANA DE TREINO */}
      <div>
        <h4 className="title" style={{ marginBottom: 12 }}>Semana de Treino</h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {schedule.map((slot) => (
            <div
              key={slot.day}
              style={{
                borderRadius: 12,
                background: '#131722',
                padding: 16,
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    📅
                  </span>
                  {slot.day.toUpperCase()}
                </div>
                {slot.workout_id && (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: 'rgba(80, 190, 120, 0.15)',
                      color: '#50be78',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Treino ativo
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#9ba4b5' }}>Treino</label>
                <select
                  value={slot.workout_id}
                  onChange={(e) => handleScheduleChange(slot.day, 'workout_id', e.target.value)}
                  style={{
                    background: '#0f131c',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <option value="">Selecione um treino</option>
                  {workouts.map((item) => (
                    <option key={item.id || item.name} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#9ba4b5' }}>Horário</label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#0f131c',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '8px 12px',
                  }}
                >
                  <span role="img" aria-label="Relógio">
                    🕒
                  </span>
                  <input
                    type="time"
                    value={slot.time}
                    onChange={(e) => handleScheduleChange(slot.day, 'time', e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, color: '#9ba4b5' }}>Lembrete</label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#0f131c',
                    borderRadius: 12,
                    padding: '10px 12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span style={{ color: '#d3d8e6' }}>Ativar lembrete</span>
                  <div
                    style={{
                      position: 'relative',
                      width: 56,
                      height: 28,
                      borderRadius: 20,
                      background: slot.reminder ? '#4ade80' : 'rgba(255,255,255,0.12)',
                      transition: 'all 0.2s ease',
                      boxShadow: slot.reminder
                        ? '0 10px 20px rgba(74, 222, 128, 0.35)'
                        : 'inset 0 1px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!slot.reminder}
                      onChange={(e) => handleScheduleChange(slot.day, 'reminder', e.target.checked)}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: slot.reminder ? 30 : 4,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 6px 12px rgba(0,0,0,0.25)',
                        transition: 'all 0.2s ease',
                      }}
                    ></span>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            className="primary"
            onClick={handleSaveSchedule}
            disabled={savingSchedule || !hasWorkouts}
          >
            {savingSchedule ? 'Salvando...' : 'Salvar semana de treino'}
          </button>
        </div>
        {!hasWorkouts && (
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Cadastre ao menos um treino para montar a semana.
          </div>
        )}
      </div>

      {/* MODAL VER TREINO */}
      {showWorkoutModal && selectedWorkout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: '#0f131c',
              borderRadius: 16,
              padding: 24,
              width: 'min(540px, 90vw)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Detalhes do treino</h4>
              <button
                className="ghost"
                onClick={() => {
                  setShowWorkoutModal(false);
                  setSelectedWorkout(null);
                }}
              >
                Fechar
              </button>
            </div>

            <div className="sep" style={{ margin: '12px 0' }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Nome do treino
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedWorkout.name}</div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Grupos musculares
                </div>

                {selectedMuscleDetails.length === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Nenhum grupo muscular selecionado.
                  </p>
                )}

                {selectedMuscleDetails.length > 0 && (
                  <div className="muscle-grid">
                    {selectedMuscleDetails.map((muscle) => (
                      <div key={muscle.value} className="muscle-card active">
                        <div className="muscle-image-wrapper">
                          <img
                            src={muscle.image}
                            alt={muscle.label}
                            className="muscle-image"
                          />
                        </div>
                        <span className="muscle-label">{muscle.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Esportes / atividades
                </div>

                {selectedSportsDetails.length === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Nenhum esporte selecionado.
                  </p>
                )}

                {selectedSportsDetails.length > 0 && (
                  <div className="muscle-grid">
                    {selectedSportsDetails.map((sport) => (
                      <div key={sport.value} className="muscle-card active">
                        <div className="muscle-image-wrapper">
                          <img
                            src={sport.image}
                            alt={sport.label}
                            className="muscle-image"
                          />
                        </div>
                        <span className="muscle-label">{sport.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button
                  className="ghost"
                  onClick={() => {
                    setShowWorkoutModal(false);
                    setSelectedWorkout(null);
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default WorkoutRoutine;
