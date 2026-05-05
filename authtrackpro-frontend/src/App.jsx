import { useEffect, useState } from "react";

const API_BASE = "https://authtrackpro-backend.onrender.com";

function App() {
  const [metrics, setMetrics] = useState({ pending: 0, approved: 0, denied: 0 });
  const [auths, setAuths] = useState([]);

  const [form, setForm] = useState({
    patient_name: "",
    payer: "",
    procedure_name: "",
    cpt_code: "",
    status: "Pending",
    priority: "Normal"
  });

  useEffect(() => {
    refreshData();
  }, []);

  async function refreshData() {
    await loadDashboard();
    await loadAuthorizations();
  }

  async function loadDashboard() {
    const res = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();
    setMetrics(data);
  }

  async function loadAuthorizations() {
    const res = await fetch(`${API_BASE}/authorizations`);
    const data = await res.json();
    setAuths(data);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch(`${API_BASE}/authorizations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(form)
    });

    if (!res.ok) {
      alert("Authorization could not be saved. Backend POST route may need to be added.");
      return;
    }

    setForm({
      patient_name: "",
      payer: "",
      procedure_name: "",
      cpt_code: "",
      status: "Pending",
      priority: "Normal"
    });

    await refreshData();
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>AuthTrack Pro Dashboard</h1>

      <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
        <div><strong>Pending:</strong> {metrics.pending}</div>
        <div><strong>Approved:</strong> {metrics.approved}</div>
        <div><strong>Denied:</strong> {metrics.denied}</div>
      </div>

      <h2>Add Authorization</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px", maxWidth: "500px", marginBottom: "30px" }}>
        <input
          placeholder="Patient Name"
          value={form.patient_name}
          onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
          required
        />

        <input
          placeholder="Payer"
          value={form.payer}
          onChange={(e) => setForm({ ...form, payer: e.target.value })}
          required
        />

        <input
          placeholder="Procedure Name"
          value={form.procedure_name}
          onChange={(e) => setForm({ ...form, procedure_name: e.target.value })}
          required
        />

        <input
          placeholder="CPT Code"
          value={form.cpt_code}
          onChange={(e) => setForm({ ...form, cpt_code: e.target.value })}
          required
        />

        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option>Pending</option>
          <option>Approved</option>
          <option>Denied</option>
        </select>

        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          <option>Normal</option>
          <option>High</option>
          <option>Urgent</option>
        </select>

        <button type="submit">Add Authorization</button>
      </form>

      <h2>Authorizations</h2>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Payer</th>
            <th>CPT</th>
            <th>Procedure</th>
            <th>Status</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          {auths.map((a) => (
            <tr key={a.id}>
              <td>{a.patient_name}</td>
              <td>{a.payer}</td>
              <td>{a.cpt_code}</td>
              <td>{a.procedure_name}</td>
              <td>{a.status}</td>
              <td>{a.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
