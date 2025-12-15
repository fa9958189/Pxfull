import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://gklpjwjzluqsnavwhwxf.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;

const WORKOUT_SCHEDULE_TABLE = process.env.WORKOUT_SCHEDULE_TABLE || "events";

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

const TZ = "America/Sao_Paulo";

let reminderTableEnsured = false;

async function ensureEventReminderTable() {
  if (reminderTableEnsured) return true;

  const baseUrl = SUPABASE_URL?.replace(/\/$/, "");
  const sql = `create table if not exists public.event_reminder_sends (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    user_id uuid not null,
    scheduled_at timestamptz not null,
    sent_at timestamptz not null default now()
  );`;

  if (!baseUrl || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Não foi possível garantir a tabela event_reminder_sends (config ausente)");
    return false;
  }

  try {
    const resp = await fetch(`${baseUrl}/rest/v1/rpc/execute_sql`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(
        "❌ Falha ao garantir tabela event_reminder_sends:",
        resp.status,
        text
      );
      return false;
    }

    reminderTableEnsured = true;
    return true;
  } catch (err) {
    console.error("❌ Erro ao criar tabela event_reminder_sends:", err);
    return false;
  }
}

function getNowInSaoPaulo() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

function formatDateOnlyInSaoPaulo(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function normalizePhone(raw) {
  return String(raw || "")
    .replace(/[+\s()-]/g, "")
    .trim();
}

function toSaoPauloDate(dateStr, timeStr) {
  const [year, month, day] = (dateStr || "").split("-").map(Number);
  const [hour, minute] = (timeStr || "0:0").split(":").map(Number);
  if (
    [year, month, day, hour, minute].some((value) =>
      Number.isNaN(Number(value))
    )
  ) {
    return null;
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const localInTz = new Date(
    utcGuess.toLocaleString("en-US", { timeZone: TZ })
  );
  const offsetMinutes = (localInTz.getTime() - utcGuess.getTime()) / 60000;
  return new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);
}

async function hasEventReminderBeenSent(eventId) {
  const { data, error } = await supabase
    .from("event_reminder_sends")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar envio do lembrete: ${error.message}`);
  }

  return Boolean(data);
}

async function markEventReminderSent(eventId, userId, scheduledAt) {
  const payload = {
    event_id: eventId,
    user_id: userId,
    scheduled_at: scheduledAt.toISOString(),
  };

  const { error } = await supabase
    .from("event_reminder_sends")
    .insert(payload);

  if (error) {
    throw new Error(`Erro ao registrar envio de lembrete: ${error.message}`);
  }
}

async function fetchTodaysEvents(todayStr) {
  const { data, error } = await supabase
    .from("events")
    .select("id, user_id, title, date, start, notes")
    .eq("date", todayStr);

  if (error) {
    throw new Error(`Erro ao buscar eventos do dia: ${error.message}`);
  }

  return data || [];
}

function buildEventReminderMessage(event) {
  const lines = [
    "📅 Lembrete de agenda",
    "",
    `Título: ${event.title || "Evento"}`,
    `Horário: ${event.start || "-"}`,
  ];

  if (event.notes) {
    lines.push("", event.notes);
  }

  return lines.join("\n");
}

export async function checkEventReminders() {
  try {
    const tableReady = await ensureEventReminderTable();
    if (!tableReady) return;

    const now = getNowInSaoPaulo();
    const todayStr = formatDateOnlyInSaoPaulo(now);

    console.log(`🕒 Verificando eventos do dia ${todayStr}`);

    const events = await fetchTodaysEvents(todayStr);

    for (const event of events) {
      if (!event.user_id || !event.start) continue;

      console.log(`📌 Evento encontrado: ${event.title} às ${event.start}`);

      const eventDate = toSaoPauloDate(event.date, event.start);
      if (!eventDate) continue;

      const nowTs = now.getTime();
      const eventTs = eventDate.getTime();
      const diff = nowTs - eventTs;

      if (diff < 0 || diff > 59_000) {
        continue;
      }

      try {
        const alreadySent = await hasEventReminderBeenSent(event.id);
        if (alreadySent) {
          console.log("⏭️ Evento já notificado, ignorando");
          continue;
        }

        const whatsapp = await fetchUserWhatsapp(event.user_id);
        const phone = normalizePhone(whatsapp);

        if (!phone) {
          console.warn("⚠️ Usuário sem telefone válido, ignorando evento", event.id);
          continue;
        }

        const message = buildEventReminderMessage(event);

        console.log(`📤 Enviando WhatsApp para ${phone}`);
        await sendWhatsappMessage({ to: phone, message });

        await markEventReminderSent(event.id, event.user_id, eventDate);

        console.log("✅ Lembrete enviado");
      } catch (err) {
        console.error("❌ Erro ao processar evento:", err.message || err);
      }
    }
  } catch (err) {
    console.error("❌ Erro no worker de eventos:", err.message || err);
  }
}

let eventReminderIntervalId = null;

export function startEventReminderWorker() {
  if (eventReminderIntervalId) return eventReminderIntervalId;

  console.log("🟢 Worker de lembretes de agenda iniciado");

  checkEventReminders().catch((err) =>
    console.error("❌ Erro inicial no worker de eventos:", err)
  );

  eventReminderIntervalId = setInterval(() => {
    checkEventReminders().catch((err) =>
      console.error("❌ Erro no ciclo do worker de eventos:", err)
    );
  }, 20_000);

  return eventReminderIntervalId;
}

const sentInMinute = new Set();
function makeKey(userId, dateStr, hhmm) {
  return `${userId}|${dateStr}|${hhmm}`;
}

function logSupabaseInfo() {
  const rawUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || SUPABASE_URL;
  const urlHost = (rawUrl || "")
    .replace("https://", "")
    .replace("http://", "")
    .split("/")[0];

  console.log("SUPABASE_URL host:", urlHost || "(vazio)");
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
  return sendWhatsAppMessage({ phone: to, message });
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

const MINUTE_CACHE_TTL_MS = 70_000;

export async function sendWhatsAppMessage({ phone, message }) {
  const sanitizedPhone = String(phone || "").replace(/\D/g, "");
  if (!sanitizedPhone) throw new Error("Telefone vazio");

  const url =
    WHATSAPP_API_URL ||
    (ZAPI_INSTANCE_ID && ZAPI_TOKEN
      ? `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
      : null);

  if (!url) {
    throw new Error("URL da API de WhatsApp não configurada");
  }

  const body = {
    phone: sanitizedPhone,
    message,
  };

  const headers = {
    "Content-Type": "application/json",
  };

  if (WHATSAPP_API_TOKEN) {
    headers.Authorization = `Bearer ${WHATSAPP_API_TOKEN}`;
  }

  if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;

  const maskedPhone = sanitizedPhone.replace(/.(?=.{4})/g, "*");
  console.log("📨 Enviando WhatsApp (Z-API) para", maskedPhone);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await resp.text().catch(() => "");
    const ok = resp.status === 200 || resp.status === 201;

    console.log("📥 Resposta Z-API: status", resp.status);

    if (!ok) {
      console.error("❌ Z-API retornou status inesperado", {
        status: resp.status,
        body: text,
      });
    }

    return { ok, status: resp.status, body: text };
  } catch (err) {
    console.error("❌ Erro na chamada Z-API:", err);
    throw err;
  }
}

export const sendZapiMessage = sendWhatsAppMessage;

function formatHHMM(now) {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatTempo(value) {
  return String(value ?? "").slice(0, 5);
}

function isSchemaCacheError(error) {
  return (
    error?.code === "PGST205" ||
    /schema cache/i.test(error?.message || "") ||
    /reload schema/i.test(error?.message || "")
  );
}

async function loadRemindersFromSupabase(todayStr) {
  const { data, error } = await supabase
    .from(WORKOUT_SCHEDULE_TABLE)
    .select("id, user_id, start, title")
    .eq("date", todayStr);

  if (error) throw error;
  return data || [];
}

async function loadRemindersViaRest(todayStr) {
  const baseUrl = SUPABASE_URL?.replace(/\/$/, "");
  const url = `${baseUrl}/rest/v1/${WORKOUT_SCHEDULE_TABLE}` +
    `?select=id,user_id,start,title` +
    `&date=eq.${todayStr}`;

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: "application/json",
  };

  const resp = await fetch(url, { headers });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(
      `REST fallback falhou (${resp.status}): ${text || "sem corpo"}`
    );
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("REST fallback retornou JSON inválido");
  }
}

async function loadRemindersForNow(todayStr) {
  try {
    return await loadRemindersFromSupabase(todayStr);
  } catch (error) {
    console.error("❌ Erro Supabase ao buscar cronograma:", error);

    if (!isSchemaCacheError(error)) {
      throw error;
    }

    console.warn(
      "⚠️ Erro PGST205/schema cache detectado. Tentando fallback REST..."
    );

    return await loadRemindersViaRest(todayStr);
  }
}

async function getUserPhone(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("whatsapp")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data?.whatsapp || null;
}

export async function checkWorkoutRemindersOnce() {
  const now = getNowInSaoPaulo();
  const hhmm = formatHHMM(now);
  const todayStr = formatDateOnlyInSaoPaulo(now);

  console.log(`⏱ Checando lembretes... data=${todayStr} hora=${hhmm}`);

  let reminders = [];

  try {
    reminders = await loadRemindersForNow(todayStr);
    console.log(`📋 Eventos encontrados hoje: ${reminders.length}`);
  } catch (error) {
    console.error("❌ Falha na busca da agenda de treino:", error);
    console.error(
      "ℹ️ Worker continuará rodando mesmo com erro na consulta do Supabase."
    );
    return;
  }

  for (const reminder of reminders) {
    const tempo = formatTempo(reminder.start);
    if (!tempo || tempo !== hhmm) continue;

    const key = makeKey(reminder.user_id, todayStr, hhmm);
    if (sentInMinute.has(key)) {
      console.log("⏭️ Ignorando duplicado (anti-spam):", key);
      continue;
    }

    sentInMinute.add(key);
    setTimeout(() => sentInMinute.delete(key), MINUTE_CACHE_TTL_MS);

    let phone;
    try {
      phone = await getUserPhone(reminder.user_id);
    } catch (err) {
      console.error("❌ Erro buscando telefone do usuário:", err);
      continue;
    }

    if (!phone) {
      console.warn("⚠️ Usuário sem telefone cadastrado. user_id=", reminder.user_id);
      continue;
    }

    const message = reminder.title
      ? `📌 Lembrete: "${reminder.title}" está marcado para agora (${hhmm}).`
      : `📌 Lembrete: seu treino está marcado para agora (${hhmm}). Bora! 💪`;

    try {
      const z = await sendWhatsAppMessage({ phone, message });

      if (!z.ok) {
        console.error("❌ Z-API falhou:", { status: z.status, body: z.body });
      } else {
        console.log("✅ Z-API OK:", { status: z.status, body: z.body });
      }
    } catch (err) {
      console.error("❌ Erro ao enviar via Z-API:", err);
    }
  }

  if (sentInMinute.size > 5000) {
    sentInMinute.clear();
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
  }, 30_000);

  return workoutWorkerIntervalId;
}

if (process.argv[1] && process.argv[1].endsWith("reminders.js")) {
  startEventReminderWorker();
}
