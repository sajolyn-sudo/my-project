import { useEffect, useState } from "react";

type AcademicYear = { id: number; name: string; isActive: boolean };

const STORAGE_KEY = "gcms_mock_academic_years_v1";

function load(): AcademicYear[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AcademicYear[]) : [];
  } catch {
    return [];
  }
}

function save(data: AcademicYear[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function AcademicYears() {
  const [years, setYears] = useState<AcademicYear[]>(() => {
    const saved = load();
    return saved.length
      ? saved
      : [
          { id: 1, name: "2024–2025", isActive: false },
          { id: 2, name: "2025–2026", isActive: true },
        ];
  });

  const [name, setName] = useState("");

  useEffect(() => save(years), [years]);

  const addYear = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const nextId = years.length ? Math.max(...years.map((y) => y.id)) + 1 : 1;
    setYears([{ id: nextId, name: trimmed, isActive: false }, ...years]);
    setName("");
  };

  const setActive = (id: number) => {
    setYears(years.map((y) => ({ ...y, isActive: y.id === id })));
  };

  const removeYear = (id: number) => {
    setYears(years.filter((y) => y.id !== id));
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontWeight: 800 }}>Academic Years</h2>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Add Academic Year</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="e.g. 2026–2027"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
          <button onClick={addYear} style={primaryBtn}>
            Add
          </button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Academic Year List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id}>
                <td style={td}>{y.name}</td>
                <td style={td}>
                  <span style={y.isActive ? badgeActive : badgeInactive}>
                    {y.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={td}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    {!y.isActive && (
                      <button
                        onClick={() => setActive(y.id)}
                        style={secondaryBtn}
                      >
                        Set Active
                      </button>
                    )}
                    <button onClick={() => removeYear(y.id)} style={dangerBtn}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {years.length === 0 && (
              <tr>
                <td style={td} colSpan={3}>
                  <span style={{ opacity: 0.8 }}>No academic years yet.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          Only one Academic Year should be active at a time.
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

const secondaryBtn: React.CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "none",
  background: "var(--secondary)",
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

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: "white",
};

const badgeActive: React.CSSProperties = {
  ...badgeBase,
  background: "var(--primary)",
};
const badgeInactive: React.CSSProperties = {
  ...badgeBase,
  background: "#9CA3AF",
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
