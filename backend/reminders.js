// reminders.js
import "dotenv/config";
import { supabase } from "./supabase.js";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

/**
 * Busca eventos que são:
 *  - hoje
 *  - daqui a 3 dias
 * e marca cada um com o tipo de lembrete.
 */
export async function fetchUpcomingEvents() {
  const now = new Date();

  // Hoje (YYYY-MM-DD)
  const todayStr = now.toISOString().slice(0, 10);

  // Daqui a 3 dias (YYYY-MM-DD)
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const threeDaysStr = threeDays.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("events")
    .select("id, title, date, start, end, notes, user_id")
    .in("date", [todayStr, threeDaysStr])
    .order("date", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }

  const events = data || [];

  // Marca qual tipo de lembrete é cada evento
  return events.map((ev) => {
    let reminderType = "other";
    if (ev.date === todayStr) {
      reminderType = "today";
    } else if (ev.date === threeDaysStr) {
      reminderType = "three_days_before";
    }
    return { ...ev, reminderType };
  });
}

/**
 * Busca o WhatsApp do usuário na tabela profiles.
 * Aqui usamos o userId que vem do campo user_id da tabela events.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function fetchUserWhatsapp(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("whatsapp")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar WhatsApp do usuário: ${error.message}`);
  }

  return data?.whatsapp || null;
}

/**
 * Envia uma mensagem via API de WhatsApp.
 * @param {{ to: string, message: string }} payload
 * @returns {Promise<any>}
 */
export async function sendWhatsappMessage({ to, message }) {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    throw new Error(
      "Configure WHATSAPP_API_URL e WHATSAPP_API_TOKEN para enviar mensagens."
    );
  }

  // Garante que o número vai no formato apenas com dígitos (ex.: 5563992393705)
  const phone = String(to).replace(/\D/g, "");
  if (!phone) {
    throw new Error("Número de WhatsApp inválido para envio.");
  }

  const response = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": WHATSAPP_API_TOKEN, // z-API usa Client-Token no header
    },
    body: JSON.stringify({
      phone, // campo esperado pela z-API
      message, // texto já montado pelo sistema de lembretes
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao enviar mensagem (${response.status}): ${body}`);
  }

  try {
    return await response.json();
  } catch (err) {
    return null;
  }
}

const formatTimeRange = (event) => {
  if (!event.start && !event.end) return "";
  if (event.start && event.end) return `, das ${event.start} às ${event.end}`;
  if (event.start) return `, às ${event.start}`;
  return `, termina ${event.end}`;
};

/**
 * Monta a mensagem de lembrete usando:
 *  - tipo do lembrete (5 dias antes ou no dia)
 *  - título
 *  - data
 *  - horário (start/end)
 *  - notas
 */
const buildReminderMessage = (event) => {
  const date = new Date(event.date).toLocaleDateString("pt-BR");
  const timeRange = formatTimeRange(event);
  const notesPart = event.notes ? `\nNotas: ${event.notes}` : "";

  const title = event.title || "Evento";

  let prefix;
  if (event.reminderType === "three_days_before") {
    prefix = `Lembrete: faltam 3 dias para o compromisso "${title}".`;
  } else if (event.reminderType === "today") {
    prefix = `Lembrete: hoje é o dia do compromisso "${title}".`;
  } else {
    // fallback, se um dia quiser usar esse helper pra outra coisa
    prefix = `Lembrete do compromisso "${title}".`;
  }

  return `${prefix}\nData: ${date}${timeRange}${notesPart}`;
};

const getCurrentWeekdayIndex = () => {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay; // 1=segunda, 7=domingo
};

async function fetchTodayWorkoutEntries() {
  const weekday = getCurrentWeekdayIndex();

  const { data, error } = await supabase
    .from("workout_schedule")
    .select("id, user_id, weekday, workout_id, time, is_active")
    .eq("weekday", weekday)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Erro ao buscar agenda de treino: ${error.message}`);
  }

  return data || [];
}

async function buildWorkoutRemindersForToday() {
  const entries = await fetchTodayWorkoutEntries();
  if (!entries.length) return [];

  const workoutIds = Array.from(
    new Set(entries.map((item) => item.workout_id).filter(Boolean))
  );

  let workoutsMap = new Map();
  if (workoutIds.length) {
    const { data: workouts, error: workoutError } = await supabase
      .from("workout_routines")
      .select("id, name, muscle_groups")
      .in("id", workoutIds);

    if (workoutError) {
      throw new Error(`Erro ao buscar treinos: ${workoutError.message}`);
    }

    workoutsMap = new Map((workouts || []).map((item) => [item.id, item]));
  }

  const userIds = Array.from(new Set(entries.map((item) => item.user_id).filter(Boolean)));
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, whatsapp")
    .in("id", userIds);

  if (profileError) {
    throw new Error(`Erro ao buscar perfis: ${profileError.message}`);
  }

  const profilesMap = new Map((profiles || []).map((item) => [item.id, item]));

  return entries
    .map((entry) => {
      const workout = workoutsMap.get(entry.workout_id);
      const profile = profilesMap.get(entry.user_id);

      if (!workout || !profile || !profile.whatsapp) return null;

      const timePart = entry.time ? ` às ${entry.time}` : "";
      const muscleGroups = (workout.muscle_groups || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .join(", ") || "-";

      const message =
        `Bom dia, ${profile.name || ""}! Hoje é dia de ${workout.name}${timePart}. ` +
        `Grupos musculares: ${muscleGroups}. Bora treinar! 💪`;

      return { to: profile.whatsapp, message };
    })
    .filter(Boolean);
}

/**
 * Inicia um agendador simples que verifica eventos e dispara mensagens.
 * @param {{ intervalMinutes?: number }} options
 */
export function startRemindersJob({ intervalMinutes = 15 } = {}) {
  let isRunning = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const events = await fetchUpcomingEvents();

      for (const event of events) {
        if (!event.user_id) continue;

        const whatsapp = await fetchUserWhatsapp(event.user_id);
        if (!whatsapp) continue;

        const message = buildReminderMessage(event);

        await sendWhatsappMessage({ to: whatsapp, message });
      }

      try {
        const workoutReminders = await buildWorkoutRemindersForToday();
        for (const reminder of workoutReminders) {
          await sendWhatsappMessage(reminder);
        }
      } catch (workoutErr) {
        console.error("Erro ao enviar lembretes de treino:", workoutErr.message);
      }
    } catch (err) {
      console.error("Erro no job de lembretes:", err.message);
    } finally {
      isRunning = false;
    }
  };

  // roda uma vez ao subir
  tick();
  // e depois de X em X minutos
  const intervalId = setInterval(tick, intervalMinutes * 60 * 1000);

  return () => clearInterval(intervalId);
}

// Se rodar direto: `node reminders.js`
if (process.argv[1] && process.argv[1].endsWith("reminders.js")) {
  startRemindersJob();
}
