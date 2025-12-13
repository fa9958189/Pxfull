import { useState, useEffect } from "react";
import "./App.css";

export default function DailyReminders({ user }) {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");
  const apiBaseUrl = window.APP_CONFIG?.apiBaseUrl || "";

  async function loadReminders() {
    const res = await fetch(`${apiBaseUrl}/api/daily-reminders?user_id=${user.id}`);
    const data = await res.json();
    if (!res.ok) {
      console.error("DailyReminders API error", data);
      alert(data.error || "Erro ao salvar lembrete diário");
      return;
    }
    setList(data);
  }

  async function handleAdd() {
    if (!title || !time) return;

    const res = await fetch(`${apiBaseUrl}/api/daily-reminders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id,
        title,
        reminder_time: time,
        notes
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("DailyReminders API error", data);
      alert(data.error || "Erro ao salvar lembrete diário");
      return;
    }

    setTitle("");
    setTime("");
    setNotes("");

    await loadReminders();
  }

  async function deleteReminder(id) {
    await fetch(`${apiBaseUrl}/api/daily-reminders/${id}`, { method: "DELETE" });
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
