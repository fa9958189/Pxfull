import express from "express";
import cors from "cors";
import { supabase } from "./supabase.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create-user", async (req, res) => {
  try {
    const { name, username, password, whatsapp, role } = req.body;

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: `${username}@example.com`,
        password: password,
        user_metadata: { full_name: name, role }
      });

    if (authError) return res.status(400).json({ error: authError.message });

    const userId = authUser.user.id;

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
      return res.status(400).json({ error: profileError.message });
    }

    res.json({ success: true, id: userId });

  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.listen(3001, () => console.log("Backend rodando na porta 3001"));
