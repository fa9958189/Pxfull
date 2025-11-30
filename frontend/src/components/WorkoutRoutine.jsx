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

const getMuscleGroupByLabel = (label) => {
  const normalized = String(label || '').toLowerCase();
  return MUSCLE_GROUPS.find(
    (group) =>
      group.label.toLowerCase() === normalized ||
      group.value.toLowerCase() === normalized
  );
};

const getSportByLabel = (label) => {
  const normalized = String(label || '').toLowerCase();
  return SPORTS.find(
    (sport) => sport.label.toLowerCase() === normalized || sport.value.toLowerCase() === normalized
  );
};

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

const WorkoutRestTimer = ({
  restDuration,
  restCountdown,
  restFinished,
  onChangeDuration,
  onStart,
}) => (
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
            onClick={() => onChangeDuration(sec)}
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
      <button className="primary" onClick={onStart}>
        Iniciar descanso
      </button>
    </div>
    {restFinished && (
      <div style={{ color: '#50be78', fontWeight: 600 }}>Descanso finalizado!</div>
    )}
  </div>
);

const ViewWorkoutModal = ({
  open,
  workout,
  onClose,
  onCompleteToday,
  muscleMap,
  sportsMap,
  restDuration,
  restCountdown,
  restFinished,
  onChangeDuration,
  onStart,
}) => {
  // Modal de visualização de treino
  if (!open || !workout) return null;

  const muscleGroups = Array.isArray(workout.muscleGroups) ? workout.muscleGroups : [];
  const sportsActivities = Array.isArray(workout.sportsActivities)
    ? workout.sportsActivities
    : [];

  return (
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
        className="workout-view-modal"
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
          <button className="ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="sep" style={{ margin: '12px 0' }}></div>

        <section className="modal-body">
          <div className="workout-details-content">
            <div className="field">
              <label>Nome do treino</label>
              <div className="value" style={{ fontWeight: 600 }}>
                {workout.name || 'Treino sem nome'}
              </div>
            </div>

            <div className="field">
              <label>Grupos musculares</label>
              <div className="chips chips-with-image">
                {muscleGroups.length > 0 ? (
                  muscleGroups.map((mg) => {
                    const def = getMuscleGroupByLabel(mg) || muscleMap[mg];
                    return (
                      <div key={mg} className="chip chip-with-image">
                        {def?.image && (
                          <img
                            src={def.image}
                            alt={def.label || mg}
                            className="chip-icon"
                          />
                        )}
                        <span>{def?.label || mg}</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="muted">Nenhum grupo selecionado</span>
                )}
              </div>
            </div>

            <div className="field">
              <label>Esportes / atividades</label>
              <div className="chips chips-with-image">
                {sportsActivities.length > 0 ? (
                  sportsActivities.map((act) => {
                    const def = getSportByLabel(act) || sportsMap[act];
                    return (
                      <div key={act} className="chip chip-with-image">
                        {def?.image && (
                          <img
                            src={def.image}
                            alt={def.label || act}
                            className="chip-icon"
                          />
                        )}
                        <span>{def?.label || act}</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="muted">Nenhuma atividade selecionada</span>
                )}
              </div>
            </div>
          </div>

          {Array.isArray(workout.exercises) && workout.exercises.length > 0 && (
            <div className="field">
              <label>Exercícios</label>
              <ul className="exercise-list" style={{ paddingLeft: 18 }}>
                {workout.exercises.map((ex) => (
                  <li key={ex.id || ex.name} style={{ marginBottom: 6 }}>
                    <strong>{ex.name}</strong>{' '}
                    {ex.sets && ex.reps && (
                      <span>
                        {ex.sets} x {ex.reps}
                      </span>
                    )}
                    {typeof ex.weight === 'number' && <span> – {ex.weight} kg</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="workout-timer-section">
            <div className="field">
              <label>Timer de descanso</label>
              <WorkoutRestTimer
                restDuration={restDuration}
                restCountdown={restCountdown}
                restFinished={restFinished}
                onChangeDuration={onChangeDuration}
                onStart={onStart}
              />
            </div>
            <div className="complete-today-wrapper" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="primary"
                onClick={() => onCompleteToday?.(workout)}
              >
                Concluir treino de hoje
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const WorkoutRoutine = ({ apiBaseUrl = 'http://192.168.11.190:3001', pushToast }) => {
  const [activeTab, setActiveTab] = useState('config');
  const [workoutForm, setWorkoutForm] = useState({
    id: null,
    name: '',
    muscleGroups: [],
    sportsActivities: [],
    exercises: [],
  });
  const [routines, setRoutines] = useState([]);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [userId, setUserId] = useState('');
  const [viewWorkout, setViewWorkout] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
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

  const hasRoutines = useMemo(() => routines.length > 0, [routines]);

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

  const normalizeRoutineFromApi = (item) => {
    const normalizeList = (value, fallback = []) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value.split(',').map((g) => g.trim()).filter(Boolean);
      }
      if (typeof fallback === 'string') {
        return fallback.split(',').map((g) => g.trim()).filter(Boolean);
      }
      return Array.isArray(fallback) ? fallback : [];
    };

    const muscleGroups = normalizeList(item?.muscleGroups, item?.muscle_group);
    const sportsActivities = normalizeList(
      item?.sportsActivities,
      item?.sports_list || item?.sports
    );

    return {
      ...item,
      muscleGroups,
      sports: sportsActivities,
      sportsActivities,
      exercises: Array.isArray(item?.exercises) ? item.exercises : [],
    };
  };

  const loadRoutines = async () => {
    try {
      if (!userId) {
        notify('Perfil do usuário não carregado.', 'warning');
        return;
      }
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/workout/routines?userId=${userId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível carregar os treinos.');
      }
      const raw = Array.isArray(data) ? data : data?.items || [];
      const normalized = raw.map(normalizeRoutineFromApi);
      setRoutines(normalized);
    } catch (err) {
      console.error('Erro ao carregar rotinas', err);
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
      const raw = Array.isArray(data) ? data : data?.items || [];
      const normalized = raw.map((session) => {
        const normalizedSports = syncSportsFromTemplate(
          session.sportsActivities,
          session.sports || session.sports_activities
        );

        const normalizedGroups = Array.isArray(session.muscleGroups)
          ? session.muscleGroups
          : typeof session.muscle_groups === 'string'
            ? session.muscle_groups.split(',').map((g) => g.trim()).filter(Boolean)
            : [];

        return {
          ...session,
          muscleGroups: normalizedGroups,
          sportsActivities: normalizedSports,
        };
      });
      setSessions(normalized);
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

  const handleOpenViewWorkout = (template) => {
    const normalizedSports = syncSportsFromTemplate(
      template.sportsActivities,
      template.sports
    );
    setWorkoutForm({
      id: template.id || null,
      name: template.name || '',
      muscleGroups: template.muscleGroups || [],
      sportsActivities: normalizedSports,
      exercises: template.exercises || [],
    });
    setViewWorkout({ ...template, sportsActivities: normalizedSports });
    setIsViewModalOpen(true);
  };

  const handleCloseViewWorkout = () => {
    setIsViewModalOpen(false);
    setViewWorkout(null);
  };

  const handleSaveRoutine = async () => {
    if (!workoutForm.name.trim()) {
      notify('Informe o nome do treino.', 'warning');
      return;
    }
    if (!workoutForm.muscleGroups.length) {
      notify('Selecione pelo menos um grupo muscular.', 'warning');
      return;
    }

    const payload = {
      userId,
      name: workoutForm.name,
      muscleGroups: workoutForm.muscleGroups,
      sportsActivities: workoutForm.sportsActivities,
    };

    try {
      setLoading(true);
      let response;
      if (workoutForm.id) {
        response = await fetch(`${apiBaseUrl}/api/workout/routines/${workoutForm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch(`${apiBaseUrl}/api/workout/routines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const saved = await response.json();

      if (!response.ok) {
        throw new Error(saved?.error || 'Não foi possível salvar o treino.');
      }

      setWorkoutForm({ id: null, name: '', muscleGroups: [], sportsActivities: [], exercises: [] });

      setRoutines((prev) => {
        if (workoutForm.id) {
          return prev.map((routine) => (routine.id === saved.id ? normalizeRoutineFromApi(saved) : routine));
        }
        return [...prev, normalizeRoutineFromApi(saved)];
      });

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

  const handleDeleteRoutine = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este treino?')) return;

    try {
      const response = await fetch(`${apiBaseUrl}/api/workout/routines/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Não foi possível excluir o treino.');
      }

      setRoutines((prev) => prev.filter((tpl) => tpl.id !== id));
      setSchedule((prev) =>
        prev.map((slot) => (slot.workout_id === id ? { ...slot, workout_id: '' } : slot))
      );
    } catch (err) {
      console.error('Erro ao excluir treino', err);
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

  const completeWorkoutSession = async (template) => {
    const source = template || workoutForm;
    if (!source?.name) {
      notify('Selecione um treino para concluir.', 'warning');
      return null;
    }

    const sportsActivities = syncSportsFromTemplate(
      source.sportsActivities,
      source.sports || source.sports_activities
    );

    const sessionPayload = {
      userId,
      templateId: source.id || null,
      date: new Date().toISOString().slice(0, 10),
      name: source.name,
      muscleGroups: source.muscleGroups || source.muscle_groups || [],
      sportsActivities,
      sports: sportsActivities,
      sports_activities: sportsActivities,
      exercises: (source.exercises || []).map((ex) => ({
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

      const normalizedSaved = {
        ...saved,
        muscleGroups: Array.isArray(saved?.muscleGroups)
          ? saved.muscleGroups
          : Array.isArray(source.muscleGroups)
            ? source.muscleGroups
            : [],
        sportsActivities: syncSportsFromTemplate(
          saved?.sportsActivities,
          saved?.sports || saved?.sports_activities || sportsActivities
        ),
      };

      setSessions((prev) => [normalizedSaved, ...prev]);
      if (sessionReminder) {
        const reminderPayload = {
          type: 'workout',
          workoutName: normalizedSaved?.name || source.name,
          date: normalizedSaved?.date || sessionPayload.date,
        };
        await fetchJson(`${apiBaseUrl}/api/workouts/reminders`, {
          method: 'POST',
          body: JSON.stringify(reminderPayload),
        });
      }
      notify('Treino de hoje concluído!', 'success');
      return normalizedSaved;
    } catch (err) {
      console.error('Erro ao concluir treino', err);
      notify('Não foi possível registrar o treino de hoje.', 'danger');
      return null;
    }
  };

  const handleCompleteTodayWorkout = async () => {
    await completeWorkoutSession(workoutForm);
  };

  const handleCompleteFromModal = async (template) => {
    const saved = await completeWorkoutSession(template);
    if (saved) {
      handleCloseViewWorkout();
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
    loadRoutines();
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
                <button className="primary" onClick={handleSaveRoutine} disabled={loading}>
                  {loading ? 'Salvando...' : workoutForm.id ? 'Atualizar template' : 'Salvar template'}
                </button>
              </div>
            </div>
          </div>

          {/* TREINOS CADASTRADOS */}
          <div>
            <h4 className="title" style={{ marginBottom: 12 }}>Treinos cadastrados</h4>
            {!routines.length && <div className="muted">Nenhum treino cadastrado.</div>}
            {routines.length > 0 && (
              <div className="table">
                {routines.map((template) => (
                  <div
                    key={template.id || template.name}
                    className="workout-template-item table-row"
                  >
                    <div className="workout-template-header">
                      <strong>{template.name}</strong>
                      <div className="workout-template-subtitle">
                        {Array.isArray(template.muscleGroups) && template.muscleGroups.length > 0 && (
                          <span>
                            {(template.muscleGroups || [])
                              .map((group) => muscleMap[group]?.label || group)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                      {Array.isArray(template.sportsActivities) && template.sportsActivities.length > 0 && (
                        <div className="workout-template-subtitle">
                          Esportes/atividades:{' '}
                          {(template.sportsActivities || [])
                            .map((sport) => sportsMap[sport]?.label || sport)
                            .join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="workout-template-actions">
                      <button
                        type="button"
                        className="ghost small btn-outline"
                        onClick={() => handleOpenViewWorkout({
                          ...template,
                          sportsActivities: syncSportsFromTemplate(
                            template.sportsActivities,
                            template.sports
                          )
                        })}
                      >
                        Ver treino
                      </button>
                      <button
                        type="button"
                        className="ghost small btn-danger-outline"
                        onClick={() => handleDeleteRoutine(template.id)}
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
                      {routines.map((item) => (
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
                disabled={savingSchedule || !hasRoutines}
              >
                {savingSchedule ? 'Salvando...' : 'Salvar semana de treino'}
              </button>
            </div>
            {!hasRoutines && (
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
                    {Array.isArray(session.sportsActivities) && session.sportsActivities.length > 0 && (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Esportes/atividades:{' '}
                        {session.sportsActivities
                          .map((sport) => sportsMap[sport]?.label || sport)
                          .join(', ')}
                      </div>
                    )}
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

      <ViewWorkoutModal
        open={isViewModalOpen}
        workout={viewWorkout}
        onClose={handleCloseViewWorkout}
        onCompleteToday={handleCompleteFromModal}
        muscleMap={muscleMap}
        sportsMap={sportsMap}
        restDuration={restDuration}
        restCountdown={restCountdown}
        restFinished={restFinished}
        onChangeDuration={setRestDuration}
        onStart={startRestTimer}
      />
    </section>
  );
};

export default WorkoutRoutine;
