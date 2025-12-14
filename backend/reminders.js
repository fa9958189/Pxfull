import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://gklpjwjzluqsnavwhwxf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const WORKOUT_SCHEDULE_TABLE =
  process.env.WORKOUT_SCHEDULE_TABLE || "cronograma_de_treinos";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

// Z-API
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;
const ZAPI_BASE_URL = process.env.ZAPI_BASE_URL || "https://api.z-api.io";

const sentCache = new Map();

/**
 * Utilidades de data/hora
 */
function nowBR() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
}

function hhmm(dt) {
  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getWeekdayBR(dt) {
  const jsDay = dt.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function normalizeTimeToHHMM(timeValue) {
  if (!timeValue) return null;
  if (typeof timeValue === "string") return timeValue.slice(0, 5);
  return null;
}

function shouldSendOnce(key) {
  const ts = sentCache.get(key);
  const now = Date.now();
  if (ts && now - ts < 70_000) return false;
  sentCache.set(key, now);
  return true;
}

function logSupabaseInfo() {
  const urlHost = (SUPABASE_URL || "")
    .replace("https://", "")
    .replace("http://", "")
    .split("/")[0];
  console.log("🔎 SUPABASE_URL host:", urlHost);
  console.log("🔎 Tabela agenda:", WORKOUT_SCHEDULE_TABLE);
}

// --------------------
// Eventos (lógica original)
// --------------------

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

  const phone = String(to || "").replace(/\D/g, "");
  if (!phone) {
    throw new Error("Número de WhatsApp inválido para envio.");
  }

  const response = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": WHATSAPP_API_TOKEN,
    },
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

export async function startRemindersJob({ intervalMinutes = 15 } = {}) {
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
    } catch (err) {
      console.error("Erro no job de lembretes:", err.message);
    } finally {
      isRunning = false;
    }
  };

  tick();
  const intervalId = setInterval(tick, intervalMinutes * 60 * 1000);

  return () => clearInterval(intervalId);
}

// --------------------
// Worker de treinos
// --------------------

async function sendWhatsAppMessage({ phone, message }) {
  const url = `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const body = {
    phone,
    message,
  };

  const headers = {
    "Content-Type": "application/json",
  };

  if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await resp.text().catch(() => "");
  return { ok: resp.ok, status: resp.status, body: text };
}

export async function checkWorkoutRemindersOnce() {
  const dt = nowBR();
  const weekday = getWeekdayBR(dt);
  const currentHHMM = hhmm(dt);

  console.log(`⏱️ Checando lembretes... weekday=${weekday} hora=${currentHHMM}`);

  const { data, error } = await supabase
    .from(WORKOUT_SCHEDULE_TABLE)
    .select("id, user_id, weekday, time, is_active")
    .eq("weekday", weekday)
    .eq("is_active", true);

  if (error) {
    console.error("❌ Erro ao buscar agenda de treino (Supabase):", error);
    return;
  }

  const total = data?.length || 0;
  console.log(`📋 Registros ativos encontrados hoje: ${total}`);

  const due = (data || []).filter(
    (row) => normalizeTimeToHHMM(row.time) === currentHHMM
  );

  if (due.length === 0) {
    console.log(
      `ℹ️ Registros hoje: ${total}, mas nenhum bateu no minuto ${currentHHMM}.`
    );
    return;
  }

  console.log(`✅ Encontrados ${due.length} lembrete(s) para agora (${currentHHMM}).`);

  for (const row of due) {
    const key = `${row.user_id}-${row.weekday}-${currentHHMM}`;
    if (!shouldSendOnce(key)) {
      console.log("⏭️ Ignorando duplicado (anti-spam):", key);
      continue;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("whatsapp, name")
      .eq("id", row.user_id)
      .maybeSingle();

    if (profileErr) {
      console.error("❌ Erro buscando telefone do usuário:", profileErr);
      continue;
    }

    const phone = profile?.whatsapp;
    if (!phone) {
      console.warn("⚠️ Usuário sem telefone cadastrado. user_id=", row.user_id);
      continue;
    }

    const message = `🏋️ Lembrete de treino: tá na hora! (${currentHHMM})`;

    console.log("📤 Enviando WhatsApp via Z-API:", { phone, message });

    const z = await sendWhatsAppMessage({ phone, message });

    if (!z.ok) {
      console.error("❌ Z-API falhou:", { status: z.status, body: z.body });
    } else {
      console.log("✅ Z-API OK:", { status: z.status, body: z.body });
    }
  }
}

let workoutWorkerIntervalId = null;

export function startWorkoutReminderWorker() {
  if (workoutWorkerIntervalId) {
    return workoutWorkerIntervalId;
  }

  console.log("🟢 Worker de lembretes iniciado");
  logSupabaseInfo();

  checkWorkoutRemindersOnce().catch((e) =>
    console.error("❌ Erro no worker (boot):", e)
  );

  workoutWorkerIntervalId = setInterval(() => {
    checkWorkoutRemindersOnce().catch((e) =>
      console.error("❌ Erro no worker:", e)
    );
  }, 10_000);

  return workoutWorkerIntervalId;
}

if (process.argv[1] && process.argv[1].endsWith("reminders.js")) {
  startRemindersJob();
  startWorkoutReminderWorker();
}
