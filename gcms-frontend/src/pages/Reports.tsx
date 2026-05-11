import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Eye,
  FileDown,
  FileText,
  List,
  RefreshCw,
} from "lucide-react";
import {
  fetchEntitiesBootstrap,
  generateStudentCircleAttendanceReport,
  listCounselingCases,
  listGroupSessions,
  listReferrals,
  type CounselingCase,
  type GroupSession,
  type GroupSessionMember,
  type Referral,
  type StudentCircleAttendanceReport,
} from "../lib/entitiesApi";
import {
  downloadReportsWord,
  openReportsPdfPrint,
  type ReportDownloadRow,
} from "../lib/reportsDownload";
import {
  downloadStudentCircleAttendanceReportWord,
  openStudentCircleAttendanceReportPrint,
} from "../lib/studentCircleAttendanceReportPrint";

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
  courseName?: string | null;
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

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const COURSES_KEY = "gcms_mock_courses_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const CASES_KEY = "gcms_mock_counseling_cases_v2";
const REF_KEY = "gcms_mock_referrals_v1";
const GS_KEY = "gcms_mock_group_sessions_v1";
const GSM_KEY = "gcms_mock_group_session_members_v1";

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

function toDateKey(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatLongDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSessionTime(value?: string | null): string {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function userCourseId(user?: User): number {
  const raw =
    (user as (User & { course_id?: unknown }) | undefined)?.courseId ??
    (user as (User & { course_id?: unknown }) | undefined)?.course_id ??
    0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fullName(user?: User): string {
  if (!user) return "-";
  return [user.fname, user.mname, user.lname].filter(Boolean).join(" ").trim() || "-";
}

function sortTimestamp(dateValue?: string | null, timeValue?: string | null): number {
  const key = toDateKey(dateValue);
  const time = timeValue || "00:00";
  const fromKey = key ? new Date(`${key}T${time}:00`).getTime() : NaN;
  if (Number.isFinite(fromKey)) return fromKey;

  const fallback = dateValue ? new Date(dateValue).getTime() : NaN;
  return Number.isFinite(fallback) ? fallback : 0;
}

function isPastSchedule(dateValue?: string | null, timeValue?: string | null): boolean {
  const timestamp = sortTimestamp(dateValue, timeValue);
  return timestamp > 0 && timestamp < Date.now();
}

function isCompletedStatus(status?: string | null): boolean {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "closed" ||
    normalized === "resolved" ||
    normalized === "done"
  );
}

function markGroupCounsellingReportPresent(
  report: StudentCircleAttendanceReport,
): StudentCircleAttendanceReport {
  const rows = report.rows.map((row) =>
    row.status === "Absent" ? { ...row, status: "Present" as const } : row,
  );
  const extraSubmissionCount = rows.filter(
    (row) => row.status === "Present (not in member list)",
  ).length;
  const expectedPresentCount = rows.filter(
    (row) => row.status === "Present",
  ).length;

  return {
    ...report,
    rows,
    presentCount:
      report.expectedCount > 0 ? report.expectedCount : expectedPresentCount,
    absentCount: 0,
    extraSubmissionCount,
  };
}

type ReportType = "Group Counselling" | "Referral" | "Session";

type ReportRow = ReportDownloadRow & {
  key: string;
  id: number;
  type: ReportType;
  subject: string;
  topic: string;
  detail: string;
  status: string;
  viewHref: string;
  sortTimestamp: number;
  rawDate: string;
  rawTime?: string | null;
  academicYearId: number;
  collegeId: number;
  courseId: number;
  yearLevelId: number;
};

function reportActionStyle(
  base: React.CSSProperties,
  active = false,
  hovered = false,
): React.CSSProperties {
  return {
    ...base,
    border: active ? "1px solid #5F6D7A" : "1px solid var(--border)",
    background: active ? "#5F6D7A" : "white",
    color: active ? "white" : "#000000",
    boxShadow: "none",
    transform: active
      ? "translateY(1px) scale(0.98)"
      : hovered
        ? "translateY(-1px)"
        : "translateY(0)",
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease",
    cursor: "pointer",
    textDecoration: "none",
  };
}

function ReportIconButton({
  children,
  title,
  onClick,
  href,
  style,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  href?: string;
  style: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const computed = reportActionStyle(style, pressed, hovered);

  if (href) {
    return (
      <Link
        to={href}
        title={title}
        aria-label={title}
        style={computed}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onBlur={() => setPressed(false)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={computed}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

export default function Reports() {
  const [users, setUsers] = useState<User[]>(() => load<User[]>(USERS_KEY, []));
  const [colleges, setColleges] = useState<College[]>(() =>
    load<College[]>(COLLEGES_KEY, []),
  );
  const [courses, setCourses] = useState<Course[]>(() =>
    load<Course[]>(COURSES_KEY, []),
  );
  const [years, setYears] = useState<AcademicYear[]>(() =>
    load<AcademicYear[]>(YEARS_KEY, []),
  );
  const [yearLevels, setYearLevels] = useState<YearLevel[]>(() =>
    load<YearLevel[]>(YL_KEY, []),
  );
  const [cases, setCases] = useState<CounselingCase[]>(() =>
    load<CounselingCase[]>(CASES_KEY, []),
  );
  const [referrals, setReferrals] = useState<Referral[]>(() =>
    load<Referral[]>(REF_KEY, []),
  );
  const [sessions, setSessions] = useState<GroupSession[]>(() =>
    load<GroupSession[]>(GS_KEY, []),
  );
  const [members, setMembers] = useState<GroupSessionMember[]>(() =>
    load<GroupSessionMember[]>(GSM_KEY, []),
  );
  const [loading, setLoading] = useState(false);
  const [groupAttendanceReports, setGroupAttendanceReports] = useState<
    Record<number, StudentCircleAttendanceReport>
  >({});
  const [groupReportsLoading, setGroupReportsLoading] = useState(false);

  const refreshReports = () => {
    setLoading(true);
    Promise.allSettled([
      fetchEntitiesBootstrap(),
      listGroupSessions(),
      listCounselingCases(),
      listReferrals(),
    ])
      .then(([bootstrapRes, sessionsRes, casesRes, referralsRes]) => {
        if (bootstrapRes.status === "fulfilled") {
          const nextUsers = bootstrapRes.value.users ?? [];
          const nextColleges = bootstrapRes.value.colleges ?? [];
          const nextCourses = bootstrapRes.value.courses ?? [];
          const nextYears = bootstrapRes.value.academicYears ?? [];
          const nextYearLevels = bootstrapRes.value.yearLevels ?? [];

          setUsers(nextUsers as User[]);
          setColleges(nextColleges);
          setCourses(nextCourses);
          setYears(nextYears);
          setYearLevels(nextYearLevels);

          save(USERS_KEY, nextUsers);
          save(COLLEGES_KEY, nextColleges);
          save(COURSES_KEY, nextCourses);
          save(YEARS_KEY, nextYears);
          save(YL_KEY, nextYearLevels);
        }

        if (sessionsRes.status === "fulfilled") {
          const nextSessions = sessionsRes.value.sessions ?? [];
          const nextMembers = sessionsRes.value.members ?? [];
          setSessions(nextSessions);
          setMembers(nextMembers);
          save(GS_KEY, nextSessions);
          save(GSM_KEY, nextMembers);
        }

        if (casesRes.status === "fulfilled") {
          const nextCases = casesRes.value.cases ?? [];
          setCases(nextCases);
          save(CASES_KEY, nextCases);
        }

        if (referralsRes.status === "fulfilled") {
          const nextReferrals = referralsRes.value.referrals ?? [];
          setReferrals(nextReferrals);
          save(REF_KEY, nextReferrals);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshReports();
  }, []);

  useEffect(() => {
    const eligibleSessions = sessions.filter((session) =>
      isPastSchedule(session.date, session.time),
    );

    if (eligibleSessions.length === 0) {
      setGroupAttendanceReports({});
      setGroupReportsLoading(false);
      return;
    }

    let alive = true;
    setGroupReportsLoading(true);

    Promise.allSettled(
      eligibleSessions.map((session) =>
        generateStudentCircleAttendanceReport(session.id),
      ),
    )
      .then((results) => {
        if (!alive) return;

        const next: Record<number, StudentCircleAttendanceReport> = {};
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[eligibleSessions[index].id] = markGroupCounsellingReportPresent(
              result.value.report,
            );
          }
        });
        setGroupAttendanceReports(next);
      })
      .finally(() => {
        if (alive) setGroupReportsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [sessions]);

  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );
  const collegeById = useMemo(
    () => new Map(colleges.map((college) => [college.id, college])),
    [colleges],
  );
  const yearById = useMemo(
    () => new Map(years.map((year) => [year.id, year])),
    [years],
  );
  const yearLevelById = useMemo(
    () => new Map(yearLevels.map((yearLevel) => [yearLevel.id, yearLevel])),
    [yearLevels],
  );
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  const reportRows = useMemo<ReportRow[]>(() => {
    const membersBySession = new Map<number, GroupSessionMember[]>();
    members.forEach((member) => {
      const current = membersBySession.get(member.groupSessionId) ?? [];
      current.push(member);
      membersBySession.set(member.groupSessionId, current);
    });

    const courseNameForUser = (user?: User) => {
      const courseId = userCourseId(user);
      return {
        courseId,
        courseName: courseById.get(courseId)?.name || user?.courseName || "-",
      };
    };

    const groupRows: ReportRow[] = sessions
      .filter((session) => isPastSchedule(session.date, session.time))
      .map((session) => {
        const sessionMembers = membersBySession.get(session.id) ?? [];
        const firstStudent = userById.get(sessionMembers[0]?.studentUserId ?? 0);
        const attendanceReport = groupAttendanceReports[session.id];
        const courseId =
          Number(session.courseId ?? 0) ||
          userCourseId(firstStudent) ||
          0;
        const courseName =
          courseById.get(courseId)?.name || firstStudent?.courseName || "-";
        const statusParts = attendanceReport
          ? [
              `${attendanceReport.presentCount} present`,
              `${attendanceReport.absentCount} absent`,
            ]
          : [
              `${sessionMembers.length} present`,
              "0 absent",
            ];
        if ((attendanceReport?.extraSubmissionCount ?? 0) > 0) {
          statusParts.push(`${attendanceReport?.extraSubmissionCount} extra`);
        }

        return {
          key: `group-${session.id}`,
          id: session.id,
          type: "Group Counselling",
          subject: session.facilitator?.trim() || "-",
          topic: session.topic?.trim() || "Group Counselling",
          detail: session.location || "-",
          status: statusParts.join(" / "),
          viewHref: `/app/group-sessions/${session.id}?from=reports`,
          sortTimestamp: sortTimestamp(session.date, session.time),
          rawDate: session.date,
          rawTime: session.time ?? null,
          facilitator: session.facilitator?.trim() || "-",
          location: session.location || "-",
          date: formatLongDate(session.date),
          time: formatSessionTime(session.time),
          members: attendanceReport?.expectedCount ?? sessionMembers.length,
          course: courseName,
          college: collegeById.get(session.collegeId)?.name || "-",
          academicYear: yearById.get(session.academicYearId)?.name || "-",
          yearLevel: yearLevelById.get(session.yearLevelId)?.name || "-",
          academicYearId: session.academicYearId,
          collegeId: session.collegeId,
          courseId,
          yearLevelId: session.yearLevelId,
        };
      });

    const sessionRows: ReportRow[] = cases
      .filter((item) => isCompletedStatus(item.status))
      .map((item) => {
      const student = userById.get(item.studentId);
      const { courseId, courseName } = courseNameForUser(student);
      const reason = item.reason?.trim() || item.notes?.trim() || "Counseling session";

      return {
        key: `session-${item.id}`,
        id: item.id,
        type: "Session",
        subject: fullName(student),
        topic: reason,
        detail: reason,
        status: item.status,
        viewHref: `/app/counseling/${item.id}?from=reports`,
        sortTimestamp: sortTimestamp(item.date, item.time),
        rawDate: item.date,
        rawTime: item.time ?? null,
        facilitator: fullName(student),
        location: reason,
        date: formatLongDate(item.date),
        time: formatSessionTime(item.time),
        members: 1,
        course: courseName,
        college: collegeById.get(item.collegeId)?.name || "-",
        academicYear: yearById.get(item.academicYearId)?.name || "-",
        yearLevel: yearLevelById.get(item.yearLevelId)?.name || "-",
        academicYearId: item.academicYearId,
        collegeId: item.collegeId,
        courseId,
        yearLevelId: item.yearLevelId,
      };
    });

    const referralRows: ReportRow[] = referrals
      .filter((referral) => isCompletedStatus(referral.status))
      .map((referral) => {
      const student = userById.get(referral.studentId);
      const referredBy = userById.get(referral.referredByUserId);
      const { courseId, courseName } = courseNameForUser(student);
      const detail = [
        referral.reason?.trim() || "Referral",
        referredBy ? `Referred by ${fullName(referredBy)}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      const reportDate = referral.referredDate ?? referral.createdAt;

      return {
        key: `referral-${referral.id}`,
        id: referral.id,
        type: "Referral",
        subject: fullName(student),
        topic: referral.reason?.trim() || "Referral",
        detail,
        status: referral.status,
        viewHref: `/app/referrals/${referral.id}?from=reports`,
        sortTimestamp: sortTimestamp(reportDate, referral.referredTime),
        rawDate: reportDate || "",
        rawTime: referral.referredTime ?? null,
        facilitator: fullName(student),
        location: detail,
        date: formatLongDate(reportDate),
        time: formatSessionTime(referral.referredTime),
        members: 1,
        course: courseName,
        college: collegeById.get(referral.collegeId)?.name || "-",
        academicYear: yearById.get(referral.academicYearId)?.name || "-",
        yearLevel: yearLevelById.get(referral.yearLevelId)?.name || "-",
        academicYearId: referral.academicYearId,
        collegeId: referral.collegeId,
        courseId,
        yearLevelId: referral.yearLevelId,
      };
    });

    return [...groupRows, ...sessionRows, ...referralRows].sort((a, b) => {
      const byDate = b.sortTimestamp - a.sortTimestamp;
      if (byDate !== 0) return byDate;
      return b.key.localeCompare(a.key);
    });
  }, [
    cases,
    collegeById,
    courseById,
    groupAttendanceReports,
    members,
    referrals,
    sessions,
    userById,
    yearById,
    yearLevelById,
  ]);

  const ensureGroupAttendanceReport = async (sessionId: number) => {
    const cached = groupAttendanceReports[sessionId];
    if (cached) return markGroupCounsellingReportPresent(cached);

    const response = await generateStudentCircleAttendanceReport(sessionId);
    const report = markGroupCounsellingReportPresent(response.report);
    setGroupAttendanceReports((current) => ({
      ...current,
      [sessionId]: report,
    }));
    return report;
  };

  const buildGroupAttendancePayload = (
    row: ReportRow,
    report: StudentCircleAttendanceReport,
  ) => {
    const session = sessionById.get(row.id);
    return {
      sessionId: row.id,
      topic: session?.topic?.trim() || row.topic || "Group Counselling",
      date: row.rawDate,
      time: row.rawTime,
      location: session?.location || row.location || "-",
      facilitator: session?.facilitator?.trim() || row.facilitator || "-",
      academicYearName: row.academicYear,
      collegeName: row.college,
      courseName: row.course,
      yearLevelName: row.yearLevel,
      expectedCount: report.expectedCount,
      presentCount: report.presentCount,
      absentCount: report.absentCount,
      extraSubmissionCount: report.extraSubmissionCount,
      rows: report.rows.map((item) => ({
        studentName: item.studentName,
        courseName: item.courseName,
        yearLevelName: item.yearLevelName,
        phoneNumber: item.phoneNumber,
        email: item.email,
        status: item.status,
        submittedAt: item.submittedAt ?? undefined,
        signatureData: item.signatureData ?? undefined,
        signatureSource: item.signatureSource ?? undefined,
      })),
    };
  };

  const makePayload = (rows: ReportDownloadRow[], title = "All Reports") => ({
    title,
    subtitle: "Group Counselling, Referrals, and Counseling Sessions",
    generatedAt: new Date().toISOString(),
    rows,
  });

  const openAllPdf = () => {
    openReportsPdfPrint(makePayload(reportRows));
  };

  const downloadAllWord = () => {
    downloadReportsWord(makePayload(reportRows));
  };

  const openRowPdf = async (row: ReportRow) => {
    if (row.type === "Group Counselling") {
      try {
        const report = await ensureGroupAttendanceReport(row.id);
        openStudentCircleAttendanceReportPrint(
          buildGroupAttendancePayload(row, report),
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to generate the group counselling attendance report.",
        );
      }
      return;
    }

    openReportsPdfPrint(makePayload([row], `${row.type} Report ${row.date}`));
  };

  const downloadRowWord = async (row: ReportRow) => {
    if (row.type === "Group Counselling") {
      try {
        const report = await ensureGroupAttendanceReport(row.id);
        downloadStudentCircleAttendanceReportWord(
          buildGroupAttendancePayload(row, report),
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to generate the group counselling attendance report.",
        );
      }
      return;
    }

    downloadReportsWord(makePayload([row], `${row.type} Report ${row.date}`));
  };

  const page: React.CSSProperties = {
    display: "grid",
    gap: 16,
  };

  const topBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };

  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 20,
    borderRadius: 18,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const headerIconButton: React.CSSProperties = {
    height: 48,
    width: 60,
    borderRadius: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "white",
    color: "#000000",
  };

  const iconButton: React.CSSProperties = {
    height: 50,
    width: 56,
    borderRadius: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "white",
    color: "#000000",
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 8px",
    opacity: 0.8,
    fontSize: 13.5,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };

  const td: React.CSSProperties = {
    padding: "8px 8px",
    borderTop: "1px solid var(--border)",
    verticalAlign: "middle",
    fontSize: 13.5,
    lineHeight: 1.35,
    color: "#0f172a",
  };

  return (
    <div style={page}>
      <div style={topBar}>
        <h2 style={{ fontWeight: 900, margin: 0, marginRight: "auto" }}>
          Reports
        </h2>

        <ReportIconButton
          title="Download all reports as PDF"
          onClick={openAllPdf}
          style={headerIconButton}
        >
          <FileDown size={22} />
        </ReportIconButton>
        <ReportIconButton
          title="Download all reports as Word"
          onClick={downloadAllWord}
          style={headerIconButton}
        >
          <FileText size={22} />
        </ReportIconButton>
        <ReportIconButton
          title="Refresh reports"
          onClick={refreshReports}
          style={headerIconButton}
        >
          {loading || groupReportsLoading ? <RefreshCw size={22} /> : <List size={22} />}
        </ReportIconButton>
      </div>

      <div style={card}>
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
            All Reports
          </h3>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 900,
              color: "#475569",
            }}
          >
            <CalendarDays size={16} />
            Total: {reportRows.length}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: 1080,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={th}>Type</th>
                <th style={th}>Name / Facilitator</th>
                <th style={th}>Details</th>
                <th style={th}>Date</th>
                <th style={th}>Time</th>
                <th style={th}>Status</th>
                <th style={th}>Course</th>
                <th style={th}>College / Year</th>
                <th style={{ ...th, width: 198 }}></th>
              </tr>
            </thead>
            <tbody>
              {reportRows.length === 0 ? (
                <tr>
                  <td style={td} colSpan={8}>
                    <span style={{ opacity: 0.78 }}>
                      {loading
                        ? "Loading reports..."
                        : groupReportsLoading
                          ? "Generating group counselling attendance reports..."
                        : "No reports found."}
                    </span>
                  </td>
                </tr>
              ) : (
                reportRows.map((row) => (
                  <tr key={row.key}>
                    <td style={td}>{row.type}</td>
                    <td style={td}>{row.subject}</td>
                    <td style={td}>{row.detail}</td>
                    <td style={td}>{row.date}</td>
                    <td style={td}>{row.time}</td>
                    <td style={td}>{row.status}</td>
                    <td style={td}>{row.course}</td>
                    <td style={td}>
                      <div>{row.college}</div>
                      <div style={{ opacity: 0.68, fontSize: 13.5, marginTop: 3 }}>
                        {row.academicYear} / {row.yearLevel}
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ReportIconButton
                          title="Download PDF"
                          onClick={() => openRowPdf(row)}
                          style={iconButton}
                        >
                          <FileDown size={20} />
                        </ReportIconButton>
                        <ReportIconButton
                          title="Download Word"
                          onClick={() => downloadRowWord(row)}
                          style={iconButton}
                        >
                          <FileText size={20} />
                        </ReportIconButton>
                        <ReportIconButton
                          title={`View ${row.type}`}
                          href={row.viewHref}
                          style={iconButton}
                        >
                          <Eye size={20} />
                        </ReportIconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
