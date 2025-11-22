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

    // 1) Cria usuário no Auth (Supabase)
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: `${username}@example.com`,
        password: password,
        user_metadata: { full_name: name, role }
      });

    if (authError) {
      console.error(authError);
      return res.status(400).json({ error: authError.message });
    }

    const userId = authUser.user.id;

    // 2) Grava em profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        name,
        username,
        whatsapp,
        role
      });

    if (profileError) {
      console.error(profileError);
      return res.status(400).json({ error: profileError.message });
    }

    // 3) Grava em profiles_auth (tabela usada no login do app)
    const { error: authTableError } = await supabase
      .from("profiles_auth")
      .insert({
        id: userId,
        email: `${username}@example.com`,
        password: password
      });

    if (authTableError) {
      console.error(authTableError);
      return res.status(400).json({ error: authTableError.message });
    }

    return res.json({ success: true, id: userId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.listen(3001, () => console.log("Backend rodando na porta 3001"));
