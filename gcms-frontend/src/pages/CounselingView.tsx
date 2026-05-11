import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Handshake,
  NotebookPen,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getCounselingCase } from "../lib/entitiesApi";

type Role =
  | "ADMIN"
  | "STAFF"
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
  courseId?: number | null;
};

type College = { id: number; name: string };
type Course = {
  id: number;
  name: string;
  collegeId: number;
};
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
  STAFFUserId?: number | null;
  counselorUserId?: number | null;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  date: string;
  time?: string | null;
  status: "Pending" | "Ongoing" | "Completed";
  reason?: string;
  notes?: string;
  actionTaken?: string;
  followUpDate?: string;
  timeFinished?: string | null;
  recommendation?: string;
  createdAt: string;
};

type MediationStatus = "Open" | "In Progress" | "Resolved";

type MediationCase = {
  id: number;
  title: string;
  participantIds: number[];
  STAFFUserId?: number;
  academicYearId: number;
  date: string;
  status: MediationStatus;
  issueDescription?: string;
  agreementsMade?: string;
  outcome?: string;
  remarks?: string;
  createdAt: string;
  resolvedAt?: string;
};

const CASES_KEY = "gcms_mock_counseling_cases_v2";
const MEDIATION_KEY = "gcms_mock_mediation_cases_v1";
const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const COURSES_KEY = "gcms_mock_courses_v1";
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

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function mergeCounselingCase(
  item: CounselingCase,
  cached?: CounselingCase,
): CounselingCase {
  return {
    ...cached,
    ...item,
    STAFFUserId:
      (item as CounselingCase & { counselorUserId?: number }).STAFFUserId ??
      (item as CounselingCase & { counselorUserId?: number }).counselorUserId ??
      cached?.STAFFUserId,
    reason:
      optionalText((item as CounselingCase & { reason?: unknown }).reason) ??
      cached?.reason,
    notes: optionalText(item.notes) ?? cached?.notes,
    time:
      optionalText((item as CounselingCase & { time?: unknown }).time) ??
      cached?.time,
    actionTaken:
      optionalText(
        (item as CounselingCase & { actionTaken?: unknown }).actionTaken,
      ) ?? cached?.actionTaken,
    followUpDate:
      optionalText(
        (item as CounselingCase & { followUpDate?: unknown }).followUpDate,
      ) ?? cached?.followUpDate,
    timeFinished:
      optionalText(
        (
          item as CounselingCase & {
            timeFinished?: unknown;
            time_finished?: unknown;
          }
        ).timeFinished ??
          (
            item as CounselingCase & {
              timeFinished?: unknown;
              time_finished?: unknown;
            }
          ).time_finished,
      ) ?? cached?.timeFinished,
    recommendation:
      optionalText(
        (item as CounselingCase & { recommendation?: unknown }).recommendation,
      ) ?? cached?.recommendation,
  };
}

function formatCaseDate(value?: string) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return value || "-";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCaseTime(value?: string | null) {
  if (!value) return "No time set";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function userCourseId(user: User): number {
  const raw = (user as User & { courseId?: unknown; course_id?: unknown }).courseId ??
    (user as User & { courseId?: unknown; course_id?: unknown }).course_id ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function CounselingView() {
  const location = useLocation();
  const { id } = useParams();
  const caseId = Number(id);
  const isMediationView = false;

  const listHref = useMemo(
    () => {
      const params = new URLSearchParams(location.search);
      if (params.get("from") === "reports") return "/app/reports";
      if (params.get("tab") === "mediation") params.delete("tab");
      const query = params.toString();
      return `/app/counseling${query ? `?${query}` : ""}`;
    },
    [location.search],
  );

  const cases = useMemo(() => load<CounselingCase[]>(CASES_KEY, []), []);
  const mediationCases = useMemo(() => load<MediationCase[]>(MEDIATION_KEY, []), []);
  const users = useMemo(() => load<User[]>(USERS_KEY, []), []);
  const colleges = useMemo(() => load<College[]>(COLLEGES_KEY, []), []);
  const courses = useMemo(() => load<Course[]>(COURSES_KEY, []), []);
  const years = useMemo(() => load<AcademicYear[]>(YEARS_KEY, []), []);
  const yearLevels = useMemo(() => load<YearLevel[]>(YL_KEY, []), []);

  const [found, setFound] = useState<CounselingCase | undefined>(() =>
    cases.find((c) => c.id === caseId),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    localStorage.removeItem(MEDIATION_KEY);
  }, []);

  useEffect(() => {
    if (isMediationView) {
      setLoaded(true);
      return;
    }

    if (!caseId) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    let alive = true;

    getCounselingCase(caseId)
      .then((res) => {
        if (!alive) return;

        const item = mergeCounselingCase(
          res.item,
          load<CounselingCase[]>(CASES_KEY, []).find((entry) => entry.id === res.item.id),
        );
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
  }, [caseId, isMediationView]);

  const student = found ? users.find((u) => u.id === found.studentId) : undefined;
  const college = found ? colleges.find((c) => c.id === found.collegeId) : undefined;
  const ay = found ? years.find((y) => y.id === found.academicYearId) : undefined;
  const yl = found ? yearLevels.find((y) => y.id === found.yearLevelId) : undefined;
  const mediationCase = useMemo(
    () => mediationCases.find((item) => item.id === caseId),
    [mediationCases, caseId],
  );
  const mediationParticipants = useMemo(() => {
    if (!mediationCase) return [];
    return mediationCase.participantIds
      .map((participantId) => users.find((item) => item.id === participantId))
      .filter(Boolean) as User[];
  }, [mediationCase, users]);
  const getUserFullName = (user?: User) =>
    user
      ? `${user.fname} ${user.mname ? `${user.mname} ` : ""}${user.lname}`.trim()
      : "Unknown";
  const getCollegeName = (collegeId?: number) =>
    colleges.find((item) => item.id === collegeId)?.name ?? "-";
  const getYearLevelName = (yearLevelId?: number) =>
    yearLevels.find((item) => item.id === yearLevelId)?.name ?? "-";
  const getCourseName = (courseId?: number | null) =>
    courses.find((item) => item.id === courseId)?.name ?? "-";
  const getParticipantCourseYear = (participant: User) => {
    const courseName = getCourseName(userCourseId(participant));
    const yearLevelName = getYearLevelName(participant.yearLevelId);
    if (courseName === "-" && yearLevelName === "-") return "-";
    if (courseName === "-") return yearLevelName;
    if (yearLevelName === "-") return courseName;
    return `${courseName} / ${yearLevelName}`;
  };

  const shell: React.CSSProperties = {
    display: "grid",
    gap: 14,
  };

  const card: React.CSSProperties = {
    background: "white",
    padding: 16,
    borderRadius: 16,
    boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
    border: "1px solid rgba(15,23,42,0.08)",
  };

  const label: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 800,
    letterSpacing: 0.16,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const value: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 18,
    lineHeight: 1.25,
    color: "#0f172a",
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
  const metaCard: React.CSSProperties = {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: 12,
    background: "white",
    display: "grid",
    gap: 6,
  };
  const metaHeader: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12.5,
    fontWeight: 800,
    color: "#334155",
  };
  const metaValue: React.CSSProperties = {
    fontWeight: 500,
    fontSize: 12.5,
    color: "#0f172a",
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
  };
  const pageTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#1e293b",
  };
  const infoChipWrap: React.CSSProperties = {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  };
  const infoChip: React.CSSProperties = {
    minHeight: 52,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  };
  const infoChipIcon: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "rgba(248,250,252,0.96)",
    border: "1px solid rgba(15,23,42,0.08)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    flexShrink: 0,
  };
  const infoChipLabel: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 0.16,
    textTransform: "uppercase",
    color: "#64748b",
    lineHeight: 1.1,
  };
  const infoChipValue: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.3,
  };
  const participantTableWrap: React.CSSProperties = {
    overflowX: "auto",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    background: "white",
  };
  const participantTableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 700,
  };
  const participantTableHeadCell: React.CSSProperties = {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: 12.5,
    fontWeight: 800,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    background: "rgba(248,250,252,0.92)",
    borderBottom: "1px solid rgba(15,23,42,0.08)",
  };
  const participantTableCell: React.CSSProperties = {
    padding: "14px",
    fontSize: 12.5,
    fontWeight: 500,
    color: "#0f172a",
    borderTop: "1px solid rgba(15,23,42,0.08)",
  };
  const detailGrid: React.CSSProperties = {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  };
  const sectionTitleWrap: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  };
  const sectionTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 12.5,
    fontWeight: 800,
    color: "#1e293b",
  };

  const [backHovered, setBackHovered] = useState(false);
  const [backPressed, setBackPressed] = useState(false);

  const backButtonStyle: React.CSSProperties = {
    ...backIcon,
    border: (backPressed ? "1px solid #5F6D7A" : "1px solid #000000"),
    background: backPressed ? "#5F6D7A" : "white",
    color: backPressed ? "white" : "#000000",
    boxShadow: "none",
    transform: backPressed
      ? "translateY(1px) scale(0.98)"
      : backHovered
        ? "translateY(-1px)"
        : "translateY(0)",
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease",
  };

  if (isMediationView) {
    if (!mediationCase) {
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
            <h2 style={pageTitle}>Mediation Case Details</h2>
            <Link
              to={listHref}
              title="Back to Counseling"
              aria-label="Back to Counseling"
              style={backButtonStyle}
              onMouseEnter={() => setBackHovered(true)}
              onMouseLeave={() => {
                setBackHovered(false);
                setBackPressed(false);
              }}
              onPointerDown={() => setBackPressed(true)}
              onPointerUp={() => setBackPressed(false)}
              onPointerCancel={() => setBackPressed(false)}
              onBlur={() => setBackPressed(false)}
            >
              <ArrowLeft size={18} />
            </Link>
          </div>

          <div style={card}>
            <div style={{ opacity: 0.8 }}>Mediation case not found.</div>
          </div>
        </div>
      );
    }

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
          <h2 style={pageTitle}>Mediation Case Details</h2>
          <Link
            to={listHref}
            title="Back to Counseling"
            aria-label="Back to Counseling"
            style={backButtonStyle}
            onMouseEnter={() => setBackHovered(true)}
            onMouseLeave={() => {
              setBackHovered(false);
              setBackPressed(false);
            }}
            onPointerDown={() => setBackPressed(true)}
            onPointerUp={() => setBackPressed(false)}
            onPointerCancel={() => setBackPressed(false)}
            onBlur={() => setBackPressed(false)}
          >
            <ArrowLeft size={18} />
          </Link>
        </div>

        <div style={card}>
          <div style={label}>Case Title</div>
          <div style={value}>{mediationCase.title}</div>

          <div style={infoChipWrap}>
            <div style={infoChip}>
              <span style={infoChipIcon}>
                <CalendarDays size={16} />
              </span>
              <div>
                <div style={infoChipLabel}>Date</div>
                <div style={infoChipValue}>{formatCaseDate(mediationCase.date)}</div>
              </div>
            </div>

            <div style={infoChip}>
              <span style={infoChipIcon}>
                <CheckCircle2 size={16} />
              </span>
              <div>
                <div style={infoChipLabel}>Status</div>
                <div
                  style={{
                    ...infoChipValue,
                    marginTop: 2,
                    color:
                      mediationCase.status === "Resolved"
                        ? "#166534"
                        : mediationCase.status === "In Progress"
                          ? "#1d4ed8"
                          : "#92400e",
                  }}
                >
                  {mediationCase.status}
                </div>
              </div>
            </div>

            <div style={infoChip}>
              <span style={infoChipIcon}>
                <Users size={16} />
              </span>
              <div>
                <div style={infoChipLabel}>Participants</div>
                <div style={infoChipValue}>{mediationParticipants.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={sectionTitleWrap}>
            <Users size={16} color="#991b1b" />
            <h3 style={sectionTitle}>Participants</h3>
          </div>

          <div style={{ ...metaCard, marginBottom: 12 }}>
            {mediationParticipants.length === 0 ? (
              <div style={metaValue}>No participants added yet.</div>
            ) : (
              <div style={participantTableWrap}>
                <table style={participantTableStyle}>
                  <thead>
                    <tr>
                      <th style={participantTableHeadCell}>Name</th>
                      <th style={participantTableHeadCell}>Email</th>
                      <th style={participantTableHeadCell}>College</th>
                      <th style={participantTableHeadCell}>Course / Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediationParticipants.map((participant, index) => (
                      <tr key={participant.id}>
                        <td
                          style={{
                            ...participantTableCell,
                            borderTop:
                              index === 0
                                ? "none"
                                : "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          {getUserFullName(participant)}
                        </td>
                        <td
                          style={{
                            ...participantTableCell,
                            borderTop:
                              index === 0
                                ? "none"
                                : "1px solid rgba(15,23,42,0.08)",
                            color: "#475569",
                          }}
                        >
                          {participant.email || "-"}
                        </td>
                        <td
                          style={{
                            ...participantTableCell,
                            borderTop:
                              index === 0
                                ? "none"
                                : "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          {getCollegeName(participant.collegeId)}
                        </td>
                        <td
                          style={{
                            ...participantTableCell,
                            borderTop:
                              index === 0
                                ? "none"
                                : "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          {getParticipantCourseYear(participant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={sectionTitleWrap}>
            <Sparkles size={16} color="#5F6D7A" />
            <h3 style={sectionTitle}>Case Notes</h3>
          </div>

          <div style={detailGrid}>
            <div style={{ ...metaCard, gridColumn: "1 / -1" }}>
              <div style={metaHeader}>
                <Handshake size={16} />
                Issue / Conflict Description
              </div>
              <div style={metaValue}>
                {mediationCase.issueDescription ?? "No issue description added yet."}
              </div>
            </div>

            <div style={metaCard}>
              <div style={metaHeader}>
                <ClipboardList size={16} />
                Agreements Made
              </div>
              <div style={metaValue}>
                {mediationCase.agreementsMade ?? "No agreements recorded yet."}
              </div>
            </div>

            <div style={metaCard}>
              <div style={metaHeader}>
                <FileText size={16} />
                Outcome
              </div>
              <div style={metaValue}>
                {mediationCase.outcome ?? "No outcome recorded yet."}
              </div>
            </div>

            <div style={metaCard}>
              <div style={metaHeader}>
                <NotebookPen size={16} />
                Remarks
              </div>
              <div style={metaValue}>
                {mediationCase.remarks ?? "No remarks added yet."}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 style={pageTitle}>Session Details</h2>
          <Link
            to={listHref}
            title="Back to Counseling"
            aria-label="Back to Counseling"
            style={backButtonStyle}
            onMouseEnter={() => setBackHovered(true)}
            onMouseLeave={() => {
              setBackHovered(false);
              setBackPressed(false);
            }}
            onPointerDown={() => setBackPressed(true)}
            onPointerUp={() => setBackPressed(false)}
            onPointerCancel={() => setBackPressed(false)}
            onBlur={() => setBackPressed(false)}
          >
            <ArrowLeft size={18} />
          </Link>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8 }}>
            {loaded ? "Session not found." : "Loading session..."}
          </div>
        </div>
      </div>
    );
  }

  const studentName = student
    ? `${student.fname} ${student.mname ? `${student.mname} ` : ""}${student.lname}`
    : "Unknown Student";
  const studentCourseName = student ? getCourseName(userCourseId(student)) : "-";
  const courseYearText =
    [studentCourseName !== "-" ? studentCourseName : "", yl?.name ?? ""]
      .filter(Boolean)
      .join(" / ") || "-";
  const counselorId = found.STAFFUserId ?? found.counselorUserId ?? null;
  const counselor = counselorId
    ? users.find((item) => item.id === counselorId)
    : undefined;
  const counselorName = counselor ? getUserFullName(counselor) : "To be assigned";

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
        <h2 style={pageTitle}>Session Details</h2>
        <Link
          to={listHref}
          title="Back to Counseling"
          aria-label="Back to Counseling"
          style={backButtonStyle}
          onMouseEnter={() => setBackHovered(true)}
          onMouseLeave={() => {
            setBackHovered(false);
            setBackPressed(false);
          }}
          onPointerDown={() => setBackPressed(true)}
          onPointerUp={() => setBackPressed(false)}
          onPointerCancel={() => setBackPressed(false)}
          onBlur={() => setBackPressed(false)}
        >
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div style={card}>
        <div style={label}>Student</div>
        <div style={value}>{studentName}</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
          {student?.email ?? "-"}
        </div>

        <div style={infoChipWrap}>
          <div style={infoChip}>
            <span style={infoChipIcon}>
              <BookOpen size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Academic Year</div>
              <div style={infoChipValue}>{ay?.name ?? "-"}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <School size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>College</div>
              <div style={infoChipValue}>{college?.name ?? "-"}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <GraduationCap size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Course & Year</div>
              <div style={infoChipValue}>{courseYearText}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <Users size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Counselor</div>
              <div style={infoChipValue}>{counselorName}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <ClipboardList size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Session No.</div>
              <div style={infoChipValue}>#{found.id}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <CalendarDays size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Date</div>
              <div style={infoChipValue}>{formatCaseDate(found.date)}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <Clock3 size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Time Start</div>
              <div style={infoChipValue}>{formatCaseTime(found.time)}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <Clock3 size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Time Finished</div>
              <div style={infoChipValue}>
                {found.timeFinished
                  ? formatCaseTime(found.timeFinished)
                  : "Not set"}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <CalendarDays size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Follow-up Date</div>
              <div style={infoChipValue}>
                {found.followUpDate
                  ? formatCaseDate(found.followUpDate)
                  : "Not set"}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <CheckCircle2 size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Status</div>
              <div
                style={{
                  ...infoChipValue,
                  marginTop: 2,
                  color:
                    found.status === "Completed"
                      ? "#166534"
                      : found.status === "Ongoing"
                        ? "#1d4ed8"
                        : "#92400e",
                }}
              >
                {found.status}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={sectionTitleWrap}>
          <Sparkles size={16} color="#5F6D7A" />
          <h3 style={sectionTitle}>Session Notes</h3>
        </div>

        <div style={detailGrid}>
          <div style={{ ...metaCard, gridColumn: "1 / -1" }}>
            <div style={metaHeader}>
              <ClipboardList size={16} />
              Background
            </div>
            <div style={metaValue}>
              {found.reason ?? "No background recorded yet."}
            </div>
          </div>

          <div style={{ ...metaCard, gridColumn: "1 / -1" }}>
            <div style={metaHeader}>
              <FileText size={16} />
              Behavioral Observations and Relevant History
            </div>
            <div style={metaValue}>
              {found.notes ??
                "No behavioral observations or relevant history recorded yet."}
            </div>
          </div>

          <div style={{ ...metaCard, gridColumn: "1 / -1" }}>
            <div style={metaHeader}>
              <NotebookPen size={16} />
              Intervention
            </div>
            <div style={metaValue}>
              {found.actionTaken ?? "No intervention recorded yet."}
            </div>
          </div>

          <div style={{ ...metaCard, gridColumn: "1 / -1" }}>
            <div style={metaHeader}>
              <BookOpen size={16} />
              Assignment / Recommendation
            </div>
            <div style={metaValue}>
              {found.recommendation ??
                "No assignment or recommendation recorded yet."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
