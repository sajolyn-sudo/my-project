import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type Role = "ADMIN" | "COUNSELOR" | "STUDENT";
type User = {
  id: number;
  fname: string;
  mname?: string;
  lname: string;
  email: string;
  role: Role;
  collegeId?: number;
  yearLevelId?: number;
};

type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = { id: number; name: string; collegeId: number; academicYearId: number };

type CounselingCase = {
  id: number;
  studentId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  date: string;
  status: "Pending" | "Ongoing" | "Completed";
  notes?: string;
  createdAt: string;
};

const CASES_KEY = "gcms_mock_counseling_cases_v2";
const USERS_KEY = "gcms_mock_users_v1";
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

export default function CounselingView() {
  const nav = useNavigate();
  const { id } = useParams();
  const caseId = Number(id);

  const cases = useMemo(() => load<CounselingCase[]>(CASES_KEY, []), []);
  const users = useMemo(() => load<User[]>(USERS_KEY, []), []);
  const colleges = useMemo(() => load<College[]>(COLLEGES_KEY, []), []);
  const years = useMemo(() => load<AcademicYear[]>(YEARS_KEY, []), []);
  const yearLevels = useMemo(() => load<YearLevel[]>(YL_KEY, []), []);

  const found = cases.find((c) => c.id === caseId);

  const student = found ? users.find((u) => u.id === found.studentId) : undefined;
  const college = found ? colleges.find((c) => c.id === found.collegeId) : undefined;
  const ay = found ? years.find((y) => y.id === found.academicYearId) : undefined;
  const yl = found ? yearLevels.find((y) => y.id === found.yearLevelId) : undefined;

  const [status, setStatus] = useState<CounselingCase["status"]>(found?.status ?? "Pending");
  const [notes, setNotes] = useState(found?.notes ?? "");

  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 16,
    borderRadius: 16,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const inputStyle: React.CSSProperties = {
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "0 10px",
    outline: "none",
    width: "100%",
    background: "white",
    color: "var(--text)",
  };

  const textareaStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "10px 10px",
    outline: "none",
    width: "100%",
    background: "white",
    color: "var(--text)",
    minHeight: 120,
    resize: "vertical",
  };

  const primaryButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  };

  const ghostButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--primary)",
    fontWeight: 800,
    cursor: "pointer",
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    opacity: 0.85,
    marginBottom: 6,
  };

  if (!found) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <h2 style={{ fontWeight: 900 }}>Case Details</h2>
        <div style={card}>
          <div style={{ opacity: 0.8 }}>Case not found.</div>
          <div style={{ marginTop: 12 }}>
            <Link
              to="/app/counseling"
              style={{ color: "var(--primary)", fontWeight: 900, textDecoration: "none" }}
            >
              ← Back to Counseling Cases
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const studentName = student
    ? `${student.fname} ${student.mname ? student.mname + " " : ""}${student.lname}`
    : "Unknown Student";

  const handleSave = () => {
    const next = cases.map((c) =>
      c.id === found.id ? { ...c, status, notes: notes.trim() ? notes.trim() : undefined } : c
    );
    save(CASES_KEY, next);
    nav("/app/counseling");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontWeight: 900, marginRight: "auto" }}>Case Details</h2>
        <Link
          to="/app/counseling"
          style={{ textDecoration: "none", color: "var(--primary)", fontWeight: 900 }}
        >
          ← Back
        </Link>
      </div>

      {/* TOP DETAILS */}
      <div style={card}>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Student</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{studentName}</div>
        <div style={{ opacity: 0.85 }}>{student?.email ?? "—"}</div>

        <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div>
            <div style={label}>Academic Year</div>
            <div style={{ fontWeight: 800 }}>{ay?.name ?? "—"}</div>
          </div>

          <div>
            <div style={label}>College</div>
            <div style={{ fontWeight: 800 }}>{college?.name ?? "—"}</div>
          </div>

          <div>
            <div style={label}>Year Level</div>
            <div style={{ fontWeight: 800 }}>{yl?.name ?? "—"}</div>
          </div>

          <div>
            <div style={label}>Date</div>
            <div style={{ fontWeight: 800 }}>{found.date}</div>
          </div>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
          Case ID: <b>#{found.id}</b> • Created: <b>{found.createdAt}</b>
        </div>
      </div>

      {/* UPDATE */}
      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Update Case</h3>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 2fr" }}>
          <div>
            <div style={label}>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value as CounselingCase["status"])} style={inputStyle}>
              <option value="Pending">Pending</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div>
            <div style={label}>Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={textareaStyle} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => nav("/app/counseling")} style={ghostButton}>
            Cancel
          </button>
          <button onClick={handleSave} style={primaryButton}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
