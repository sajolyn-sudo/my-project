import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";

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

export default function Counseling() {
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

  const activeYearId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const yearLevels = useMemo<YearLevel[]>(
    () => load<YearLevel[]>(YL_KEY, []),
    [],
  );

  const users = useMemo<User[]>(() => load<User[]>(USERS_KEY, []), []);

  const students = useMemo(
    () => users.filter((u) => u.role === "STUDENT"),
    [users],
  );

  const [cases, setCases] = useState<CounselingCase[]>(() =>
    load<CounselingCase[]>(CASES_KEY, [
      {
        id: 1,
        studentId: students[0]?.id ?? 0,
        academicYearId: activeYearId,
        collegeId: students[0]?.collegeId ?? colleges[0]?.id ?? 1,
        yearLevelId: students[0]?.yearLevelId ?? 0,
        date: "2026-02-15",
        status: "Pending",
        notes: "Initial assessment",
        createdAt: "2026-02-15",
      },
    ]),
  );

  const [selectedAyId, setSelectedAyId] = useState<number>(activeYearId);

  // Filters (College + Year Level)
  const [filterCollegeId, setFilterCollegeId] = useState<number>(
    colleges[0]?.id ?? 0,
  );

  const filteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) =>
        yl.collegeId === filterCollegeId && yl.academicYearId === selectedAyId,
    );
  }, [yearLevels, filterCollegeId, selectedAyId]);

  const [filterYearLevelId, setFilterYearLevelId] = useState<number>(
    filteredYearLevels[0]?.id ?? 0,
  );

  // update yearlevel when college/AY changes
  useMemo(() => {
    if (filteredYearLevels.length)
      setFilterYearLevelId(filteredYearLevels[0].id);
  }, [filteredYearLevels]);

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.collegeId === filterCollegeId && s.yearLevelId === filterYearLevelId,
    );
  }, [students, filterCollegeId, filterYearLevelId]);

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<number>(
    filteredStudents[0]?.id ?? 0,
  );
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  // keep studentId valid when filtered list changes
  useMemo(() => {
    setStudentId(filteredStudents[0]?.id ?? 0);
  }, [filterCollegeId, filterYearLevelId, filteredStudents]);

  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => c.academicYearId === selectedAyId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [cases, selectedAyId]);

  const getStudentLabel = (id: number) => {
    const s = students.find((x) => x.id === id);
    if (!s) return "Unknown";
    const full = `${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`;
    return `${full} (${s.email})`;
  };

  const updateStatus = (id: number, status: CounselingCase["status"]) => {
    const next = cases.map((c) => (c.id === id ? { ...c, status } : c));
    setCases(next);
    save(CASES_KEY, next);
  };

  const handleCreate = () => {
    if (!studentId || !date || !filterCollegeId || !filterYearLevelId) return;

    const nextId = cases.length ? Math.max(...cases.map((c) => c.id)) + 1 : 1;

    const newCase: CounselingCase = {
      id: nextId,
      studentId,
      academicYearId: selectedAyId,
      collegeId: filterCollegeId,
      yearLevelId: filterYearLevelId,
      date,
      status: "Pending",
      notes: notes.trim() ? notes.trim() : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const next = [newCase, ...cases];
    setCases(next);
    save(CASES_KEY, next);

    setDate("");
    setNotes("");
    setOpen(false);
  };

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
    minHeight: 90,
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 800, marginRight: "auto" }}>
          Counseling Cases
        </h2>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Academic Year</div>
          <select
            value={selectedAyId}
            onChange={(e) => setSelectedAyId(Number(e.target.value))}
            style={inputStyle}
          >
            {years.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isActive ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>College</div>
          <select
            value={filterCollegeId}
            onChange={(e) => setFilterCollegeId(Number(e.target.value))}
            style={inputStyle}
          >
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Year Level</div>
          <select
            value={filterYearLevelId}
            onChange={(e) => setFilterYearLevelId(Number(e.target.value))}
            style={inputStyle}
          >
            {filteredYearLevels.map((yl) => (
              <option key={yl.id} value={yl.id}>
                {yl.name}
              </option>
            ))}
          </select>
        </div>

        <button onClick={() => setOpen(true)} style={primaryButton}>
          + Create Case
        </button>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Case List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Student</th>
              <th style={th}>Date</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.length === 0 ? (
              <tr>
                <td style={td} colSpan={4}>
                  <span style={{ opacity: 0.8 }}>
                    No cases for this academic year.
                  </span>
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => (
                <tr key={c.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 800 }}>
                      {getStudentLabel(c.studentId)}
                    </div>
                  </td>
                  <td style={td}>{c.date}</td>
                  <td style={td}>
                    <select
                      value={c.status}
                      onChange={(e) =>
                        updateStatus(
                          c.id,
                          e.target.value as CounselingCase["status"],
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                  <td style={td}>
                    <Link
                      to={`/app/counseling/${c.id}`}
                      style={{
                        textDecoration: "none",
                        color: "var(--primary)",
                        fontWeight: 900,
                      }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Counseling Case"
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={label}>Student (filtered by College + Year Level)</div>
            <select
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
              style={inputStyle}
            >
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`} (
                  {s.email})
                </option>
              ))}
            </select>
            {filteredStudents.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No students found in this College + Year Level. Add students in
                User Management.
              </div>
            )}
          </div>

          <div>
            <div style={label}>Date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <div style={label}>Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setOpen(false)} style={ghostButton}>
              Cancel
            </button>
            <button
              onClick={handleCreate}
              style={primaryButton}
              disabled={filteredStudents.length === 0}
            >
              Create
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
