import { useEffect, useMemo, useState } from "react";

type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };

type YearLevel = {
  id: number;
  name: string; // ex: "1st Year"
  collegeId: number;
  academicYearId: number;
};

const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export default function YearLevels() {
  const colleges = useMemo<College[]>(
    () =>
      load<College[]>(COLLEGES_KEY, [
        { id: 1, name: "College of Computer Studies" },
        { id: 2, name: "College of Education" },
      ]),
    [],
  );

  const years = useMemo<AcademicYear[]>(
    () =>
      load<AcademicYear[]>(YEARS_KEY, [
        { id: 1, name: "2024–2025", isActive: false },
        { id: 2, name: "2025–2026", isActive: true },
      ]),
    [],
  );

  const activeYear = years.find((y) => y.isActive) ?? years[0];

  const [items, setItems] = useState<YearLevel[]>(() =>
    load<YearLevel[]>(YL_KEY, [
      {
        id: 1,
        name: "1st Year",
        collegeId: 1,
        academicYearId: activeYear?.id ?? 2,
      },
      {
        id: 2,
        name: "2nd Year",
        collegeId: 1,
        academicYearId: activeYear?.id ?? 2,
      },
    ]),
  );

  const [name, setName] = useState("");
  const [collegeId, setCollegeId] = useState<number>(colleges[0]?.id ?? 0);
  const [academicYearId, setAcademicYearId] = useState<number>(
    activeYear?.id ?? 0,
  );

  useEffect(() => save(YL_KEY, items), [items]);

  const addItem = () => {
    const trimmed = name.trim();
    if (!trimmed || !collegeId || !academicYearId) return;

    const nextId = items.length ? Math.max(...items.map((x) => x.id)) + 1 : 1;
    setItems([
      { id: nextId, name: trimmed, collegeId, academicYearId },
      ...items,
    ]);
    setName("");
  };

  const removeItem = (id: number) => {
    setItems(items.filter((x) => x.id !== id));
  };

  const getCollege = (id: number) =>
    colleges.find((c) => c.id === id)?.name ?? "—";
  const getYear = (id: number) => years.find((y) => y.id === id)?.name ?? "—";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontWeight: 800 }}>Year Levels</h2>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Add Year Level</h3>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "2fr 2fr 2fr 1fr",
          }}
        >
          <input
            placeholder="e.g. 1st Year"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />

          <select
            value={collegeId}
            onChange={(e) => setCollegeId(Number(e.target.value))}
            style={input}
          >
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(Number(e.target.value))}
            style={input}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isActive ? "(Active)" : ""}
              </option>
            ))}
          </select>

          <button onClick={addItem} style={primaryBtn}>
            Add
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          Year Levels are linked to a College and Academic Year.
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Year Level List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Year Level</th>
              <th style={th}>College</th>
              <th style={th}>Academic Year</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td style={td}>{x.name}</td>
                <td style={td}>{getCollege(x.collegeId)}</td>
                <td style={td}>{getYear(x.academicYearId)}</td>
                <td style={td}>
                  <button onClick={() => removeItem(x.id)} style={dangerBtn}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>
                  <span style={{ opacity: 0.8 }}>No year levels yet.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
