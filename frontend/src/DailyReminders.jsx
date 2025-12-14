import { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";

export default function DailyReminders({ user }) {
  const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
  const authUserId = user?.id_de_autenticacao || user?.auth_user_id || user?.id;
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");

  async function loadReminders() {
    if (!authUserId) {
      alert("Usuário sem id_de_autenticacao (auth id).");
      return;
    }

    const res = await fetch(`${API_BASE}/api/daily-reminders?user_id=${authUserId}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Erro ao salvar. Veja o console.");
      console.error(data);
      return;
    }
    setList(data);
  }

  async function handleAdd() {
    if (!title || !time) return;

    if (!authUserId) {
      alert("Usuário sem id_de_autenticacao (auth id).");
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Faça login novamente para criar lembretes.");
      return;
    }

    const res = await fetch(`${API_BASE}/api/daily-reminders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        title,
        reminder_time: time,
        notes
      })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Erro ao salvar. Veja o console.");
      console.error(data);
      return;
    }

    setTitle("");
    setTime("");
    setNotes("");

    await loadReminders();
  }

  async function deleteReminder(id) {
    if (!authUserId) {
      alert("Usuário sem id_de_autenticacao (auth id).");
      return;
    }

    await fetch(`${API_BASE}/api/daily-reminders/${id}?user_id=${authUserId}`, { method: "DELETE" });
    loadReminders();
  }

  useEffect(() => {
    loadReminders();
  }, []);

  return (
    <div className="card">
      <h2>Lembretes Diários</h2>
      <div className="form-grid">
        <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        <input placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} />
        <button onClick={handleAdd}>Adicionar</button>
      </div>

      <table>
        <thead>
          <tr><th>Título</th><th>Horário</th><th>Notas</th><th>Ações</th></tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.reminder_time}</td>
              <td>{r.notes}</td>
              <td>
                <button onClick={() => deleteReminder(r.id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
