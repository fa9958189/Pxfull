// reminders.js
import "dotenv/config";
import { supabase } from "./supabase.js";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

/**
 * Busca eventos de hoje e de amanhã.
 */
export async function fetchUpcomingEvents() {
  const now = new Date();

  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("events")
    .select("id, title, date, start, end, notes, user_id")
    .in("date", [todayStr, tomorrowStr])
    .order("date", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }

  return data || [];
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

  // z-API espera o número apenas com dígitos, no formato 55DDDNÚMERO
  const phone = String(to || "").replace(/\D/g, "");
  if (!phone) {
    throw new Error("Número de WhatsApp inválido para envio.");
  }

  const response = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // z-API usa Client-Token no header, não Authorization: Bearer
      "Client-Token": WHATSAPP_API_TOKEN,
    },
    // z-API espera o campo 'phone' no body, junto com 'message'
    body: JSON.stringify({
      phone,
      message,
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

const buildReminderMessage = (event, type) => {
  const date = new Date(event.date).toLocaleDateString("pt-BR");
  const startTime = event.start || "-";
  const endTime = event.end || "-";
  const notes = event.notes || "-";
  const title = event.title || "Evento";

  const base =
    type === "day_before"
      ? "Não esqueça do seu compromisso amanhã!"
      : "Não esqueça do seu compromisso hoje!";

  return `${base}\nTítulo: ${title}\nData: ${date}\nHorário: ${startTime} – ${endTime}\nNotas: ${notes}`;
};

const getDateTimeAt = (dateStr, hour, minute) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  return new Date(
    dt.getUTCFullYear(),
    dt.getUTCMonth(),
    dt.getUTCDate(),
    dt.getUTCHours(),
    dt.getUTCMinutes(),
    dt.getUTCSeconds()
  );
};

const parseEventStartTime = (event) => {
  if (!event.start) return null;
  const [hourStr, minuteStr] = event.start.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr || 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return getDateTimeAt(event.date, hour, minute);
};

const MORNING_SEND_HOUR = 6;
const MORNING_SEND_MINUTE = 20;
const EARLY_EVENT_LIMIT_HOUR = 9;
const EARLY_EVENT_LIMIT_MINUTE = 20;

const shouldSendReminder = (event, now, intervalMinutes) => {
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const startDateTime = parseEventStartTime(event);
  const windowMinutes = intervalMinutes;

  if (event.date === tomorrowStr) {
    const sendTime = getDateTimeAt(todayStr, MORNING_SEND_HOUR, MORNING_SEND_MINUTE);
    if (isWithinWindow(now, sendTime, windowMinutes)) {
      return { shouldSend: true, reminderType: "day_before" };
    }
    return { shouldSend: false };
  }

  if (event.date !== todayStr) return { shouldSend: false };

  if (startDateTime) {
    const earlyLimit = getDateTimeAt(
      event.date,
      EARLY_EVENT_LIMIT_HOUR,
      EARLY_EVENT_LIMIT_MINUTE
    );

    if (startDateTime > earlyLimit) {
      const sendTime = getDateTimeAt(
        event.date,
        MORNING_SEND_HOUR,
        MORNING_SEND_MINUTE
      );
      if (isWithinWindow(now, sendTime, windowMinutes)) {
        return { shouldSend: true, reminderType: "day_of_morning" };
      }
    } else {
      const sendTime = new Date(startDateTime.getTime() - 3 * 60 * 60 * 1000);
      if (isWithinWindow(now, sendTime, windowMinutes)) {
        return { shouldSend: true, reminderType: "day_of_three_hours_before" };
      }
    }
  } else {
    const sendTime = getDateTimeAt(event.date, MORNING_SEND_HOUR, MORNING_SEND_MINUTE);
    if (isWithinWindow(now, sendTime, windowMinutes)) {
      return { shouldSend: true, reminderType: "day_of_morning" };
    }
  }

  return { shouldSend: false };
};

const getReminderKey = (event, reminderType) => `${event.id}-${reminderType}`;

async function hasReminderBeenSent(eventId, reminderKey, dayStr) {
  const { data, error } = await supabase
    .from("event_reminder_logs")
    .select("id")
    .eq("event_id", eventId)
    .eq("reminder_key", reminderKey)
    .eq("day", dayStr)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar logs de lembrete: ${error.message}`);
  }

  return Boolean(data);
}

async function markReminderSent(eventId, reminderKey, dayStr) {
  const payload = {
    event_id: eventId,
    reminder_key: reminderKey,
    day: dayStr,
    sent_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("event_reminder_logs")
    .upsert(payload, { onConflict: "event_id,day,reminder_key" });

  if (error) {
    throw new Error(`Erro ao registrar lembrete enviado: ${error.message}`);
  }
}

function parseHourMinute(timeValue) {
  const str = String(timeValue || "").trim();
  if (!str) return null;
  const [hh, mm] = str.split(":");
  const hour = Number(hh);
  const minute = Number(mm);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

function isWithinWindow(now, target, windowMinutes) {
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff < windowMinutes * 60 * 1000;
}

async function hasWorkoutReminderBeenSent(scheduleId, dayStr) {
  const { data, error } = await supabase
    .from("workout_reminder_logs")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("day", dayStr)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar log de treino: ${error.message}`);
  }
  return Boolean(data);
}

async function markWorkoutReminderSent(scheduleId, userId, dayStr) {
  const payload = {
    schedule_id: scheduleId,
    user_id: userId,
    day: dayStr,
    sent_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("workout_reminder_logs")
    .upsert(payload, { onConflict: "schedule_id,day" });

  if (error) {
    throw new Error(`Erro ao registrar log de treino: ${error.message}`);
  }
}

const getCurrentWeekdayIndex = (referenceDate = new Date()) => {
  const jsDay = referenceDate.getDay();
  return jsDay === 0 ? 7 : jsDay; // 1=segunda, 7=domingo
};

async function fetchTodayWorkoutEntries(referenceDate = new Date()) {
  const weekday = getCurrentWeekdayIndex(referenceDate);

  const { data, error } = await supabase
    .from("workout_schedule")
    .select("id, user_id, weekday, workout_id, time, is_active")
    .eq("weekday", weekday)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Erro ao buscar agenda de treino: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    weekday: row.weekday,
    workout_id: row.workout_id,
    time: row.time,
    is_active: row.is_active,
  }));
}

async function buildWorkoutRemindersForToday(now, dayStr, intervalMinutes) {
  const entries = await fetchTodayWorkoutEntries(now);
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

  const reminders = [];

  for (const entry of entries) {
    const workout = workoutsMap.get(entry.workout_id);
    const profile = profilesMap.get(entry.user_id);

    if (!workout || !profile || !profile.whatsapp) continue;

    const hm = parseHourMinute(entry.time);
    if (!hm) continue;

    const sendTime = new Date(now);
    sendTime.setHours(hm.hour, hm.minute, 0, 0);

    if (!isWithinWindow(now, sendTime, intervalMinutes)) continue;

    const alreadySent = await hasWorkoutReminderBeenSent(entry.id, dayStr);
    if (alreadySent) continue;

    const timePart = entry.time ? ` às ${entry.time}` : "";
    const muscleGroups = (workout.muscle_groups || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ") || "-";

    const message =
      `Bom dia, ${profile.name || ""}! Hoje é dia de ${workout.name}${timePart}. ` +
      `Grupos musculares: ${muscleGroups}. Bora treinar! 💪`;

    reminders.push({
      to: profile.whatsapp,
      message,
      scheduleId: entry.id,
      userId: entry.user_id,
    });
  }

  return reminders;
}

export async function checkWorkoutReminders(intervalMinutes = 15) {
  const now = new Date();
  const dayStr = now.toISOString().slice(0, 10);

  const workoutReminders = await buildWorkoutRemindersForToday(
    now,
    dayStr,
    intervalMinutes
  );

  for (const reminder of workoutReminders) {
    await sendWhatsappMessage(reminder);
    await markWorkoutReminderSent(reminder.scheduleId, reminder.userId, dayStr);
  }
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

      const now = new Date();
      const dayStr = now.toISOString().slice(0, 10);

      for (const event of events) {
        if (!event.user_id) continue;

        const { shouldSend, reminderType } = shouldSendReminder(
          event,
          now,
          intervalMinutes
        );

        if (!shouldSend || !reminderType) continue;

        const reminderKey = getReminderKey(event, reminderType);
        const alreadySent = await hasReminderBeenSent(event.id, reminderKey, dayStr);
        if (alreadySent) continue;

        const whatsapp = await fetchUserWhatsapp(event.user_id);
        if (!whatsapp) continue;

        const message = buildReminderMessage(
          event,
          reminderType === "day_before" ? "day_before" : "day_of"
        );

        await sendWhatsappMessage({ to: whatsapp, message });
        await markReminderSent(event.id, reminderKey, dayStr);
      }

      try {
        await checkWorkoutReminders(intervalMinutes);
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

export function startWorkoutReminderWorker() {
  console.log("⏰ Worker de lembretes de treino iniciado");

  // roda imediatamente uma vez ao subir (opcional mas recomendado)
  (async () => {
    try {
      console.log("🔎 Checando lembretes de treino (boot)...");
      await checkWorkoutReminders();
    } catch (err) {
      console.error("Erro no worker (boot):", err?.message || err);
    }
  })();

  // e depois roda a cada 60 segundos
  setInterval(async () => {
    try {
      console.log("🔎 Checando lembretes de treino...");
      await checkWorkoutReminders();
    } catch (err) {
      console.error("Erro no worker:", err?.message || err);
    }
  }, 60 * 1000);
}

// Se rodar direto: `node reminders.js`
if (process.argv[1] && process.argv[1].endsWith("reminders.js")) {
  startRemindersJob();
}
