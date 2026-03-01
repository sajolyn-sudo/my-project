import { useEffect, useMemo, useState } from "react";
import { postJSON } from "../lib/api";

type College = { id: number; name: string };
type Course = {
  id: number;
  name: string;
  collegeId: number;
  collegeName: string;
};

type CollegesResponse = { ok: boolean; colleges?: College[] };
type CoursesResponse = { ok: boolean; courses?: Course[]; message?: string };

export default function Courses() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [items, setItems] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [collegeId, setCollegeId] = useState(0);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadAll = async () => {
    const [colRes, courseRes] = await Promise.all([
      postJSON<CollegesResponse>("/colleges_api.php", { action: "list" }),
      postJSON<CoursesResponse>("/courses_api.php", { action: "list" }),
    ]);
    const nextColleges = colRes.colleges ?? [];
    setColleges(nextColleges);
    setItems(courseRes.courses ?? []);
    if (nextColleges.length && !nextColleges.some((c) => c.id === collegeId)) {
      setCollegeId(nextColleges[0].id);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadAll()
      .catch(() => {
        if (!alive) return;
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const canAdd = useMemo(
    () => name.trim() !== "" && collegeId > 0 && !adding,
    [name, collegeId, adding],
  );

  const addCourse = async () => {
    const trimmed = name.trim();
    if (!trimmed || collegeId <= 0) return;

    try {
      setAdding(true);
      const res = await postJSON<CoursesResponse>("/courses_api.php", {
        action: "create",
        name: trimmed,
        collegeId,
      });
      setItems(res.courses ?? []);
      setName("");
    } catch (e: any) {
      alert(e?.message || "Failed to add course.");
    } finally {
      setAdding(false);
    }
  };

  const removeCourse = async (id: number) => {
    try {
      setDeletingId(id);
      const res = await postJSON<CoursesResponse>("/courses_api.php", {
        action: "delete",
        id,
      });
      setItems(res.courses ?? []);
    } catch (e: any) {
      alert(e?.message || "Failed to delete course.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h2 style={{ fontWeight: 800 }}>Courses</h2>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Add Course</h3>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "2fr 2fr 1fr",
            alignItems: "end",
          }}
        >
          <input
            placeholder="Course name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />

          <select
            value={collegeId}
            onChange={(e) => setCollegeId(Number(e.target.value))}
            style={input}
          >
            {colleges.length === 0 ? (
              <option value={0}>No colleges available</option>
            ) : (
              colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>

          <button onClick={addCourse} style={primaryBtn} disabled={!canAdd}>
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Course List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Course Name</th>
              <th style={th}>College</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={td} colSpan={4}>
                  <span style={{ opacity: 0.8 }}>Loading courses...</span>
                </td>
              </tr>
            ) : (
              items.map((x) => (
                <tr key={x.id}>
                  <td style={td}>{x.id}</td>
                  <td style={td}>{x.name}</td>
                  <td style={td}>{x.collegeName}</td>
                  <td style={td}>
                    <button
                      onClick={() => removeCourse(x.id)}
                      style={dangerBtn}
                      disabled={deletingId === x.id}
                    >
                      {deletingId === x.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>
                  <span style={{ opacity: 0.8 }}>No courses yet.</span>
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

