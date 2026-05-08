import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Eye, FileText, History as HistoryIcon, List, Plus, Search, X } from "lucide-react";
import Modal from "../components/Modal";
import DropdownSelect from "../components/DropdownSelect";
import FormattedDateInput from "../components/FormattedDateInput";
import SuccessNoticeModal from "../components/SuccessNoticeModal";
import { useAuthStore } from "../store/authStore";
import {
  createReferral,
  listReferralReasonOptions,
  listReferrals,
  updateReferral,
} from "../lib/entitiesApi";
import { postJSON } from "../lib/api";
import { matchesSearchPrefix } from "../lib/searchPrefix";
import {
  normalizeSentenceCaseName,
  toSentenceCaseNameInput,
} from "../lib/nameCase";
import {
  buildReferralReasonPayload,
  DEFAULT_REFERRAL_REASON_OPTIONS,
  mergeReferralReasonOptions,
  OTHER_REFERRAL_REASON_LABEL,
} from "../lib/referralReasons";
import { canApproveSystemReferrals } from "../lib/referralApproval";
import { referralStatusLabel } from "../lib/referralStatus";

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
  courseId?: number;
  section?: string;
};

type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

type Referral = {
  id: number;
  studentId: number;
  referredByUserId: number; // STAFF/admin
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;

  referredDate?: string | null; // scheduled date after approval
  referredTime?: string | null;
  reason: string; // ERD: reason (stored as comma-separated text)
  notes?: string;
  status: "Pending" | "Approved" | "Complete";
  createdAt: string;
};

type Course = {
  id: number;
  name: string;
  collegeId: number;
  collegeName?: string;
};
type CoursesResponse = { ok: boolean; courses?: Course[] };

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const REF_KEY = "gcms_mock_referrals_v1";

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

function toDateKey(value?: string | null): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function compareNewestReferrals(a: Referral, b: Referral): number {
  const byCreatedAt =
    parseSortTimestamp(b.createdAt, b.referredTime, b.referredDate) -
    parseSortTimestamp(a.createdAt, a.referredTime, a.referredDate);
  if (byCreatedAt !== 0) return byCreatedAt;

  const bySchedule =
    parseSortTimestamp(b.referredDate, b.referredTime, b.createdAt) -
    parseSortTimestamp(a.referredDate, a.referredTime, a.createdAt);
  if (bySchedule !== 0) return bySchedule;

  return b.id - a.id;
}

/** âœ… Helpers for clean list rendering */
function splitReasons(reasonText: string) {
  return reasonText
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function referralActionStyle(
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

type ReferralActionButtonProps = {
  baseStyle: React.CSSProperties;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
};

function ReferralActionButton({
  baseStyle,
  onClick,
  title,
  ariaLabel,
  active = false,
  disabled = false,
  children,
  type = "button",
}: ReferralActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      style={referralActionStyle(baseStyle, {
        active: active || pressed,
        hovered,
        disabled,
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

type ReferralActionLinkProps = {
  to: string;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  keepBorder?: boolean;
};

function ReferralActionLink({
  to,
  title,
  ariaLabel,
  baseStyle,
  children,
  keepBorder = false,
}: ReferralActionLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      title={title}
      aria-label={ariaLabel ?? title}
      style={referralActionStyle(baseStyle, {
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

function formatDateShort(iso?: string | null) {
  if (!iso) return "â€”";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatTimeShort(value?: string | null) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function fullNameOfUser(u?: { fname: string; mname?: string; lname: string }) {
  if (!u) return "Unknown";
  return `${u.fname} ${u.mname ? `${u.mname} ` : ""}${u.lname}`.trim();
}

function extractLabeledValue(text: string | undefined, label: string): string {
  const source = String(text || "");
  const chunks = source
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
  const found = chunks.find((line) =>
    line.toLowerCase().startsWith(`${label.toLowerCase()}:`),
  );
  if (!found) return "";
  return found.slice(found.indexOf(":") + 1).trim();
}

function userCourseId(u: User): number {
  const raw = (u as User & { courseId?: unknown; course_id?: unknown }).courseId ??
    (u as User & { courseId?: unknown; course_id?: unknown }).course_id ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function userSection(u: User): string {
  const raw =
    (u as User & { sectionName?: unknown; section_name?: unknown }).section ??
    (u as User & { sectionName?: unknown; section_name?: unknown }).sectionName ??
    (u as User & { sectionName?: unknown; section_name?: unknown }).section_name ??
    "";
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeReferralStatus(status: unknown): Referral["status"] {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "approved" ||
    normalized === "ongoing" ||
    normalized === "reviewed"
  ) {
    return "Approved";
  }
  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "resolved"
  ) {
    return "Complete";
  }

  return "Pending";
}

function normalizeReferral(item: {
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate?: string | null;
  referredTime?: string | null;
  reason: string;
  notes?: string;
  status: unknown;
  createdAt: string;
}): Referral {
  return {
    ...item,
    status: normalizeReferralStatus(item.status),
  };
}

function normalizeReferrals(items: Array<{
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate?: string | null;
  referredTime?: string | null;
  reason: string;
  notes?: string;
  status: unknown;
  createdAt: string;
}>): Referral[] {
  return items.map(normalizeReferral);
}

function applyReferralPatch(
  items: Referral[],
  id: number,
  patch: Partial<Referral>,
): Referral[] {
  return items.map((item) =>
    item.id === id ? normalizeReferral({ ...item, ...patch }) : item,
  );
}

function mergeReferralRecords(apiItems: Referral[], cachedItems: Referral[]): Referral[] {
  const cachedById = new Map(cachedItems.map((item) => [item.id, item]));

  return apiItems.map((item) => {
    const cached = cachedById.get(item.id);
    if (!cached) return item;

    return normalizeReferral({
      ...item,
      status: cached.status ?? item.status,
      referredDate: item.referredDate ?? cached.referredDate ?? null,
      referredTime: cached.referredTime ?? item.referredTime,
      notes: cached.notes ?? item.notes,
    });
  });
}

function getReferralScheduleDateTime(referral: {
  referredDate?: string | null;
  referredTime?: string | null;
}) {
  const datePart = String(referral.referredDate || "").trim();
  const timePart = String(referral.referredTime || "").trim();
  if (!datePart || !timePart) return null;

  const parsed = new Date(`${datePart}T${timePart}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function hasReferralReachedScheduledSession(referral: {
  referredDate?: string | null;
  referredTime?: string | null;
}) {
  const schedule = getReferralScheduleDateTime(referral);
  if (!schedule) return false;
  return schedule.getTime() <= Date.now();
}

function isReferralOverdue(referral: {
  referredDate?: string | null;
  referredTime?: string | null;
  status: Referral["status"];
}) {
  return (
    referral.status !== "Complete" &&
    hasReferralReachedScheduledSession(referral)
  );
}
type ReferralsProps = {
  embedded?: boolean;
  onReferralsChange?: (items: Referral[]) => void;
};

export default function Referrals({
  embedded = false,
  onReferralsChange,
}: ReferralsProps = {}) {
  const authUser = useAuthStore((s) => s.user);
  const canApproveReferrals = canApproveSystemReferrals(authUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const isTeacherPortal =
    authUser?.role === "TEACHER" ||
    authUser?.role === "NON_TEACHING_PERSONNEL";
  const users = useMemo<User[]>(() => {
    const base = load<User[]>(USERS_KEY, []);
    if (!authUser) return base;

    const authAsUser: User = {
      id: authUser.id,
      fname: authUser.fname,
      lname: authUser.lname,
      email: authUser.email,
      role: authUser.role,
    };

    const idx = base.findIndex((u) => u.id === authAsUser.id);
    if (idx === -1) return [authAsUser, ...base];

    const copy = [...base];
    copy[idx] = { ...copy[idx], ...authAsUser };
    return copy;
  }, [authUser]);
  const colleges = useMemo<College[]>(
    () => load<College[]>(COLLEGES_KEY, []),
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
  const yearLevels = useMemo<YearLevel[]>(
    () => load<YearLevel[]>(YL_KEY, []),
    [],
  );

  const students = useMemo(
    () =>
      users.filter(
        (u) =>
          u.role === "STUDENT" &&
          !Boolean((u as User & { isArchived?: boolean }).isArchived),
      ),
    [users],
  );

  const activeAyId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const selectedAyId = activeAyId;
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
  const [showClosedHistory, setShowClosedHistory] = useState<boolean>(() => {
    if (embedded) return false;
    return searchParams.get("tab") === "history";
  });
  const [showFilters, setShowFilters] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showDateCalendar, setShowDateCalendar] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const pageContentRef = useRef<HTMLDivElement | null>(null);
  const [statusOverlayFrame, setStatusOverlayFrame] = useState({
    left: 16,
    right: 16,
    top: 16,
  });
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (embedded) return startOfMonth(new Date());
    const seed = String(searchParams.get("date") || "").trim();
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
    if (statusUpdatingId === null) return;

    const updateOverlayFrame = () => {
      const rect = pageContentRef.current?.getBoundingClientRect();
      if (!rect) return;
      setStatusOverlayFrame({
        left: Math.max(rect.left, 16),
        right: Math.max(window.innerWidth - rect.right, 16),
        top: Math.max(rect.top, 16),
      });
    };

    updateOverlayFrame();
    window.addEventListener("resize", updateOverlayFrame);
    window.addEventListener("scroll", updateOverlayFrame, true);
    return () => {
      window.removeEventListener("resize", updateOverlayFrame);
      window.removeEventListener("scroll", updateOverlayFrame, true);
    };
  }, [statusUpdatingId]);

  useEffect(() => {
    if (filterCourseId && !filteredCourses.some((c) => c.id === filterCourseId)) {
      setFilterCourseId(0);
    }
  }, [filterCourseId, filteredCourses]);

  useEffect(() => {
    if (embedded) return;
    const next = new URLSearchParams();
    if (filterCollegeId) next.set("collegeId", String(filterCollegeId));
    if (filterCourseId) next.set("courseId", String(filterCourseId));
    if (filterYearLevelId) next.set("yearLevelId", String(filterYearLevelId));
    if (filterDate) next.set("date", filterDate);
    if (showClosedHistory) next.set("tab", "history");
    setSearchParams(next, { replace: true });
  }, [
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    filterDate,
    showClosedHistory,
    setSearchParams,
    embedded,
  ]);

  const [referrals, setReferrals] = useState<Referral[]>(() =>
    normalizeReferrals(load<any[]>(REF_KEY, [])),
  );

  useEffect(() => {
    let alive = true;
    listReferrals()
      .then((res) => {
        if (!alive) return;
        const normalized = normalizeReferrals(res.referrals ?? []);
        const cached = normalizeReferrals(load<any[]>(REF_KEY, []));
        const next = mergeReferralRecords(normalized, cached);
        setReferrals(next);
        save(REF_KEY, next);
        if (res.reasonOptions?.length) {
          setReferralReasonOptions(mergeReferralReasonOptions(res.reasonOptions));
        }
      })
      .catch(() => {
        // Keep cached data when API is unreachable.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onReferralsChange?.(referrals);
  }, [referrals, onReferralsChange]);

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

  const visibleReferrals = useMemo(() => {
    const scoped = isTeacherPortal
      ? referrals.filter((r) => r.referredByUserId === authUser?.id)
      : referrals
          .filter((r) => r.academicYearId === selectedAyId)
          .filter((r) => (filterCollegeId ? r.collegeId === filterCollegeId : true))
          .filter((r) => {
            if (!filterCourseId) return true;
            const selectedCourse = courses.find((c) => c.id === filterCourseId);
            if (!selectedCourse) return true;

            const courseFromNotes = extractLabeledValue(r.notes, "Course")
              .toLowerCase()
              .trim();
            if (courseFromNotes) {
              return courseFromNotes === selectedCourse.name.toLowerCase().trim();
            }

            const student = users.find((u) => u.id === r.studentId);
            if (!student) return true;
            const sid = userCourseId(student);
            return sid === 0 || sid === filterCourseId;
          })
          .filter((r) =>
            filterYearLevelId ? r.yearLevelId === filterYearLevelId : true,
          )
          .filter((r) =>
            filterDate ? toDateKey(r.referredDate) === filterDate : true,
          );

    return scoped.sort(compareNewestReferrals);
  }, [
    referrals,
    isTeacherPortal,
    authUser?.id,
    selectedAyId,
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    filterDate,
    courses,
    users,
  ]);
  const activeReferrals = useMemo(
    () => visibleReferrals.filter((r) => r.status !== "Complete"),
    [visibleReferrals],
  );
  const closedReferrals = useMemo(
    () => visibleReferrals.filter((r) => r.status === "Complete"),
    [visibleReferrals],
  );
  const calendarBaseReferrals = useMemo(() => {
    const scoped = isTeacherPortal
      ? referrals.filter((r) => r.referredByUserId === authUser?.id)
      : referrals
          .filter((r) => r.academicYearId === selectedAyId)
          .filter((r) => (filterCollegeId ? r.collegeId === filterCollegeId : true))
          .filter((r) => {
            if (!filterCourseId) return true;
            const selectedCourse = courses.find((c) => c.id === filterCourseId);
            if (!selectedCourse) return true;

            const courseFromNotes = extractLabeledValue(r.notes, "Course")
              .toLowerCase()
              .trim();
            if (courseFromNotes) {
              return courseFromNotes === selectedCourse.name.toLowerCase().trim();
            }

            const student = users.find((u) => u.id === r.studentId);
            if (!student) return true;
            const sid = userCourseId(student);
            return sid === 0 || sid === filterCourseId;
          })
          .filter((r) =>
            filterYearLevelId ? r.yearLevelId === filterYearLevelId : true,
          );

    return scoped.sort(compareNewestReferrals);
  }, [
    referrals,
    isTeacherPortal,
    authUser?.id,
    selectedAyId,
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    courses,
    users,
  ]);
  const calendarDisplayReferrals = useMemo(
    () =>
      historyOpen || showClosedHistory
        ? calendarBaseReferrals.filter((r) => r.status === "Complete")
        : calendarBaseReferrals.filter((r) => r.status !== "Complete"),
    [calendarBaseReferrals, historyOpen, showClosedHistory],
  );

  const userById = (id: number) => users.find((x) => x.id === id);

  const labelUserName = (id: number) => {
    const u = users.find((x) => x.id === id);
    if (!u) return "Unknown";
    return `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`.trim();
  };

  // âœ… Reasons list (multi-select)
  // Create Modal
  const [open, setOpen] = useState(false);
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalReferral, setApprovalReferral] = useState<Referral | null>(null);
  const [approvalDate, setApprovalDate] = useState("");
  const [approvalTime, setApprovalTime] = useState("");
  const [referralReasonOptions, setReferralReasonOptions] = useState<string[]>(
    () => [...DEFAULT_REFERRAL_REASON_OPTIONS],
  );
  const dateCalendarWrapRef = useRef<HTMLDivElement | null>(null);
  const [studentId, setStudentId] = useState<number>(0);
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] = useState<
    "STUDENT" | "TEACHER" | "NON_TEACHING"
  >("STUDENT");
  const [targetCollegeId, setTargetCollegeId] = useState<number>(0);
  const [targetCourseId, setTargetCourseId] = useState<number>(0);
  const [referredByUserId, setReferredByUserId] = useState<number>(
    authUser?.id ?? 0,
  );
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showModalFilters, setShowModalFilters] = useState(false);
  const [modalCollegeId, setModalCollegeId] = useState<number>(0);
  const [modalCourseId, setModalCourseId] = useState<number>(0);
  const [modalYearLevelId, setModalYearLevelId] = useState<number>(0);
  const [modalSection, setModalSection] = useState("");
  const [modalStudentQuery, setModalStudentQuery] = useState("");
  useEffect(() => {
    if (authUser?.id) setReferredByUserId(authUser.id);
  }, [authUser?.id]);

  useEffect(() => {
    let alive = true;

    listReferralReasonOptions()
      .then((res) => {
        if (!alive) return;
        setReferralReasonOptions(
          mergeReferralReasonOptions(res.reasonOptions ?? DEFAULT_REFERRAL_REASON_OPTIONS),
        );
      })
      .catch(() => {
        if (!alive) return;
        setReferralReasonOptions([...DEFAULT_REFERRAL_REASON_OPTIONS]);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!showDateCalendar) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!dateCalendarWrapRef.current) return;
      if (dateCalendarWrapRef.current.contains(event.target as Node)) return;
      setShowDateCalendar(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showDateCalendar]);

  const modalFilteredCourses = useMemo(
    () =>
      modalCollegeId
        ? courses.filter((c) => c.collegeId === modalCollegeId)
        : courses,
    [courses, modalCollegeId],
  );
  const labelCourse = (courseId: number) =>
    courses.find((course) => course.id === courseId)?.name ?? "-";
  const modalFilteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          (modalCollegeId ? yl.collegeId === modalCollegeId : true),
      ),
    [yearLevels, selectedAyId, modalCollegeId],
  );
  const canPickCourse = modalCollegeId > 0;
  const canPickYearLevel = canPickCourse && modalCourseId > 0;
  const canPickSection = canPickYearLevel && modalYearLevelId > 0;
  const modalSectionOptions = useMemo(() => {
    const rows = students.filter((s) => {
      const sid = userCourseId(s);
      const matchesCourse = !modalCourseId || sid === modalCourseId;
      return (
        (modalCollegeId ? s.collegeId === modalCollegeId : true) &&
        (modalYearLevelId ? s.yearLevelId === modalYearLevelId : true) &&
        matchesCourse
      );
    });
    return Array.from(
      new Set(rows.map((s) => userSection(s)).filter((v) => v.length > 0)),
    ).sort((a, b) => a.localeCompare(b));
  }, [students, modalCollegeId, modalYearLevelId, modalCourseId]);
  const modalFilteredStudents = useMemo(() => {
    if (isTeacherPortal) return students;
    const query = modalStudentQuery.trim().toLowerCase();
    const sectionNeedle = modalSection.trim().toLowerCase();
    return students.filter((s) => {
      const isSelf = Boolean(authUser?.id) && s.id === authUser?.id;
      const sid = userCourseId(s);
      const fullName = `${s.fname} ${s.mname ? `${s.mname} ` : ""}${s.lname}`
        .toLowerCase()
        .trim();
      const matchesCollege = !modalCollegeId || s.collegeId === modalCollegeId;
      const matchesCourse = !modalCourseId || sid === modalCourseId;
      const matchesYearLevel =
        !modalYearLevelId || s.yearLevelId === modalYearLevelId;
      const matchesSection = !sectionNeedle
        ? true
        : userSection(s).toLowerCase() === sectionNeedle;
      const matchesQuery =
        !query ||
        matchesSearchPrefix(query, fullName, s.email, labelCourse(sid), userSection(s));
      return (
        !isSelf &&
        matchesCollege &&
        matchesCourse &&
        matchesYearLevel &&
        matchesSection &&
        matchesQuery
      );
    });
  }, [
    students,
    isTeacherPortal,
    modalCollegeId,
    modalCourseId,
    modalYearLevelId,
    modalSection,
    modalStudentQuery,
    authUser?.id,
  ]);

  useEffect(() => {
    if (!modalCollegeId) {
      if (modalCourseId !== 0) setModalCourseId(0);
      if (modalYearLevelId !== 0) setModalYearLevelId(0);
      if (modalSection !== "") setModalSection("");
    }
  }, [modalCollegeId, modalCourseId, modalYearLevelId, modalSection]);

  useEffect(() => {
    if (!modalCourseId) {
      if (modalYearLevelId !== 0) setModalYearLevelId(0);
      if (modalSection !== "") setModalSection("");
    }
  }, [modalCourseId, modalYearLevelId, modalSection]);

  useEffect(() => {
    if (!modalYearLevelId && modalSection !== "") {
      setModalSection("");
    }
  }, [modalYearLevelId, modalSection]);

  useEffect(() => {
    if (modalCourseId && !modalFilteredCourses.some((c) => c.id === modalCourseId)) {
      setModalCourseId(0);
    }
  }, [modalCourseId, modalFilteredCourses]);

  useEffect(() => {
    if (
      modalYearLevelId &&
      !modalFilteredYearLevels.some((yl) => yl.id === modalYearLevelId)
    ) {
      setModalYearLevelId(0);
    }
  }, [modalYearLevelId, modalFilteredYearLevels]);

  useEffect(() => {
    if (!modalSection) return;
    const exists = modalSectionOptions.some((sec) => sec === modalSection);
    if (!exists) setModalSection("");
  }, [modalSection, modalSectionOptions]);

  useEffect(() => {
    if (!open || isTeacherPortal) return;
    if (!modalFilteredStudents.some((s) => s.id === studentId)) {
      setStudentId(modalFilteredStudents[0]?.id ?? 0);
    }
  }, [open, isTeacherPortal, modalFilteredStudents, studentId]);

  const teacherCourseOptions = useMemo(
    () => courses.filter((c) => c.collegeId === targetCollegeId),
    [courses, targetCollegeId],
  );

  useEffect(() => {
    if (targetType === "NON_TEACHING") {
      if (targetCollegeId) setTargetCollegeId(0);
      if (targetCourseId) setTargetCourseId(0);
      return;
    }
    if (!targetCollegeId && colleges[0]?.id) {
      setTargetCollegeId(colleges[0].id);
    }
  }, [targetType, targetCollegeId, targetCourseId, colleges]);

  useEffect(() => {
    if (targetType !== "STUDENT") {
      if (targetCourseId) setTargetCourseId(0);
      return;
    }
    if (!targetCollegeId) {
      if (targetCourseId) setTargetCourseId(0);
      return;
    }
    if (!teacherCourseOptions.some((c) => c.id === targetCourseId)) {
      setTargetCourseId(teacherCourseOptions[0]?.id ?? 0);
    }
  }, [targetType, targetCollegeId, teacherCourseOptions, targetCourseId]);

  const referredByDisplay = useMemo(() => {
    if (authUser) return `${authUser.fname} ${authUser.lname}`.trim();
    if (!referredByUserId) return "";
    const u = users.find((x) => x.id === referredByUserId);
    if (!u) return "";
    return `${u.fname} ${u.mname ? `${u.mname} ` : ""}${u.lname}`.trim();
  }, [authUser, referredByUserId, users]);

  const referredByLabel = useMemo(() => {
    const role = String(authUser?.role || "").toUpperCase();
    if (role === "TEACHER") return "Referred By Teacher";
    if (role === "NON_TEACHING_PERSONNEL") {
      return "Referred By Non Teaching Personnel";
    }
    if (role === "ADMIN") return "Referred By Admin";
    return "Referred By STAFF";
  }, [authUser?.role]);

  const personTypeLabel = (v: "STUDENT" | "TEACHER" | "NON_TEACHING") => {
    if (v === "NON_TEACHING") return "Non Teaching Personnel";
    if (v === "TEACHER") return "Teacher";
    return "Student";
  };

  const totalSubmittedCount = useMemo(
    () => visibleReferrals.length,
    [visibleReferrals],
  );

  const studentsReferredCount = useMemo(
    () => new Set(visibleReferrals.map((r) => r.studentId)).size,
    [visibleReferrals],
  );

  const awaitingReviewCount = useMemo(
    () => visibleReferrals.filter((r) => r.status === "Pending").length,
    [visibleReferrals],
  );

  const toggleReason = (r: string) => {
    setSelectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };
  const referralReasonPayload = useMemo(
    () => buildReferralReasonPayload(selectedReasons, notes),
    [selectedReasons, notes],
  );
  const requiresCustomReason = selectedReasons.includes(OTHER_REFERRAL_REASON_LABEL);

  const openApprovalModal = (referral: Referral) => {
    setApprovalReferral(referral);
    setApprovalDate(String(referral.referredDate || ""));
    setApprovalTime(String(referral.referredTime || ""));
    setApprovalOpen(true);
  };
  const closeApprovalModal = () => {
    if (statusUpdatingId !== null) return;
    setApprovalOpen(false);
    setApprovalReferral(null);
    setApprovalDate("");
    setApprovalTime("");
  };
  const completeReferral = (referral: Referral) => {
    if (!hasReferralReachedScheduledSession({
      referredDate: String(referral.referredDate || ""),
      referredTime: referral.referredTime,
    })) {
      alert("Complete will only be available after the scheduled date and time have been reached.");
      return;
    }

    setStatusUpdatingId(referral.id);
    const minimumSpinnerDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 3000);
    });

    Promise.all([
      updateReferral({
        id: referral.id,
        status: "Complete",
        referredDate: referral.referredDate ?? undefined,
        referredTime: referral.referredTime ?? undefined,
      }),
      minimumSpinnerDelay,
    ])
      .then(([res]) => {
        const normalized = normalizeReferrals(res.referrals ?? []);
        const nextSource = normalized.length > 0 ? normalized : referrals;
        const next = normalized.some(
          (item) => item.id === referral.id && item.status === "Complete",
        )
          ? nextSource
          : applyReferralPatch(nextSource, referral.id, {
              status: "Complete",
            });
        setReferrals(next);
        save(REF_KEY, next);
      })
      .catch((e: any) => {
        alert(e?.message || "Failed to complete referral.");
      })
      .finally(() => {
        setStatusUpdatingId((current) => (current === referral.id ? null : current));
      });
  };
  const saveApprovalSchedule = () => {
    if (!approvalReferral) return;
    if (!approvalDate || !approvalTime) {
      alert("Please set the schedule date and time before approving this referral.");
      return;
    }

    const referral = approvalReferral;
    const nextApprovalDate = approvalDate;
    const nextApprovalTime = approvalTime;
    setApprovalOpen(false);
    setStatusUpdatingId(referral.id);
    const minimumSpinnerDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 3000);
    });

    Promise.all([
      updateReferral({
        id: referral.id,
        status: "Approved",
        referredDate: nextApprovalDate,
        referredTime: nextApprovalTime,
      }),
      minimumSpinnerDelay,
    ])
      .then(([res]) => {
        const normalized = normalizeReferrals(res.referrals ?? []);
        const nextSource = normalized.length > 0 ? normalized : referrals;
        const next = normalized.some(
          (item) => item.id === referral.id && item.status === "Approved",
        )
          ? nextSource
          : applyReferralPatch(nextSource, referral.id, {
              status: "Approved",
              referredDate: nextApprovalDate,
              referredTime: nextApprovalTime,
            });
        setReferrals(next);
        save(REF_KEY, next);
        setApprovalReferral(null);
        setApprovalDate("");
        setApprovalTime("");
      })
      .catch((e: any) => {
        alert(e?.message || "Failed to approve and schedule referral.");
      })
      .finally(() => {
        setStatusUpdatingId((current) => (current === referral.id ? null : current));
      });
  };
  const handleReferralManageAction = (referral: Referral, action: string) => {
    if (!action) return;
    if (action === "approve" || action === "reschedule") {
      openApprovalModal(referral);
      return;
    }
    if (action === "complete") {
      completeReferral(referral);
    }
  };

  const handleCreate = async () => {
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
    const { reasonText, customReasons, missingCustomReason } = referralReasonPayload;

    if (missingCustomReason) {
      alert("If you selected Others, please type the custom reason in Notes. Separate multiple reasons with commas or new lines.");
      return;
    }

    if (isTeacherPortal) {
      if (!targetName.trim() || !referredByUserId || selectedReasons.length === 0) return;
      if ((targetType === "STUDENT" || targetType === "TEACHER") && !targetCollegeId) return;
      if (targetType === "STUDENT" && !targetCourseId) return;

      const allowedRoles =
        targetType === "STUDENT"
          ? ["STUDENT"]
          : targetType === "TEACHER"
            ? ["TEACHER"]
            : ["STAFF", "ADMIN", "NON_TEACHING_PERSONNEL"];
      const inputName = normalize(normalizeSentenceCaseName(targetName));
      const targetUser = users.find((u) => {
        if (!allowedRoles.includes(u.role)) return false;
        const full = `${u.fname} ${u.mname ? `${u.mname} ` : ""}${u.lname}`;
        const matchesName = normalize(full) === inputName;
        const matchesCollege =
          targetType === "NON_TEACHING" || !targetCollegeId
            ? true
            : Number(u.collegeId ?? 0) === targetCollegeId;
        const matchesCourse =
          targetType !== "STUDENT" || !targetCourseId
            ? true
            : userCourseId(u) === targetCourseId;
        return matchesName && matchesCollege && matchesCourse;
      });

      if (!targetUser) {
        alert("Name not found for the selected type. Please check the spelling.");
        return;
      }

      if (targetUser.id === referredByUserId) {
        alert("You cannot refer yourself.");
        return;
      }

      let payloadCollegeId = 0;
      if (targetType === "STUDENT" || targetType === "TEACHER") {
        if (!targetCollegeId) {
          alert("Please select a college.");
          return;
        }
        payloadCollegeId = targetCollegeId;
      } else {
        payloadCollegeId = Number(targetUser.collegeId ?? colleges[0]?.id ?? 0);
      }

      const fallbackYearLevel =
        yearLevels.find(
          (yl) =>
            yl.academicYearId === selectedAyId && yl.collegeId === payloadCollegeId,
        ) ??
        yearLevels.find((yl) => yl.academicYearId === selectedAyId) ??
        yearLevels[0];

      const payloadYearLevelId =
        targetType === "STUDENT"
          ? Number(targetUser.yearLevelId ?? fallbackYearLevel?.id ?? 0)
          : Number(fallbackYearLevel?.id ?? 0);

      if (!payloadCollegeId || !payloadYearLevelId) {
        alert("Missing college or year level mapping. Please review inputs.");
        return;
      }

      const selectedCollegeName =
        colleges.find((c) => c.id === payloadCollegeId)?.name ?? "";
      const selectedCourseName =
        courses.find((c) => c.id === targetCourseId)?.name ?? "";

      const metadataBits = [
        `Name: ${normalizeSentenceCaseName(targetName)}`,
        `Type: ${personTypeLabel(targetType)}`,
        (targetType === "STUDENT" || targetType === "TEACHER") && selectedCollegeName
          ? `College: ${selectedCollegeName}`
          : "",
        targetType === "STUDENT" && selectedCourseName
          ? `Course: ${selectedCourseName}`
          : "",
        notes.trim() ? `Notes: ${notes.trim()}` : "",
      ].filter(Boolean);

      try {
        const res = await createReferral({
          studentId: targetUser.id,
          referredByUserId,
          academicYearId: selectedAyId,
          collegeId: payloadCollegeId,
          yearLevelId: payloadYearLevelId,
          reason: reasonText,
          customReasons,
          notes: metadataBits.join(" | "),
        });

        const next = normalizeReferrals(res.referrals ?? []);
        setReferrals(next);
        save(REF_KEY, next);
        if (res.reasonOptions?.length) {
          setReferralReasonOptions(mergeReferralReasonOptions(res.reasonOptions));
        } else if (customReasons.length) {
          setReferralReasonOptions((current) =>
            mergeReferralReasonOptions([...current, ...customReasons]),
          );
        }

        setTargetName("");
        setTargetType("STUDENT");
        setTargetCollegeId(0);
        setTargetCourseId(0);
        setSelectedReasons([]);
        setNotes("");
        closeCreateModal();
        setShowCreateNotice(true);
      } catch (e: any) {
        alert(e?.message || "Failed to create referral.");
      }
      return;
    }

    if (
      !studentId ||
      !referredByUserId ||
      selectedReasons.length === 0
    ) {
      return;
    }

    const selectedStudent = students.find((s) => s.id === studentId);
    if (studentId === referredByUserId) {
      alert("You cannot refer yourself.");
      return;
    }
    const payloadCollegeId = Number(selectedStudent?.collegeId ?? 0);
    const payloadYearLevelId = Number(selectedStudent?.yearLevelId ?? 0);

    if (!payloadCollegeId || !payloadYearLevelId) {
      alert("Selected student has no college or year level assigned.");
      return;
    }

    try {
      const res = await createReferral({
        studentId,
        referredByUserId,
        academicYearId: selectedAyId,
        collegeId: payloadCollegeId,
        yearLevelId: payloadYearLevelId,
        reason: reasonText,
        customReasons,
        notes: notes.trim() ? notes.trim() : undefined,
      });

        const next = normalizeReferrals(res.referrals ?? []);
        setReferrals(next);
        save(REF_KEY, next);
        if (res.reasonOptions?.length) {
          setReferralReasonOptions(mergeReferralReasonOptions(res.reasonOptions));
        } else if (customReasons.length) {
          setReferralReasonOptions((current) =>
            mergeReferralReasonOptions([...current, ...customReasons]),
          );
        }

      setSelectedReasons([]);
      setNotes("");
      setModalStudentQuery("");
      closeCreateModal();
      setShowCreateNotice(true);
    } catch (e: any) {
      alert(e?.message || "Failed to create referral.");
    }
  };

  const closeCreateModal = () => {
    setOpen(false);
    setShowModalFilters(false);
  };

  // Styles
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
    whiteSpace: "nowrap",
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
  const referralStatusBody: React.CSSProperties = {
    position: "relative",
  };
  const referralStatusOverlay: React.CSSProperties = {
    position: "fixed",
    left: statusOverlayFrame.left,
    right: statusOverlayFrame.right,
    top: statusOverlayFrame.top,
    bottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1200,
    pointerEvents: "none",
  };
  const referralStatusCard: React.CSSProperties = {
    minWidth: 320,
    maxWidth: 400,
    padding: "34px 28px",
    borderRadius: 28,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(251,191,36,0.26)",
    boxShadow: "0 28px 64px rgba(15,23,42,0.16)",
    display: "grid",
    justifyItems: "center",
    gap: 16,
    textAlign: "center",
  };
  const referralStatusIconWrap: React.CSSProperties = {
    position: "relative",
    width: 168,
    height: 168,
    display: "grid",
    placeItems: "center",
  };
  const referralStatusSpinnerRing: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(from 0deg, rgba(9,14,25,0.96) 0deg, rgba(9,14,25,0.96) 90deg, rgba(251,191,36,1) 90deg, rgba(245,158,11,1) 250deg, rgba(9,14,25,0.22) 320deg, rgba(9,14,25,0.08) 360deg)",
    animation: "gcms-spin 0.95s linear infinite",
    boxShadow: "0 14px 30px rgba(245,158,11,0.22)",
  };
  const referralStatusSpinnerHole: React.CSSProperties = {
    position: "absolute",
    inset: 16,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.98)",
  };
  const referralStatusIconCore: React.CSSProperties = {
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
  const referralStatusTitle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    color: "rgba(9,14,25,1)",
    lineHeight: 1.15,
  };
  const referralStatusSubtitle: React.CSSProperties = {
    fontSize: 14,
    color: "#526371",
    lineHeight: 1.5,
    maxWidth: 290,
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
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
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
    width: "min(360px, calc(100vw - 200px))",
  };

  const overviewActionButton: React.CSSProperties = {
    height: 50,
    padding: "0 24px",
    fontSize: 16,
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
    whiteSpace: "nowrap",
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
    fontSize: 12.5,
    fontWeight: 800,
  };
  const td: React.CSSProperties = {
    padding: "10px 8px",
    borderTop: "1px solid var(--border)",
    verticalAlign: "top",
    fontSize: 12.5,
    color: "#334155",
  };

  const smallMuted: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 500,
  };

  const reasonWrap: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    maxWidth: 520,
  };

  const reasonChip: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
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
    cursor: "pointer",
    color: "var(--primary)",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };
  const rowActionSelect: React.CSSProperties = {
    height: 34,
    width: 248,
    minWidth: 248,
    maxWidth: 248,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 800,
    padding: "0 10px",
    outline: "none",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const filterQuery = useMemo(() => {
    if (embedded) return "";
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams, embedded]);
  const scheduleDateKeys = useMemo(
    () =>
      new Set(
        calendarDisplayReferrals
          .map((referral) => toDateKey(referral.referredDate))
          .filter(Boolean),
      ),
    [calendarDisplayReferrals],
  );
  const scheduleTimesByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    calendarDisplayReferrals.forEach((referral) => {
      const key = toDateKey(referral.referredDate);
      if (!key || !referral.referredTime) return;
      const label = formatTimeShort(referral.referredTime);
      const current = map.get(key) ?? [];
      if (!current.includes(label)) current.push(label);
      map.set(key, current);
    });
    return map;
  }, [calendarDisplayReferrals]);
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
  const tableReferrals = embedded
    ? activeReferrals
    : historyOpen || showClosedHistory
      ? closedReferrals
      : activeReferrals;
  const showScheduleColumns = !isTeacherPortal;

  const referralTable = (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Name</th>
          <th style={th}>Referred By</th>
          <th style={th}>Reason</th>
          {showScheduleColumns && <th style={th}>Scheduled Date</th>}
          {showScheduleColumns && <th style={th}>Scheduled Time</th>}
          <th style={th}>Status</th>
          <th style={th}></th>
        </tr>
      </thead>

      <tbody>
        {tableReferrals.length === 0 ? (
          <tr>
            <td style={td} colSpan={showScheduleColumns ? 7 : 5}>
              <span style={{ opacity: 0.8 }}>
                {historyOpen || showClosedHistory
                  ? "No completed referrals found for this filter."
                  : isTeacherPortal
                    ? "No active referrals yet."
                    : "No active referrals found for this filter."}
              </span>
            </td>
          </tr>
        ) : (
          tableReferrals.map((r) => {
            const reasons = splitReasons(r.reason);
            const preview = reasons.slice(0, 2);
            const student = userById(r.studentId);
            const studentName = student ? fullNameOfUser(student) : extractLabeledValue(r.notes, "Name") || "Unknown";
            const isOverdue = isReferralOverdue(r);
            const rowTdStyle = isOverdue
              ? {
                  background: "rgba(239,68,68,0.08)",
                  borderTop: "1px solid rgba(239,68,68,0.18)",
                }
              : null;

            return (
              <tr key={r.id}>
                <td style={{ ...td, ...(rowTdStyle ?? {}) }}>
                  <div style={{ fontWeight: 500 }}>{studentName}</div>
                </td>

                <td style={{ ...td, ...(rowTdStyle ?? {}) }}>{labelUserName(r.referredByUserId)}</td>

                <td style={{ ...td, ...(rowTdStyle ?? {}) }}>
                  <div style={reasonWrap} title={reasons.join(", ")}>
                    {preview.map((x) => (
                      <span key={x} style={reasonChip}>
                        {x}
                      </span>
                    ))}
                    {reasons.length > 2 && (
                      <span
                        style={{
                          ...reasonChip,
                          background: "rgba(99,102,241,0.10)",
                          border: "1px solid rgba(99,102,241,0.25)",
                        }}
                      >
                        ..others
                      </span>
                    )}
                    {reasons.length === 0 && <span style={smallMuted}>â€”</span>}
                  </div>
                </td>

                {showScheduleColumns && (
                  <td style={{ ...td, ...(rowTdStyle ?? {}) }}>
                    <div style={smallMuted}>{formatDateShort(r.referredDate)}</div>
                  </td>
                )}

                {showScheduleColumns && (
                  <td style={{ ...td, ...(rowTdStyle ?? {}) }}>
                    <div style={smallMuted}>{formatTimeShort(r.referredTime)}</div>
                  </td>
                )}

                <td style={{ ...td, ...(rowTdStyle ?? {}) }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 108,
                      padding: "8px 12px",
                      borderRadius: 999,
                      border:
                        r.status === "Complete"
                          ? "1px solid rgba(34,197,94,0.28)"
                          : r.status === "Approved"
                            ? "1px solid rgba(59,130,246,0.24)"
                            : "1px solid rgba(245,158,11,0.28)",
                      background:
                        r.status === "Complete"
                          ? "rgba(240,253,244,0.98)"
                          : r.status === "Approved"
                            ? "rgba(239,246,255,0.98)"
                            : "rgba(255,251,235,0.98)",
                      color:
                        r.status === "Complete"
                          ? "#166534"
                          : r.status === "Approved"
                            ? "#1d4ed8"
                            : "#92400e",
                      fontSize: 12.5,
                      fontWeight: 800,
                    }}
                  >
                    {referralStatusLabel(r.status)}
                  </span>
                </td>

                <td style={{ ...td, ...(rowTdStyle ?? {}) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {canApproveReferrals && !showClosedHistory && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const action = e.target.value;
                          e.currentTarget.selectedIndex = 0;
                          handleReferralManageAction(r, action);
                        }}
                        disabled={statusUpdatingId !== null}
                        style={{
                          ...rowActionSelect,
                          opacity: statusUpdatingId !== null ? 0.7 : 1,
                          cursor: statusUpdatingId !== null ? "not-allowed" : "pointer",
                        }}
                        aria-label="Manage referral"
                        title="Manage referral"
                      >
                        <option value="">Manage</option>
                        {r.status === "Pending" && (
                          <option value="approve">Approve and Set Schedule</option>
                        )}
                        {r.status === "Approved" && (
                          <option value="reschedule">Change Schedule</option>
                        )}
                        {r.status === "Approved" && (
                          <option
                            value="complete"
                            disabled={
                              !hasReferralReachedScheduledSession({
                                referredDate: String(r.referredDate || ""),
                                referredTime: r.referredTime,
                              })
                            }
                          >
                            Mark as Complete
                          </option>
                        )}
                        {r.status === "Complete" && (
                          <option value="done" disabled>
                            Completed
                          </option>
                        )}
                      </select>
                    )}
                    <ReferralActionLink
                      to={`/app/referrals/${r.id}${filterQuery}`}
                      title="View referral"
                      ariaLabel="View referral"
                      baseStyle={iconAction}
                      keepBorder
                    >
                      <Eye size={16} />
                    </ReferralActionLink>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  const createReferralModal = (
    <Modal open={open} onClose={closeCreateModal} title="Create Referral">
      <div style={{ display: "grid", gap: 12 }}>
        {isTeacherPortal ? (
          <>
            <div>
              <div style={label}>Name</div>
              <input
                value={targetName}
                onChange={(e) =>
                  setTargetName(toSentenceCaseNameInput(e.target.value))
                }
                placeholder="Type full name"
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <div>
                <div style={label}>College</div>
                <DropdownSelect
                  value={targetCollegeId}
                  onChange={(e) => setTargetCollegeId(Number(e.target.value))}
                  disabled={targetType === "NON_TEACHING"}
                >
                  <option value={0}>
                    {targetType === "NON_TEACHING" ? "Not needed for this type" : "Select college"}
                  </option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </DropdownSelect>
              </div>

              <div>
                <div style={label}>Course</div>
                <DropdownSelect
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(Number(e.target.value))}
                  disabled={targetType !== "STUDENT" || !targetCollegeId}
                >
                  <option value={0}>
                    {targetType !== "STUDENT"
                      ? "Not needed for this type"
                      : targetCollegeId
                        ? "Select course"
                        : "Select college first"}
                  </option>
                  {teacherCourseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </DropdownSelect>
              </div>
            </div>

            <div>
              <div style={label}>Type</div>
              <DropdownSelect
                value={targetType}
                onChange={(e) =>
                  setTargetType(
                    e.target.value as "STUDENT" | "TEACHER" | "NON_TEACHING",
                  )
                }
              >
                <option value="STUDENT">Student</option>
              </DropdownSelect>
            </div>
          </>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={label}>Student Name</div>
                <DropdownSelect
                  value={studentId}
                  onChange={(e) => setStudentId(Number(e.target.value))}
                >
                  {modalFilteredStudents.length === 0 && (
                    <option value={0}>No students found</option>
                  )}
                  {modalFilteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`}
                    </option>
                  ))}
                </DropdownSelect>
              </div>

              <div style={{ position: "relative", flexShrink: 0 }}>
                <ReferralActionButton
                  type="button"
                  onClick={() => setShowModalFilters((value) => !value)}
                  active={showModalFilters}
                  baseStyle={modalFilterButton}
                  title={showModalFilters ? "Hide student filters" : "Show student filters"}
                  ariaLabel={showModalFilters ? "Hide student filters" : "Show student filters"}
                >
                  <List size={18} />
                </ReferralActionButton>

                {showModalFilters && (
                  <div style={modalCompactFilterPanel}>
                    <div style={compactField}>
                      <div style={compactLabel}>College</div>
                      <DropdownSelect
                        value={modalCollegeId}
                        onChange={(e) => setModalCollegeId(Number(e.target.value))}
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
                        value={modalCourseId}
                        onChange={(e) => setModalCourseId(Number(e.target.value))}
                        disabled={!canPickCourse}
                      >
                        <option value={0}>
                          {!canPickCourse
                            ? "Select college first"
                            : modalFilteredCourses.length
                              ? "All courses"
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
                          {canPickYearLevel ? "All year levels" : "Select course first"}
                        </option>
                        {modalFilteredYearLevels.map((yl) => (
                          <option key={yl.id} value={yl.id}>
                            {yl.name}
                          </option>
                        ))}
                      </DropdownSelect>
                    </div>

                    <div style={compactField}>
                      <div style={compactLabel}>Section</div>
                      <DropdownSelect
                        value={modalSection}
                        onChange={(e) => setModalSection(e.target.value)}
                        disabled={!canPickSection}
                      >
                        <option value="">
                          {canPickSection ? "All sections" : "Select year level first"}
                        </option>
                        {modalSectionOptions.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </DropdownSelect>
                    </div>

                    <div style={compactField}>
                      <div style={compactLabel}>Search Name</div>
                      <div style={{ position: "relative" }}>
                        <Search
                          size={16}
                          style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#64748b",
                            pointerEvents: "none",
                          }}
                        />
                        <input
                          value={modalStudentQuery}
                          onChange={(e) =>
                            setModalStudentQuery(toSentenceCaseNameInput(e.target.value))
                          }
                          placeholder="Search student name"
                          style={{
                            ...inputStyle,
                            paddingLeft: 38,
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <ReferralActionButton
                        type="button"
                        onClick={() => {
                          setModalCollegeId(0);
                          setModalCourseId(0);
                          setModalYearLevelId(0);
                          setModalSection("");
                          setModalStudentQuery("");
                          setShowModalFilters(false);
                        }}
                        baseStyle={compactClearButton}
                        title="Clear student filters"
                        ariaLabel="Clear student filters"
                      >
                        <X size={14} />
                        Clear
                      </ReferralActionButton>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {modalFilteredStudents.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No students found in this filter. Add students in User Management.
              </div>
            )}
          </div>
        )}

        <div>
          <div style={label}>{referredByLabel}</div>
          <input
            value={referredByDisplay}
            readOnly
            style={{
              ...inputStyle,
              background: "rgba(15,23,42,0.06)",
              color: "rgba(15,23,42,0.85)",
              cursor: "default",
            }}
          />
        </div>

        <div>
          <div style={label}>Reason for Referral (Select all that apply)</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
            }}
          >
            {referralReasonOptions.map((r) => (
              <label
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  opacity: 0.9,
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(r)}
                  onChange={() => toggleReason(r)}
                />
                {r}
              </label>
            ))}
          </div>

          {selectedReasons.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {selectedReasons.map((r) => (
                <span
                  key={r}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "rgba(15,23,42,0.04)",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={label}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={textareaStyle}
            placeholder="Add details. If you selected 'Others', type the custom reason here. Separate multiple reasons with commas or new lines."
          />
          {requiresCustomReason && referralReasonPayload.customReasons.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#475569", fontWeight: 700 }}>
              New reason{referralReasonPayload.customReasons.length > 1 ? "s" : ""} to save:{" "}
              {referralReasonPayload.customReasons.join(", ")}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={closeCreateModal} style={ghostButton}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={primaryButton}
            disabled={
              isTeacherPortal
                ? !targetName.trim() ||
                  !referredByUserId ||
                  selectedReasons.length === 0 ||
                  referralReasonPayload.missingCustomReason ||
                  ((targetType === "STUDENT" || targetType === "TEACHER") &&
                    !targetCollegeId) ||
                  (targetType === "STUDENT" && !targetCourseId)
                : modalFilteredStudents.length === 0 ||
                  !studentId ||
                  !referredByUserId ||
                  selectedReasons.length === 0 ||
                  referralReasonPayload.missingCustomReason
            }
            title={
              isTeacherPortal
                ? !targetName.trim()
                  ? "Type name"
                  : (targetType === "STUDENT" || targetType === "TEACHER") &&
                      !targetCollegeId
                    ? "Select college"
                    : targetType === "STUDENT" && !targetCourseId
                    ? "Select course"
                      : referralReasonPayload.missingCustomReason
                          ? "Type the custom reason in Notes"
                        : selectedReasons.length === 0
                          ? "Select at least one reason"
                          : ""
                : modalFilteredStudents.length === 0
                  ? "No students found for this College + Course + Year Level"
                  : !studentId
                    ? "Select a student"
                  : !referredByUserId
                    ? "Signed-in user is missing"
                    : referralReasonPayload.missingCustomReason
                      ? "Type the custom reason in Notes"
                    : selectedReasons.length === 0
                      ? "Select at least one reason"
                      : ""
            }
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );

  const approvalModal = (
    <Modal
      open={approvalOpen}
      onClose={closeApprovalModal}
      title={approvalReferral?.status === "Approved" ? "Change Referral Schedule" : "Approve Referral"}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>
          Set the date and time when the guidance office will entertain this referral.
        </div>

        <div>
          <div style={label}>Scheduled Date</div>
          <FormattedDateInput
            value={approvalDate}
            onChange={(e) => setApprovalDate(e.target.value)}
            displayStyle={inputStyle}
          />
        </div>

        <div>
          <div style={label}>Scheduled Time</div>
          <input
            type="time"
            value={approvalTime}
            onChange={(e) => setApprovalTime(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={closeApprovalModal}
            style={ghostButton}
            disabled={statusUpdatingId !== null}
          >
            Cancel
          </button>
          <button
            onClick={saveApprovalSchedule}
            style={primaryButton}
            disabled={!approvalDate || !approvalTime || statusUpdatingId !== null}
            title={
              !approvalDate
                ? "Select schedule date"
                : !approvalTime
                  ? "Select schedule time"
                  : ""
            }
          >
            Save Schedule
          </button>
        </div>
      </div>
    </Modal>
  );

  const historyModal = (
    <Modal
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      title="Completed Referral History"
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ ...smallMuted, fontSize: 13 }}>
          Showing completed referrals you submitted.
        </div>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 10,
            background: "white",
            maxHeight: "62vh",
            overflow: "auto",
          }}
        >
          {referralTable}
        </div>
      </div>
    </Modal>
  );

  if (isTeacherPortal) {
    return (
      <div style={{ display: "grid", gap: 24 }}>
        <section
          style={{
            borderRadius: 24,
            padding: "54px 24px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.96) 100%)",
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.07)",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 5vw, 54px)",
              lineHeight: 1.08,
              fontWeight: 900,
              color: "var(--text)",
            }}
          >
            Referral Management Portal
          </h1>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(16px, 2.2vw, 22px)",
              color: "rgba(51,65,85,0.82)",
              fontWeight: 600,
            }}
          >
            Submit and monitor guidance referrals for students and school
            personnel.
          </p>
          <div
            style={{
              marginTop: 26,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <ReferralActionButton
              onClick={() => setOpen(true)}
              title="Add Referral"
              ariaLabel="Add Referral"
              baseStyle={overviewActionButton}
              active={open}
            >
              <Plus size={16} />
              Add Referral
            </ReferralActionButton>
            <ReferralActionButton
              onClick={() => setHistoryOpen(true)}
              title="View Referral History"
              ariaLabel="View Referral History"
              baseStyle={overviewActionButton}
              active={historyOpen}
            >
              <HistoryIcon size={16} />
              View Referral History
            </ReferralActionButton>
          </div>
        </section>

        <section
          style={{
            ...card,
            borderRadius: 20,
            padding: 22,
            boxShadow: "0 20px 44px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { title: "Total Referrals Submitted", value: totalSubmittedCount },
              { title: "Unique Students Referred", value: studentsReferredCount },
              { title: "Pending Referrals", value: awaitingReviewCount },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.09)",
                  background: "rgba(255,255,255,0.86)",
                  boxShadow: "0 12px 24px rgba(15,23,42,0.06)",
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.72 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

        </section>

        {createReferralModal}
        {historyModal}
      </div>
    );
  }

  return (
    <div ref={pageContentRef} style={{ display: "grid", gap: 16 }}>
      {!embedded && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ fontWeight: 800, marginRight: "auto", marginTop: 6 }}>
            Referrals
          </h2>

          <ReferralActionButton
            onClick={() => setOpen(true)}
            active={open}
            baseStyle={headerIconButton}
            title="Create Referral"
            ariaLabel="Create Referral"
          >
            <Plus size={22} />
          </ReferralActionButton>
          <ReferralActionButton
            onClick={() => setShowClosedHistory((v) => !v)}
            active={showClosedHistory}
            baseStyle={headerIconButton}
            title={showClosedHistory ? "Show active referrals" : "Show completed history"}
            ariaLabel={showClosedHistory ? "Show active referrals" : "Show completed history"}
          >
            {showClosedHistory ? <List size={22} /> : <HistoryIcon size={22} />}
          </ReferralActionButton>
        </div>
      )}

      <div
        style={
          embedded
            ? {
                ...card,
                padding: 0,
                border: "none",
                boxShadow: "none",
                background: "transparent",
                position: "relative",
              }
            : card
        }
      >
        <div
          style={{
            marginBottom: embedded ? 0 : 10,
            display: "flex",
            justifyContent: embedded ? "flex-end" : "space-between",
            alignItems: embedded ? "flex-start" : "center",
            gap: 10,
            flexWrap: "wrap",
            position: embedded ? "absolute" : "static",
            top: embedded ? -58 : undefined,
            right: embedded ? 0 : undefined,
            zIndex: embedded ? 5 : undefined,
          }}
        >
          {!embedded && <h3 style={{ marginBottom: 0 }}>Referrals</h3>}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: embedded ? "flex-start" : "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: embedded ? "column" : "row",
                gap: 10,
                alignItems: embedded ? "flex-end" : "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
              <div ref={dateCalendarWrapRef} style={{ position: "relative" }}>
              <ReferralActionButton
                type="button"
                onClick={() => setShowDateCalendar((prev) => !prev)}
                active={Boolean(filterDate || showDateCalendar)}
                baseStyle={headerIconButton}
                title="Filter by date"
                ariaLabel="Filter by date"
              >
                <CalendarDays size={20} />
              </ReferralActionButton>

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
                      style={{ ...iconAction, width: 34, height: 34 }}
                      aria-label="Previous month"
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>&lt;</span>
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
                      style={{ ...iconAction, width: 34, height: 34 }}
                      aria-label="Next month"
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>&gt;</span>
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
                  <ReferralActionButton
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    active={showFilters}
                    baseStyle={headerIconButton}
                    title={showFilters ? "Hide filters" : "Show filters"}
                    ariaLabel={showFilters ? "Hide filters" : "Show filters"}
                  >
                    <List size={20} />
                  </ReferralActionButton>

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
                        <ReferralActionButton
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
                        </ReferralActionButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {embedded && (
                <ReferralActionButton
                  onClick={() => setOpen(true)}
                  active={open}
                  baseStyle={headerIconButton}
                  title="Create Referral"
                  ariaLabel="Create Referral"
                >
                  <Plus size={20} />
                </ReferralActionButton>
              )}

            </div>

            {!embedded && (
              <ReferralActionButton
                onClick={() => setShowClosedHistory((v) => !v)}
                active={showClosedHistory}
                baseStyle={headerIconButton}
                title={showClosedHistory ? "Show active referrals" : "Show completed history"}
                ariaLabel={showClosedHistory ? "Show active referrals" : "Show completed history"}
              >
                {showClosedHistory ? <List size={22} /> : <HistoryIcon size={22} />}
              </ReferralActionButton>
            )}
          </div>
        </div>
        <div style={{ ...referralStatusBody, marginTop: embedded ? 82 : 0 }}>
          {statusUpdatingId !== null && (
            <div style={referralStatusOverlay}>
              <div style={referralStatusCard}>
                <div style={referralStatusIconWrap}>
                  <div style={referralStatusSpinnerRing} />
                  <div style={referralStatusSpinnerHole} />
                  <div style={referralStatusIconCore}>
                    <FileText size={52} />
                  </div>
                </div>
                <div style={referralStatusTitle}>Updating Referral...</div>
                <div style={referralStatusSubtitle}>
                  Please wait while we save the referral status update.
                </div>
              </div>
            </div>
          )}
          <div
            style={{
              opacity: statusUpdatingId !== null ? 0.12 : 1,
              pointerEvents: statusUpdatingId !== null ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
            {referralTable}
          </div>
        </div>
      </div>

      {createReferralModal}
      {approvalModal}

      <SuccessNoticeModal
        open={showCreateNotice}
        onClose={() => setShowCreateNotice(false)}
        title="Referral Created"
        message="The referral has been created successfully."
      />
    </div>
  );
}










