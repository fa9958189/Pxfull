import React, { useEffect, useMemo, useState } from 'react';
import PeitoImg from '../assets/muscles/Peito.png';
import CostasImg from '../assets/muscles/Costas.png';
import OmbrosImg from '../assets/muscles/Ombros.png';
import BicepsImg from '../assets/muscles/Biceps.png';
import TricepsImg from '../assets/muscles/Triceps.png';
import AbdomenImg from '../assets/muscles/Abdomen.png';
import PernasImg from '../assets/muscles/Pernas.png';
import GluteosImg from '../assets/muscles/Gluteos.png';
import NatacaoImg from '../assets/muscles/Natacao.png';
import VoleiImg from '../assets/muscles/Volei.png';
import BoxeImg from '../assets/muscles/Boxe.png';
import JiuJitsuImg from '../assets/muscles/Jiu-jitsu.png';
import FutebolImg from '../assets/muscles/Futebol.png';
import BeachTennisImg from '../assets/muscles/beach tennis.png';

const muscleGroups = [
  { id: 'peito', name: 'Peito', image: PeitoImg },
  { id: 'costas', name: 'Costas', image: CostasImg },
  { id: 'ombros', name: 'Ombros', image: OmbrosImg },
  { id: 'biceps', name: 'Bíceps', image: BicepsImg },
  { id: 'triceps', name: 'Tríceps', image: TricepsImg },
  { id: 'abdomen', name: 'Abdômen', image: AbdomenImg },
  { id: 'pernas', name: 'Pernas', image: PernasImg },
  { id: 'gluteos', name: 'Glúteos', image: GluteosImg },

  // Esportes
  { id: 'natacao', name: 'Natação', image: NatacaoImg },
  { id: 'volei', name: 'Vôlei', image: VoleiImg },
  { id: 'boxe', name: 'Boxe', image: BoxeImg },
  { id: 'jiujitsu', name: 'Jiu-Jitsu', image: JiuJitsuImg },
  { id: 'futebol', name: 'Futebol', image: FutebolImg },
  { id: 'beachtennis', name: 'Beach Tennis', image: BeachTennisImg },
];

const MUSCLE_GROUPS = muscleGroups.slice(0, 8).map(({ id, name, image }) => ({
  value: id,
  label: name,
  image
}));

const SPORTS = muscleGroups.slice(8).map(({ id, name, image }) => ({
  value: id,
  label: name,
  image
}));

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

const formatExerciseResume = (exercise) => {
  const base = `${exercise.name || 'Exercício'} ${exercise.sets || 0}x${exercise.reps || 0}`;
  const weightPart = exercise.weight ? ` – ${exercise.weight}kg` : '';
  return `${base}${weightPart}`;
};

const WorkoutRoutine = ({ apiBaseUrl = 'http://localhost:3001', pushToast }) => {
  const [activeTab, setActiveTab] = useState('config');
  const [workoutForm, setWorkoutForm] = useState({
    id: null,
    name: '',
    muscleGroups: [],
    sportsActivities: [],
    exercises: [],
  });
  const [workouts, setWorkouts] = useState([]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [userId, setUserId] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [restDuration, setRestDuration] = useState(60);
  const [restCountdown, setRestCountdown] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restFinished, setRestFinished] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [historyRange, setHistoryRange] = useState({ from: '', to: '' });
  const [progress, setProgress] = useState({ totalSessions: 0, byMuscleGroup: {} });
  const [createReminder, setCreateReminder] = useState(false);
  const [sessionReminder, setSessionReminder] = useState(false);

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

  const selectedMuscleDetails = useMemo(() => {
    if (!selectedWorkout || !Array.isArray(selectedWorkout.muscleGroups)) return [];

    return MUSCLE_GROUPS.filter((group) =>
      selectedWorkout.muscleGroups.includes(group.value)
    );
  }, [selectedWorkout]);

  const selectedSportsDetails = useMemo(() => {
    if (!selectedWorkout) return [];
    const normalized = syncSportsFromTemplate(
      selectedWorkout.sportsActivities,
      selectedWorkout.sports
    );

    return SPORTS.filter((sport) => normalized.includes(sport.value));
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

  const normalizeWorkoutFromApi = (item) => {
    const rawGroups = Array.isArray(item.muscleGroups)
      ? item.muscleGroups
      : typeof item.muscle_groups === 'string'
        ? item.muscle_groups.split(',').map((g) => g.trim()).filter(Boolean)
        : [];

    const rawSports = Array.isArray(item.sportsActivities)
      ? item.sportsActivities
      : Array.isArray(item.sports)
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
      sportsActivities: rawSports,
      exercises: Array.isArray(item.exercises) ? item.exercises : [],
    };
  };

  const loadWorkouts = async () => {
    try {
      if (!userId) {
        notify('Perfil do usuário não carregado.', 'warning');
        return;
      }
      setLoading(true);
      const data = await fetchJson(`${apiBaseUrl}/api/workouts/templates?userId=${userId}`);
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

  const loadSessions = async () => {
    try {
      if (!userId) return;
      const query = new URLSearchParams({ userId });
      if (historyRange.from) query.append('from', historyRange.from);
      if (historyRange.to) query.append('to', historyRange.to);
      const data = await fetchJson(`${apiBaseUrl}/api/workouts/sessions?${query.toString()}`);
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao carregar histórico', err);
      notify('Não foi possível carregar o histórico de treinos.');
    }
  };

  const loadProgress = async () => {
    try {
      if (!userId) return;
      const data = await fetchJson(`${apiBaseUrl}/api/workouts/progress?userId=${userId}&period=month`);
      setProgress(data || { totalSessions: 0, byMuscleGroup: {} });
    } catch (err) {
      console.error('Erro ao carregar progresso', err);
      notify('Não foi possível carregar o progresso.');
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
    setWorkoutForm((prev) => ({
      ...prev,
      sportsActivities: prev.sportsActivities.includes(sportValue)
        ? prev.sportsActivities.filter((item) => item !== sportValue)
        : [...prev.sportsActivities, sportValue],
    }));
  };

  const syncSportsFromTemplate = (sportsActivities = [], sports = []) => {
    const raw = Array.isArray(sportsActivities) && sportsActivities.length
      ? sportsActivities
      : Array.isArray(sports)
        ? sports
        : [];

    return raw.map((item) => String(item).trim()).filter(Boolean);
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
        ...workoutForm,
        exercises: workoutForm.exercises,
        sportsActivities: workoutForm.sportsActivities,
        sports: workoutForm.sportsActivities,
        userId,
      };
      const url = workoutForm.id
        ? `${apiBaseUrl}/api/workouts/templates/${workoutForm.id}`
        : `${apiBaseUrl}/api/workouts/templates`;
      const method = workoutForm.id ? 'PUT' : 'POST';
      const saved = await fetchJson(url, {
        method,
        body: JSON.stringify(payload),
      });
      setWorkoutForm({ id: null, name: '', muscleGroups: [], sportsActivities: [], exercises: [] });
      if (saved && saved.id) {
        setWorkouts((prev) => {
          const others = prev.filter((w) => w.id !== saved.id);
          return [normalizeWorkoutFromApi(saved), ...others];
        });
      } else {
        await loadWorkouts();
      }
      if (createReminder) {
        const reminderPayload = {
          type: 'workout',
          workoutName: saved?.name || workoutForm.name,
          date: new Date().toISOString().slice(0, 10),
        };
        await fetchJson(`${apiBaseUrl}/api/workouts/reminders`, {
          method: 'POST',
          body: JSON.stringify(reminderPayload),
        });
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
      await fetchJson(`${apiBaseUrl}/api/workouts/templates/${id}?userId=${userId}`, {
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

  const handleCompleteTodayWorkout = async () => {
    if (!workoutForm.name) {
      notify('Selecione um treino para concluir.', 'warning');
      return;
    }
    const sessionPayload = {
      userId,
      templateId: workoutForm.id || null,
      date: new Date().toISOString().slice(0, 10),
      name: workoutForm.name,
      muscleGroups: workoutForm.muscleGroups,
      sportsActivities: workoutForm.sportsActivities,
      sports: workoutForm.sportsActivities,
      exercises: workoutForm.exercises.map((ex) => ({
        ...ex,
        completed: true,
      })),
      completed: true,
    };

    try {
      const saved = await fetchJson(`${apiBaseUrl}/api/workouts/sessions`, {
        method: 'POST',
        body: JSON.stringify(sessionPayload),
      });
      setSessions((prev) => [saved, ...prev]);
      if (sessionReminder) {
        const reminderPayload = {
          type: 'workout',
          workoutName: saved?.name || workoutForm.name,
          date: saved?.date || sessionPayload.date,
        };
        await fetchJson(`${apiBaseUrl}/api/workouts/reminders`, {
          method: 'POST',
          body: JSON.stringify(reminderPayload),
        });
      }
      notify('Treino de hoje concluído!', 'success');
    } catch (err) {
      console.error('Erro ao concluir treino', err);
      notify('Não foi possível registrar o treino de hoje.', 'danger');
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

  useEffect(() => {
    if (activeTab === 'history') {
      loadSessions();
    } else if (activeTab === 'progress') {
      loadProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyRange]);

  useEffect(() => {
    if (!restRunning) return;
    if (restCountdown <= 0) {
      setRestRunning(false);
      setRestFinished(true);
      return;
    }
    const timer = setTimeout(() => setRestCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [restRunning, restCountdown]);

  const startRestTimer = () => {
    setRestFinished(false);
    setRestCountdown(restDuration);
    setRestRunning(true);
  };

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="title" style={{ margin: 0 }}>Rotina de Treino</h3>
        <div className="muted" style={{ fontSize: 13 }}>
          Monte templates detalhados, salve o histórico e acompanhe o progresso.
        </div>
      </div>

      <div className="sep" style={{ marginTop: 12 }}></div>

      <div className="row" style={{ gap: 12, margin: '10px 0 18px' }}>
        <button
          className={activeTab === 'config' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('config')}
        >
          Configuração
        </button>
        <button
          className={activeTab === 'history' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('history')}
        >
          Histórico
        </button>
        <button
          className={activeTab === 'progress' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('progress')}
        >
          Progresso
        </button>
      </div>

      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* NOVO TREINO */}
          <div>
            <h4 className="title" style={{ marginBottom: 12 }}>Novo Template de Treino</h4>
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
                const active = workoutForm.sportsActivities.includes(sport.value);
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

            <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={createReminder}
                  onChange={(e) => setCreateReminder(e.target.checked)}
                />
                Criar lembrete para este treino
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={sessionReminder}
                  onChange={(e) => setSessionReminder(e.target.checked)}
                />
                Criar lembrete ao concluir
              </label>
            </div>

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <button
                className="ghost"
                disabled={!workoutForm.id}
                onClick={() => setWorkoutForm({ id: null, name: '', muscleGroups: [], sportsActivities: [], exercises: [] })}
              >
                Limpar edição
              </button>
              <div className="row" style={{ gap: 8 }}>
                <button className="ghost" onClick={handleCompleteTodayWorkout} disabled={!workoutForm.name}>
                  Concluir treino de hoje
                </button>
                <button className="primary" onClick={handleSaveWorkout} disabled={loading}>
                  {loading ? 'Salvando...' : workoutForm.id ? 'Atualizar template' : 'Salvar template'}
                </button>
              </div>
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
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {(item.muscleGroups || [])
                          .map((group) => muscleMap[group]?.label || group)
                          .join(', ')}
                      </div>
                      {(item.exercises || []).length > 0 && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {(item.exercises || []).slice(0, 2).map(formatExerciseResume).join('; ')}
                          {item.exercises.length > 2 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        className="ghost small"
                        onClick={() => {
                          setWorkoutForm({
                            id: item.id,
                            name: item.name,
                            muscleGroups: item.muscleGroups || [],
                            sportsActivities: syncSportsFromTemplate(item.sportsActivities, item.sports),
                            exercises: item.exercises || [],
                          });
                          setSelectedWorkout({
                            ...item,
                            sportsActivities: syncSportsFromTemplate(item.sportsActivities, item.sports),
                          });
                          setShowWorkoutModal(true);
                        }}
                        disabled={loading}
                      >
                        Editar treino
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
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row" style={{ gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label>De</label>
              <input
                type="date"
                value={historyRange.from}
                onChange={(e) => setHistoryRange((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label>Até</label>
              <input
                type="date"
                value={historyRange.to}
                onChange={(e) => setHistoryRange((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>
          </div>

          {!sessions.length && <div className="muted">Nenhum treino registrado no período.</div>}
          {sessions.length > 0 && (
            <div className="table">
              {sessions.map((session) => (
                <details key={session.id} className="table-row" open>
                  <summary style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 600 }}>{session.name}</div>
                      <span className="muted" style={{ fontSize: 13 }}>{session.date}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {(session.muscleGroups || []).map((g) => muscleMap[g]?.label || g).join(', ')}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {(session.exercises || []).map(formatExerciseResume).join('; ')}
                    </div>
                  </summary>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(session.exercises || []).map((ex) => (
                      <div
                        key={ex.id}
                        style={{
                          border: '1px solid rgba(255,255,255,0.08)',
                          padding: 12,
                          borderRadius: 10,
                          background: '#0f131c',
                        }}
                      >
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <strong>{ex.name}</strong>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {muscleMap[ex.muscleGroupId]?.label || ex.muscleGroupId}
                          </span>
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          Séries: {ex.sets} · Repetições: {ex.reps} · Peso: {ex.weight || '--'}kg · Descanso: {ex.restSeconds}s
                        </div>
                        {ex.notes && (
                          <div style={{ marginTop: 6, fontSize: 13 }}>
                            <strong>Anotações:</strong> {ex.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="muted" style={{ fontSize: 14 }}>
            Total de treinos no mês: <strong>{progress.totalSessions || 0}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(progress.byMuscleGroup || {}).map(([muscle, count]) => (
              <div key={muscle}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{muscleMap[muscle]?.label || muscle}</span>
                  <span className="muted">{count} treino(s)</span>
                </div>
                <div
                  style={{
                    height: 10,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min((count / Math.max(progress.totalSessions, 1)) * 100, 100)}%`,
                      height: '100%',
                      background: '#50be78',
                    }}
                  ></div>
                </div>
              </div>
            ))}
            {Object.keys(progress.byMuscleGroup || {}).length === 0 && (
              <div className="muted">Nenhum progresso registrado ainda.</div>
            )}
          </div>
        </div>
      )}

      {/* MODAL VER TREINO + EXERCÍCIOS */}
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
              width: 'min(720px, 90vw)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              maxHeight: '90vh',
              overflow: 'auto',
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
                <input
                  value={workoutForm.name}
                  onChange={(e) => setWorkoutForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do treino"
                />
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
                      <button
                        type="button"
                        key={muscle.value}
                        className="muscle-card active"
                        style={{ cursor: 'default' }}
                      >
                        <div className="muscle-image-wrapper">
                          <img
                            src={muscle.image}
                            alt={muscle.label}
                            className="muscle-image"
                          />
                        </div>
                        <span className="muscle-label">{muscle.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Exibe esportes/atividades selecionados. */}
              <div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Esportes / atividades
                </div>

                {selectedSportsDetails.length === 0 && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Nenhuma atividade selecionada.
                  </p>
                )}

                {selectedSportsDetails.length > 0 && (
                  <div className="muscle-grid">
                    {selectedSportsDetails.map((sport) => (
                      <button
                        type="button"
                        key={sport.value}
                        className="muscle-card active"
                        style={{ cursor: 'default', pointerEvents: 'none' }}
                      >
                        <div className="muscle-image-wrapper">
                          <img
                            src={sport.image}
                            alt={sport.label}
                            className="muscle-image"
                          />
                        </div>
                        <span className="muscle-label">{sport.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Timer de descanso</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Escolha um tempo e inicie para contar o descanso do exercício.
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    {[30, 45, 60, 90].map((sec) => (
                      <button
                        key={sec}
                        className={restDuration === sec ? 'primary small' : 'ghost small'}
                        onClick={() => setRestDuration(sec)}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {restCountdown || restDuration}s
                  </div>
                  <button className="primary" onClick={startRestTimer}>
                    Iniciar descanso
                  </button>
                </div>
                {restFinished && (
                  <div style={{ color: '#50be78', fontWeight: 600 }}>Descanso finalizado!</div>
                )}
              </div>

              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button
                  className="primary"
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
