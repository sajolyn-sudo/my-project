import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, History, List } from "lucide-react";
import Modal from "../components/Modal";
import DropdownSelect from "../components/DropdownSelect";
import { useAuthStore } from "../store/authStore";
import {
  createCounselingCase,
  listCounselingCases,
  updateCounselingCase,
} from "../lib/entitiesApi";
import { postJSON } from "../lib/api";

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
type Course = {
  id: number;
  name: string;
  collegeId: number;
};
type CoursesResponse = { ok: boolean; courses?: Course[] };

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

function parsePositiveInt(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function userCourseId(u: User): number {
  const raw = (u as User & { courseId?: unknown; course_id?: unknown }).courseId ??
    (u as User & { courseId?: unknown; course_id?: unknown }).course_id ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function Counseling() {
  const authUser = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
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
        { id: 1, name: "2024â€“2025", isActive: false },
        { id: 2, name: "2025â€“2026", isActive: true },
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

  useEffect(() => {
    let alive = true;
    listCounselingCases()
      .then((res) => {
        if (!alive) return;
        const next = res.cases ?? [];
        setCases(next);
        save(CASES_KEY, next);
      })
      .catch(() => {
        // Keep cached data when API is unreachable.
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedAyId = activeYearId;
  const [courses, setCourses] = useState<Course[]>([]);

  // Filters (College + Year Level)
  const [filterCollegeId, setFilterCollegeId] = useState<number>(() => {
    const fromQuery = parsePositiveInt(searchParams.get("collegeId"));
    if (fromQuery && colleges.some((c) => c.id === fromQuery)) return fromQuery;
    return 0;
  });
  const filteredCourses = useMemo(
    () =>
      filterCollegeId
        ? courses.filter((c) => c.collegeId === filterCollegeId)
        : courses,
    [courses, filterCollegeId],
  );
  const [filterCourseId, setFilterCourseId] = useState<number>(() =>
    parsePositiveInt(searchParams.get("courseId")),
  );

  useEffect(() => {
    if (filterCourseId && !filteredCourses.some((c) => c.id === filterCourseId)) {
      setFilterCourseId(0);
    }
  }, [filterCourseId, filteredCourses]);

  useEffect(() => {
    let alive = true;
    postJSON<CoursesResponse>("/courses_api.php", { action: "list" })
      .then((res) => {
        if (!alive) return;
        setCourses(res.courses ?? []);
      })
      .catch(() => {
        if (!alive) return;
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) =>
        yl.academicYearId === selectedAyId &&
        (filterCollegeId ? yl.collegeId === filterCollegeId : true),
    );
  }, [yearLevels, filterCollegeId, selectedAyId]);

  const [filterYearLevelId, setFilterYearLevelId] = useState<number>(() =>
    parsePositiveInt(searchParams.get("yearLevelId")),
  );
  const [showCompletedHistory, setShowCompletedHistory] = useState<boolean>(() => {
    return searchParams.get("tab") === "history";
  });

  // update yearlevel when college/AY changes
  useEffect(() => {
    if (filteredYearLevels.length === 0) {
      if (filterYearLevelId !== 0) setFilterYearLevelId(0);
      return;
    }
    const exists = filteredYearLevels.some((yl) => yl.id === filterYearLevelId);
    if (!exists && filterYearLevelId !== 0) setFilterYearLevelId(0);
  }, [filteredYearLevels, filterYearLevelId]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (filterCollegeId) next.set("collegeId", String(filterCollegeId));
    if (filterCourseId) next.set("courseId", String(filterCourseId));
    if (filterYearLevelId) next.set("yearLevelId", String(filterYearLevelId));
    if (showCompletedHistory) next.set("tab", "history");
    setSearchParams(next, { replace: true });
  }, [
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    showCompletedHistory,
    setSearchParams,
  ]);

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) => {
        const sid = userCourseId(s);
        const matchesCourse = !filterCourseId || sid === 0 || sid === filterCourseId;
        return (
          s.collegeId === filterCollegeId &&
          s.yearLevelId === filterYearLevelId &&
          matchesCourse
        );
      },
    );
  }, [students, filterCollegeId, filterYearLevelId, filterCourseId]);

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<number>(
    filteredStudents[0]?.id ?? 0,
  );
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  // keep studentId valid when filtered list changes
  useEffect(() => {
    setStudentId(filteredStudents[0]?.id ?? 0);
  }, [filterCollegeId, filterYearLevelId, filteredStudents]);

  const filterQuery = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams]);

  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => c.academicYearId === selectedAyId)
      .filter((c) => (filterCollegeId ? c.collegeId === filterCollegeId : true))
      .filter((c) =>
        filterYearLevelId ? c.yearLevelId === filterYearLevelId : true,
      )
      .filter((c) => {
        if (!filterCourseId) return true;
        const student = students.find((s) => s.id === c.studentId);
        if (!student) return true;
        const sid = userCourseId(student);
        return sid === 0 || sid === filterCourseId;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [
    cases,
    selectedAyId,
    filterCollegeId,
    filterYearLevelId,
    filterCourseId,
    students,
  ]);
  const activeCases = useMemo(
    () => filteredCases.filter((c) => c.status !== "Completed"),
    [filteredCases],
  );
  const completedCases = useMemo(
    () => filteredCases.filter((c) => c.status === "Completed"),
    [filteredCases],
  );
  const displayCases = showCompletedHistory ? completedCases : activeCases;

  const getStudentName = (id: number) => {
    const s = students.find((x) => x.id === id);
    if (!s) return "Unknown";
    return `${s.fname} ${s.mname ? `${s.mname} ` : ""}${s.lname}`.trim();
  };

  const getStudentEmail = (id: number) => {
    const s = students.find((x) => x.id === id);
    return s?.email ?? "-";
  };

  const getCollegeName = (id: number) =>
    colleges.find((x) => x.id === id)?.name ?? "-";

  const getCourseNameByStudentId = (studentUserId: number) => {
    const s = students.find((x) => x.id === studentUserId);
    if (!s) return "-";
    const sid = userCourseId(s);
    if (!sid) return "-";
    return courses.find((c) => c.id === sid)?.name ?? "-";
  };

  const updateStatus = async (id: number, status: CounselingCase["status"]) => {
    try {
      const res = await updateCounselingCase({ id, status });
      const next = res.cases ?? [];
      setCases(next);
      save(CASES_KEY, next);
    } catch (e: any) {
      alert(e?.message || "Failed to update case status.");
    }
  };

  const handleCreate = async () => {
    if (!studentId || !date || !filterCollegeId || !filterYearLevelId) return;

    try {
      const res = await createCounselingCase({
        studentId,
        counselorUserId:
          authUser && authUser.role !== "STUDENT" ? authUser.id : undefined,
        academicYearId: selectedAyId,
        collegeId: filterCollegeId,
        yearLevelId: filterYearLevelId,
        date,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      const next = res.cases ?? [];
      setCases(next);
      save(CASES_KEY, next);

      setDate("");
      setNotes("");
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to create counseling case.");
    }
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

  const iconAction: React.CSSProperties = {
    height: 34,
    width: 34,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--primary)",
    textDecoration: "none",
  };
  const statusPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    minWidth: 96,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #c7e8d8",
    background: "#ecfdf3",
    color: "#166534",
    fontWeight: 800,
    fontSize: 13,
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 800, marginRight: "auto" }}>
          Counseling Cases
        </h2>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>College</div>
          <DropdownSelect
            value={filterCollegeId}
            onChange={(e) => setFilterCollegeId(Number(e.target.value))}
          >
            <option value={0}>All colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DropdownSelect>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Course</div>
          <DropdownSelect
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(Number(e.target.value))}
          >
            <option value={0}>
              {filteredCourses.length ? "All courses" : "No courses found"}
            </option>
            {filteredCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DropdownSelect>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Year Level</div>
          <DropdownSelect
            value={filterYearLevelId}
            onChange={(e) => setFilterYearLevelId(Number(e.target.value))}
          >
            <option value={0}>All year levels</option>
            {filteredYearLevels.map((yl) => (
              <option key={yl.id} value={yl.id}>
                {yl.name}
              </option>
            ))}
          </DropdownSelect>
        </div>

        <button onClick={() => setOpen(true)} style={primaryButton}>
          + Create Case
        </button>

        <button
          onClick={() => setShowCompletedHistory((v) => !v)}
          style={ghostButton}
          title={showCompletedHistory ? "Show active cases" : "Show completed history"}
          aria-label={showCompletedHistory ? "Show active cases" : "Show completed history"}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {showCompletedHistory ? <List size={16} /> : <History size={16} />}
            {showCompletedHistory ? "Active Cases" : "Completed History"}
          </span>
        </button>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>
          {showCompletedHistory ? "Completed Cases History" : "Case List"}
        </h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>College</th>
              <th style={th}>Course</th>
              <th style={th}>Date</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {displayCases.length === 0 ? (
              <tr>
                <td style={td} colSpan={7}>
                  <span style={{ opacity: 0.8 }}>
                    {showCompletedHistory
                      ? "No completed cases found for this filter."
                      : "No active cases found for this filter."}
                  </span>
                </td>
              </tr>
            ) : (
              displayCases.map((c) => (
                <tr key={c.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 800 }}>{getStudentName(c.studentId)}</div>
                  </td>
                  <td style={td}>{getStudentEmail(c.studentId)}</td>
                  <td style={td}>{getCollegeName(c.collegeId)}</td>
                  <td style={td}>{getCourseNameByStudentId(c.studentId)}</td>
                  <td style={td}>{c.date}</td>
                  <td style={td}>
                    {showCompletedHistory ? (
                      <span style={statusPill}>Completed</span>
                    ) : (
                      <DropdownSelect
                        value={c.status}
                        onChange={(e) =>
                          updateStatus(
                            c.id,
                            e.target.value as CounselingCase["status"],
                          )
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </DropdownSelect>
                    )}
                  </td>
                  <td style={td}>
                    <Link
                      to={`/app/counseling/${c.id}${filterQuery}`}
                      title="View case"
                      aria-label="View case"
                      style={iconAction}
                    >
                      <Eye size={16} />
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
            <div style={label}>Student (filtered by College + Course + Year Level)</div>
            <DropdownSelect
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
            >
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`} (
                  {s.email})
                </option>
              ))}
            </DropdownSelect>
            {filteredStudents.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No students found in this filter. Add students in User
                Management.
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

