import { useEffect, useState } from "react";

type College = { id: number; name: string };

const STORAGE_KEY = "gcms_mock_colleges_v1";

function load(): College[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as College[]) : [];
  } catch {
    return [];
  }
}

function save(data: College[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function Colleges() {
  const [colleges, setColleges] = useState<College[]>(() => {
    const saved = load();
    return saved.length
      ? saved
      : [
          { id: 1, name: "College of Computer Studies" },
          { id: 2, name: "College of Education" },
        ];
  });

  const [name, setName] = useState("");

  useEffect(() => save(colleges), [colleges]);

  const addCollege = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const nextId = colleges.length
      ? Math.max(...colleges.map((c) => c.id)) + 1
      : 1;
    setColleges([{ id: nextId, name: trimmed }, ...colleges]);
    setName("");
  };

  const removeCollege = (id: number) => {
    setColleges(colleges.filter((c) => c.id !== id));
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontWeight: 800 }}>Colleges</h2>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Add College</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="College name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
          <button onClick={addCollege} style={primaryBtn}>
            Add
          </button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>College List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>College Name</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.id}</td>
                <td style={td}>{c.name}</td>
                <td style={td}>
                  <button onClick={() => removeCollege(c.id)} style={dangerBtn}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {colleges.length === 0 && (
              <tr>
                <td style={td} colSpan={3}>
                  <span style={{ opacity: 0.8 }}>No colleges yet.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          Tip: Add Colleges first, then Academic Years, then Year Levels.
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--card)",
  padding: 16,
  borderRadius: 16,
  boxShadow: "var(--shadow)",
  border: "1px solid var(--border)",
};

const input: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: "0 10px",
  outline: "none",
  width: "100%",
  background: "white",
  color: "var(--text)",
};

const primaryBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--primary)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "none",
  background: "#D9534F",
  color: "white",
  cursor: "pointer",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  opacity: 0.8,
};
const td: React.CSSProperties = {
  padding: "10px 8px",
  borderTop: "1px solid var(--border)",
};
