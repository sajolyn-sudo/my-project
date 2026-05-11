import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  History,
  List,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import Modal from "../components/Modal";
import DropdownSelect from "../components/DropdownSelect";
import FormattedDateInput from "../components/FormattedDateInput";
import { createGroupSession, fetchEntitiesBootstrap, listGroupSessions } from "../lib/entitiesApi";
import { matchesSearchPrefix } from "../lib/searchPrefix";
import { useAuthStore } from "../store/authStore";
import { postJSON } from "../lib/api";
import { canCreateGroupCounselling } from "../lib/staffPermissions";

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
  section?: string | null;
  isArchived?: boolean;
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
  createdAt: string;
};

type GroupSessionMember = {
  id: number;
  groupSessionId: number;
  studentUserId: number;
};

const YEAR_LEVEL_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
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

function toDateKey(value?: string): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSortTimestamp(
  primaryDate?: string | null,
  time?: string | null,
  fallbackDate?: string | null,
): number {
  const candidates = [primaryDate, fallbackDate];

  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parsed = new Date(`${raw}T${String(time || "00:00").trim() || "00:00"}:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  return 0;
}

function compareNewestGroupSessions(a: GroupSession, b: GroupSession): number {
  const bySchedule =
    parseSortTimestamp(b.date, b.time, b.createdAt) -
    parseSortTimestamp(a.date, a.time, a.createdAt);
  if (bySchedule !== 0) return bySchedule;

  const byCreatedAt =
    parseSortTimestamp(b.createdAt, b.time, b.date) -
    parseSortTimestamp(a.createdAt, a.time, a.date);
  if (byCreatedAt !== 0) return byCreatedAt;

  return b.id - a.id;
}

function studentCircleActionStyle(
  base: React.CSSProperties,
  {
    active = false,
    hovered = false,
    disabled = false,
    keepBorder = false,
  }: {
    active?: boolean;
    hovered?: boolean;
    disabled?: boolean;
    keepBorder?: boolean;
  } = {},
): React.CSSProperties {
  const isInteractive = !disabled;
  const isActive = active && isInteractive;

  return {
    ...base,
    border: keepBorder
      ? isActive
        ? "2px solid #5F6D7A"
        : "2px solid #000000"
      : isActive
        ? "1px solid #5F6D7A"
        : "1px solid var(--border)",
    background: isActive ? "#5F6D7A" : "white",
    color: isActive ? "white" : "#000000",
    boxShadow: "none",
    transform: isActive
      ? "translateY(1px) scale(0.98)"
      : hovered && isInteractive
        ? "translateY(-1px)"
        : "translateY(0)",
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
  };
}

type StudentCircleActionButtonProps = {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  keepBorder?: boolean;
};

function StudentCircleActionButton({
  active = false,
  disabled = false,
  onClick,
  title,
  ariaLabel,
  baseStyle,
  children,
  type = "button",
  keepBorder = false,
}: StudentCircleActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      style={studentCircleActionStyle(baseStyle, {
        active: active || pressed,
        hovered,
        disabled,
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
    </button>
  );
}

type StudentCircleActionLinkProps = {
  to: string;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  keepBorder?: boolean;
};

function StudentCircleActionLink({
  to,
  title,
  ariaLabel,
  baseStyle,
  children,
  keepBorder = false,
}: StudentCircleActionLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      title={title}
      aria-label={ariaLabel ?? title}
      style={studentCircleActionStyle(baseStyle, {
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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatSessionTimeLabel(value?: string | null): string {
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
}

type GroupSessionsProps = {
  embedded?: boolean;
};

export default function GroupSessions({ embedded = false }: GroupSessionsProps = {}) {
  const currentUser = useAuthStore((s) => s.user);
  const canCreateGroupCounsellingSession =
    canCreateGroupCounselling(currentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>(() => load<User[]>(USERS_KEY, []));
  const [colleges, setColleges] = useState<College[]>(() =>
    load<College[]>(COLLEGES_KEY, []),
  );
  const [years, setYears] = useState<AcademicYear[]>(() =>
    load<AcademicYear[]>(YEARS_KEY, [
      { id: 1, name: "2024â€“2025", isActive: false },
      { id: 2, name: "2025â€“2026", isActive: true },
    ]),
  );
  const [yearLevels, setYearLevels] = useState<YearLevel[]>(() =>
    load<YearLevel[]>(YL_KEY, []),
  );

  useEffect(() => {
    let alive = true;
    fetchEntitiesBootstrap()
      .then((payload) => {
        if (!alive) return;

        const nextUsers = payload.users ?? [];
        const nextColleges = payload.colleges ?? [];
        const nextYears = payload.academicYears ?? [];
        const nextYearLevels = payload.yearLevels ?? [];

        if (nextUsers.length) {
          setUsers(nextUsers as User[]);
          save(USERS_KEY, nextUsers);
        }
        if (nextColleges.length) {
          setColleges(nextColleges);
          save(COLLEGES_KEY, nextColleges);
        }
        if (nextYears.length) {
          setYears(nextYears);
          save(YEARS_KEY, nextYears);
        }
        if (nextYearLevels.length) {
          setYearLevels(nextYearLevels);
          save(YL_KEY, nextYearLevels);
        }
      })
      .catch(() => {
        // Keep cached values when bootstrap is unavailable.
      });

    return () => {
      alive = false;
    };
  }, []);

  const STAFFs = useMemo(
    () => users.filter((u) => u.role === "STAFF"),
    [users],
  );
  const students = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "STUDENT" &&
          !(u as User & { isArchived?: boolean }).isArchived,
      ),
    [users],
  );

  const activeAyId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const selectedAyId = activeAyId;
  const [courses, setCourses] = useState<Course[]>([]);
  const [filterCollegeId, setFilterCollegeId] = useState<number>(() => {
    if (embedded) return 0;
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
    embedded ? 0 : parsePositiveInt(searchParams.get("courseId")),
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

  const filteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          (filterCollegeId ? yl.collegeId === filterCollegeId : true),
      ),
    [yearLevels, selectedAyId, filterCollegeId],
  );

  const [filterYearLevelId, setFilterYearLevelId] = useState<number>(() =>
    embedded ? 0 : parsePositiveInt(searchParams.get("yearLevelId")),
  );
  const [filterDate, setFilterDate] = useState<string>(() =>
    embedded ? "" : String(searchParams.get("date") || "").trim(),
  );
  const [showHistory, setShowHistory] = useState<boolean>(() => {
    if (embedded) return false;
    return searchParams.get("tab") === "history";
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showDateCalendar, setShowDateCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const seed = embedded ? "" : String(searchParams.get("date") || "").trim();
    return startOfMonth(seed ? new Date(seed) : new Date());
  });

  useEffect(() => {
    if (filteredYearLevels.length === 0) {
      if (filterYearLevelId !== 0) setFilterYearLevelId(0);
      return;
    }
    const exists = filteredYearLevels.some((yl) => yl.id === filterYearLevelId);
    if (!exists && filterYearLevelId !== 0) setFilterYearLevelId(0);
  }, [filteredYearLevels, filterYearLevelId]);

  useEffect(() => {
    if (embedded) return;
    const next = new URLSearchParams();
    if (filterCollegeId) next.set("collegeId", String(filterCollegeId));
    if (filterCourseId) next.set("courseId", String(filterCourseId));
    if (filterYearLevelId) next.set("yearLevelId", String(filterYearLevelId));
    if (filterDate) next.set("date", filterDate);
    if (showHistory) next.set("tab", "history");
    setSearchParams(next, { replace: true });
  }, [
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    filterDate,
    showHistory,
    embedded,
    setSearchParams,
  ]);

  const [sessions, setSessions] = useState<GroupSession[]>(() =>
    load<GroupSession[]>(GS_KEY, []),
  );
  const [members, setMembers] = useState<GroupSessionMember[]>(() =>
    load<GroupSessionMember[]>(GSM_KEY, []),
  );

  useEffect(() => {
    let alive = true;
    listGroupSessions()
      .then((res) => {
        if (!alive) return;
        const nextSessions = res.sessions ?? [];
        const nextMembers = res.members ?? [];
        setSessions(nextSessions);
        setMembers(nextMembers);
        save(GS_KEY, nextSessions);
        save(GSM_KEY, nextMembers);
      })
      .catch(() => {
        // Keep cached data when API is unreachable.
      });
    return () => {
      alive = false;
    };
  }, []);

  const visibleSessions = useMemo(() => {
    return sessions
      .filter((s) => s.academicYearId === selectedAyId)
      .filter((s) => (filterCollegeId ? s.collegeId === filterCollegeId : true))
      .filter((s) => (filterCourseId ? sessionCourseId(s) === filterCourseId : true))
      .filter((s) =>
        filterYearLevelId ? s.yearLevelId === filterYearLevelId : true,
      )
      .filter((s) => (filterDate ? s.date === filterDate : true))
      .sort(compareNewestGroupSessions);
  }, [sessions, selectedAyId, filterCollegeId, filterCourseId, filterYearLevelId, filterDate, members, users]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const calendarBaseSessions = useMemo(() => {
    return sessions
      .filter((s) => s.academicYearId === selectedAyId)
      .filter((s) => (filterCollegeId ? s.collegeId === filterCollegeId : true))
      .filter((s) => (filterCourseId ? sessionCourseId(s) === filterCourseId : true))
      .filter((s) =>
        filterYearLevelId ? s.yearLevelId === filterYearLevelId : true,
      )
      .sort(compareNewestGroupSessions);
  }, [sessions, selectedAyId, filterCollegeId, filterCourseId, filterYearLevelId, members, users]);
  const activeSessions = useMemo(
    () => visibleSessions.filter((s) => s.date >= todayIso),
    [visibleSessions, todayIso],
  );
  const historySessions = useMemo(
    () => visibleSessions.filter((s) => s.date < todayIso),
    [visibleSessions, todayIso],
  );
  const calendarDisplaySessions = useMemo(
    () =>
      showHistory
        ? calendarBaseSessions.filter((s) => s.date < todayIso)
        : calendarBaseSessions.filter((s) => s.date >= todayIso),
    [calendarBaseSessions, showHistory, todayIso],
  );
  const displaySessions = showHistory ? historySessions : activeSessions;

  const labelUserName = (id: number) => {
    const u = users.find((x) => x.id === id);
    if (!u) return "Unknown";
    return `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`.trim();
  };
  const labelCollege = (id: number) =>
    colleges.find((c) => c.id === id)?.name ?? "â€”";
  const labelCourse = (id: number) =>
    courses.find((c) => c.id === id)?.name ?? "â€”";
  const labelAy = (id: number) => years.find((y) => y.id === id)?.name ?? "â€”";
  const labelYL = (id: number) =>
    yearLevels.find((y) => y.id === id)?.name ?? "â€”";

  function sessionCourseId(session: GroupSession): number {
    const explicit = Number(session.courseId ?? 0);
    if (explicit > 0) return explicit;
    const firstMember = members.find((m) => m.groupSessionId === session.id);
    if (!firstMember) return 0;
    const student = users.find((u) => u.id === firstMember.studentUserId);
    return student ? userCourseId(student) : 0;
  }

  const memberCount = (sessionId: number) =>
    members.filter((m) => m.groupSessionId === sessionId).length;

  const filterQuery = useMemo(() => {
    if (embedded) return "?from=counseling";
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams, embedded]);
  const scheduleDateKeys = useMemo(
    () =>
      new Set(
        calendarDisplaySessions
          .map((session) => toDateKey(session.date))
          .filter(Boolean),
      ),
    [calendarDisplaySessions],
  );
  const scheduleTimesByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    calendarDisplaySessions.forEach((session) => {
      const key = toDateKey(session.date);
      if (!key || !session.time) return;
      const label = formatSessionTimeLabel(session.time);
      const current = map.get(key) ?? [];
      if (!current.includes(label)) current.push(label);
      map.set(key, current);
    });
    return map;
  }, [calendarDisplaySessions]);
  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + index);
      const key = toDateKey(cellDate.toISOString());
      const times = scheduleTimesByDate.get(key) ?? [];
      return {
        key,
        label: cellDate.getDate(),
        isCurrentMonth: sameMonth(cellDate, calendarMonth),
        hasSchedule: scheduleDateKeys.has(key),
        isSelected: filterDate === key,
        isToday: toDateKey(new Date().toISOString()) === key,
        tooltip:
          times.length > 0
            ? `${key}\n${times.join("\n")}`
            : key,
      };
    });
  }, [calendarMonth, filterDate, scheduleDateKeys, scheduleTimesByDate]);

  // ===== Create Session Modal State =====
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showModalFilters, setShowModalFilters] = useState(false);
  const [modalCollegeId, setModalCollegeId] = useState<number>(0);
  const modalFilteredCourses = useMemo(
    () =>
      modalCollegeId
        ? courses.filter((c) => c.collegeId === modalCollegeId)
        : courses,
    [courses, modalCollegeId],
  );
  const [modalCourseId, setModalCourseId] = useState<number>(0);
  const modalFilteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          (modalCollegeId ? yl.collegeId === modalCollegeId : true),
      ),
    [yearLevels, selectedAyId, modalCollegeId],
  );
  const [modalYearLevelId, setModalYearLevelId] = useState<number>(0);
  const canPickCourse = modalCollegeId > 0;
  const canPickYearLevel = canPickCourse && modalCourseId > 0;
  const canShowMembers = canPickYearLevel;
  const [studentSearch, setStudentSearch] = useState("");
  const facilitatorUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.role === "STAFF" || u.role === "STUDENT") && !u.isArchived,
      ),
    [users],
  );
  const [showFacilitatorPicker, setShowFacilitatorPicker] = useState(false);
  const [showFacilitatorFilters, setShowFacilitatorFilters] = useState(false);
  const [facilitatorSearch, setFacilitatorSearch] = useState("");
  const [facilitatorRoleFilter, setFacilitatorRoleFilter] = useState<
    "ALL" | "STAFF" | "STUDENT"
  >("ALL");
  const [facilitatorCollegeId, setFacilitatorCollegeId] = useState<number>(0);
  const facilitatorFilteredCourses = useMemo(
    () =>
      facilitatorCollegeId
        ? courses.filter((c) => c.collegeId === facilitatorCollegeId)
        : courses,
    [courses, facilitatorCollegeId],
  );
  const [facilitatorCourseId, setFacilitatorCourseId] = useState<number>(0);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();

    return students.filter((s) => {
      const sid = userCourseId(s);
      const matchesCourse = !modalCourseId || sid === 0 || sid === modalCourseId;
      const matchesSearch =
        !keyword ||
        matchesSearchPrefix(keyword, labelUserName(s.id), s.email ?? "", labelCourse(sid));
      return (
        (modalCollegeId ? s.collegeId === modalCollegeId : true) &&
        (modalYearLevelId ? s.yearLevelId === modalYearLevelId : true) &&
        matchesCourse &&
        matchesSearch
      );
    });
  }, [students, modalCollegeId, modalYearLevelId, modalCourseId, studentSearch]);

  const [STAFFUserId, setSTAFFUserId] = useState<number>(STAFFs[0]?.id ?? 0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [facilitatorUserId, setFacilitatorUserId] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  useEffect(() => {
    if (!modalCollegeId) {
      if (modalCourseId !== 0) setModalCourseId(0);
      if (modalYearLevelId !== 0) setModalYearLevelId(0);
    }
  }, [modalCollegeId, modalCourseId, modalYearLevelId]);

  useEffect(() => {
    if (!modalCourseId) {
      if (modalYearLevelId !== 0) setModalYearLevelId(0);
    }
  }, [modalCourseId, modalYearLevelId]);

  useEffect(() => {
    if (modalCourseId && !modalFilteredCourses.some((c) => c.id === modalCourseId)) {
      setModalCourseId(0);
    }
  }, [modalCourseId, modalFilteredCourses]);

  useEffect(() => {
    if (
      facilitatorCourseId &&
      !facilitatorFilteredCourses.some((c) => c.id === facilitatorCourseId)
    ) {
      setFacilitatorCourseId(0);
    }
  }, [facilitatorCourseId, facilitatorFilteredCourses]);

  useEffect(() => {
    if (modalYearLevelId && !modalFilteredYearLevels.some((yl) => yl.id === modalYearLevelId)) {
      setModalYearLevelId(0);
    }
  }, [modalYearLevelId, modalFilteredYearLevels]);

  useEffect(() => {
    setSelectedStudentIds([]);
  }, [modalCollegeId, modalCourseId, modalYearLevelId, selectedAyId]);

  useEffect(() => {
    const currentUserIsStaff =
      currentUser?.role === "STAFF" && Number(currentUser?.id ?? 0) > 0;
    const fallbackStaffId = STAFFs[0]?.id ?? 0;

    if (currentUserIsStaff) {
      setSTAFFUserId(Number(currentUser?.id ?? 0));
      return;
    }

    const hasSelectedStaff = STAFFs.some((entry) => entry.id === STAFFUserId);
    if (!hasSelectedStaff && fallbackStaffId) {
      setSTAFFUserId(fallbackStaffId);
    }
  }, [currentUser?.id, currentUser?.role, STAFFUserId, STAFFs]);

  useEffect(() => {
    if (!facilitatorUserId && STAFFUserId > 0) {
      setFacilitatorUserId(STAFFUserId);
    }
  }, [facilitatorUserId, STAFFUserId]);

  useEffect(() => {
    if (
      facilitatorUserId > 0 &&
      !facilitatorUsers.some((entry) => entry.id === facilitatorUserId)
    ) {
      setFacilitatorUserId(0);
    }
  }, [facilitatorUserId, facilitatorUsers]);

  // ===== Refs for auto-scroll / focus =====
  const STAFFRef = useRef<HTMLSelectElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const dateCalendarWrapRef = useRef<HTMLDivElement | null>(null);
  const facilitatorRef = useRef<HTMLInputElement | null>(null);
  const facilitatorControlRef = useRef<HTMLDivElement | null>(null);
  const locationRef = useRef<HTMLInputElement | null>(null);
  const membersRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showFacilitatorPicker) return;
    const handle = window.setTimeout(() => facilitatorRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [showFacilitatorPicker]);

  useEffect(() => {
    if (!showFacilitatorPicker && !showFacilitatorFilters) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        facilitatorControlRef.current &&
        target instanceof Node &&
        facilitatorControlRef.current.contains(target)
      ) {
        return;
      }
      setShowFacilitatorPicker(false);
      setShowFacilitatorFilters(false);
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [showFacilitatorFilters, showFacilitatorPicker]);

  const selectedFacilitator = useMemo(
    () => facilitatorUsers.find((entry) => entry.id === facilitatorUserId) ?? null,
    [facilitatorUserId, facilitatorUsers],
  );
  const selectedFacilitatorLabel = selectedFacilitator
    ? labelUserName(selectedFacilitator.id)
    : "";
  const facilitatorKeyword = facilitatorSearch.trim().toLowerCase();
  const appliedFacilitatorKeyword =
    showFacilitatorPicker &&
    facilitatorKeyword !== selectedFacilitatorLabel.trim().toLowerCase()
      ? facilitatorKeyword
      : "";

  useEffect(() => {
    if (!showFacilitatorPicker) {
      setFacilitatorSearch(selectedFacilitatorLabel);
    }
  }, [selectedFacilitatorLabel, showFacilitatorPicker]);

  const facilitatorOptions = useMemo(() => {
    return facilitatorUsers
      .filter((entry) =>
        facilitatorRoleFilter === "ALL" ? true : entry.role === facilitatorRoleFilter,
      )
      .filter((entry) =>
        facilitatorCollegeId ? Number(entry.collegeId ?? 0) === facilitatorCollegeId : true,
      )
      .filter((entry) =>
        facilitatorCourseId ? userCourseId(entry) === facilitatorCourseId : true,
      )
      .filter((entry) => {
        return matchesSearchPrefix(
          appliedFacilitatorKeyword,
          labelUserName(entry.id),
        );
      })
      .sort((a, b) => {
        const nameA = labelUserName(a.id).toLowerCase();
        const nameB = labelUserName(b.id).toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [
    facilitatorCollegeId,
    facilitatorCourseId,
    facilitatorRoleFilter,
    appliedFacilitatorKeyword,
    facilitatorUsers,
  ]);

  const toggleStudent = (id: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const filteredStudentIds = useMemo(
    () => filteredStudents.map((s) => s.id),
    [filteredStudents],
  );
  const hasStudentSearch = studentSearch.trim().length > 0;
  const shouldShowStudentResults = canShowMembers || hasStudentSearch;
  const allFilteredSelected =
    filteredStudentIds.length > 0 &&
    filteredStudentIds.every((id) => selectedStudentIds.includes(id));

  const handleSelectAllStudents = () => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      for (const id of filteredStudentIds) next.add(id);
      return Array.from(next);
    });
  };

  const handleClearFilteredStudents = () => {
    setSelectedStudentIds((prev) =>
      prev.filter((id) => !filteredStudentIds.includes(id)),
    );
  };

  // âœ… Live validation
  const missing: string[] = [];
  if (!STAFFUserId) missing.push("STAFF");
  if (!modalCollegeId) missing.push("College");
  if (!modalCourseId) missing.push("Course");
  if (!modalYearLevelId) missing.push("Year Level");
  if (!facilitatorUserId) missing.push("Facilitator");
  if (!date) missing.push("Date");
  if (!time) missing.push("Time");
  if (!location.trim()) missing.push("Location");
  if (selectedStudentIds.length === 0) missing.push("At least 1 Student");
  const canCreate = canCreateGroupCounsellingSession && missing.length === 0;

  const focusAndScroll = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in el) (el as any).focus();
  };

  const scrollToFirstMissing = () => {
    if (!STAFFUserId) return focusAndScroll(STAFFRef.current);
    if (!modalCollegeId || !modalCourseId || !modalYearLevelId)
      return focusAndScroll(membersRef.current);
    if (!facilitatorUserId) return focusAndScroll(facilitatorRef.current);
    if (!date) return focusAndScroll(dateRef.current);
    if (!time) return focusAndScroll(timeRef.current);
    if (!location.trim()) return focusAndScroll(locationRef.current);
    if (selectedStudentIds.length === 0)
      return focusAndScroll(membersRef.current);
  };

  const handleCreate = async () => {
    // safety
    if (!canCreateGroupCounsellingSession) {
      setOpen(false);
      return;
    }
    if (!canCreate || creating) return;

    try {
      setCreating(true);
      const minLoadingDelay = new Promise<void>((resolve) =>
        window.setTimeout(resolve, 1200),
      );
      const res = await createGroupSession({
        academicYearId: selectedAyId,
        collegeId: modalCollegeId,
        courseId: modalCourseId,
        yearLevelId: modalYearLevelId,
        STAFFUserId,
        date,
        time,
        location: location.trim(),
        topic: labelYL(modalYearLevelId),
        facilitatorUserId,
        facilitator: selectedFacilitatorLabel,
        notes: notes.trim() ? notes.trim() : undefined,
        studentIds: selectedStudentIds,
      });
      await minLoadingDelay;

      const nextSessions = res.sessions ?? [];
      const nextMembers = res.members ?? [];
      setSessions(nextSessions);
      setMembers(nextMembers);
      save(GS_KEY, nextSessions);
      save(GSM_KEY, nextMembers);

      // reset
      setDate("");
      setTime("");
      setLocation("");
      setFacilitatorUserId(STAFFUserId > 0 ? STAFFUserId : 0);
      setFacilitatorSearch("");
      setFacilitatorRoleFilter("ALL");
      setFacilitatorCollegeId(0);
      setFacilitatorCourseId(0);
      setNotes("");
      setStudentSearch("");
      setSelectedStudentIds([]);
      setOpen(false);
      setShowModalFilters(false);
      setShowFacilitatorPicker(false);
      setShowFacilitatorFilters(false);
    } catch (e: any) {
      alert(e?.message || "Failed to create Group Counselling.");
    } finally {
      setCreating(false);
    }
  };

  const closeCreateModal = () => {
    if (creating) return;
    setOpen(false);
    setShowModalFilters(false);
    setShowFacilitatorPicker(false);
    setShowFacilitatorFilters(false);
    setFacilitatorSearch("");
    setFacilitatorRoleFilter("ALL");
    setFacilitatorCollegeId(0);
    setFacilitatorCourseId(0);
    setStudentSearch("");
  };

  // ===== Call Slip Print =====
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

  const openCallSlipPrint = (session: GroupSession) => {
    const sessionMembers = members
      .filter((m) => m.groupSessionId === session.id)
      .map((m) => users.find((u) => u.id === m.studentUserId))
      .filter(Boolean) as User[];

    const collegeName = labelCollege(session.collegeId);
    const ylName = labelYL(session.yearLevelId);
    const courseYear = `${collegeName} / ${ylName}`;

    const chunkSize = 10;
    const chunks: User[][] = [];
    for (let i = 0; i < sessionMembers.length; i += chunkSize) {
      chunks.push(sessionMembers.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) chunks.push([]);

    const dateIssued = fmtLongDate(new Date().toISOString().slice(0, 10));
    const scheduleTimeText = formatSessionTimeLabel(session.time);
    const scheduleText = `${fmtLongDate(session.date)} - ${scheduleTimeText}`;
    const reasonText = "group counselling";

    const pages = chunks
      .map((chunk) => {
        const rows = chunk
          .map((s) => {
            const full = `${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`;
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
                  Please see your guidance counselor at the Guidance and Counseling Services Center on
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
                  <div class="name">Guidance Counselor</div>
                </div>

                <div class="foot">
                  <div>GCMS - Call Slip</div>
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

                <div class="para" style="margin-top:14px;">
                  Remarks:
                </div>
                <div class="ln"></div>
                <div class="ln"></div>
                <div class="ln"></div>

                <div class="sig" style="margin-top:24px;">
                  <div class="name">Name and Signature of Guidance Counselor</div>
                </div>

                <div class="foot">
                  <div>GCMS - Appearance</div>
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

  // ===== Styles =====
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
  const facilitatorControlRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "start",
  };
  const facilitatorTriggerWrap: React.CSSProperties = {
    position: "relative",
  };
  const facilitatorTriggerButton: React.CSSProperties = {
    ...inputStyle,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "text",
    fontWeight: 700,
  };
  const facilitatorInlineInput: React.CSSProperties = {
    border: "none",
    outline: "none",
    width: "100%",
    minWidth: 0,
    background: "transparent",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 16,
  };
  const facilitatorToggleButton: React.CSSProperties = {
    border: "none",
    background: "transparent",
    color: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    flexShrink: 0,
  };
  const facilitatorSearchRow: React.CSSProperties = {
    ...inputStyle,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 12px",
  };
  const facilitatorSearchInput: React.CSSProperties = {
    border: "none",
    outline: "none",
    width: "100%",
    minWidth: 0,
    background: "transparent",
    color: "var(--text)",
    fontSize: 14,
  };
  const facilitatorDropdownPanel: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: "calc(100% + 10px)",
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "white",
    boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
    padding: 12,
    zIndex: 30,
    display: "grid",
    gap: 10,
  };
  const facilitatorOptionsList: React.CSSProperties = {
    maxHeight: 240,
    overflowY: "auto",
    display: "grid",
    gap: 8,
  };
  const facilitatorOptionButton: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "white",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    cursor: "pointer",
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
  const buttonContent: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  const headerIconButton: React.CSSProperties = {
    height: 48,
    width: 48,
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const compactFilterPanel: React.CSSProperties = {
    position: "absolute",
    right: 0,
    top: "calc(100% + 10px)",
    width: "min(340px, calc(100vw - 120px))",
    padding: 12,
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "white",
    boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
    display: "grid",
    gap: 10,
    zIndex: 20,
  };

  const compactField: React.CSSProperties = {
    display: "grid",
    gap: 5,
  };

  const compactLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.78,
  };

  const compactClearButton: React.CSSProperties = {
    height: 34,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    color: "#000000",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 12.5,
    cursor: "pointer",
  };
  const modalFilterButton: React.CSSProperties = {
    ...headerIconButton,
    height: 40,
    width: 40,
    borderRadius: 12,
  };
  const modalCompactFilterPanel: React.CSSProperties = {
    ...compactFilterPanel,
    right: "calc(100% + 10px)",
    top: "auto",
    bottom: 0,
    width: "min(300px, calc(100vw - 220px))",
  };

  const iconButton: React.CSSProperties = {
    height: 40,
    width: 44,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    opacity: 0.85,
  };
  const modalBody: React.CSSProperties = {
    position: "relative",
  };
  const createOverlay: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    pointerEvents: "none",
  };
  const createCard: React.CSSProperties = {
    minWidth: 320,
    maxWidth: 400,
    padding: "34px 28px",
    borderRadius: 28,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(95,109,122,0.18)",
    boxShadow: "0 28px 64px rgba(15,23,42,0.16)",
    display: "grid",
    justifyItems: "center",
    gap: 16,
    textAlign: "center",
  };
  const createIconWrap: React.CSSProperties = {
    position: "relative",
    width: 168,
    height: 168,
    display: "grid",
    placeItems: "center",
  };
  const createSpinnerRing: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(from 0deg, rgba(9,14,25,0.96) 0deg, rgba(9,14,25,0.96) 90deg, rgba(251,191,36,1) 90deg, rgba(245,158,11,1) 250deg, rgba(9,14,25,0.22) 320deg, rgba(9,14,25,0.08) 360deg)",
    animation: "gcms-spin 0.95s linear infinite",
    boxShadow: "0 14px 30px rgba(245,158,11,0.22)",
  };
  const createSpinnerHole: React.CSSProperties = {
    position: "absolute",
    inset: 16,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.98)",
  };
  const createIconCore: React.CSSProperties = {
    position: "absolute",
    inset: 34,
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, rgba(251,191,36,1) 0%, rgba(245,158,11,1) 100%)",
    border: "1px solid rgba(251,191,36,0.35)",
    color: "rgba(9,14,25,1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 18px 32px rgba(245,158,11,0.22)",
  };
  const createTitle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    color: "rgba(9,14,25,1)",
    lineHeight: 1.15,
  };
  const createSubtitle: React.CSSProperties = {
    fontSize: 14,
    color: "#526371",
    lineHeight: 1.5,
    maxWidth: 290,
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 8px",
    opacity: 0.8,
    fontSize: 13,
  };
  const td: React.CSSProperties = {
    padding: "8px 8px",
    borderTop: "1px solid var(--border)",
    fontSize: 13,
    lineHeight: 1.35,
  };

  useEffect(() => {
    if (!showDateCalendar) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dateCalendarWrapRef.current) return;
      if (dateCalendarWrapRef.current.contains(event.target as Node)) return;
      setShowDateCalendar(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showDateCalendar]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: embedded ? "flex-end" : undefined,
          flexWrap: "wrap",
        }}
      >
        {!embedded && (
          <h2 style={{ fontWeight: 800, marginRight: "auto" }}>
            Group Counselling
          </h2>
        )}

        {canCreateGroupCounsellingSession && (
          <StudentCircleActionButton
            onClick={() => {
              setShowFacilitatorPicker(false);
              setShowFacilitatorFilters(false);
              setFacilitatorSearch("");
              setFacilitatorRoleFilter("ALL");
              setFacilitatorCollegeId(0);
              setFacilitatorCourseId(0);
              setStudentSearch("");
              setOpen(true);
            }}
            active={open}
            baseStyle={headerIconButton}
            title="Create Group Counselling"
            ariaLabel="Create Group Counselling"
          >
            <Plus size={22} />
          </StudentCircleActionButton>
        )}
        <StudentCircleActionButton
          onClick={() => setShowHistory((v) => !v)}
          active={showHistory}
          baseStyle={headerIconButton}
          title={showHistory ? "Show active Group Counselling sessions" : "Show Group Counselling history"}
          ariaLabel={showHistory ? "Show active Group Counselling sessions" : "Show Group Counselling history"}
        >
          {showHistory ? <List size={22} /> : <History size={22} />}
        </StudentCircleActionButton>
      </div>

      {/* List */}
      <div style={card}>
        <div
          style={{
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ marginBottom: 0, marginRight: "auto" }}>
            Group Counselling
          </h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div ref={dateCalendarWrapRef} style={{ position: "relative" }}>
              <StudentCircleActionButton
                type="button"
                onClick={() => setShowDateCalendar((prev) => !prev)}
                active={Boolean(filterDate || showDateCalendar)}
                baseStyle={headerIconButton}
                title="Filter by date"
                ariaLabel="Filter by date"
              >
                <CalendarDays size={22} />
              </StudentCircleActionButton>

              {showDateCalendar && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 10px)",
                    width: 290,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "white",
                    boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
                    zIndex: 20,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                      style={{
                        ...iconButton,
                        width: 34,
                        height: 34,
                      }}
                      aria-label="Previous month"
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
                    </button>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>
                      {calendarMonth.toLocaleDateString(undefined, {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                      style={{
                        ...iconButton,
                        width: 34,
                        height: 34,
                      }}
                      aria-label="Next month"
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>›</span>
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 6,
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 6,
                    }}
                  >
                    {calendarCells.map((cell) => (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => {
                          setFilterDate(cell.key);
                          setCalendarMonth(startOfMonth(new Date(cell.key)));
                          setShowDateCalendar(false);
                        }}
                        title={cell.tooltip}
                        style={{
                          minHeight: 40,
                          borderRadius: 12,
                          border: cell.isSelected
                            ? "1px solid #5F6D7A"
                            : cell.isToday
                              ? "1px solid rgba(34,197,94,0.35)"
                              : "1px solid rgba(15,23,42,0.08)",
                          background: cell.isSelected
                            ? "#5F6D7A"
                            : cell.isCurrentMonth
                              ? "white"
                              : "rgba(226,232,240,0.38)",
                          color: cell.isSelected
                            ? "white"
                            : cell.isCurrentMonth
                              ? "#0f172a"
                              : "#94a3b8",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          padding: "6px 4px",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                        aria-label={`Filter ${cell.key}`}
                      >
                        <span>{cell.label}</span>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: cell.hasSchedule ? "#22c55e" : "transparent",
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDate("");
                        setShowDateCalendar(false);
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#2563eb",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Clear
                    </button>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#475569",
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: "#22c55e",
                        }}
                      />
                      Has schedule
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <StudentCircleActionButton
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                active={showFilters}
                baseStyle={headerIconButton}
                title={showFilters ? "Hide filters" : "Show filters"}
                ariaLabel={showFilters ? "Hide filters" : "Show filters"}
              >
                <List size={22} />
              </StudentCircleActionButton>

              {showFilters && (
                <div style={compactFilterPanel}>
                  <div style={compactField}>
                    <div style={compactLabel}>College</div>
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

                  <div style={compactField}>
                    <div style={compactLabel}>Course</div>
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

                  <div style={compactField}>
                    <div style={compactLabel}>Year Level</div>
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

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                    <StudentCircleActionButton
                      type="button"
                      onClick={() => {
                        setFilterCollegeId(0);
                        setFilterCourseId(0);
                        setFilterYearLevelId(0);
                        setShowFilters(false);
                      }}
                      baseStyle={compactClearButton}
                      title="Clear filters"
                      ariaLabel="Clear filters"
                    >
                      <X size={14} />
                      Clear
                    </StudentCircleActionButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Facilitator</th>
              <th style={th}>Location</th>
              <th style={th}>Date</th>
              <th style={th}>Time</th>
              <th style={th}>Members</th>
              <th style={th}>Course</th>
              <th style={th}>College / Year</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {displaySessions.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>
                  <span style={{ opacity: 0.8 }}>
                    {showHistory
                      ? "No past Group Counselling sessions found for this filter."
                      : "No active Group Counselling sessions found for this filter."}
                  </span>
                </td>
              </tr>
            ) : (
              displaySessions.map((s) => (
                <tr key={s.id}>
                  <td style={td}>{s.facilitator?.trim() || "-"}</td>
                  <td style={td}>{s.location || "-"}</td>
                  <td style={td}>{fmtLongDate(s.date)}</td>
                  <td style={td}>{formatSessionTimeLabel(s.time)}</td>
                  <td style={td}>
                    <b>{memberCount(s.id)}</b>
                  </td>
                  <td style={td}>{labelCourse(sessionCourseId(s))}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>
                      {labelCollege(s.collegeId)}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      {labelAy(s.academicYearId)} / {labelYL(s.yearLevelId)}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <StudentCircleActionButton
                        baseStyle={iconButton}
                        title="Print Call Slip"
                        onClick={() => openCallSlipPrint(s)}
                        keepBorder
                      >
                        <Printer size={18} />
                      </StudentCircleActionButton>
                      <StudentCircleActionLink
                        to={`/app/group-sessions/${s.id}${filterQuery}`}
                        title="View Group Counselling"
                        ariaLabel="View Group Counselling"
                        baseStyle={iconButton}
                        keepBorder
                      >
                        <Eye size={18} />
                      </StudentCircleActionLink>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal
        open={open && canCreateGroupCounsellingSession}
        onClose={creating ? () => {} : closeCreateModal}
        title="Create Group Counselling"
      >
        <div style={modalBody}>
          {creating && (
            <div style={createOverlay}>
              <div style={createCard}>
                <div style={createIconWrap}>
                  <div style={createSpinnerRing} />
                  <div style={createSpinnerHole} />
                  <div style={createIconCore}>
                    <Users size={52} />
                  </div>
                </div>
                <div style={createTitle}>Creating Group Counselling...</div>
                <div style={createSubtitle}>
                  Please wait while we prepare the group counselling session.
                </div>
              </div>
            </div>
          )}
          <div
            style={{
              display: "grid",
              gap: 12,
              opacity: creating ? 0.12 : 1,
              pointerEvents: creating ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
          {/* ðŸ”´ Live validation reminder */}
          {!canCreate && (
            <div
              style={{
                border: "1px solid rgba(217,83,79,0.35)",
                background: "rgba(217,83,79,0.10)",
                color: "#b42318",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <AlertTriangle size={16} />
              <div>Reminder: complete {missing.join(", ")}.</div>
            </div>
          )}

          <div>
            <div style={label}>STAFF</div>
            <DropdownSelect
              ref={STAFFRef}
              value={STAFFUserId}
              onChange={(e) => setSTAFFUserId(Number(e.target.value))}
              style={{
                ...inputStyle,
                background: "white",
                color: "var(--text)",
              }}
            >
              <option value={0}>Select staff</option>
              {STAFFs.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {labelUserName(staff.id)}
                </option>
              ))}
            </DropdownSelect>
          </div>

          <div>
            <div style={label}>Facilitator</div>
            <div ref={facilitatorControlRef} style={facilitatorControlRow}>
              <div style={facilitatorTriggerWrap}>
                <div
                  style={facilitatorTriggerButton}
                  onClick={() => {
                    setShowFacilitatorPicker(true);
                    facilitatorRef.current?.focus();
                    facilitatorRef.current?.select();
                  }}
                >
                  <input
                    ref={facilitatorRef}
                    value={facilitatorSearch}
                    onFocus={(e) => {
                      setShowFacilitatorPicker(true);
                      e.currentTarget.select();
                    }}
                    onChange={(e) => {
                      setFacilitatorSearch(e.target.value);
                      setShowFacilitatorPicker(true);
                    }}
                    placeholder="Search facilitator"
                    style={facilitatorInlineInput}
                    title="Search facilitator"
                  />
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowFacilitatorPicker((prev) => !prev);
                      if (!showFacilitatorPicker) {
                        facilitatorRef.current?.focus();
                        facilitatorRef.current?.select();
                      }
                    }}
                    aria-label={
                      showFacilitatorPicker
                        ? "Hide facilitator options"
                        : "Show facilitator options"
                    }
                    aria-expanded={showFacilitatorPicker}
                    style={facilitatorToggleButton}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {showFacilitatorPicker && (
                  <div style={facilitatorDropdownPanel}>
                    <div style={facilitatorOptionsList}>
                      {facilitatorOptions.length === 0 ? (
                        <div
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: "12px 14px",
                            fontSize: 13,
                            opacity: 0.76,
                          }}
                        >
                          No matching facilitator found.
                        </div>
                      ) : (
                        facilitatorOptions.map((entry) => {
                          const isSelected = facilitatorUserId === entry.id;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => {
                                setFacilitatorUserId(entry.id);
                                setShowFacilitatorPicker(false);
                              }}
                              style={{
                                ...facilitatorOptionButton,
                                border: isSelected
                                  ? "1px solid rgba(31,78,95,0.38)"
                                  : facilitatorOptionButton.border,
                                background: isSelected
                                  ? "rgba(31,78,95,0.06)"
                                  : "white",
                              }}
                            >
                              <span style={{ fontWeight: 900 }}>
                                {labelUserName(entry.id)}
                              </span>
                              {isSelected ? <Check size={16} /> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ position: "relative" }}>
                <StudentCircleActionButton
                  onClick={() => setShowFacilitatorFilters((value) => !value)}
                  active={showFacilitatorFilters}
                  title={
                    showFacilitatorFilters
                      ? "Hide facilitator filters"
                      : "Show facilitator filters"
                  }
                  ariaLabel={
                    showFacilitatorFilters
                      ? "Hide facilitator filters"
                      : "Show facilitator filters"
                  }
                  baseStyle={modalFilterButton}
                >
                  <SlidersHorizontal size={18} />
                </StudentCircleActionButton>

                {showFacilitatorFilters && (
                  <div style={modalCompactFilterPanel}>
                    <div style={compactField}>
                      <div style={compactLabel}>Type</div>
                      <DropdownSelect
                        value={facilitatorRoleFilter}
                        onChange={(e) =>
                          setFacilitatorRoleFilter(
                            e.target.value as "ALL" | "STAFF" | "STUDENT",
                          )
                        }
                      >
                        <option value="ALL">All users</option>
                        <option value="STAFF">Staff</option>
                        <option value="STUDENT">Student</option>
                      </DropdownSelect>
                    </div>

                    <div style={compactField}>
                      <div style={compactLabel}>College</div>
                      <DropdownSelect
                        value={facilitatorCollegeId}
                        onChange={(e) =>
                          setFacilitatorCollegeId(Number(e.target.value))
                        }
                      >
                        <option value={0}>All colleges</option>
                        {colleges.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </DropdownSelect>
                    </div>

                    <div style={compactField}>
                      <div style={compactLabel}>Course</div>
                      <DropdownSelect
                        value={facilitatorCourseId}
                        onChange={(e) =>
                          setFacilitatorCourseId(Number(e.target.value))
                        }
                        disabled={!facilitatorCollegeId}
                      >
                        <option value={0}>
                          {facilitatorCollegeId ? "All courses" : "Select college first"}
                        </option>
                        {facilitatorFilteredCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </DropdownSelect>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <StudentCircleActionButton
                        onClick={() => {
                          setFacilitatorRoleFilter("ALL");
                          setFacilitatorCollegeId(0);
                          setFacilitatorCourseId(0);
                          setShowFacilitatorFilters(false);
                        }}
                        title="Clear facilitator filters"
                        ariaLabel="Clear facilitator filters"
                        baseStyle={compactClearButton}
                      >
                        <X size={14} />
                        Clear
                      </StudentCircleActionButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <div>
              <div style={label}>Date</div>
              <FormattedDateInput
                ref={dateRef}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                displayStyle={inputStyle}
              />
            </div>

            <div>
              <div style={label}>Time</div>
              <input
                ref={timeRef}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={label}>Location</div>
              <input
                ref={locationRef}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Guidance Office"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <div style={label}>Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr)",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div style={label}>Student</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 320px) auto",
                  alignItems: "center",
                  gap: 10,
                  marginLeft: "auto",
                  width: "100%",
                  maxWidth: 380,
                  justifySelf: "end",
                }}
              >
                <div
                  style={{
                    ...facilitatorSearchRow,
                    width: "100%",
                  }}
                >
                  <Search size={16} style={{ opacity: 0.66 }} />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search student name, email, or course"
                    style={facilitatorSearchInput}
                  />
                </div>

                <div style={{ position: "relative", flexShrink: 0 }}>
                  <StudentCircleActionButton
                    onClick={() => setShowModalFilters((value) => !value)}
                    active={showModalFilters}
                    title={showModalFilters ? "Hide student filters" : "Show student filters"}
                    ariaLabel={showModalFilters ? "Hide student filters" : "Show student filters"}
                    baseStyle={modalFilterButton}
                  >
                    <List size={18} />
                  </StudentCircleActionButton>

                  {showModalFilters && (
                    <div style={modalCompactFilterPanel}>
                      <div style={compactField}>
                        <div style={compactLabel}>College</div>
                        <DropdownSelect
                          value={modalCollegeId}
                          onChange={(e) => setModalCollegeId(Number(e.target.value))}
                        >
                          <option value={0}>Select college</option>
                          {colleges.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </DropdownSelect>
                      </div>

                      <div style={compactField}>
                        <div style={compactLabel}>Course</div>
                        <DropdownSelect
                          value={modalCourseId}
                          onChange={(e) => setModalCourseId(Number(e.target.value))}
                          disabled={!canPickCourse}
                        >
                          <option value={0}>
                            {!canPickCourse
                              ? "Select college first"
                              : modalFilteredCourses.length
                                ? "Select course"
                                : "No courses found"}
                          </option>
                          {modalFilteredCourses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </DropdownSelect>
                      </div>

                      <div style={compactField}>
                        <div style={compactLabel}>Year Level</div>
                        <DropdownSelect
                          value={modalYearLevelId}
                          onChange={(e) => setModalYearLevelId(Number(e.target.value))}
                          disabled={!canPickYearLevel}
                        >
                          <option value={0}>
                            {canPickYearLevel ? "Select year level" : "Select course first"}
                          </option>
                          {YEAR_LEVEL_OPTIONS.map((name) => {
                            const item = modalFilteredYearLevels.find((yl) => yl.name === name);
                            if (!item) return null;
                            return (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            );
                          })}
                        </DropdownSelect>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <StudentCircleActionButton
                          onClick={() => {
                            setModalCollegeId(0);
                            setModalCourseId(0);
                            setModalYearLevelId(0);
                            setShowModalFilters(false);
                          }}
                          title="Clear student filters"
                          ariaLabel="Clear student filters"
                          baseStyle={compactClearButton}
                        >
                          <X size={14} />
                          Clear
                        </StudentCircleActionButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!shouldShowStudentResults ? (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  opacity: 0.8,
                }}
              >
                Select College, Course, and Year Level to load students.
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    {hasStudentSearch
                      ? "Showing student search results."
                      : "Students filtered by College + Course + Year Level."}
                    {" "}
                    Call slips auto-split every 10 students.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleSelectAllStudents}
                      disabled={filteredStudentIds.length === 0 || allFilteredSelected}
                      style={{
                        ...ghostButton,
                        height: 34,
                        padding: "0 12px",
                        opacity:
                          filteredStudentIds.length === 0 || allFilteredSelected ? 0.6 : 1,
                      }}
                      title="Select all filtered students"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFilteredStudents}
                      disabled={!filteredStudentIds.some((id) => selectedStudentIds.includes(id))}
                      style={{
                        ...ghostButton,
                        height: 34,
                        padding: "0 12px",
                        opacity:
                          !filteredStudentIds.some((id) => selectedStudentIds.includes(id))
                            ? 0.6
                            : 1,
                      }}
                      title="Clear filtered students"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div
                  ref={membersRef}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "10px 10px 96px",
                    maxHeight: 220,
                    overflow: "auto",
                    background: "rgba(255,255,255,0.6)",
                    scrollPaddingBottom: 96,
                  }}
                >
                  {filteredStudents.length === 0 ? (
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {hasStudentSearch
                        ? "No students matched your search."
                        : "No students found in this filter. Add students in User Management."}
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const checked = selectedStudentIds.includes(s.id);
                      const full = `${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`;
                      return (
                        <label
                          key={s.id}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                            padding: "6px 4px",
                          }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStudent(s.id)}
                            />
                          <span style={{ fontWeight: 800 }}>{full}</span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.7)",
                    fontSize: 13,
                    fontWeight: 900,
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    width: "fit-content",
                  }}
                >
                  Selected Students:{" "}
                  <span style={{ fontSize: 14 }}>{selectedStudentIds.length}</span>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              position: "sticky",
              bottom: 0,
              paddingTop: 12,
              background: "transparent",
              zIndex: 1,
            }}
          >
            <button onClick={closeCreateModal} style={ghostButton} disabled={creating}>
              Cancel
            </button>

            <button
              onClick={() => {
                if (!canCreate) {
                  scrollToFirstMissing();
                  return;
                }
                handleCreate();
              }}
              style={{
                ...primaryButton,
                opacity: canCreate && !creating ? 1 : 0.75,
              }}
              disabled={creating}
              title={
                !canCreate ? `Missing: ${missing.join(", ")}` : "Create session"
              }
            >
              <span style={buttonContent}>
                <span>{creating ? "Creating..." : "Create"}</span>
              </span>
            </button>
          </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

