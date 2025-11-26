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

app.listen(3001, () => {
  console.log("Backend rodando na porta 3001");
});
