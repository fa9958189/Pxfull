// reminders.js
import "dotenv/config";
import { supabase } from "./supabase.js";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

/**
 * Busca eventos que são:
 *  - hoje
 *  - daqui a 5 dias
 * e marca cada um com o tipo de lembrete.
 */
export async function fetchUpcomingEvents() {
  const now = new Date();

  // Hoje (YYYY-MM-DD)
  const todayStr = now.toISOString().slice(0, 10);

  // Daqui a 5 dias (YYYY-MM-DD)
  const fiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const fiveDaysStr = fiveDays.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("events")
    .select("id, title, date, start, end, notes, user_id")
    .in("date", [todayStr, fiveDaysStr])
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
    } else if (ev.date === fiveDaysStr) {
      reminderType = "five_days_before";
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

  const response = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    },
    body: JSON.stringify({ to, message }),
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
  if (event.reminderType === "five_days_before") {
    prefix = `Lembrete: faltam 5 dias para o compromisso "${title}".`;
  } else if (event.reminderType === "today") {
    prefix = `Lembrete: hoje é o dia do compromisso "${title}".`;
  } else {
    // fallback, se um dia quiser usar esse helper pra outra coisa
    prefix = `Lembrete do compromisso "${title}".`;
  }

  return `${prefix}\nData: ${date}${timeRange}${notesPart}`;
};

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
