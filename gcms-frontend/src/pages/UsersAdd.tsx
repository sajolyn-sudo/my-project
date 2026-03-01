import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJSON } from "../lib/api";

type Role =
  | "ADMIN"
  | "COUNSELOR"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";
type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

type BootstrapResponse = {
  ok: boolean;
  colleges?: College[];
  academicYears?: AcademicYear[];
  yearLevels?: YearLevel[];
};

const BISU_DOMAIN = "bisu.edu.ph";

function toSentenceCaseName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (m) => m.toUpperCase());
}

function normalizeEmailInput(value: string): string {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!clean) return "";
  if (!clean.includes("@")) return clean;
  const local = clean.split("@")[0];
  if (!local) return "";
  return `${local}@${BISU_DOMAIN}`;
}

function normalizeBisuEmail(value: string): string {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!clean) return "";
  const localRaw = clean.split("@")[0];
  const local = localRaw.replace(/[^a-z0-9._-]/g, "");
  if (!local) return "";
  return `${local}@${BISU_DOMAIN}`;
}

export default function UsersAdd() {
  const navigate = useNavigate();

  const [fname, setFname] = useState("");
  const [mname, setMname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [colleges, setColleges] = useState<College[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearLevels, setYearLevels] = useState<YearLevel[]>([]);
  const [collegeId, setCollegeId] = useState<number>(0);
  const [yearLevelId, setYearLevelId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    postJSON<BootstrapResponse>("/entities_bootstrap.php", {})
      .then((res) => {
        if (!alive || !res.ok) return;
        const c = (res.colleges ?? []).map((x) => ({
          id: Number(x.id),
          name: String(x.name),
        }));
        const y = (res.academicYears ?? []).map((x) => ({
          id: Number(x.id),
          name: String(x.name),
          isActive: Boolean(x.isActive),
        }));
        const yl = (res.yearLevels ?? []).map((x) => ({
          id: Number(x.id),
          name: String(x.name),
          collegeId: Number(x.collegeId),
          academicYearId: Number(x.academicYearId),
        }));
        setColleges(c);
        setYears(y);
        setYearLevels(yl);
        setCollegeId(c[0]?.id ?? 0);
      })
      .catch(() => {
        if (!alive) return;
        setError("Failed to load setup data.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeYearId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const filteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) => yl.collegeId === collegeId && yl.academicYearId === activeYearId,
      ),
    [yearLevels, collegeId, activeYearId],
  );

  useEffect(() => {
    if (role !== "STUDENT") return;
    if (!collegeId) setCollegeId(colleges[0]?.id ?? 0);
  }, [role, collegeId, colleges]);

  useEffect(() => {
    if (role !== "STUDENT") return;
    setYearLevelId(filteredYearLevels[0]?.id ?? 0);
  }, [role, collegeId, filteredYearLevels]);

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (loading) return;

    const f = toSentenceCaseName(fname);
    const m = toSentenceCaseName(mname);
    const l = toSentenceCaseName(lname);
    const e = normalizeBisuEmail(email);
    if (!f || !l || !e) {
      setError("First name, last name, and BISU email are required.");
      return;
    }
    if (role === "STUDENT" && !collegeId) {
      setError("Student users must have a college.");
      return;
    }

    try {
      setLoading(true);
      await postJSON<{ ok?: boolean; users_id?: number }>("/create_user.php", {
        fname: f,
        mname: m || "",
        lname: l,
        email: e,
        password: password.trim(),
        role,
        collegeId: role === "STUDENT" ? collegeId : undefined,
        yearLevelId: role === "STUDENT" ? yearLevelId : undefined,
      });
      setMessage("User added successfully.");
      setFname("");
      setMname("");
      setLname("");
      setEmail("");
      setPassword("");
      setRole("STUDENT");
    } catch (e: any) {
      setError(e?.message || "Failed to add user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h2 style={{ margin: 0, fontWeight: 800 }}>Add User</h2>
        <button style={ghostButton} onClick={() => navigate("/app/users")}>
          Back to User Management
        </button>
      </div>

      <div style={card}>
        <p style={{ marginTop: 0, opacity: 0.82, fontSize: 13 }}>
          Add one user/authorized email. The email must be under `@bisu.edu.ph`.
        </p>

        <div style={grid3}>
          <input
            placeholder="First name"
            value={fname}
            onChange={(e) => setFname(e.target.value)}
            onBlur={() => setFname((v) => toSentenceCaseName(v))}
            style={inputStyle}
          />
          <input
            placeholder="Middle name (optional)"
            value={mname}
            onChange={(e) => setMname(e.target.value)}
            onBlur={() => setMname((v) => toSentenceCaseName(v))}
            style={inputStyle}
          />
          <input
            placeholder="Last name"
            value={lname}
            onChange={(e) => setLname(e.target.value)}
            onBlur={() => setLname((v) => toSentenceCaseName(v))}
            style={inputStyle}
          />
        </div>

        <div style={{ ...grid3, marginTop: 10 }}>
          <input
            placeholder="Email (local part or full)"
            value={email}
            onChange={(e) => setEmail(normalizeEmailInput(e.target.value))}
            onBlur={() => setEmail((v) => normalizeBisuEmail(v))}
            style={inputStyle}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={inputStyle}
          >
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="COUNSELOR">Counselor</option>
            <option value="NON_TEACHING_PERSONNEL">Non Teaching Personnel</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input
            type="password"
            placeholder="Password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        {role === "STUDENT" && (
          <div style={{ ...grid2, marginTop: 10 }}>
            <select
              value={collegeId}
              onChange={(e) => setCollegeId(Number(e.target.value))}
              style={inputStyle}
            >
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={yearLevelId}
              onChange={(e) => setYearLevelId(Number(e.target.value))}
              style={inputStyle}
            >
              {filteredYearLevels.map((yl) => (
                <option key={yl.id} value={yl.id}>
                  {yl.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <div style={errorBox}>{error}</div>}
        {message && <div style={okBox}>{message}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={handleSubmit} style={primaryButton} disabled={loading}>
            {loading ? "Adding..." : "Add User"}
          </button>
        </div>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  background: "var(--card)",
  padding: 16,
  borderRadius: 16,
  boxShadow: "var(--shadow)",
  border: "1px solid var(--border)",
};

const inputStyle: CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: "0 10px",
  outline: "none",
  background: "white",
  color: "var(--text)",
  width: "100%",
};

const grid2: CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr 1fr",
};

const grid3: CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr 1fr 1fr",
};

const primaryButton: CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--primary)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButton: CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const errorBox: CSSProperties = {
  marginTop: 10,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
};

const okBox: CSSProperties = {
  marginTop: 10,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
};
