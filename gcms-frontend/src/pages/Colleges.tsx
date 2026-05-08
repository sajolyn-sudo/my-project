import { useEffect, useState } from "react";
import { postJSON } from "../lib/api";
import SuccessNoticeModal from "../components/SuccessNoticeModal";
import LoadingSpinner from "../components/LoadingSpinner";

type College = { id: number; name: string };
type CollegesResponse = { ok: boolean; colleges?: College[]; message?: string };

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
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);

  useEffect(() => save(colleges), [colleges]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    postJSON<CollegesResponse>("/colleges_api.php", { action: "list" })
      .then((res) => {
        if (!alive) return;
        setColleges(res.colleges ?? []);
      })
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

  const addCollege = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setAdding(true);
      const res = await postJSON<CollegesResponse>("/colleges_api.php", {
        action: "create",
        name: trimmed,
      });
      setColleges(res.colleges ?? []);
      setName("");
      setShowSuccessNotice(true);
    } catch (e: any) {
      alert(e?.message || "Failed to add college.");
    } finally {
      setAdding(false);
    }
  };

  const removeCollege = async (id: number) => {
    try {
      setDeletingId(id);
      const res = await postJSON<CollegesResponse>("/colleges_api.php", {
        action: "delete",
        id,
      });
      setColleges(res.colleges ?? []);
    } catch (e: any) {
      alert(e?.message || "Failed to delete college.");
    } finally {
      setDeletingId(null);
    }
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
          <button onClick={addCollege} style={primaryBtn} disabled={adding}>
            <span style={buttonContent}>
              {adding && <LoadingSpinner size={14} />}
              <span>{adding ? "Adding..." : "Add"}</span>
            </span>
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
            {loading ? (
              <tr>
                <td style={td} colSpan={3}>
                  <span style={{ opacity: 0.8 }}>Loading colleges...</span>
                </td>
              </tr>
            ) : (
              colleges.map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.id}</td>
                <td style={td}>{c.name}</td>
                <td style={td}>
                  <button
                    onClick={() => removeCollege(c.id)}
                    style={dangerBtn}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
              ))
            )}
            {!loading && colleges.length === 0 && (
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

      <SuccessNoticeModal
        open={showSuccessNotice}
        onClose={() => setShowSuccessNotice(false)}
        title="College Added"
        message="The college has been added successfully."
      />
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

const buttonContent: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
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
