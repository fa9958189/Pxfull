import "dotenv/config";
import { supabase } from "./supabase.js";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

/**
 * Consulta eventos que começam dentro da janela configurada.
 * @param {{ windowMinutes?: number }} options
 * @returns {Promise<Array>} Lista de eventos próximos.
 */
export async function fetchUpcomingEvents({ windowMinutes = 60 } = {}) {
  const now = new Date();
  const upperBound = new Date(now.getTime() + windowMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from("events")
    .select("id, title, date, start, end, profile_id")
    .gte("date", now.toISOString())
    .lte("date", upperBound.toISOString())
    .order("date", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }

  return data || [];
}

/**
 * Busca o WhatsApp do usuário na tabela profiles_auth.
 * @param {string} profileId
 * @returns {Promise<string|null>}
 */
export async function fetchUserWhatsapp(profileId) {
  const { data, error } = await supabase
    .from("profiles_auth")
    .select("whatsapp")
    .eq("id", profileId)
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
    throw new Error("Configure WHATSAPP_API_URL e WHATSAPP_API_TOKEN para enviar mensagens.");
  }

  const response = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`
    },
    body: JSON.stringify({ to, message })
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

const buildReminderMessage = (event) => {
  const date = new Date(event.date).toLocaleDateString("pt-BR");
  const timeRange = formatTimeRange(event);
  return `Lembrete: ${event.title || "Evento"} em ${date}${timeRange}.`;
};

/**
 * Inicia um agendador simples que verifica eventos e dispara mensagens.
 * @param {{ intervalMinutes?: number, windowMinutes?: number }} options
 */
export function startRemindersJob({ intervalMinutes = 15, windowMinutes = 60 } = {}) {
  let isRunning = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const events = await fetchUpcomingEvents({ windowMinutes });

      for (const event of events) {
        const whatsapp = await fetchUserWhatsapp(event.profile_id);
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

  tick();
  const intervalId = setInterval(tick, intervalMinutes * 60 * 1000);

  return () => clearInterval(intervalId);
}

if (process.argv[1] && process.argv[1].endsWith("reminders.js")) {
  startRemindersJob();
}
