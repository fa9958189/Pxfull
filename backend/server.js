import "dotenv/config";
import express from "express";
import cors from "cors";
import { supabase } from "./supabase.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create-user", async (req, res) => {
  try {
    const { name, username, password, whatsapp, role } = req.body;

    if (!name || !username || !password) {
      return res
        .status(400)
        .json({ error: "Nome, usuário e senha são obrigatórios." });
    }

    const rawUsername = username.trim();

    // Se o "username" já for um e-mail válido, usa ele direto.
    // Senão, gera um e-mail fake tipo fulano@example.com
    let email;
    if (rawUsername.includes("@") && rawUsername.includes(".")) {
      email = rawUsername.toLowerCase();
    } else {
      const cleanUsername = rawUsername
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

      if (!cleanUsername) {
        return res.status(400).json({ error: "Usuário inválido." });
      }

      email = `${cleanUsername}@example.com`;
    }

    // 1) Cria usuário no Auth (Supabase)
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role }
      });

    if (authError) {
      console.error("Erro ao criar usuário no Auth:", authError);
      return res.status(400).json({ error: authError.message });
    }

    const userId = authUser.user.id;

    // 2) Grava em profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        name,
        username: rawUsername,
        whatsapp,
        role
      });

    if (profileError) {
      console.error("Erro ao gravar em profiles:", profileError);
      return res.status(400).json({ error: profileError.message });
    }

    // 3) Grava em profiles_auth
    const { error: authTableError } = await supabase
      .from("profiles_auth")
      .insert({
        auth_id: userId,
        name,
        role,
        email,
        username: rawUsername,
        whatsapp
      });

    if (authTableError) {
      console.error("Erro ao gravar em profiles_auth:", authTableError);
      return res.status(400).json({ error: authTableError.message });
    }

    return res.json({ success: true, id: userId });
  } catch (err) {
    console.error("Erro inesperado em /create-user:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Helpers para novas rotas de Rotina de Treino
const getUserIdFromRequest = (req) =>
  req.body?.user_id ||
  req.body?.userId ||
  req.query?.user_id ||
  req.query?.userId ||
  req.headers["x-user-id"] ||
  req.headers["user-id"];

const normalizeMuscleGroups = (muscleGroups) => {
  if (Array.isArray(muscleGroups)) return muscleGroups.join(",");
  if (typeof muscleGroups === "string") return muscleGroups;
  return "";
};

const normalizeSportsArray = (sports) => {
  if (Array.isArray(sports)) return sports;
  if (typeof sports === "string") {
    return sports
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeSportsString = (sports) => {
  if (Array.isArray(sports)) return sports.join(",");
  if (typeof sports === "string") return sports;
  return "";
};

// GET /workout-routines
app.get("/workout-routines", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ error: "user_id é obrigatório." });
    }

    const { data, error } = await supabase
      .from("workout_routines")
      .select("id, user_id, name, muscle_groups, sports, sports_list, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar treinos:", error);
      return res.status(400).json({ error: error.message });
    }

    const normalized = (data || []).map((item) => {
      const sports = normalizeSportsArray(item.sports ?? item.sports_list);
      return { ...item, sports };
    });

    return res.json(normalized);
  } catch (err) {
    console.error("Erro inesperado em GET /workout-routines:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// POST /workout-routines
app.post("/workout-routines", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { name, muscleGroups, sports } = req.body || {};

    if (!userId || !name) {
      return res.status(400).json({ error: "user_id e name são obrigatórios." });
    }

    const muscle_groups = normalizeMuscleGroups(muscleGroups);
    if (!muscle_groups) {
      return res
        .status(400)
        .json({ error: "muscleGroups é obrigatório (array ou string)." });
    }

    const sportsArray = normalizeSportsArray(sports);
    const sports_list = normalizeSportsString(sportsArray);

    const insertPayload = {
      user_id: userId,
      name,
      muscle_groups,
      sports: sportsArray,
      sports_list,
    };

    const { data, error } = await supabase
      .from("workout_routines")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar treino:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ ...data, sports: normalizeSportsArray(data?.sports ?? data?.sports_list) });
  } catch (err) {
    console.error("Erro inesperado em POST /workout-routines:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// DELETE /workout-routines/:id
app.delete("/workout-routines/:id", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { id } = req.params;

    if (!userId || !id) {
      return res.status(400).json({ error: "user_id e id são obrigatórios." });
    }

    const { error: scheduleError } = await supabase
      .from("workout_schedule")
      .delete()
      .eq("workout_id", id)
      .eq("user_id", userId);

    if (scheduleError) {
      console.error("Erro ao limpar agenda de treino:", scheduleError);
      return res.status(400).json({ error: scheduleError.message });
    }

    const { error } = await supabase
      .from("workout_routines")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao excluir treino:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro inesperado em DELETE /workout-routines/:id:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// GET /workout-schedule
app.get("/workout-schedule", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(400).json({ error: "user_id é obrigatório." });
    }

    const { data, error } = await supabase
      .from("workout_schedule")
      .select("id, user_id, weekday, workout_id, time, is_active, created_at")
      .eq("user_id", userId)
      .order("weekday", { ascending: true });

    if (error) {
      console.error("Erro ao buscar semana de treino:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("Erro inesperado em GET /workout-schedule:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// POST /workout-schedule
app.post("/workout-schedule", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const schedule = req.body?.schedule || [];

    if (!userId) {
      return res.status(400).json({ error: "user_id é obrigatório." });
    }

    const normalized = (Array.isArray(schedule) ? schedule : [])
      .map((item, index) => ({
        user_id: userId,
        weekday: Number(item.weekday || item.dayIndex || index + 1),
        workout_id: item.workout_id || item.workoutId || null,
        time: item.time || null,
        is_active:
          item.is_active !== undefined
            ? item.is_active
            : item.isActive !== undefined
            ? item.isActive
            : item.reminder !== undefined
            ? !!item.reminder
            : true,
      }))
      .filter((item) => item.weekday >= 1 && item.weekday <= 7);

    const { error: cleanupError } = await supabase
      .from("workout_schedule")
      .delete()
      .eq("user_id", userId);

    if (cleanupError) {
      console.error("Erro ao limpar agenda anterior:", cleanupError);
      return res.status(400).json({ error: cleanupError.message });
    }

    if (normalized.length) {
      const { error } = await supabase
        .from("workout_schedule")
        .insert(normalized);

      if (error) {
        console.error("Erro ao salvar semana de treino:", error);
        return res.status(400).json({ error: error.message });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro inesperado em POST /workout-schedule:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

/*
SQL para criação das tabelas no Supabase (schema public):

CREATE TABLE IF NOT EXISTS public.workout_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  muscle_groups text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
  workout_id uuid REFERENCES public.workout_routines(id),
  time time without time zone,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
*/

app.listen(3001, () => {
  console.log("Backend rodando na porta 3001");
});
