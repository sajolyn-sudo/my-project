import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DropdownSelect from "../components/DropdownSelect";
import { getCounselingCase, updateCounselingCase } from "../lib/entitiesApi";

type Role =
  | "ADMIN"
  | "COUNSELOR"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

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
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

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
  const location = useLocation();
  const { id } = useParams();
  const caseId = Number(id);

  const listHref = useMemo(
    () => `/app/counseling${location.search || ""}`,
    [location.search],
  );

  const cases = useMemo(() => load<CounselingCase[]>(CASES_KEY, []), []);
  const users = useMemo(() => load<User[]>(USERS_KEY, []), []);
  const colleges = useMemo(() => load<College[]>(COLLEGES_KEY, []), []);
  const years = useMemo(() => load<AcademicYear[]>(YEARS_KEY, []), []);
  const yearLevels = useMemo(() => load<YearLevel[]>(YL_KEY, []), []);

  const [found, setFound] = useState<CounselingCase | undefined>(() =>
    cases.find((c) => c.id === caseId),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!caseId) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    let alive = true;

    getCounselingCase(caseId)
      .then((res) => {
        if (!alive) return;

        const item = res.item;
        setFound(item);

        const current = load<CounselingCase[]>(CASES_KEY, []);
        const idx = current.findIndex((c) => c.id === item.id);
        const next =
          idx === -1
            ? [item, ...current]
            : current.map((c) => (c.id === item.id ? item : c));
        save(CASES_KEY, next);
      })
      .catch(() => {
        // Keep cached fallback if API is unreachable.
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [caseId]);

  const student = found ? users.find((u) => u.id === found.studentId) : undefined;
  const college = found ? colleges.find((c) => c.id === found.collegeId) : undefined;
  const ay = found ? years.find((y) => y.id === found.academicYearId) : undefined;
  const yl = found ? yearLevels.find((y) => y.id === found.yearLevelId) : undefined;

  const [status, setStatus] = useState<CounselingCase["status"]>(
    found?.status ?? "Pending",
  );
  const [notes, setNotes] = useState(found?.notes ?? "");

  useEffect(() => {
    setStatus(found?.status ?? "Pending");
    setNotes(found?.notes ?? "");
  }, [found]);

  const shell: React.CSSProperties = {
    display: "grid",
    gap: 16,
  };

  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 18,
    borderRadius: 16,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.2,
    opacity: 0.72,
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const value: React.CSSProperties = {
    fontWeight: 850,
    fontSize: 30,
  };

  const textareaStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "10px 10px",
    outline: "none",
    width: "100%",
    background: "white",
    color: "var(--text)",
    minHeight: 130,
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

  const backIcon: React.CSSProperties = {
    height: 36,
    width: 36,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--primary)",
    textDecoration: "none",
  };

  if (!found) {
    return (
      <div style={shell}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontWeight: 900, margin: 0 }}>Case Details</h2>
          <Link
            to={listHref}
            title="Back to Counseling Cases"
            aria-label="Back to Counseling Cases"
            style={backIcon}
          >
            <ArrowLeft size={18} />
          </Link>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8 }}>{loaded ? "Case not found." : "Loading case..."}</div>
        </div>
      </div>
    );
  }

  const studentName = student
    ? `${student.fname} ${student.mname ? `${student.mname} ` : ""}${student.lname}`
    : "Unknown Student";

  const handleSave = async () => {
    try {
      const res = await updateCounselingCase({
        id: found.id,
        status,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      save(CASES_KEY, res.cases ?? []);
      nav(listHref);
    } catch (e: any) {
      alert(e?.message || "Failed to save case.");
    }
  };

  return (
    <div style={shell}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ fontWeight: 900, margin: 0 }}>Case Details</h2>
        <Link
          to={listHref}
          title="Back to Counseling Cases"
          aria-label="Back to Counseling Cases"
          style={backIcon}
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div style={card}>
        <div style={label}>Student</div>
        <div style={value}>{studentName}</div>
        <div style={{ opacity: 0.82, marginTop: 4 }}>{student?.email ?? "-"}</div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <div>
            <div style={label}>Academic Year</div>
            <div style={{ fontWeight: 800 }}>{ay?.name ?? "-"}</div>
          </div>
          <div>
            <div style={label}>College</div>
            <div style={{ fontWeight: 800 }}>{college?.name ?? "-"}</div>
          </div>
          <div>
            <div style={label}>Year Level</div>
            <div style={{ fontWeight: 800 }}>{yl?.name ?? "-"}</div>
          </div>
          <div>
            <div style={label}>Date</div>
            <div style={{ fontWeight: 800 }}>{found.date}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, opacity: 0.74, fontSize: 13 }}>
          Case ID: <b>#{found.id}</b> | Created: <b>{found.createdAt}</b>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Update Case</h3>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(240px, 1fr) minmax(320px, 2fr)",
          }}
        >
          <div>
            <div style={label}>Status</div>
            <DropdownSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as CounselingCase["status"])}
            >
              <option value="Pending">Pending</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </DropdownSelect>
          </div>

          <div>
            <div style={label}>Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
              placeholder="Add progress notes, interventions, or outcome details..."
            />
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => nav(listHref)} style={ghostButton}>
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
