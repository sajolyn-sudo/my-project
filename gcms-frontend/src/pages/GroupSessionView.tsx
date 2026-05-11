import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  GraduationCap,
  Layers3,
  Mail,
  MapPin,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
  Signature,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  fetchEntitiesBootstrap,
  getGroupSession,
  getStudentCircleAttendanceLink,
  listStudentCircleAttendance,
  removeGroupSessionMember,
  type StudentCircleAttendanceRecord,
} from "../lib/entitiesApi";
import {
  downloadStudentCircleAttendanceReportWord,
  openStudentCircleAttendanceReportPrint,
  type StudentCircleAttendanceReportPayload,
  type StudentCircleAttendanceReportRow,
} from "../lib/studentCircleAttendanceReportPrint";

type Role =
  | "ADMIN"
  | "STAFF"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

type UserEntity = {
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
  section?: string | null;
};

type College = { id: number; name: string };
type Course = { id: number; name: string; collegeId: number };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

type GroupSession = {
  id: number;
  academicYearId: number;
  collegeId: number;
  courseId?: number | null;
  yearLevelId: number;
  STAFFUserId: number;
  date: string;
  time?: string | null;
  location: string;
  topic: string;
  facilitatorUserId?: number | null;
  facilitator?: string;
  notes?: string;
  attachment?: string;
  createdAt: string;
};

type GroupSessionMember = {
  id: number;
  groupSessionId: number;
  studentUserId: number;
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const COURSES_KEY = "gcms_mock_courses_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const GS_KEY = "gcms_mock_group_sessions_v1";
const GSM_KEY = "gcms_mock_group_session_members_v1";
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)
  ?.toString()
  .trim()
  .replace(/\/+$/, "");

function getPublicAppOrigin(): string {
  if (PUBLIC_APP_URL) return PUBLIC_APP_URL;
  return typeof window !== "undefined" ? window.location.origin : "";
}

function buildStudentCircleAttendanceUrl(sessionId: number, token: string): string {
  const origin = getPublicAppOrigin();
  if (!origin || !token) return "";
  return `${origin}/student-circle-attendance/${sessionId}?t=${encodeURIComponent(token)}`;
}

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

function normalizeEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function fullNameOfUser(user?: {
  fname: string;
  mname?: string;
  lname: string;
}): string {
  if (!user) return "Unknown";
  return `${user.fname} ${user.mname ? `${user.mname} ` : ""}${user.lname}`.trim();
}

function toDateKey(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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

function detailActionStyle(
  base: React.CSSProperties,
  {
    active = false,
    hovered = false,
    keepBorder = false,
  }: { active?: boolean; hovered?: boolean; keepBorder?: boolean } = {},
): React.CSSProperties {
  return {
    ...base,
    border: keepBorder
      ? active
        ? "2px solid #5F6D7A"
        : "2px solid #000000"
      : active
        ? "1px solid #5F6D7A"
        : "1px solid var(--border)",
    background: active ? "#5F6D7A" : "white",
    color: active ? "white" : "#000000",
    boxShadow: "none",
    transform: active
      ? "translateY(1px) scale(0.98)"
      : hovered
        ? "translateY(-1px)"
        : "translateY(0)",
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
    textDecoration: "none",
    cursor: "pointer",
  };
}

type DetailActionButtonProps = {
  baseStyle: React.CSSProperties;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
};

function DetailActionButton({
  baseStyle,
  onClick,
  title,
  ariaLabel,
  children,
  type = "button",
}: DetailActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      style={detailActionStyle(baseStyle, {
        active: pressed,
        hovered,
      })}
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

type DetailActionLinkProps = {
  to: string;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  keepBorder?: boolean;
};

function DetailActionLink({
  to,
  title,
  ariaLabel,
  baseStyle,
  children,
  keepBorder = false,
}: DetailActionLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      title={title}
      aria-label={ariaLabel ?? title}
      style={detailActionStyle(baseStyle, {
        active: pressed,
        hovered,
        keepBorder,
      })}
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

export default function GroupSessionView() {
  const location = useLocation();
  const { id } = useParams();
  const sessionId = Number(id);

  const listHref = useMemo(
    () => {
      const params = new URLSearchParams(location.search);
      if (params.get("from") === "reports") return "/app/reports";
      if (params.get("from") === "counseling") {
        return "/app/counseling?tab=group-sessions";
      }
      return `/app/group-sessions${location.search || ""}`;
    },
    [location.search],
  );

  const [users, setUsers] = useState<UserEntity[]>(() =>
    load<UserEntity[]>(USERS_KEY, []),
  );
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

  const sessions = useMemo<GroupSession[]>(() => load<GroupSession[]>(GS_KEY, []), []);
  const [members, setMembers] = useState<GroupSessionMember[]>(() =>
    load<GroupSessionMember[]>(GSM_KEY, []),
  );
  const [found, setFound] = useState<GroupSession | undefined>(() =>
    sessions.find((s) => s.id === sessionId),
  );
  const [loaded, setLoaded] = useState(false);
  const [attendance, setAttendance] = useState<StudentCircleAttendanceRecord[]>(
    [],
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceToken, setAttendanceToken] = useState("");
  const [attendanceLinkLoading, setAttendanceLinkLoading] = useState(false);
  const [attendanceLinkError, setAttendanceLinkError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [membersOpen, setMembersOpen] = useState(true);

  useEffect(() => {
    let alive = true;

    fetchEntitiesBootstrap()
      .then((payload) => {
        if (!alive) return;

        const nextUsers = payload.users ?? [];
        const nextColleges = payload.colleges ?? [];
        const nextCourses = payload.courses ?? [];
        const nextYears = payload.academicYears ?? [];
        const nextYearLevels = payload.yearLevels ?? [];

        setUsers(nextUsers as UserEntity[]);
        setColleges(nextColleges);
        setCourses(nextCourses);
        setYears(nextYears);
        setYearLevels(nextYearLevels);

        save(USERS_KEY, nextUsers);
        save(COLLEGES_KEY, nextColleges);
        save(COURSES_KEY, nextCourses);
        save(YEARS_KEY, nextYears);
        save(YL_KEY, nextYearLevels);
      })
      .catch(() => {
        // Keep cached labels if bootstrap is unavailable.
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    let alive = true;

    getGroupSession(sessionId)
      .then((res) => {
        if (!alive) return;

        const item = res.item;
        const nextMembers = res.members ?? [];

        setFound(item);
        setMembers(nextMembers);
        save(GSM_KEY, nextMembers);

        const current = load<GroupSession[]>(GS_KEY, []);
        const idx = current.findIndex((s) => s.id === item.id);
        const nextSessions =
          idx === -1
            ? [item, ...current]
            : current.map((s) => (s.id === item.id ? item : s));
        save(GS_KEY, nextSessions);
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
  }, [sessionId]);

  const attendanceUrl = useMemo(() => {
    if (!found) return "";
    return buildStudentCircleAttendanceUrl(found.id, attendanceToken);
  }, [attendanceToken, found]);

  useEffect(() => {
    if (!found?.id) {
      setAttendanceToken("");
      setAttendanceLinkError("");
      return;
    }

    let alive = true;
    setAttendanceToken("");
    setAttendanceLinkError("");
    setAttendanceLinkLoading(true);

    getStudentCircleAttendanceLink(found.id)
      .then((res) => {
        if (!alive) return;
        setAttendanceToken(res.token || "");
        if (res.isOpen === false) {
          setAttendanceLinkError("Attendance link is currently closed.");
        }
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setAttendanceLinkError(
          error instanceof Error
            ? error.message
            : "Unable to prepare the attendance QR link.",
        );
      })
      .finally(() => {
        if (alive) setAttendanceLinkLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [found?.id]);

  useEffect(() => {
    if (!attendanceUrl) {
      setQrDataUrl("");
      return;
    }

    let alive = true;
    QRCode.toDataURL(attendanceUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 232,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((value) => {
        if (alive) setQrDataUrl(value);
      })
      .catch(() => {
        if (alive) setQrDataUrl("");
      });

    return () => {
      alive = false;
    };
  }, [attendanceUrl]);

  const refreshAttendance = () => {
    if (!found?.id) return;
    setAttendanceLoading(true);
    listStudentCircleAttendance(found.id)
      .then((res) => setAttendance(res.attendance ?? []))
      .catch(() => setAttendance([]))
      .finally(() => setAttendanceLoading(false));
  };

  useEffect(() => {
    refreshAttendance();
  }, [found?.id]);

  const labelCollege = (cid: number) =>
    colleges.find((c) => c.id === cid)?.name ?? "-";
  const labelCourse = (courseId?: number | null) =>
    courses.find((course) => course.id === courseId)?.name ?? "-";
  const labelAY = (ayid: number) => years.find((y) => y.id === ayid)?.name ?? "-";
  const labelYL = (ylid: number) =>
    yearLevels.find((y) => y.id === ylid)?.name ?? "-";

  const fmtDateTime = (value?: string | null) => {
    if (!value) return "-";
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const copyAttendanceLink = async () => {
    if (!attendanceUrl) return;
    try {
      await navigator.clipboard.writeText(attendanceUrl);
      alert("Attendance QR link copied.");
    } catch {
      window.prompt("Copy attendance link:", attendanceUrl);
    }
  };

  // ===== Call Slip Print Helpers =====
  const escapeHtml = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtLongDate = (yyyy_mm_dd: string) => {
    const parts = yyyy_mm_dd.split("-");
    if (parts.length !== 3) return yyyy_mm_dd;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return yyyy_mm_dd;
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[m - 1]} ${d}, ${y}`;
  };

  const fmtSessionTime = (value?: string | null) => {
    if (!value) return "-";
    const [hourPart, minutePart] = value.split(":");
    const hours = Number(hourPart);
    const minutes = Number(minutePart);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    const key = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    if (key === "09:00") return "9 AM - 11 AM";
    if (key === "13:00") return "1 PM - 3 PM";
    if (key === "15:00") return "3 PM - 5 PM";
    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
  };

  const openCallSlipPrint = (session: GroupSession) => {
    const sessionMembers = members
      .filter((m) => m.groupSessionId === session.id)
      .map((m) => users.find((u) => u.id === m.studentUserId))
      .filter(Boolean) as UserEntity[];

    const collegeName = labelCollege(session.collegeId);
    const ylName = labelYL(session.yearLevelId);
    const courseYear = `${collegeName} / ${ylName}`;

    const chunkSize = 10;
    const chunks: UserEntity[][] = [];
    for (let i = 0; i < sessionMembers.length; i += chunkSize) {
      chunks.push(sessionMembers.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) chunks.push([]);

    const dateIssued = fmtLongDate(new Date().toISOString().slice(0, 10));
    const scheduleTimeText = fmtSessionTime(session.time);
    const scheduleText = `${fmtLongDate(session.date)} - ${scheduleTimeText} (see STAFF)`;
    const reasonText = session.topic;

    const pages = chunks
      .map((chunk) => {
        const rows = chunk
          .map((s) => {
            const full = `${s.fname} ${s.mname ? `${s.mname} ` : ""}${s.lname}`;
            return `
              <tr>
                <td>${escapeHtml(full)}</td>
                <td style="text-align:center;">${escapeHtml(courseYear)}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="page">
            <div class="grid">
              <div class="card">
                <div class="header">
                  <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
                  <div class="office">Guidance and Counseling Services Center</div>
                </div>

                <div class="title">CALL SLIP - GUIDANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <b>${escapeHtml(dateIssued)}</b></div>
                </div>

                <div class="para">
                  Please see your guidance STAFF at the Guidance and Counseling Services Center on
                  <b>${escapeHtml(scheduleText)}</b>. This is in connection with
                  <b>${escapeHtml(reasonText)}</b>.
                  <br/>Please bring this paper with you upon your visit. See you!
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Student's Name</th>
                      <th style="text-align:center;">Course &amp; Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || `<tr><td colspan="2" style="opacity:.7">No members.</td></tr>`}
                  </tbody>
                </table>

                <div class="conf">CONFIDENTIAL</div>

                <div class="sig">
                  <div class="name">Guidance STAFF</div>
                </div>

                <div class="foot">
                  <div>GCMS • Call Slip</div>
                  <div>Page 1 of 2</div>
                </div>
              </div>

              <div class="card appearance">
                <div class="header">
                  <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
                  <div class="office">Guidance and Counseling Services Center</div>
                </div>

                <div class="title">CALL SLIP - GUIDANCE</div>
                <div class="subtitle">APPEARANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <span class="line"></span></div>
                </div>

                <div class="meta">
                  <div>Time Started: <span class="line"></span></div>
                  <div>Time Ended: <span class="line"></span></div>
                </div>

                <div class="para">
                  This is to certify that <span class="line" style="min-width:260px;"></span>
                  has visited the Guidance Office last <span class="line" style="min-width:140px;"></span>
                  per referral of <span class="line" style="min-width:180px;"></span>.
                </div>

                <div class="para" style="margin-top:14px;">Remarks:</div>
                <div class="ln"></div>
                <div class="ln"></div>
                <div class="ln"></div>

                <div class="sig" style="margin-top:24px;">
                  <div class="name">Name and Signature of Guidance STAFF</div>
                </div>

                <div class="foot">
                  <div>GCMS • Appearance</div>
                  <div>Page 2 of 2</div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Call Slip - Guidance</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 14px; color: #111; }
    .page { margin-bottom: 14px; page-break-after: always; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 2px solid #222; padding: 12px; border-radius: 6px; background: #fff; }
    .header { text-align: center; line-height: 1.2; }
    .uni { font-weight: 800; font-size: 12px; }
    .office { font-size: 11px; margin-top: 2px; }
    .title { text-align: center; font-weight: 900; margin: 10px 0 6px; }
    .subtitle { text-align: center; font-weight: 800; margin-top: 0; font-size: 12px; }
    .meta { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; margin: 8px 0; }
    .line { border-bottom: 1px solid #333; min-width: 140px; display: inline-block; height: 14px; vertical-align: baseline; }
    .para { font-size: 12px; line-height: 1.35; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 6px; font-size: 12px; }
    th { background: #f3f3f3; text-align: left; }
    .conf { font-size: 11px; font-weight: 800; margin-top: 10px; }
    .sig { margin-top: 16px; display: flex; justify-content: center; }
    .sig .name { border-top: 1px solid #111; padding-top: 6px; width: 80%; text-align: center; font-size: 12px; }
    .foot { font-size: 10px; margin-top: 6px; opacity: 0.85; display: flex; justify-content: space-between; }
    .appearance .ln { border-bottom: 1px solid #333; height: 18px; margin: 10px 0; }
    @media print {
      body { padding: 0; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  ${pages}
  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const sessionMembers = useMemo(
    () => (found ? members.filter((m) => m.groupSessionId === found.id) : []),
    [found, members],
  );
  const sessionMemberRows = sessionMembers.map((member) => {
    const user = users.find((item) => item.id === member.studentUserId);
    const fullName = fullNameOfUser(user);
    return {
      id: member.id,
      name: fullName,
      email: user?.email ?? "-",
    };
  });
  const forceAllMembersPresent = found
    ? isPastSchedule(found.date, found.time)
    : false;

  const attendanceReportRows = useMemo<
    (StudentCircleAttendanceReportRow & { key: string })[]
  >(() => {
    const byStudentId = new Map<number, StudentCircleAttendanceRecord>();
    const byEmail = new Map<string, StudentCircleAttendanceRecord>();

    for (const row of attendance) {
      if (row.studentUserId) byStudentId.set(row.studentUserId, row);
      const emailKey = normalizeEmail(row.email);
      if (emailKey) byEmail.set(emailKey, row);
    }

    const usedAttendanceIds = new Set<number>();
    const rows = sessionMembers
      .map((member) => {
        const user = users.find((item) => item.id === member.studentUserId);
        const matched =
          byStudentId.get(member.studentUserId) ??
          byEmail.get(normalizeEmail(user?.email));

        if (matched) usedAttendanceIds.add(matched.id);

        const userCourseName =
          user?.courseName ||
          (user?.courseId ? labelCourse(user.courseId) : "") ||
          (found?.courseId ? labelCourse(found.courseId) : "");
        const userYearLevelName =
          (user?.yearLevelId ? labelYL(user.yearLevelId) : "") ||
          (found?.yearLevelId ? labelYL(found.yearLevelId) : "");

        return {
          key: `member-${member.id}`,
          studentName: matched?.studentName || fullNameOfUser(user),
          courseName: matched?.courseName || userCourseName || "-",
          yearLevelName: matched?.yearLevelName || userYearLevelName || "-",
          phoneNumber: matched?.phoneNumber || "",
          email: matched?.email || user?.email || "",
          status: forceAllMembersPresent || matched ? "Present" : "Absent",
          submittedAt: matched?.submittedAt,
          signatureData: matched?.signatureData,
          signatureSource: matched?.signatureSource,
        } satisfies StudentCircleAttendanceReportRow & { key: string };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    const extraRows = attendance
      .filter((row) => !usedAttendanceIds.has(row.id))
      .map((row) => ({
        key: `attendance-${row.id}`,
        studentName: row.studentName,
        courseName: row.courseName || "-",
        yearLevelName: row.yearLevelName || "-",
        phoneNumber: row.phoneNumber || "",
        email: row.email || "",
        status: "Present (not in member list)",
        submittedAt: row.submittedAt,
        signatureData: row.signatureData,
        signatureSource: row.signatureSource,
      }) satisfies StudentCircleAttendanceReportRow & { key: string });

    return [...rows, ...extraRows];
  }, [
    attendance,
    found,
    forceAllMembersPresent,
    labelCourse,
    labelYL,
    sessionMembers,
    users,
  ]);

  const presentCount = attendanceReportRows.filter(
    (row) => row.status === "Present",
  ).length;
  const absentCount = attendanceReportRows.filter(
    (row) => row.status === "Absent",
  ).length;
  const extraSubmissionCount = attendanceReportRows.filter(
    (row) => row.status === "Present (not in member list)",
  ).length;

  const buildAttendanceReportPayload =
    (): StudentCircleAttendanceReportPayload | null => {
      if (!found) return null;
    const rows: StudentCircleAttendanceReportRow[] = attendanceReportRows.map(
      ({ key: _key, ...row }) => row,
    );

      return {
      sessionId: found.id,
      topic: found.topic || "Group Counselling",
      date: found.date,
      time: found.time,
      location: found.location,
      facilitator: found.facilitator,
      academicYearName: labelAY(found.academicYearId),
      collegeName: labelCollege(found.collegeId),
      courseName: labelCourse(found.courseId),
      yearLevelName: labelYL(found.yearLevelId),
      expectedCount: sessionMembers.length,
      presentCount,
      absentCount,
      extraSubmissionCount,
      rows,
      };
    };

  const openAttendanceReport = () => {
    const payload = buildAttendanceReportPayload();
    if (!payload) return;
    openStudentCircleAttendanceReportPrint(payload);
  };

  const downloadAttendanceReportWord = () => {
    const payload = buildAttendanceReportPayload();
    if (!payload) return;
    downloadStudentCircleAttendanceReportWord(payload);
  };

  const removeMember = async (memberId: number) => {
    if (!found) return;
    try {
      const res = await removeGroupSessionMember({
        memberId,
        sessionId: found.id,
      });
      const next = res.members ?? [];
      setMembers(next);
      save(GSM_KEY, next);
    } catch (e: any) {
      alert(e?.message || "Failed to remove member.");
    }
  };

  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 16,
    borderRadius: 16,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.75)",
    fontWeight: 500,
    fontSize: 13,
    lineHeight: 1.2,
  };

  const listTh: React.CSSProperties = {
    padding: "8px 8px",
    opacity: 0.8,
    fontSize: 13.5,
    fontWeight: 600,
    textAlign: "left",
  };

  const listTd: React.CSSProperties = {
    padding: "8px 8px",
    fontSize: 13.5,
    lineHeight: 1.35,
    fontWeight: 400,
  };

  const detailLine: React.CSSProperties = {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13.5,
    lineHeight: 1.35,
    fontWeight: 400,
  };

  const detailLabel: React.CSSProperties = {
    opacity: 0.8,
    fontWeight: 400,
  };

  const printButton: React.CSSProperties = {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 600,
    color: "var(--primary)",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const iconAction: React.CSSProperties = {
    height: 40,
    width: 40,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const dangerButton: React.CSSProperties = {
    height: 36,
    width: 36,
    borderRadius: 10,
    border: "1px solid rgba(220, 38, 38, 0.18)",
    background: "rgba(254, 242, 242, 0.95)",
    color: "#DC2626",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!found) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontWeight: 600, margin: 0 }}>Group Counselling Details</h2>
          <DetailActionLink
            to={listHref}
            title="Back to Group Counselling"
            ariaLabel="Back to Group Counselling"
            baseStyle={iconAction}
          >
            <ArrowLeft size={18} />
          </DetailActionLink>
        </div>
        <div style={card}>
          <div style={{ opacity: 0.8 }}>{loaded ? "Group Counselling not found." : "Loading Group Counselling..."}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 600, margin: 0, marginRight: "auto" }}>
          Group Counselling Details
        </h2>

        <DetailActionButton
          onClick={() => openCallSlipPrint(found)}
          title="Print Call Slip"
          ariaLabel="Print Call Slip"
          baseStyle={printButton}
        >
          <Printer size={18} />
          Print Call Slip
        </DetailActionButton>

        <DetailActionLink
          to={listHref}
          title="Back to Group Counselling"
          ariaLabel="Back to Group Counselling"
          baseStyle={iconAction}
        >
          <ArrowLeft size={18} />
        </DetailActionLink>
      </div>

      <div style={card}>
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={chip}>
            <CalendarDays size={14} />
            {fmtLongDate(found.date)} / {fmtSessionTime(found.time)}
          </span>
          <span style={chip}>
            <GraduationCap size={14} />
            {labelAY(found.academicYearId)}
          </span>
          <span style={chip}>
            <Building2 size={14} />
            {labelCollege(found.collegeId)}
          </span>
          <span style={chip}>
            <Layers3 size={14} />
            {labelYL(found.yearLevelId)}
          </span>
          <span style={chip}>
            <MapPin size={14} />
            {found.location}
          </span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <div style={detailLine}>
            <BookOpen size={15} />
            <span style={detailLabel}>Course:</span>
            <span>{labelCourse(found.courseId)}</span>
          </div>

          {found.facilitator?.trim() ? (
            <div style={detailLine}>
              <span style={detailLabel}>Facilitator:</span>
              <span>{found.facilitator}</span>
            </div>
          ) : null}

          {found.notes ? (
            <div style={detailLine}>
              <span style={detailLabel}>Notes:</span>
              <span>{found.notes}</span>
            </div>
          ) : null}

          <div style={{ ...listTd, padding: 0, opacity: 0.75 }}>
            Group Counselling ID: #{found.id} | Created: {found.createdAt}
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 16,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <QrCode size={18} />
              Attendance QR
            </h3>
            <div style={{ ...listTd, padding: 0, opacity: 0.78, marginBottom: 10 }}>
              Students scan this QR to submit their name, course, year level,
              phone number, email, and signature.
            </div>
            <input
              value={attendanceUrl}
              readOnly
              placeholder={
                attendanceLinkLoading
                  ? "Preparing secure attendance link..."
                  : "Secure attendance link unavailable"
              }
              style={{
                width: "100%",
                height: 38,
                borderRadius: 10,
                border: "1px solid var(--border)",
                padding: "0 10px",
                fontWeight: 400,
                color: "var(--primary)",
                background: "rgba(255,255,255,0.72)",
              }}
            />
            {attendanceLinkError ? (
              <div
                style={{
                  marginTop: 8,
                  color: "#991b1b",
                  fontWeight: 850,
                  fontSize: 13,
                }}
              >
                {attendanceLinkError}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <DetailActionButton
                onClick={copyAttendanceLink}
                title="Copy attendance QR link"
                ariaLabel="Copy attendance QR link"
                baseStyle={printButton}
              >
                <Copy size={16} />
                Copy Link
              </DetailActionButton>
              <a
                href={attendanceUrl || undefined}
                target="_blank"
                rel="noreferrer"
                title="Open attendance form"
                aria-label="Open attendance form"
                onClick={(event) => {
                  if (!attendanceUrl) event.preventDefault();
                }}
                style={{
                  ...printButton,
                  textDecoration: "none",
                  opacity: attendanceUrl ? 1 : 0.62,
                  pointerEvents: attendanceUrl ? "auto" : "none",
                }}
              >
                <ExternalLink size={16} />
                Open Form
              </a>
            </div>
          </div>

          <div
            style={{
              width: 248,
              minHeight: 248,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              display: "grid",
              placeItems: "center",
              padding: 8,
              justifySelf: "end",
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Group Counselling attendance QR code"
                style={{ width: 232, height: 232 }}
              />
            ) : (
              <QrCode size={52} style={{ opacity: 0.46 }} />
            )}
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <h3
            style={{
              margin: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Signature size={18} />
            Attendance Report
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={openAttendanceReport}
              disabled={attendanceLoading || attendanceReportRows.length === 0}
              style={{
                ...printButton,
                height: 36,
                opacity:
                  attendanceLoading || attendanceReportRows.length === 0 ? 0.7 : 1,
              }}
            >
              <FileDown size={15} />
              Download PDF
            </button>
            <button
              type="button"
              onClick={downloadAttendanceReportWord}
              disabled={attendanceLoading || attendanceReportRows.length === 0}
              style={{
                ...printButton,
                height: 36,
                opacity:
                  attendanceLoading || attendanceReportRows.length === 0 ? 0.7 : 1,
              }}
            >
              <FileText size={15} />
              Download Word
            </button>
            <button
              type="button"
              onClick={refreshAttendance}
              disabled={attendanceLoading}
              style={{
                ...printButton,
                height: 36,
                opacity: attendanceLoading ? 0.7 : 1,
              }}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        {attendanceLoading ? (
          <div style={{ opacity: 0.8 }}>Loading attendance report...</div>
        ) : attendanceReportRows.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            No students or attendance submissions were found for this Group Counselling session.
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.65)",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 1120,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.04)" }}>
                  <th style={{ ...listTh, width: 52, textAlign: "center" }}>
                    #
                  </th>
                  <th style={listTh}>
                    Student
                  </th>
                  <th style={listTh}>
                    Course / Year Level
                  </th>
                  <th style={listTh}>
                    Phone
                  </th>
                  <th style={listTh}>
                    Email
                  </th>
                  <th style={listTh}>
                    Status
                  </th>
                  <th style={listTh}>
                    Submitted
                  </th>
                  <th style={listTh}>
                    Signature
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceReportRows.map((row, idx) => (
                  <tr key={row.key}>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        textAlign: "center",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      {row.studentName}
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      <div>{row.courseName || "-"}</div>
                      <div style={{ opacity: 0.72, fontSize: 12 }}>
                        {row.yearLevelName || "-"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Phone size={13} />
                        {row.phoneNumber || "-"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        wordBreak: "break-word",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Mail size={13} />
                        {row.email || "-"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 86,
                          padding: "7px 10px",
                          borderRadius: 999,
                          border:
                            row.status === "Absent"
                              ? "1px solid rgba(220,38,38,0.24)"
                              : "1px solid rgba(22,163,74,0.24)",
                          background:
                            row.status === "Absent"
                              ? "rgba(254,226,226,0.95)"
                              : "rgba(220,252,231,0.95)",
                          color:
                            row.status === "Absent" ? "#991b1b" : "#166534",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      {fmtDateTime(row.submittedAt)}
                    </td>
                    <td
                      style={{
                        ...listTd,
                        borderTop: "1px solid var(--border)",
                        background:
                          row.status === "Absent"
                            ? "rgba(254,242,242,0.78)"
                            : undefined,
                      }}
                    >
                      {row.signatureData ? (
                        <a
                          href={row.signatureData}
                          target="_blank"
                          rel="noreferrer"
                          title="Open signature image"
                          style={{
                            display: "inline-grid",
                            gap: 4,
                            color: "var(--primary)",
                            textDecoration: "none",
                          }}
                        >
                          <img
                            src={row.signatureData}
                            alt={`${row.studentName} signature`}
                            style={{
                              width: 110,
                              height: 44,
                              objectFit: "contain",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "white",
                            }}
                          />
                          {String(row.signatureSource || "").toLowerCase()}
                        </a>
                      ) : (
                        <span style={{ opacity: 0.65 }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ ...listTd, padding: 0, marginTop: 12, opacity: 0.82 }}>
          Expected: {sessionMembers.length} | Present: {presentCount} | Absent:{" "}
          {absentCount} | QR Submissions: {attendance.length}
          {extraSubmissionCount > 0
            ? ` | Not in member list: ${extraSubmissionCount}`
            : ""}
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 600 }}>
            Members ({sessionMembers.length})
          </h3>
          <button
            type="button"
            onClick={() => setMembersOpen((open) => !open)}
            aria-expanded={membersOpen}
            style={{ ...printButton, height: 36 }}
          >
            {membersOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {membersOpen ? "Hide Members" : "Show Members"}
          </button>
        </div>

        {!membersOpen ? null : sessionMembers.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No members for this session.</div>
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.65)",
              padding: 12,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {sessionMemberRows.map((member) => (
                <div
                  key={member.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "white",
                    padding: 10,
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...listTd, padding: 0 }}>{member.name}</div>
                    <div
                      style={{
                        ...listTd,
                        padding: 0,
                        opacity: 0.78,
                        wordBreak: "break-word",
                      }}
                    >
                      {member.email}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(member.id)}
                    style={dangerButton}
                    title="Remove member"
                    aria-label="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...listTd, padding: 0, marginTop: 12, opacity: 0.82 }}>
          Total Members: {sessionMembers.length}
        </div>
      </div>
    </div>
  );
}
