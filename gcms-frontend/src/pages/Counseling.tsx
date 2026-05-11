import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Eye,
  FileText,
  Handshake,
  History,
  List,
  Plus,
  Search,
  SquarePen,
  Users,
  X,
} from "lucide-react";
import Modal from "../components/Modal";
import DropdownSelect from "../components/DropdownSelect";
import FormattedDateInput from "../components/FormattedDateInput";
import GroupSessions from "./GroupSessions";
import { useAuthStore } from "../store/authStore";
import {
  createCounselingCase,
  listReferrals,
  listCounselingCases,
  updateCounselingCase,
} from "../lib/entitiesApi";
import { postJSON } from "../lib/api";
import { matchesSearchPrefix } from "../lib/searchPrefix";
import {
  canUseGroupCounselling,
  isCarissaEstapiaStaff,
} from "../lib/staffPermissions";

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
type Course = {
  id: number;
  name: string;
  collegeId: number;
};
type CoursesResponse = { ok: boolean; courses?: Course[] };

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
  studentRequest?: boolean | number | string | null;
  createdByUserId?: number | null;
  createdByRole?: string | null;
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

type Referral = {
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
  status: "Pending" | "Approved" | "Complete";
  createdAt: string;
};

type HistoryItem = {
  id: string;
  type: "session" | "mediation" | "referral";
  label: string;
  studentText: string;
  collegeTitle: string;
  collegeSubtitle: string;
  courseText: string;
  timeText: string;
  dateValue: string;
  statusText: string;
  viewTo: string;
  searchText: string;
  sortTimestamp: number;
};

type HistoryTypeFilter = "session" | "mediation" | "referral" | null;

type CounselingTab =
  | "sessions"
  | "mediation"
  | "group-sessions";

const CASES_KEY = "gcms_mock_counseling_cases_v2";
const MEDIATION_KEY = "gcms_mock_mediation_cases_v1";
const REF_KEY = "gcms_mock_referrals_v1";
const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const HISTORY_PAGE_SIZE = 10;

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

function parseCounselingTab(raw: string | null): CounselingTab {
  const tab = String(raw || "")
    .trim()
    .toLowerCase();

  if (
    tab === "sessions" ||
    tab === "group-sessions"
  ) {
    return tab;
  }

  return "sessions";
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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
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

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function truthyFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["1", "true", "yes", "student", "session"].includes(
      value.trim().toLowerCase(),
    );
  }
  return false;
}

function sanitizeIdList(values: number[]) {
  return Array.from(
    new Set(
      values.filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}

function mergeCounselingCases(
  nextCases: CounselingCase[],
  cachedCases: CounselingCase[],
): CounselingCase[] {
  const cachedById = new Map(cachedCases.map((item) => [item.id, item]));

  return nextCases.map((item) => {
    const cached = cachedById.get(item.id);

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
          (item as CounselingCase & { timeFinished?: unknown }).timeFinished,
        ) ?? cached?.timeFinished,
      recommendation:
        optionalText(
          (item as CounselingCase & { recommendation?: unknown }).recommendation,
        ) ?? cached?.recommendation,
      studentRequest:
        (item as CounselingCase & { studentRequest?: unknown }).studentRequest ??
        cached?.studentRequest,
      createdByUserId:
        (item as CounselingCase & { createdByUserId?: number | null })
          .createdByUserId ?? cached?.createdByUserId,
      createdByRole:
        (item as CounselingCase & { createdByRole?: string | null })
          .createdByRole ?? cached?.createdByRole,
    };
  });
}

const completedSessionTimes = ["08:10", "08:35", "09:00", "09:20", "09:45"];
const completedReasonTemplates = [
  "Student requested counseling support for academic pressure and deadline management.",
  "Student reported feeling overwhelmed balancing coursework, projects, and personal responsibilities.",
  "Student asked for guidance on managing study stress and improving classroom focus.",
  "Student shared concerns about motivation, attendance consistency, and academic performance.",
  "Student sought support for stress related to exams, expectations, and time management.",
];
const completedNotesTemplates = [
  "Student was calm and cooperative during the session. Main concerns were identified and discussed clearly.",
  "Student opened up about current academic challenges and responded well to the conversation and guidance given.",
  "Session focused on understanding the source of stress and identifying practical coping strategies for school demands.",
  "Student showed willingness to improve routines and accepted recommendations for better daily structure and follow-through.",
  "Counseling discussion remained productive, and the student demonstrated readiness to apply the suggested next steps.",
];
const completedActionTemplates = [
  "Reviewed current concerns, provided supportive counseling, and agreed on practical study and self-management steps.",
  "Discussed coping strategies, classroom adjustment plans, and short-term goals to support academic progress.",
  "Provided counseling intervention focused on stress management, routine building, and help-seeking when needed.",
  "Assisted the student in identifying priority concerns and created a simple action plan for follow-through.",
  "Conducted guidance session, clarified concerns, and recommended monitoring progress through consistent routines.",
];

function buildStudentName(student?: User) {
  if (!student) return "The student";
  return `${student.fname} ${student.mname ? `${student.mname} ` : ""}${student.lname}`.trim();
}

function seedCompletedHistoryCases(
  items: CounselingCase[],
  students: User[],
): CounselingCase[] {
  return items.map((item, index) => {
    if (item.status !== "Completed") return item;

    const student = students.find((entry) => entry.id === item.studentId);
    const studentName = buildStudentName(student);
    const slotIndex = Math.abs(item.id || index) % completedSessionTimes.length;
    const reasonIndex = Math.abs(item.id + 1 || index) % completedReasonTemplates.length;
    const notesIndex = Math.abs(item.id + 2 || index) % completedNotesTemplates.length;
    const actionIndex = Math.abs(item.id + 3 || index) % completedActionTemplates.length;

    return {
      ...item,
      time: completedSessionTimes[slotIndex],
      reason: `${studentName} ${completedReasonTemplates[reasonIndex].charAt(0).toLowerCase()}${completedReasonTemplates[reasonIndex].slice(1)}`,
      notes: completedNotesTemplates[notesIndex],
      actionTaken: completedActionTemplates[actionIndex],
    };
  });
}

function seedMediationCases(
  items: MediationCase[],
  _students: User[],
  _activeYearId: number,
): MediationCase[] {
  if (items.length > 0) {
    return items.map((item) => ({
      ...item,
      participantIds: sanitizeIdList(item.participantIds),
      title: optionalText(item.title) ?? "Untitled Mediation Case",
      issueDescription: optionalText(item.issueDescription),
      agreementsMade: optionalText(item.agreementsMade),
      outcome: optionalText(item.outcome),
      remarks: optionalText(item.remarks),
      status: item.status ?? "Open",
    }));
  }

  return [];
}

function formatCaseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "-";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCaseTime(value?: string | null) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

const historyFallbackTimes = ["08:15", "08:40", "09:05", "09:30", "10:00"];

function formatHistoryTime(
  value: string | null | undefined,
  seed: number,
) {
  const formatted = formatCaseTime(value);
  if (formatted !== "-") return formatted;
  return formatCaseTime(
    historyFallbackTimes[Math.abs(seed) % historyFallbackTimes.length],
  );
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
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

function compareNewestCounselingCases(a: CounselingCase, b: CounselingCase): number {
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

function compareNewestMediationCases(a: MediationCase, b: MediationCase): number {
  const byCreatedAt =
    parseSortTimestamp(b.createdAt, undefined, b.date) -
    parseSortTimestamp(a.createdAt, undefined, a.date);
  if (byCreatedAt !== 0) return byCreatedAt;

  const bySchedule =
    parseSortTimestamp(b.date, undefined, b.createdAt) -
    parseSortTimestamp(a.date, undefined, a.createdAt);
  if (bySchedule !== 0) return bySchedule;

  return b.id - a.id;
}

function isCompletionReady(caseLike: {
  reason?: string;
  notes?: string;
  actionTaken?: string;
}) {
  return Boolean(
    optionalText(caseLike.reason) &&
      optionalText(caseLike.notes) &&
      optionalText(caseLike.actionTaken),
  );
}

function completionAlertMessage() {
  return "Fill in Background, Behavioral Observations, and Intervention before marking this session as Completed.";
}

function isMediationResolutionReady(caseLike: {
  agreementsMade?: string;
  outcome?: string;
  remarks?: string;
}) {
  return Boolean(
    optionalText(caseLike.agreementsMade) &&
      optionalText(caseLike.outcome) &&
      optionalText(caseLike.remarks),
  );
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

function counselingActionStyle(
  base: React.CSSProperties,
  {
    active = false,
    hovered = false,
  }: { active?: boolean; hovered?: boolean } = {},
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
  };
}

type CounselingActionButtonProps = {
  active?: boolean;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

function CounselingActionButton({
  active = false,
  onClick,
  title,
  ariaLabel,
  baseStyle,
  children,
  type = "button",
  disabled = false,
}: CounselingActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      style={counselingActionStyle(baseStyle, {
        active: active || pressed,
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

type CounselingActionLinkProps = {
  to: string;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  active?: boolean;
};

function CounselingActionLink({
  to,
  title,
  ariaLabel,
  baseStyle,
  children,
  active = false,
}: CounselingActionLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      title={title}
      aria-label={ariaLabel ?? title}
      style={{
        ...counselingActionStyle(baseStyle, {
          active: active || pressed,
          hovered,
        }),
        textDecoration: "none",
      }}
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

type CounselingTabButtonProps = {
  active?: boolean;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
};

function CounselingTabButton({
  active = false,
  onClick,
  title,
  ariaLabel,
  baseStyle,
  children,
}: CounselingTabButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      style={{
        ...baseStyle,
        background: active ? "#5F6D7A" : "white",
        color: active ? "white" : "#111827",
        border: active ? "1px solid #5F6D7A" : "1px solid var(--border)",
        boxShadow: "none",
        transform: pressed
          ? "translateY(1px) scale(0.98)"
          : hovered
            ? "translateY(-1px)"
            : "translateY(0)",
        transition:
          "background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease",
        cursor: "pointer",
      }}
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

const COUNSELING_TABS: Array<{
  id: CounselingTab;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { id: "sessions", label: "Sessions", icon: CalendarDays },
  { id: "group-sessions", label: "Group Counselling", icon: Users },
];

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
    () =>
      users.filter(
        (u) =>
          u.role === "STUDENT" &&
          !(u as User & { isArchived?: boolean }).isArchived,
      ),
    [users],
  );
  const staffUsers = useMemo(
    () =>
      users.filter((u) => {
        const role = String(u.role || "").trim().toUpperCase();
        return (
          role === "ADMIN" ||
          role === "STAFF" ||
          role === "COUNSELOR" ||
          role === "NON_TEACHING_PERSONNEL"
        );
      }),
    [users],
  );

  const [cases, setCases] = useState<CounselingCase[]>(() =>
    seedCompletedHistoryCases(
      load<CounselingCase[]>(CASES_KEY, [
      {
        id: 1,
        studentId: students[0]?.id ?? 0,
        STAFFUserId: 2,
        academicYearId: activeYearId,
        collegeId: students[0]?.collegeId ?? colleges[0]?.id ?? 1,
        yearLevelId: students[0]?.yearLevelId ?? 0,
        date: "2026-02-15",
        time: "09:00",
        status: "Pending",
        reason: "Academic stress",
        notes: "Initial assessment",
        actionTaken: "Scheduled first counseling session.",
        followUpDate: "2026-02-22",
        createdAt: "2026-02-15",
      },
      ]),
      students,
    ),
  );
  const [mediationCases, setMediationCases] = useState<MediationCase[]>(() =>
    [],
  );
  const [referrals, setReferrals] = useState<Referral[]>(() =>
    normalizeReferrals(load<any[]>(REF_KEY, [])),
  );

  useEffect(() => {
    localStorage.removeItem(MEDIATION_KEY);
  }, []);

  useEffect(() => {
    let alive = true;
    listCounselingCases()
      .then((res) => {
        if (!alive) return;
        const next = mergeCounselingCases(
          res.cases ?? [],
          load<CounselingCase[]>(CASES_KEY, []),
        );
        const seededNext = seedCompletedHistoryCases(next, students);
        setCases(seededNext);
        save(CASES_KEY, seededNext);
      })
      .catch(() => {
        // Keep cached data when API is unreachable.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    listReferrals()
      .then((res) => {
        if (!alive) return;
        const next = normalizeReferrals(res.referrals ?? []);
        setReferrals(next);
        save(REF_KEY, next);
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
  const [activeTab, setActiveTab] = useState<CounselingTab>(() =>
    parseCounselingTab(searchParams.get("tab")),
  );
  const [showSessionHistory, setShowSessionHistory] = useState<boolean>(() =>
    searchParams.get("tab") === "history" ||
    searchParams.get("sessionHistory") === "1",
  );
  const canAccessGroupCounselling = canUseGroupCounselling(authUser);
  const visibleCounselingTabs = useMemo(
    () =>
      COUNSELING_TABS.filter(
        (tab) => tab.id !== "group-sessions" || canAccessGroupCounselling,
      ),
    [canAccessGroupCounselling],
  );
  const tabHasFilters = activeTab === "sessions";
  const showYearLevelFilter = activeTab === "sessions" && showSessionHistory;
  const [showFilters, setShowFilters] = useState<boolean>(() => {
    return (
      parsePositiveInt(searchParams.get("collegeId")) > 0 ||
      parsePositiveInt(searchParams.get("courseId")) > 0 ||
      parsePositiveInt(searchParams.get("yearLevelId")) > 0
    );
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
    if (showYearLevelFilter && filterYearLevelId) {
      next.set("yearLevelId", String(filterYearLevelId));
    }
    next.set("tab", activeTab);
    if (activeTab === "sessions" && showSessionHistory) {
      next.set("sessionHistory", "1");
    }
    setSearchParams(next, { replace: true });
  }, [
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    showYearLevelFilter,
    showSessionHistory,
    activeTab,
    setSearchParams,
  ]);

  useEffect(() => {
    if (activeTab === "group-sessions" && !canAccessGroupCounselling) {
      setActiveTab("sessions");
    }
  }, [activeTab, canAccessGroupCounselling]);

  useEffect(() => {
    if (activeTab === "sessions") return;
    setShowSessionHistory(false);
    setHistorySearch("");
    setHistoryTypeFilter(null);
    setHistoryPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (tabHasFilters) return;
    setShowFilters(false);
  }, [tabHasFilters]);

  const [open, setOpen] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionCreateSuccess, setSessionCreateSuccess] = useState(false);
  const [statusUpdateOverlay, setStatusUpdateOverlay] = useState<{
    kind: "session" | "mediation";
    id: number;
  } | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
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
  const [modalSection, setModalSection] = useState("");
  const canPickCourse = modalCollegeId > 0;
  const canPickYearLevel = canPickCourse && modalCourseId > 0;
  const canPickSection = canPickYearLevel && modalYearLevelId > 0;
  const modalSectionOptions = useMemo(() => {
    const rows = students.filter((s) => {
      const sid = userCourseId(s);
      const matchesCourse = !modalCourseId || sid === 0 || sid === modalCourseId;
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
  const filteredStudents = useMemo(() => {
    const sectionNeedle = modalSection.trim().toLowerCase();
    return students.filter((s) => {
      const sid = userCourseId(s);
      const matchesCourse = !modalCourseId || sid === 0 || sid === modalCourseId;
      const matchesSection = !sectionNeedle
        ? true
        : userSection(s).toLowerCase() === sectionNeedle;
      return (
        (modalCollegeId ? s.collegeId === modalCollegeId : true) &&
        (modalYearLevelId ? s.yearLevelId === modalYearLevelId : true) &&
        matchesCourse &&
        matchesSection
      );
    });
  }, [students, modalCollegeId, modalYearLevelId, modalCourseId, modalSection]);
  const [studentId, setStudentId] = useState<number>(filteredStudents[0]?.id ?? 0);
  const [additionalStudentIds, setAdditionalStudentIds] = useState<number[]>([]);
  const selectedModalStudent = useMemo(
    () => students.find((student) => student.id === studentId),
    [students, studentId],
  );
  const selectedSessionStudentIds = useMemo(
    () => sanitizeIdList([studentId, ...additionalStudentIds]),
    [studentId, additionalStudentIds],
  );
  const availableAdditionalStudents = useMemo(
    () =>
      filteredStudents.filter(
        (student) => !selectedSessionStudentIds.includes(student.id),
      ),
    [filteredStudents, selectedSessionStudentIds],
  );
  const defaultStaffUserId = useMemo(
    () =>
      staffUsers.find((staff) => staff.id === authUser?.id)?.id ??
      staffUsers[0]?.id ??
      0,
    [authUser?.id, staffUsers],
  );
  const [staffUserId, setStaffUserId] = useState<number>(defaultStaffUserId);
  const resolvedModalCollegeId = modalCollegeId || selectedModalStudent?.collegeId || 0;
  const resolvedModalYearLevelId = modalYearLevelId || selectedModalStudent?.yearLevelId || 0;
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState<CounselingCase["status"]>("Pending");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [timeFinished, setTimeFinished] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const getSessionStudentAcademicValues = (id: number) => {
    const student = students.find((item) => item.id === id);
    return {
      collegeId: student?.collegeId || modalCollegeId || 0,
      yearLevelId: student?.yearLevelId || modalYearLevelId || 0,
    };
  };
  const pageContentRef = useRef<HTMLDivElement | null>(null);
  const [statusOverlayFrame, setStatusOverlayFrame] = useState({
    left: 16,
    right: 16,
    top: 16,
  });
  const missingCreateSessionFields: string[] = [];
  if (selectedSessionStudentIds.length === 0) {
    missingCreateSessionFields.push("Student Name");
  }
  if (!staffUserId) missingCreateSessionFields.push("Staff");
  if (!date) missingCreateSessionFields.push("Date");
  if (!optionalText(time)) missingCreateSessionFields.push("Time");
  if (filteredStudents.length === 0) {
    missingCreateSessionFields.length = 0;
    missingCreateSessionFields.push("an available student");
  } else if (
    selectedSessionStudentIds.some(
      (id) => !getSessionStudentAcademicValues(id).collegeId,
    )
  ) {
    missingCreateSessionFields.push("selected student's college");
  } else if (
    selectedSessionStudentIds.some(
      (id) => !getSessionStudentAcademicValues(id).yearLevelId,
    )
  ) {
    missingCreateSessionFields.push("selected student's year level");
  }
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] =
    useState<HistoryTypeFilter>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [mediationSearch, setMediationSearch] = useState("");
  const [mediationFilterDate, setMediationFilterDate] = useState("");
  const [showMediationDateCalendar, setShowMediationDateCalendar] = useState(false);
  const [mediationCalendarMonth, setMediationCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [mediationOpen, setMediationOpen] = useState(false);
  const [mediationParticipantsOpen, setMediationParticipantsOpen] = useState(false);
  const [mediationNotesOpen, setMediationNotesOpen] = useState(false);
  const [savingMediationCase, setSavingMediationCase] = useState(false);
  const [savingMediationParticipants, setSavingMediationParticipants] = useState(false);
  const [savingMediationNotes, setSavingMediationNotes] = useState(false);
  const [mediationCaseTitle, setMediationCaseTitle] = useState("");
  const [mediationDate, setMediationDate] = useState("");
  const [mediationIssueDescription, setMediationIssueDescription] = useState("");
  const [mediationParticipantIds, setMediationParticipantIds] = useState<number[]>([]);
  const [mediationFilterCollegeId, setMediationFilterCollegeId] = useState<number>(0);
  const [mediationFilterCourseId, setMediationFilterCourseId] = useState<number>(0);
  const [mediationFilterYearLevelId, setMediationFilterYearLevelId] = useState<number>(0);
  const [showMediationModalFilters, setShowMediationModalFilters] = useState(false);
  const [mediationCandidateStudentId, setMediationCandidateStudentId] = useState<number>(0);
  const [mediationParticipantsCaseId, setMediationParticipantsCaseId] = useState<number | null>(null);
  const [mediationParticipantsFilterCollegeId, setMediationParticipantsFilterCollegeId] = useState<number>(0);
  const [mediationParticipantsFilterCourseId, setMediationParticipantsFilterCourseId] = useState<number>(0);
  const [mediationParticipantsFilterYearLevelId, setMediationParticipantsFilterYearLevelId] = useState<number>(0);
  const [mediationParticipantsSearch, setMediationParticipantsSearch] = useState("");
  const [mediationNotesCaseId, setMediationNotesCaseId] = useState<number | null>(null);
  const [mediationAgreementsMade, setMediationAgreementsMade] = useState("");
  const [mediationOutcome, setMediationOutcome] = useState("");
  const [mediationRemarks, setMediationRemarks] = useState("");
  const mediationDateCalendarWrapRef = useRef<HTMLDivElement | null>(null);
  const showSessionCreateAnimation =
    savingSession || (!editingCaseId && sessionCreateSuccess);
  useEffect(() => {
    if (!statusUpdateOverlay) return;

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
  }, [statusUpdateOverlay]);
  const missingCreateMediationFields: string[] = [];
  if (!optionalText(mediationCaseTitle)) missingCreateMediationFields.push("Case Title");
  if (!optionalText(mediationDate)) missingCreateMediationFields.push("Date");
  if (sanitizeIdList(mediationParticipantIds).length < 2) {
    missingCreateMediationFields.push("at least 2 participants");
  }
  const missingMediationParticipantsFields: string[] = [];
  if (sanitizeIdList(mediationParticipantIds).length < 2) {
    missingMediationParticipantsFields.push("at least 2 participants");
  }
  const mediationFilteredCourses = useMemo(
    () =>
      mediationFilterCollegeId
        ? courses.filter((c) => c.collegeId === mediationFilterCollegeId)
        : courses,
    [courses, mediationFilterCollegeId],
  );
  const mediationFilteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          (mediationFilterCollegeId ? yl.collegeId === mediationFilterCollegeId : true),
      ),
    [yearLevels, selectedAyId, mediationFilterCollegeId],
  );
  const mediationFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const courseId = userCourseId(student);
      const matchesCourse =
        !mediationFilterCourseId || courseId === 0 || courseId === mediationFilterCourseId;

      return (
        (mediationFilterCollegeId
          ? student.collegeId === mediationFilterCollegeId
          : true) &&
        (mediationFilterYearLevelId
          ? student.yearLevelId === mediationFilterYearLevelId
          : true) &&
        matchesCourse
      );
    });
  }, [
    students,
    mediationFilterCollegeId,
    mediationFilterCourseId,
    mediationFilterYearLevelId,
  ]);
  const mediationParticipantsFilteredCourses = useMemo(
    () =>
      mediationParticipantsFilterCollegeId
        ? courses.filter((course) => course.collegeId === mediationParticipantsFilterCollegeId)
        : courses,
    [courses, mediationParticipantsFilterCollegeId],
  );
  const mediationParticipantsFilteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          (mediationParticipantsFilterCollegeId
            ? yl.collegeId === mediationParticipantsFilterCollegeId
            : true),
      ),
    [yearLevels, selectedAyId, mediationParticipantsFilterCollegeId],
  );
  const mediationParticipantsSearchNeedle = mediationParticipantsSearch
    .trim()
    .toLowerCase();
  const mediationParticipantsFilteredStudents = useMemo(() => {
    return students.filter((student) => {
      const courseId = userCourseId(student);
      const courseName = courseId
        ? courses.find((course) => course.id === courseId)?.name ?? "-"
        : "-";
      const fullName =
        `${student.fname} ${student.mname ? `${student.mname} ` : ""}${student.lname}`
          .trim()
          .toLowerCase();
      const matchesCourse =
        !mediationParticipantsFilterCourseId ||
        courseId === 0 ||
        courseId === mediationParticipantsFilterCourseId;
      const matchesSearch = !mediationParticipantsSearchNeedle
        ? true
        : matchesSearchPrefix(
            mediationParticipantsSearchNeedle,
            fullName,
            student.email,
            courseName,
          );

      return (
        (mediationParticipantsFilterCollegeId
          ? student.collegeId === mediationParticipantsFilterCollegeId
          : true) &&
        (mediationParticipantsFilterYearLevelId
          ? student.yearLevelId === mediationParticipantsFilterYearLevelId
          : true) &&
        matchesCourse &&
        matchesSearch
      );
    });
  }, [
    students,
    mediationParticipantsFilterCollegeId,
    mediationParticipantsFilterCourseId,
    mediationParticipantsFilterYearLevelId,
    mediationParticipantsSearchNeedle,
    courses,
  ]);
  const selectedMediationParticipants = useMemo(
    () =>
      sanitizeIdList(mediationParticipantIds)
        .map((id) => students.find((student) => student.id === id))
        .filter(Boolean) as User[],
    [mediationParticipantIds, students],
  );
  const mediationAvailableStudents = useMemo(
    () =>
      mediationFilteredStudents.filter(
        (student) => !mediationParticipantIds.includes(student.id),
      ),
    [mediationFilteredStudents, mediationParticipantIds],
  );

  useEffect(() => {
    setMediationCases((current) =>
      seedMediationCases(current, students, activeYearId),
    );
  }, [students, activeYearId]);

  useEffect(() => {
    if (!showMediationDateCalendar) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!mediationDateCalendarWrapRef.current) return;
      if (mediationDateCalendarWrapRef.current.contains(event.target as Node)) return;
      setShowMediationDateCalendar(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showMediationDateCalendar]);

  useEffect(() => {
    if (!open) return;
    if (editingCaseId) return;
    setModalCollegeId(filterCollegeId);
    setModalCourseId(filterCourseId);
    setModalYearLevelId(filterYearLevelId);
    setModalSection("");
  }, [open, editingCaseId, filterCollegeId, filterCourseId, filterYearLevelId]);

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
    if (modalYearLevelId && !modalFilteredYearLevels.some((yl) => yl.id === modalYearLevelId)) {
      setModalYearLevelId(0);
    }
  }, [modalYearLevelId, modalFilteredYearLevels]);

  useEffect(() => {
    if (!mediationFilterCollegeId) {
      if (mediationFilterCourseId !== 0) setMediationFilterCourseId(0);
      if (mediationFilterYearLevelId !== 0) setMediationFilterYearLevelId(0);
    }
  }, [
    mediationFilterCollegeId,
    mediationFilterCourseId,
    mediationFilterYearLevelId,
  ]);

  useEffect(() => {
    if (!mediationFilterCourseId && mediationFilterYearLevelId !== 0) {
      setMediationFilterYearLevelId(0);
    }
  }, [mediationFilterCourseId, mediationFilterYearLevelId]);

  useEffect(() => {
    if (
      mediationFilterCourseId &&
      !mediationFilteredCourses.some((course) => course.id === mediationFilterCourseId)
    ) {
      setMediationFilterCourseId(0);
    }
  }, [mediationFilterCourseId, mediationFilteredCourses]);

  useEffect(() => {
    if (
      mediationFilterYearLevelId &&
      !mediationFilteredYearLevels.some((yl) => yl.id === mediationFilterYearLevelId)
    ) {
      setMediationFilterYearLevelId(0);
    }
  }, [mediationFilterYearLevelId, mediationFilteredYearLevels]);

  useEffect(() => {
    if (!mediationParticipantsFilterCollegeId) {
      if (mediationParticipantsFilterCourseId !== 0) setMediationParticipantsFilterCourseId(0);
      if (mediationParticipantsFilterYearLevelId !== 0) setMediationParticipantsFilterYearLevelId(0);
    }
  }, [
    mediationParticipantsFilterCollegeId,
    mediationParticipantsFilterCourseId,
    mediationParticipantsFilterYearLevelId,
  ]);

  useEffect(() => {
    if (
      mediationParticipantsFilterCourseId &&
      !mediationParticipantsFilteredCourses.some(
        (course) => course.id === mediationParticipantsFilterCourseId,
      )
    ) {
      setMediationParticipantsFilterCourseId(0);
    }
  }, [mediationParticipantsFilterCourseId, mediationParticipantsFilteredCourses]);

  useEffect(() => {
    if (
      mediationParticipantsFilterYearLevelId &&
      !mediationParticipantsFilteredYearLevels.some(
        (yl) => yl.id === mediationParticipantsFilterYearLevelId,
      )
    ) {
      setMediationParticipantsFilterYearLevelId(0);
    }
  }, [mediationParticipantsFilterYearLevelId, mediationParticipantsFilteredYearLevels]);

  useEffect(() => {
    if (
      mediationCandidateStudentId &&
      mediationAvailableStudents.some((student) => student.id === mediationCandidateStudentId)
    ) {
      return;
    }

    setMediationCandidateStudentId(mediationAvailableStudents[0]?.id ?? 0);
  }, [mediationCandidateStudentId, mediationAvailableStudents]);

  // keep studentId valid when modal filtered list changes
  useEffect(() => {
    const filteredIds = new Set(filteredStudents.map((item) => item.id));
    if (studentId && !filteredIds.has(studentId)) setStudentId(0);
    setAdditionalStudentIds((current) =>
      sanitizeIdList(current).filter(
        (id) => filteredIds.has(id) && id !== studentId,
      ),
    );
  }, [filteredStudents, studentId]);

  const filterQuery = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams]);

  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => c.academicYearId === selectedAyId)
      .filter((c) => (filterCollegeId ? c.collegeId === filterCollegeId : true))
      .filter((c) =>
        showYearLevelFilter && filterYearLevelId
          ? c.yearLevelId === filterYearLevelId
          : true,
      )
      .filter((c) => {
        if (!filterCourseId) return true;
        const student = students.find((s) => s.id === c.studentId);
        if (!student) return true;
        const sid = userCourseId(student);
        return sid === 0 || sid === filterCourseId;
      })
      .sort(compareNewestCounselingCases);
  }, [
    cases,
    selectedAyId,
    filterCollegeId,
    filterYearLevelId,
    filterCourseId,
    showYearLevelFilter,
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
  const showCompletedHistory = activeTab === "sessions" && showSessionHistory;
  const historySearchNeedle = historySearch.trim().toLowerCase();
  const displayCases = useMemo(() => {
    const baseCases = showCompletedHistory ? completedCases : activeCases;
    if (!showCompletedHistory || !historySearchNeedle) return baseCases;

    return baseCases.filter((c) => {
      const student = students.find((item) => item.id === c.studentId);
      if (!student) return false;
      const studentName = `${student.fname} ${student.mname ? `${student.mname} ` : ""}${student.lname}`
        .trim()
        .toLowerCase();
      return studentName.includes(historySearchNeedle);
    });
  }, [
    activeCases,
    completedCases,
    showCompletedHistory,
    historySearchNeedle,
    students,
  ]);
  function getStudentName(id: number) {
    const s = students.find((x) => x.id === id);
    if (!s) return "Unknown";
    return `${s.fname} ${s.mname ? `${s.mname} ` : ""}${s.lname}`.trim();
  }

  function getSessionKind(item: CounselingCase) {
    const record = item as CounselingCase & {
      student_request?: unknown;
      requestedByStudent?: unknown;
      requested_by_student?: unknown;
    };
    const createdByRole = String(item.createdByRole || "").trim().toUpperCase();

    if (
      createdByRole === "STUDENT" ||
      truthyFlag(record.studentRequest) ||
      truthyFlag(record.student_request) ||
      truthyFlag(record.requestedByStudent) ||
      truthyFlag(record.requested_by_student)
    ) {
      return "Session";
    }

    const creator = users.find((user) => user.id === item.createdByUserId);
    if (creator?.role === "ADMIN" || isCarissaEstapiaStaff(creator)) {
      return "Walk In";
    }

    const assignedStaff = users.find(
      (user) => user.id === (item.STAFFUserId ?? item.counselorUserId ?? 0),
    );
    if (assignedStaff?.role === "ADMIN" || isCarissaEstapiaStaff(assignedStaff)) {
      return "Walk In";
    }

    if (!item.STAFFUserId && !item.counselorUserId) return "Session";
    return "Walk In";
  }

  const mediationSearchNeedle = mediationSearch.trim().toLowerCase();
  const mediationVisibleCases = useMemo(
    () =>
      mediationCases
      .filter((item) => item.status !== "Resolved")
      .filter((item) =>
        mediationFilterDate ? toDateKey(item.date) === mediationFilterDate : true,
      )
      .slice()
      .sort(compareNewestMediationCases),
    [mediationCases, mediationFilterDate],
  );

  const mediationScheduleDateKeys = useMemo(
    () =>
      new Set(
        mediationCases
          .filter((item) => item.status !== "Resolved")
          .map((item) => toDateKey(item.date))
          .filter(Boolean),
      ),
    [mediationCases],
  );

  const mediationTitlesByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    mediationCases
      .filter((item) => item.status !== "Resolved")
      .forEach((item) => {
        const key = toDateKey(item.date);
        if (!key) return;
        const current = map.get(key) ?? [];
        if (!current.includes(item.title)) current.push(item.title);
        map.set(key, current);
      });
    return map;
  }, [mediationCases]);

  const mediationCalendarCells = useMemo(() => {
    const monthStart = startOfMonth(mediationCalendarMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + index);
      const key = toDateKey(cellDate.toISOString());
      const titles = mediationTitlesByDate.get(key) ?? [];

      return {
        key,
        label: cellDate.getDate(),
        isCurrentMonth: sameMonth(cellDate, mediationCalendarMonth),
        hasSchedule: mediationScheduleDateKeys.has(key),
        isSelected: mediationFilterDate === key,
        isToday: toDateKey(new Date().toISOString()) === key,
        tooltip: titles.length > 0 ? `${key}\n${titles.join("\n")}` : key,
      };
    });
  }, [
    mediationCalendarMonth,
    mediationFilterDate,
    mediationScheduleDateKeys,
    mediationTitlesByDate,
  ]);

  const displayMediationCases = useMemo(() => {
    const sorted = mediationVisibleCases;

    if (!mediationSearchNeedle) return sorted;

    return sorted.filter((item) => {
      const title = item.title.toLowerCase();
      const rawDate = String(item.date || "").toLowerCase();
      const formattedDate = formatCaseDate(item.date).toLowerCase();
      const statusText = String(item.status || "").toLowerCase();
      const issueText = String(item.issueDescription || "").toLowerCase();
      const participantNames = sanitizeIdList(item.participantIds)
        .map((id) => getStudentName(id).toLowerCase())
        .join(" ");

      return (
        title.includes(mediationSearchNeedle) ||
        rawDate.includes(mediationSearchNeedle) ||
        formattedDate.includes(mediationSearchNeedle) ||
        statusText.includes(mediationSearchNeedle) ||
        issueText.includes(mediationSearchNeedle) ||
        participantNames.includes(mediationSearchNeedle)
      );
    });
  }, [mediationVisibleCases, mediationSearchNeedle, students]);

  const getStudentEmail = (id: number) => {
    const s = students.find((x) => x.id === id);
    return s?.email ?? "-";
  };

  const getCollegeName = (id: number) =>
    colleges.find((x) => x.id === id)?.name ?? "-";

  const getAcademicYearName = (id: number) =>
    years.find((x) => x.id === id)?.name ?? "-";

  const getYearLevelName = (id: number) =>
    yearLevels.find((x) => x.id === id)?.name ?? "-";

  const getCourseNameByStudentId = (studentUserId: number) => {
    const s = students.find((x) => x.id === studentUserId);
    if (!s) return "-";
    const sid = userCourseId(s);
    if (!sid) return "-";
    return courses.find((c) => c.id === sid)?.name ?? "-";
  };
  const matchesStudentFilters = (student?: User) => {
    if (!student) return true;
    const courseId = userCourseId(student);

    return (
      (filterCollegeId ? student.collegeId === filterCollegeId : true) &&
      (showYearLevelFilter && filterYearLevelId
        ? student.yearLevelId === filterYearLevelId
        : true) &&
      (filterCourseId ? courseId === 0 || courseId === filterCourseId : true)
    );
  };
  const historyItems = useMemo<HistoryItem[]>(() => {
    const sessionItems = completedCases.map((item) => {
      const student = students.find((entry) => entry.id === item.studentId);

      return {
        id: `session-${item.id}`,
        type: "session" as const,
        label: "Session",
        studentText: getStudentName(item.studentId),
        collegeTitle: getCollegeName(item.collegeId),
        collegeSubtitle: `${getAcademicYearName(item.academicYearId)} / ${getYearLevelName(item.yearLevelId)}`,
        courseText: getCourseNameByStudentId(item.studentId),
        timeText: formatHistoryTime(item.time, item.id),
        dateValue: item.date,
        statusText: item.status,
        viewTo: `/app/counseling/${item.id}${filterQuery}`,
        searchText: [
          "session sessions",
          "case type session",
          "Session",
          getStudentName(item.studentId),
          getCollegeName(item.collegeId),
          `${getAcademicYearName(item.academicYearId)} / ${getYearLevelName(item.yearLevelId)}`,
          getCourseNameByStudentId(item.studentId),
          student?.email ?? "",
          item.reason ?? "",
          item.date,
        ]
          .join(" ")
          .toLowerCase(),
        sortTimestamp: parseSortTimestamp(item.createdAt, item.time, item.date),
      };
    });

    const referralItems = referrals
      .filter((item) => item.status === "Complete")
      .filter((item) => item.academicYearId === selectedAyId)
      .filter((item) => (filterCollegeId ? item.collegeId === filterCollegeId : true))
      .filter((item) =>
        showYearLevelFilter && filterYearLevelId
          ? item.yearLevelId === filterYearLevelId
          : true,
      )
      .filter((item) => {
        if (!filterCourseId) return true;
        const student = students.find((entry) => entry.id === item.studentId);
        return matchesStudentFilters(student);
      })
      .map((item) => {
        const student = students.find((entry) => entry.id === item.studentId);

        return {
          id: `referral-${item.id}`,
          type: "referral" as const,
          label: "Referral",
          studentText: getStudentName(item.studentId),
          collegeTitle: getCollegeName(item.collegeId),
          collegeSubtitle: `${getAcademicYearName(item.academicYearId)} / ${getYearLevelName(item.yearLevelId)}`,
          courseText: getCourseNameByStudentId(item.studentId),
          timeText: formatHistoryTime(item.referredTime, item.id),
          dateValue: item.referredDate ?? item.createdAt,
          statusText: item.status,
          viewTo: `/app/referrals/${item.id}`,
          searchText: [
            "referral referrals",
            "case type referral",
            "Referral",
            getStudentName(item.studentId),
            getCollegeName(item.collegeId),
            `${getAcademicYearName(item.academicYearId)} / ${getYearLevelName(item.yearLevelId)}`,
            getCourseNameByStudentId(item.studentId),
            student?.email ?? "",
            item.reason,
            item.referredDate ?? "",
          ]
            .join(" ")
            .toLowerCase(),
          sortTimestamp: parseSortTimestamp(
            item.createdAt,
            item.referredTime,
            item.referredDate,
          ),
        };
      });

    const combined = [...sessionItems, ...referralItems].sort((a, b) => {
      const byTimestamp = b.sortTimestamp - a.sortTimestamp;
      if (byTimestamp !== 0) return byTimestamp;

      const byDateValue =
        parseSortTimestamp(b.dateValue, b.timeText, undefined) -
        parseSortTimestamp(a.dateValue, a.timeText, undefined);
      if (byDateValue !== 0) return byDateValue;

      return b.id.localeCompare(a.id);
    });

    const typeFiltered = historyTypeFilter
      ? combined.filter((item) => item.type === historyTypeFilter)
      : combined;

    if (!historySearchNeedle) return typeFiltered;
    return typeFiltered.filter((item) =>
      item.searchText.includes(historySearchNeedle),
    );
  }, [
    completedCases,
    referrals,
    students,
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    showYearLevelFilter,
    selectedAyId,
    historySearchNeedle,
    historyTypeFilter,
    filterQuery,
    courses,
  ]);

  const sessionHistoryItems = useMemo(
    () => historyItems.filter((item) => item.type === "session"),
    [historyItems],
  );

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(sessionHistoryItems.length / HISTORY_PAGE_SIZE),
  );
  const paginatedHistoryItems = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return sessionHistoryItems.slice(start, start + HISTORY_PAGE_SIZE);
  }, [sessionHistoryItems, historyPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [
    historySearch,
    historyTypeFilter,
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    showYearLevelFilter,
    selectedAyId,
  ]);

  useEffect(() => {
    if (historyPage <= totalHistoryPages) return;
    setHistoryPage(totalHistoryPages);
  }, [historyPage, totalHistoryPages]);

  const persistCases = (nextCases: CounselingCase[]) => {
    const seededNext = seedCompletedHistoryCases(nextCases, students);
    setCases(seededNext);
    save(CASES_KEY, seededNext);
  };
  const persistMediationCases = (nextCases: MediationCase[]) => {
    const seededNext = seedMediationCases(nextCases, students, activeYearId);
    setMediationCases(seededNext);
    save(MEDIATION_KEY, seededNext);
  };
  const resetMediationModal = () => {
    setMediationCaseTitle("");
    setMediationDate("");
    setMediationIssueDescription("");
    setMediationParticipantIds([]);
    setMediationFilterCollegeId(0);
    setMediationFilterCourseId(0);
    setMediationFilterYearLevelId(0);
    setShowMediationModalFilters(false);
    setMediationCandidateStudentId(0);
  };
  const closeMediationModal = () => {
    setMediationOpen(false);
    resetMediationModal();
  };
  const closeParticipantsModal = () => {
    setMediationParticipantsOpen(false);
    setMediationParticipantsCaseId(null);
    setMediationParticipantIds([]);
    setMediationParticipantsFilterCollegeId(0);
    setMediationParticipantsFilterCourseId(0);
    setMediationParticipantsFilterYearLevelId(0);
    setMediationParticipantsSearch("");
  };
  const closeNotesModal = () => {
    setMediationNotesOpen(false);
    setMediationNotesCaseId(null);
    setMediationAgreementsMade("");
    setMediationOutcome("");
    setMediationRemarks("");
  };
  const toggleMediationParticipant = (id: number) => {
    setMediationParticipantIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };
  const resetMediationParticipantFilters = () => {
    setMediationFilterCollegeId(0);
    setMediationFilterCourseId(0);
    setMediationFilterYearLevelId(0);
    setShowMediationModalFilters(false);
  };
  const addMediationParticipant = () => {
    if (!mediationCandidateStudentId) return;
    if (mediationParticipantIds.includes(mediationCandidateStudentId)) return;

    setMediationParticipantIds((current) => [...current, mediationCandidateStudentId]);
  };
  const openCreateMediationCase = () => {
    resetMediationModal();
    setMediationOpen(true);
  };
  const openMediationParticipantsModal = (item: MediationCase) => {
    setMediationParticipantsCaseId(item.id);
    setMediationParticipantIds(item.participantIds);
    setMediationParticipantsFilterCollegeId(0);
    setMediationParticipantsFilterCourseId(0);
    setMediationParticipantsFilterYearLevelId(0);
    setMediationParticipantsSearch("");
    setMediationParticipantsOpen(true);
  };
  const openMediationNotesModal = (item: MediationCase) => {
    setMediationNotesCaseId(item.id);
    setMediationAgreementsMade(item.agreementsMade ?? "");
    setMediationOutcome(item.outcome ?? "");
    setMediationRemarks(item.remarks ?? "");
    setMediationNotesOpen(true);
  };
  const handleSaveMediationCase = async () => {
    const cleanTitle = optionalText(mediationCaseTitle);
    const cleanDate = optionalText(mediationDate);
    const participantIds = sanitizeIdList(mediationParticipantIds);

    if (savingMediationCase || !cleanTitle || !cleanDate || participantIds.length < 2) {
      return;
    }

    try {
      setSavingMediationCase(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));

      const nextId =
        mediationCases.reduce((max, item) => Math.max(max, item.id), 0) + 1;

      persistMediationCases([
        {
          id: nextId,
          title: cleanTitle,
          participantIds,
          STAFFUserId:
            authUser && authUser.role !== "STUDENT" ? authUser.id : undefined,
          academicYearId: activeYearId,
          date: cleanDate,
          status: "Open",
          issueDescription: optionalText(mediationIssueDescription),
          createdAt: cleanDate,
        },
        ...mediationCases,
      ]);

      closeMediationModal();
    } finally {
      setSavingMediationCase(false);
    }
  };
  const handleSaveMediationParticipants = async () => {
    if (!mediationParticipantsCaseId || savingMediationParticipants) return;
    const participantIds = sanitizeIdList(mediationParticipantIds);

    if (participantIds.length < 2) {
      return;
    }

    try {
      setSavingMediationParticipants(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));

      persistMediationCases(
        mediationCases.map((item) =>
          item.id === mediationParticipantsCaseId
            ? { ...item, participantIds }
            : item,
        ),
      );
      closeParticipantsModal();
    } finally {
      setSavingMediationParticipants(false);
    }
  };
  const handleSaveMediationNotes = async () => {
    if (!mediationNotesCaseId || savingMediationNotes) return;

    try {
      setSavingMediationNotes(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));

      persistMediationCases(
        mediationCases.map((item) =>
          item.id === mediationNotesCaseId
            ? {
                ...item,
                agreementsMade: optionalText(mediationAgreementsMade),
                outcome: optionalText(mediationOutcome),
                remarks: optionalText(mediationRemarks),
              }
            : item,
        ),
      );
      closeNotesModal();
    } finally {
      setSavingMediationNotes(false);
    }
  };
  const updateMediationStatus = async (id: number, nextStatus: MediationStatus) => {
    const target = mediationCases.find((item) => item.id === id);
    if (!target) return;

    if (
      nextStatus === "Resolved" &&
      sanitizeIdList(target.participantIds).length < 2
    ) {
      alert("A mediation case needs at least 2 participants before it can be marked as Resolved.");
      return;
    }

    if (nextStatus === "Resolved" && !isMediationResolutionReady(target)) {
      alert("Fill in Agreements Made, Outcome, and Remarks before marking this mediation case as Resolved.");
      return;
    }

    try {
      setStatusUpdateOverlay({ kind: "mediation", id });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));

      persistMediationCases(
        mediationCases.map((item) =>
          item.id === id
            ? {
                ...item,
                status: nextStatus,
                resolvedAt: nextStatus === "Resolved" ? todayIsoDate() : undefined,
              }
            : item,
        ),
      );

      if (nextStatus === "Resolved") {
        setActiveTab("sessions");
        setShowSessionHistory(true);
      }
    } finally {
      setStatusUpdateOverlay(null);
    }
  };
  const mediationParticipantSummary = (participantIds: number[]) => {
    const names = sanitizeIdList(participantIds)
      .map((id) => getStudentName(id))
      .filter((name) => name !== "Unknown");

    if (names.length === 0) return "No participants added";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  };

  const addSessionStudent = () => {
    const nextStudent = availableAdditionalStudents[0];
    if (!nextStudent) return;
    setAdditionalStudentIds((current) =>
      sanitizeIdList([...current, nextStudent.id]),
    );
  };
  const updateAdditionalSessionStudent = (index: number, nextId: number) => {
    setAdditionalStudentIds((current) => {
      const next = [...current];
      next[index] = nextId;
      return sanitizeIdList(next).filter((id) => id !== studentId);
    });
  };
  const removeAdditionalSessionStudent = (index: number) => {
    setAdditionalStudentIds((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const resetModal = () => {
    setEditingCaseId(null);
    setShowModalFilters(false);
    setModalCollegeId(filterCollegeId);
    setModalCourseId(filterCourseId);
    setModalYearLevelId(filterYearLevelId);
    setModalSection("");
    setStudentId(0);
    setAdditionalStudentIds([]);
    setStaffUserId(defaultStaffUserId);
    setDate("");
    setTime("");
    setStatus("Pending");
    setReason("");
    setNotes("");
    setActionTaken("");
    setFollowUpDate("");
    setTimeFinished("");
    setRecommendation("");
  };

  const openAddSession = () => {
    resetModal();
    setOpen(true);
  };

  const openEditSession = (item: CounselingCase) => {
    const currentStudent = students.find((student) => student.id === item.studentId);

    setEditingCaseId(item.id);
    setShowModalFilters(false);
    setModalCollegeId(item.collegeId || currentStudent?.collegeId || 0);
    setModalCourseId(currentStudent ? userCourseId(currentStudent) : 0);
    setModalYearLevelId(item.yearLevelId || currentStudent?.yearLevelId || 0);
    setModalSection(currentStudent ? userSection(currentStudent) : "");
    setStudentId(item.studentId);
    setAdditionalStudentIds([]);
    setStaffUserId(item.STAFFUserId ?? item.counselorUserId ?? 0);
    setDate(item.date);
    setTime(item.time ?? "");
    setStatus(item.status);
    setReason(item.reason ?? "");
    setNotes(item.notes ?? "");
    setActionTaken(item.actionTaken ?? "");
    setFollowUpDate(item.followUpDate ?? "");
    setTimeFinished(item.timeFinished ?? "");
    setRecommendation(item.recommendation ?? "");
    setOpen(true);
  };

  const closeModal = () => {
    if (savingSession || sessionCreateSuccess) return;
    setOpen(false);
    setEditingCaseId(null);
    setShowModalFilters(false);
  };

  const updateStatus = async (id: number, status: CounselingCase["status"]) => {
    try {
      const target = cases.find((item) => item.id === id);
      if (!target) return;

      if (status === "Completed" && !isCompletionReady(target)) {
        alert(completionAlertMessage());
        return;
      }

      const assignedStaffId = target.STAFFUserId ?? target.counselorUserId ?? 0;
      if (status !== "Pending" && (!assignedStaffId || !target.date || !target.time)) {
        alert("Assign staff, date, and time before changing this session status.");
        return;
      }

      setStatusUpdateOverlay({ kind: "session", id });
      const minimumSpinnerDelay = new Promise<void>((resolve) =>
        window.setTimeout(resolve, 2000),
      );
      const [res] = await Promise.all([
        updateCounselingCase({
          id,
          STAFFUserId: assignedStaffId || null,
          date: target.date,
          status,
          time: target?.time ?? undefined,
        }),
        minimumSpinnerDelay,
      ]);
      const next = mergeCounselingCases(res.cases ?? [], cases).map((item) =>
        item.id === id ? { ...item, status } : item,
      );
      persistCases(next);
    } catch (e: any) {
      alert(e?.message || "Failed to update case status.");
    } finally {
      setStatusUpdateOverlay(null);
    }
  };

  const handleSaveSession = async () => {
    const sessionStudentIds = editingCaseId
      ? sanitizeIdList([studentId])
      : selectedSessionStudentIds;

    if (
      (!editingCaseId && missingCreateSessionFields.length > 0) ||
      sessionStudentIds.length === 0 ||
      !date ||
      (editingCaseId && (!resolvedModalCollegeId || !resolvedModalYearLevelId)) ||
      savingSession
    ) {
      return;
    }
    const editingCase =
      editingCaseId != null ? cases.find((item) => item.id === editingCaseId) : undefined;
    const isEditingSession = editingCaseId != null;
    const nextFollowUpDate = optionalText(followUpDate);
    const originalFollowUpDate = optionalText(editingCase?.followUpDate);
    const nextTimeFinished = optionalText(timeFinished);
    const nextRecommendation = optionalText(recommendation);

    if (
      status === "Completed" &&
      !isCompletionReady({ reason, notes, actionTaken })
    ) {
      alert(completionAlertMessage());
      return;
    }

    if (status !== "Pending" && (!staffUserId || !date || !optionalText(time))) {
      alert("Assign staff, date, and time before changing this session status.");
      return;
    }

    if (
      nextFollowUpDate &&
      nextFollowUpDate !== originalFollowUpDate &&
      nextFollowUpDate <= todayIsoDate()
    ) {
      alert("Follow-up date must be a future date.");
      return;
    }

    const basePayload = {
      STAFFUserId: staffUserId || null,
      academicYearId: selectedAyId,
      date,
      time: optionalText(time),
      status,
      reason: optionalText(reason),
      notes: optionalText(notes),
      actionTaken: optionalText(actionTaken),
      followUpDate: nextFollowUpDate,
    };

    const payload = {
      studentId,
      ...basePayload,
      collegeId: resolvedModalCollegeId,
      yearLevelId: resolvedModalYearLevelId,
      timeFinished: nextTimeFinished,
      recommendation: nextRecommendation,
      studentRequest: editingCase?.studentRequest,
      createdByUserId: editingCase?.createdByUserId,
      createdByRole: editingCase?.createdByRole,
    };

    try {
      setSavingSession(true);
      if (editingCaseId) {
        const minLoadingDelay = new Promise<void>((resolve) =>
          window.setTimeout(resolve, 1200),
        );
        const res = await updateCounselingCase({
          id: editingCaseId,
          studentId,
          STAFFUserId: staffUserId || null,
          academicYearId: selectedAyId,
          collegeId: resolvedModalCollegeId,
          yearLevelId: resolvedModalYearLevelId,
          date,
          status,
          time: optionalText(time),
          reason: optionalText(reason),
          notes: optionalText(notes),
          actionTaken: optionalText(actionTaken),
          followUpDate: nextFollowUpDate,
        });
        await minLoadingDelay;
        const next = mergeCounselingCases(res.cases ?? cases, cases).map((item) =>
          item.id === editingCaseId
            ? {
                ...item,
                ...payload,
              }
            : item,
        );
        persistCases(next);
      } else {
        const minLoadingDelay = new Promise<void>((resolve) =>
          window.setTimeout(resolve, 3000),
        );
        let nextCases = cases;
        let fallbackId =
          cases.reduce((max, item) => Math.max(max, item.id), 0) + 1;

        for (const currentStudentId of sessionStudentIds) {
          const academicValues =
            getSessionStudentAcademicValues(currentStudentId);
          const currentPayload = {
            studentId: currentStudentId,
            ...basePayload,
            collegeId: academicValues.collegeId,
            yearLevelId: academicValues.yearLevelId,
            studentRequest: false,
          };
          const localCurrentPayload = {
            ...currentPayload,
            createdByUserId: authUser?.id ?? null,
            createdByRole: authUser?.role ?? null,
          };

          const res = await createCounselingCase(currentPayload);
          const createdId =
            typeof res.id === "number" && Number.isFinite(res.id)
              ? res.id
              : fallbackId++;
          fallbackId = Math.max(fallbackId, createdId + 1);
          let merged = mergeCounselingCases(
            res.cases ?? nextCases,
            nextCases,
          ).map((item) =>
            item.id === createdId
              ? {
                  ...item,
                  ...localCurrentPayload,
                }
              : item,
          );
          if (!merged.some((item) => item.id === createdId)) {
            merged = [
              {
                id: createdId,
                ...localCurrentPayload,
                createdAt: currentPayload.date,
              },
              ...merged,
            ];
          }
          nextCases = merged;
        }

        await minLoadingDelay;
        persistCases(nextCases);
      }

      if (isEditingSession) {
        setOpen(false);
        setEditingCaseId(null);
        setShowModalFilters(false);
        resetModal();
      } else {
        setSessionCreateSuccess(true);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
        setSessionCreateSuccess(false);
        setOpen(false);
        setEditingCaseId(null);
        setShowModalFilters(false);
        resetModal();
      }
    } catch (e: any) {
      alert(e?.message || "Failed to save counseling session.");
    } finally {
      setSavingSession(false);
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
  const counselingNotesSheet: React.CSSProperties = {
    display: "grid",
    gap: 12,
  };
  const counselingNotesLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    opacity: 0.85,
  };
  const counselingNotesInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: "#ffffff",
    color: "var(--text)",
  };
  const counselingNotesReadOnlyInputStyle: React.CSSProperties = {
    ...counselingNotesInputStyle,
    background: "rgba(248,250,252,0.92)",
    color: "#334155",
    cursor: "default",
  };
  const counselingNotesTextareaStyle: React.CSSProperties = {
    ...textareaStyle,
    minHeight: 90,
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
  const historyToolbarIconButton: React.CSSProperties = {
    ...headerIconButton,
    height: 44,
    width: 44,
    borderRadius: 12,
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
  const sessionModalBody: React.CSSProperties = {
    position: "relative",
  };
  const sessionCreateOverlay: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    pointerEvents: "none",
  };
  const sessionCreateCard: React.CSSProperties = {
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
  const sessionCreateIconWrap: React.CSSProperties = {
    position: "relative",
    width: 168,
    height: 168,
    display: "grid",
    placeItems: "center",
  };
  const sessionCreateSpinnerRing: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background:
      "conic-gradient(from 0deg, rgba(9,14,25,0.96) 0deg, rgba(9,14,25,0.96) 90deg, rgba(251,191,36,1) 90deg, rgba(245,158,11,1) 250deg, rgba(9,14,25,0.22) 320deg, rgba(9,14,25,0.08) 360deg)",
    animation: "gcms-spin 0.95s linear infinite",
    boxShadow: "0 14px 30px rgba(245,158,11,0.22)",
  };
  const sessionCreateSpinnerHole: React.CSSProperties = {
    position: "absolute",
    inset: 16,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.98)",
  };
  const sessionCreateIconCore: React.CSSProperties = {
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
  const sessionCreateTitle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    color: "rgba(9,14,25,1)",
    lineHeight: 1.15,
  };
  const sessionCreateSubtitle: React.CSSProperties = {
    fontSize: 14,
    color: "#526371",
    lineHeight: 1.5,
    maxWidth: 290,
  };
  const sessionWarningText: React.CSSProperties = {
    marginTop: 8,
    color: "#b42318",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.4,
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
  const renderMediationLoadingOverlay = (title: string, subtitle: string) => (
    <div style={sessionCreateOverlay}>
      <div style={sessionCreateCard}>
        <div style={sessionCreateIconWrap}>
          <div style={sessionCreateSpinnerRing} />
          <div style={sessionCreateSpinnerHole} />
          <div style={sessionCreateIconCore}>
            <Handshake size={52} />
          </div>
        </div>
        <div style={sessionCreateTitle}>{title}</div>
        <div style={sessionCreateSubtitle}>{subtitle}</div>
      </div>
    </div>
  );
  const statusUpdateScreenOverlay: React.CSSProperties = {
    position: "fixed",
    left: statusOverlayFrame.left,
    right: statusOverlayFrame.right,
    top: statusOverlayFrame.top,
    bottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    background: "rgba(248,250,252,0.72)",
    backdropFilter: "blur(4px)",
  };
  const renderStatusUpdateOverlay = () => {
    if (!statusUpdateOverlay) return null;
    const Icon = statusUpdateOverlay.kind === "session" ? CalendarDays : Handshake;
    const title =
      statusUpdateOverlay.kind === "session"
        ? "Updating Session..."
        : "Updating Mediation...";
    const subtitle =
      statusUpdateOverlay.kind === "session"
        ? "Please wait while we save the session status update."
        : "Please wait while we save the mediation status update.";

    return (
      <div style={statusUpdateScreenOverlay}>
        <div style={sessionCreateCard}>
          <div style={sessionCreateIconWrap}>
            <div style={sessionCreateSpinnerRing} />
            <div style={sessionCreateSpinnerHole} />
            <div style={sessionCreateIconCore}>
              <Icon size={52} />
            </div>
          </div>
          <div style={sessionCreateTitle}>{title}</div>
          <div style={sessionCreateSubtitle}>{subtitle}</div>
        </div>
      </div>
    );
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
    height: 44,
    width: 44,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    color: "#000000",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const modalCompactFilterPanel: React.CSSProperties = {
    ...compactFilterPanel,
    top: "calc(100% + 8px)",
    width: "min(340px, calc(100vw - 140px))",
  };
  const mediationModalCompactFilterPanel: React.CSSProperties = {
    ...modalCompactFilterPanel,
    top: "auto",
    bottom: "calc(100% + 8px)",
    right: 0,
    left: "auto",
    width: "min(220px, calc(100vw - 140px))",
    padding: 10,
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
  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  };
  const sessionIconActionButton: React.CSSProperties = {
    height: 36,
    width: 36,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#000000",
    textDecoration: "none",
    padding: 0,
  };
  const historyTh: React.CSSProperties = {
    ...th,
    fontSize: 12.5,
    fontWeight: 800,
  };
  const historyTd: React.CSSProperties = {
    ...td,
    fontSize: 12.5,
    color: "#334155",
    verticalAlign: "middle",
  };
  const sessionTh: React.CSSProperties = {
    ...th,
    fontSize: 12.5,
    fontWeight: 800,
  };
  const sessionTd: React.CSSProperties = {
    ...td,
    fontSize: 12.5,
    color: "#334155",
    verticalAlign: "middle",
  };
  const tabButtonStyle: React.CSSProperties = {
    minHeight: 38,
    minWidth: 0,
    padding: "0 16px",
    borderRadius: 10,
    background: "white",
    display: "inline-flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 13.5,
    color: "#111827",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
  const paginationButtonStyle: React.CSSProperties = {
    minWidth: 36,
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    color: "#334155",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  };
  const renderTabContent = () => {
    if (activeTab === "sessions") {
      const isHistoryTab = showSessionHistory;

      return (
        <div style={{ display: "grid", gap: 12 }}>
          {activeTab === "sessions" && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <CounselingActionButton
                onClick={() => {
                  setShowSessionHistory((current) => !current);
                  setHistoryPage(1);
                  setHistorySearch("");
                  setHistoryTypeFilter(null);
                }}
                active={showSessionHistory}
                title={
                  showSessionHistory
                    ? "Show active sessions"
                    : "Show completed session history"
                }
                ariaLabel={
                  showSessionHistory
                    ? "Show active sessions"
                    : "Show completed session history"
                }
                baseStyle={headerIconButton}
              >
                {showSessionHistory ? <List size={20} /> : <History size={20} />}
              </CounselingActionButton>
              {!showSessionHistory && (
              <CounselingActionButton
                onClick={openAddSession}
                title="Add Session"
                ariaLabel="Add Session"
                baseStyle={headerIconButton}
              >
                <Plus size={20} />
              </CounselingActionButton>
              )}
            </div>
          )}

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: isHistoryTab ? 10 : 0,
            }}
          >
            <thead>
              <tr>
                {isHistoryTab && <th style={historyTh}>Case Type</th>}
                <th style={isHistoryTab ? historyTh : sessionTh}>Student Name</th>
                {!isHistoryTab && <th style={sessionTh}>Kinds</th>}
                <th style={isHistoryTab ? historyTh : sessionTh}>College / Year</th>
                <th style={isHistoryTab ? historyTh : sessionTh}>Course</th>
                <th style={isHistoryTab ? historyTh : sessionTh}>Time</th>
                <th style={isHistoryTab ? historyTh : sessionTh}>Date</th>
                <th style={isHistoryTab ? historyTh : sessionTh}>Status</th>
                <th style={isHistoryTab ? { ...historyTh, textAlign: "center" } : { ...sessionTh, textAlign: "center" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {(isHistoryTab ? sessionHistoryItems.length === 0 : displayCases.length === 0) ? (
                <tr>
                  <td
                    style={isHistoryTab ? historyTd : sessionTd}
                    colSpan={isHistoryTab ? 8 : 8}
                  >
                    <span style={{ opacity: 0.8 }}>
                      {showCompletedHistory
                        ? "No completed sessions found for this filter."
                        : "No active sessions found for this filter."}
                    </span>
                  </td>
                </tr>
              ) : isHistoryTab ? (
                paginatedHistoryItems.map((item) => {
                  const Icon =
                    item.type === "session"
                      ? CalendarDays
                      : item.type === "mediation"
                        ? Handshake
                        : FileText;
                  const statusIsPositive =
                    item.statusText === "Completed" ||
                    item.statusText === "Resolved" ||
                    item.statusText === "Complete";
                  const statusIsProgress =
                    item.statusText === "Ongoing" ||
                    item.statusText === "In Progress" ||
                    item.statusText === "Reviewed";

                  return (
                    <tr key={item.id}>
                      <td style={historyTd}>
                        <div
                          title={item.label}
                          aria-label={item.label}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            border: "1px solid rgba(15,23,42,0.08)",
                            background: "rgba(248,250,252,0.85)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color:
                              item.type === "session"
                                ? "#1e3a8a"
                                : item.type === "mediation"
                                  ? "#991b1b"
                                  : "#111827",
                          }}
                        >
                          <Icon size={16} />
                        </div>
                      </td>
                      <td style={historyTd}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                          {item.studentText}
                        </div>
                      </td>
                      <td style={historyTd}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: "#1e293b",
                              lineHeight: 1.2,
                            }}
                          >
                            {item.collegeTitle}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 400,
                              color: "#64748b",
                              lineHeight: 1.2,
                            }}
                          >
                            {item.collegeSubtitle}
                          </span>
                        </div>
                      </td>
                      <td style={historyTd}>{item.courseText}</td>
                      <td style={historyTd}>{item.timeText}</td>
                      <td style={historyTd}>{formatCaseDate(item.dateValue)}</td>
                      <td style={historyTd}>
                        <span
                          style={{
                            ...statusPill,
                            minHeight: 28,
                            minWidth: 86,
                            fontSize: 12,
                            borderColor: statusIsPositive
                              ? "#c7e8d8"
                              : statusIsProgress
                                ? "#bfdbfe"
                                : "#fde68a",
                            background: statusIsPositive
                              ? "#ecfdf3"
                              : statusIsProgress
                                ? "#eff6ff"
                                : "#fffbeb",
                            color: statusIsPositive
                              ? "#166534"
                              : statusIsProgress
                                ? "#1d4ed8"
                                : "#92400e",
                          }}
                        >
                          {item.statusText}
                        </span>
                      </td>
                      <td style={{ ...historyTd, textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <CounselingActionLink
                            to={item.viewTo}
                            title="View Details"
                            ariaLabel="View Details"
                            baseStyle={sessionIconActionButton}
                          >
                            <Eye size={16} />
                          </CounselingActionLink>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                displayCases.map((c) => (
                  <tr key={c.id}>
                    {(() => {
                      const overdue =
                        !isHistoryTab &&
                        c.status !== "Completed" &&
                        toDateKey(c.date) < todayIsoDate();
                      const overdueCellStyle: React.CSSProperties = overdue
                        ? {
                            background: "rgba(239,68,68,0.08)",
                            borderTop: "1px solid rgba(239,68,68,0.18)",
                          }
                        : {};

                      return (
                        <>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: isHistoryTab ? 600 : 600,
                          fontSize: 12.5,
                          color: isHistoryTab ? "#334155" : "inherit",
                        }}
                      >
                        {getStudentName(c.studentId)}
                      </div>
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                        color: isHistoryTab ? historyTd.color : sessionTd.color,
                      }}
                    >
                      {getSessionKind(c)}
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                      }}
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: "#1e293b",
                            lineHeight: 1.2,
                          }}
                        >
                          {getCollegeName(c.collegeId)}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "#64748b",
                            lineHeight: 1.2,
                          }}
                        >
                          {getAcademicYearName(c.academicYearId)} / {getYearLevelName(c.yearLevelId)}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                        color: isHistoryTab ? historyTd.color : sessionTd.color,
                      }}
                    >
                      {getCourseNameByStudentId(c.studentId)}
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                        color: isHistoryTab ? historyTd.color : sessionTd.color,
                      }}
                    >
                      {formatCaseTime(c.time)}
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                        color: isHistoryTab ? historyTd.color : sessionTd.color,
                      }}
                    >
                      {formatCaseDate(c.date)}
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab ? historyTd : sessionTd),
                        ...overdueCellStyle,
                      }}
                    >
                      {isHistoryTab ? (
                        <span
                          style={{
                            ...statusPill,
                            minHeight: 28,
                            minWidth: 86,
                            fontSize: 12,
                            borderColor:
                              c.status === "Completed"
                                ? "#c7e8d8"
                                : c.status === "Ongoing"
                                  ? "#bfdbfe"
                                  : "#fde68a",
                            background:
                              c.status === "Completed"
                                ? "#ecfdf3"
                                : c.status === "Ongoing"
                                  ? "#eff6ff"
                                  : "#fffbeb",
                            color:
                              c.status === "Completed"
                                ? "#166534"
                                : c.status === "Ongoing"
                                  ? "#1d4ed8"
                                  : "#92400e",
                          }}
                        >
                          {c.status}
                        </span>
                      ) : (
                        <DropdownSelect
                          value={c.status}
                          onChange={(e) => {
                            const nextStatus = e.target.value as CounselingCase["status"];
                            if (
                              nextStatus === "Completed" &&
                              !isCompletionReady(c)
                            ) {
                              alert(completionAlertMessage());
                              return;
                            }
                            updateStatus(c.id, nextStatus);
                          }}
                          disabled={statusUpdateOverlay !== null}
                          style={{
                            height: 34,
                            minWidth: 118,
                            borderRadius: 10,
                            fontSize: 12.5,
                            fontWeight: 800,
                            border:
                              c.status === "Completed"
                                ? "1px solid #c7e8d8"
                                : c.status === "Ongoing"
                                  ? "1px solid #bfdbfe"
                                  : "1px solid #fde68a",
                            background:
                              c.status === "Completed"
                                ? "#ecfdf3"
                                : c.status === "Ongoing"
                                  ? "#eff6ff"
                                  : "#fffbeb",
                            color:
                              c.status === "Completed"
                                ? "#166534"
                                : c.status === "Ongoing"
                                  ? "#1d4ed8"
                                  : "#92400e",
                          }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Ongoing">Ongoing</option>
                          <option
                            value="Completed"
                            disabled={!isCompletionReady(c)}
                          >
                            Completed
                          </option>
                        </DropdownSelect>
                      )}
                    </td>
                    <td
                      style={{
                        ...(isHistoryTab
                          ? { ...historyTd, textAlign: "center" }
                          : { ...sessionTd, textAlign: "center" }),
                        ...overdueCellStyle,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {isHistoryTab ? (
                          <>
                            <CounselingActionLink
                              to={`/app/counseling/${c.id}${filterQuery}`}
                              title="View Details"
                              ariaLabel="View Details"
                              baseStyle={sessionIconActionButton}
                            >
                              <Eye size={16} />
                            </CounselingActionLink>
                          </>
                        ) : (
                          <>
                            <CounselingActionLink
                              to={`/app/counseling/${c.id}${filterQuery}`}
                              title="View Details"
                              aria-label="View Details"
                              baseStyle={sessionIconActionButton}
                            >
                              <Eye size={16} />
                            </CounselingActionLink>
                            <CounselingActionButton
                              onClick={() => openEditSession(c)}
                              title="Edit"
                              ariaLabel="Edit"
                              baseStyle={sessionIconActionButton}
                            >
                              <SquarePen size={16} />
                            </CounselingActionButton>
                          </>
                        )}
                      </div>
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {isHistoryTab && sessionHistoryItems.length > 0 && totalHistoryPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 6,
              }}
            >
              <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>
                Page {historyPage} of {totalHistoryPages}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage((current) => Math.max(1, current - 1))
                  }
                  disabled={historyPage === 1}
                  style={{
                    ...paginationButtonStyle,
                    opacity: historyPage === 1 ? 0.55 : 1,
                    cursor: historyPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>

                {Array.from({ length: totalHistoryPages }, (_, index) => {
                  const page = index + 1;
                  const active = page === historyPage;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setHistoryPage(page)}
                      style={{
                        ...paginationButtonStyle,
                        minWidth: 36,
                        padding: 0,
                        borderColor: active
                          ? "rgba(37,99,235,0.24)"
                          : "var(--border)",
                        background: active
                          ? "rgba(239,246,255,0.96)"
                          : "white",
                        color: active ? "#1d4ed8" : "#334155",
                      }}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setHistoryPage((current) =>
                      Math.min(totalHistoryPages, current + 1),
                    )
                  }
                  disabled={historyPage === totalHistoryPages}
                  style={{
                    ...paginationButtonStyle,
                    opacity: historyPage === totalHistoryPages ? 0.55 : 1,
                    cursor:
                      historyPage === totalHistoryPages
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "mediation") {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={sessionTh}>Case Title</th>
                <th style={sessionTh}>Participants (2+ students)</th>
                <th style={sessionTh}>Date</th>
                <th style={sessionTh}>Status</th>
                <th style={{ ...sessionTh, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayMediationCases.length === 0 ? (
                <tr>
                  <td style={sessionTd} colSpan={5}>
                    <span style={{ opacity: 0.8 }}>
                      {mediationSearchNeedle || mediationFilterDate
                        ? "No mediation cases matched your search or selected date."
                        : "No mediation cases created yet."}
                    </span>
                  </td>
                </tr>
              ) : (
                displayMediationCases.map((item) => {
                  const overdueMediation =
                    item.status !== "Resolved" && toDateKey(item.date) < todayIsoDate();
                  const rowTdStyle = overdueMediation
                    ? {
                        background: "rgba(239,68,68,0.08)",
                        borderTop: "1px solid rgba(239,68,68,0.18)",
                      }
                    : null;

                  return (
                    <tr key={item.id}>
                      <td style={{ ...sessionTd, ...(rowTdStyle ?? {}) }}>
                        <span style={{ fontWeight: 500, color: "#0f172a" }}>
                          {item.title}
                        </span>
                      </td>
                      <td style={{ ...sessionTd, ...(rowTdStyle ?? {}) }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span style={{ fontWeight: 500, color: "#0f172a" }}>
                            <span style={{ fontWeight: 800 }}>
                              {sanitizeIdList(item.participantIds).length}
                            </span>{" "}
                            participants
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            {mediationParticipantSummary(item.participantIds)}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...sessionTd, ...(rowTdStyle ?? {}) }}>
                        {formatCaseDate(item.date)}
                      </td>
                      <td style={{ ...sessionTd, ...(rowTdStyle ?? {}) }}>
                        <DropdownSelect
                          value={item.status}
                          onChange={(e) =>
                            updateMediationStatus(
                              item.id,
                              e.target.value as MediationStatus,
                            )
                          }
                          disabled={statusUpdateOverlay !== null}
                          style={{
                            height: 34,
                            minWidth: 132,
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 800,
                            borderColor:
                              item.status === "Resolved"
                                ? "#c7e8d8"
                                : item.status === "In Progress"
                                  ? "#bfdbfe"
                                  : "#fde68a",
                            background:
                              item.status === "Resolved"
                                ? "#ecfdf3"
                                : item.status === "In Progress"
                                  ? "#eff6ff"
                                  : "#fffbeb",
                            color:
                              item.status === "Resolved"
                                ? "#166534"
                                : item.status === "In Progress"
                                  ? "#1d4ed8"
                                  : "#92400e",
                          }}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option
                            value="Resolved"
                            disabled={
                              !isMediationResolutionReady(item) &&
                              item.status !== "Resolved"
                            }
                          >
                            Resolved
                          </option>
                        </DropdownSelect>
                      </td>
                      <td style={{ ...sessionTd, ...(rowTdStyle ?? {}), textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent: "center",
                          }}
                        >
                          <CounselingActionLink
                            to={`/app/counseling/${item.id}?tab=mediation`}
                            title="View"
                            ariaLabel="View"
                            baseStyle={sessionIconActionButton}
                          >
                            <Eye size={16} />
                          </CounselingActionLink>
                          <CounselingActionButton
                            onClick={() => openMediationParticipantsModal(item)}
                            title="Add Participants"
                            ariaLabel="Add Participants"
                            baseStyle={sessionIconActionButton}
                          >
                            <Users size={16} />
                          </CounselingActionButton>
                          <CounselingActionButton
                            onClick={() => openMediationNotesModal(item)}
                            title="Add Notes"
                            ariaLabel="Add Notes"
                            baseStyle={sessionIconActionButton}
                          >
                            <SquarePen size={16} />
                          </CounselingActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === "group-sessions" && canAccessGroupCounselling) {
      return <GroupSessions embedded />;
    }

    return null;
  };

  return (
    <div ref={pageContentRef} style={{ display: "grid", gap: 16 }}>
      {renderStatusUpdateOverlay()}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 800, marginRight: "auto" }}>Counseling</h2>
      </div>

      <div style={card}>
        <div
          style={{
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={tabBarStyle}>
              {visibleCounselingTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <CounselingTabButton
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id !== "sessions") {
                        setShowSessionHistory(false);
                        setHistorySearch("");
                        setHistoryTypeFilter(null);
                        setHistoryPage(1);
                      }
                    }}
                    active={activeTab === tab.id}
                    title={tab.label}
                    ariaLabel={tab.label}
                    baseStyle={tabButtonStyle}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </CounselingTabButton>
                );
              })}
            </div>
          </div>
          {activeTab === "mediation" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignItems: "flex-end",
              }}
            >
              <div ref={mediationDateCalendarWrapRef} style={{ position: "relative" }}>
                <CounselingActionButton
                  onClick={() => setShowMediationDateCalendar((prev) => !prev)}
                  active={Boolean(mediationFilterDate || showMediationDateCalendar)}
                  title="Filter by date"
                  ariaLabel="Filter by date"
                  baseStyle={headerIconButton}
                >
                  <CalendarDays size={20} />
                </CounselingActionButton>

                {showMediationDateCalendar && (
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
                        onClick={() =>
                          setMediationCalendarMonth((prev) => shiftMonth(prev, -1))
                        }
                        style={{
                          ...sessionIconActionButton,
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                        }}
                        aria-label="Previous month"
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>&lsaquo;</span>
                      </button>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {mediationCalendarMonth.toLocaleDateString(undefined, {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setMediationCalendarMonth((prev) => shiftMonth(prev, 1))
                        }
                        style={{
                          ...sessionIconActionButton,
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                        }}
                        aria-label="Next month"
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>&rsaquo;</span>
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
                      {mediationCalendarCells.map((cell) => (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => {
                            setMediationFilterDate(cell.key);
                            setMediationCalendarMonth(startOfMonth(new Date(cell.key)));
                            setShowMediationDateCalendar(false);
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
                          setMediationFilterDate("");
                          setShowMediationDateCalendar(false);
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
                        Has mediation case
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <div style={{ position: "relative", width: 220, maxWidth: "100%" }}>
                  <Search
                    size={15}
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
                    value={mediationSearch}
                    onChange={(e) => setMediationSearch(e.target.value)}
                    placeholder="Search case, participant, or date..."
                    style={{
                      ...inputStyle,
                      height: 44,
                      width: "100%",
                      paddingLeft: 36,
                      fontSize: 13,
                    }}
                  />
                </div>

                <CounselingActionButton
                  onClick={openCreateMediationCase}
                  title="Create Mediation Case"
                  ariaLabel="Create Mediation Case"
                  baseStyle={headerIconButton}
                >
                  <Plus size={20} />
                </CounselingActionButton>
              </div>
            </div>
          ) : tabHasFilters && (
            <div
              style={{
                display: "grid",
                gap: showSessionHistory ? 10 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                {showSessionHistory && (
                  <div style={{ position: "relative", width: 220, maxWidth: "100%" }}>
                    <Search
                      size={15}
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
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search completed sessions..."
                      style={{
                        ...inputStyle,
                        height: 44,
                        width: "100%",
                        paddingLeft: 38,
                        fontSize: 13,
                      }}
                    />
                  </div>
                )}

                <div style={{ position: "relative" }}>
                  <CounselingActionButton
                    onClick={() => setShowFilters((v) => !v)}
                    active={showFilters}
                    title={showFilters ? "Hide filters" : "Show filters"}
                    ariaLabel={showFilters ? "Hide filters" : "Show filters"}
                    baseStyle={historyToolbarIconButton}
                  >
                    <List size={20} />
                  </CounselingActionButton>

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

                      {showYearLevelFilter && (
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
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                        <CounselingActionButton
                          onClick={() => {
                            setFilterCollegeId(0);
                            setFilterCourseId(0);
                            setFilterYearLevelId(0);
                            setHistorySearch("");
                            setHistoryTypeFilter(null);
                            setShowFilters(false);
                          }}
                          title="Clear filters"
                          ariaLabel="Clear filters"
                          baseStyle={compactClearButton}
                        >
                          <X size={14} />
                          Clear
                        </CounselingActionButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {renderTabContent()}
      </div>

      <Modal
        open={open}
        onClose={savingSession || sessionCreateSuccess ? () => {} : closeModal}
        title={editingCaseId ? "Edit Session" : "Add Session"}
        contentStyle={
          editingCaseId
            ? undefined
            : { overflow: "visible", maxHeight: "none" }
        }
        bodyStyle={
          editingCaseId
            ? undefined
            : { overflow: "visible" }
        }
      >
        <div style={sessionModalBody}>
          {showSessionCreateAnimation && (
            <div style={sessionCreateOverlay}>
              <div style={sessionCreateCard}>
                <div style={sessionCreateIconWrap}>
                  {savingSession ? (
                    <>
                      <div style={sessionCreateSpinnerRing} />
                      <div style={sessionCreateSpinnerHole} />
                      <div style={sessionCreateIconCore}>
                        <CalendarDays size={52} />
                      </div>
                    </>
                  ) : (
                    <div style={{ ...sessionCreateIconCore, transform: "scale(1.02)" }}>
                      <CalendarDays size={54} />
                    </div>
                  )}
                </div>
                <div style={sessionCreateTitle}>
                  {savingSession
                    ? editingCaseId
                      ? "Saving Changes..."
                      : "Creating Session..."
                    : "Session Created"}
                </div>
                <div style={sessionCreateSubtitle}>
                  {savingSession
                    ? editingCaseId
                      ? "Please wait while we save the session updates."
                      : "Please wait while we prepare the session."
                    : "The session has been added successfully."}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: editingCaseId ? 8 : 12,
              opacity: showSessionCreateAnimation ? 0.12 : 1,
              pointerEvents: showSessionCreateAnimation ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
          <div
            style={
              editingCaseId
                ? counselingNotesSheet
                : { display: "grid", gap: 12 }
            }
          >
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
                <div style={editingCaseId ? counselingNotesLabel : label}>
                  {editingCaseId ? "Name" : "Student Name"}
                </div>
                {editingCaseId ? (
                  <input
                    value={
                      filteredStudents.find((s) => s.id === studentId)
                        ? `${getStudentName(studentId)} (${getStudentEmail(studentId)})${
                            (() => {
                              const student = filteredStudents.find((s) => s.id === studentId);
                              const section = student ? userSection(student) : "";
                              return section ? ` - ${section}` : "";
                            })()
                          }`
                        : `${getStudentName(studentId)} (${getStudentEmail(studentId)})`
                    }
                    readOnly
                    style={counselingNotesReadOnlyInputStyle}
                  />
                ) : (
                  <DropdownSelect
                    value={studentId}
                    onChange={(e) => setStudentId(Number(e.target.value))}
                    style={{
                      ...inputStyle,
                      color: studentId ? "var(--text)" : "#6b7280",
                    }}
                  >
                    <option value={0} hidden>
                      Select student
                    </option>
                    {filteredStudents
                      .filter(
                        (s) =>
                          s.id === studentId ||
                          !additionalStudentIds.includes(s.id),
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {`${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`}
                        </option>
                      ))}
                  </DropdownSelect>
                )}
              </div>

              {editingCaseId && (
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={counselingNotesLabel}>Course & Year</div>
                  <input
                    value={`${getCourseNameByStudentId(studentId)} / ${getYearLevelName(resolvedModalYearLevelId)}`}
                    readOnly
                    style={counselingNotesReadOnlyInputStyle}
                  />
                </div>
              )}

              {!editingCaseId && (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <CounselingActionButton
                    onClick={() => setShowModalFilters((value) => !value)}
                    active={showModalFilters}
                    title={showModalFilters ? "Hide student filters" : "Show student filters"}
                    ariaLabel={showModalFilters ? "Hide student filters" : "Show student filters"}
                    baseStyle={modalFilterButton}
                  >
                    <List size={18} />
                  </CounselingActionButton>
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
                            {canPickYearLevel
                              ? "All year levels"
                              : "Select course first"}
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

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <CounselingActionButton
                          onClick={() => {
                            setModalCollegeId(0);
                            setModalCourseId(0);
                            setModalYearLevelId(0);
                            setModalSection("");
                            setShowModalFilters(false);
                          }}
                          title="Clear student filters"
                          ariaLabel="Clear student filters"
                          baseStyle={compactClearButton}
                        >
                          <X size={14} />
                          Clear
                        </CounselingActionButton>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!editingCaseId && additionalStudentIds.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {additionalStudentIds.map((selectedId, index) => {
                  const blockedIds = new Set([
                    studentId,
                    ...additionalStudentIds.filter((_, itemIndex) => itemIndex !== index),
                  ]);

                  return (
                    <div
                      key={`${selectedId}-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <div style={label}>Student Name {index + 2}</div>
                        <DropdownSelect
                          value={selectedId}
                          onChange={(e) =>
                            updateAdditionalSessionStudent(
                              index,
                              Number(e.target.value),
                            )
                          }
                          style={{
                            ...inputStyle,
                            color: selectedId ? "var(--text)" : "#6b7280",
                          }}
                        >
                          <option value={0} hidden>
                            Select student
                          </option>
                          {filteredStudents
                            .filter(
                              (student) =>
                                student.id === selectedId ||
                                !blockedIds.has(student.id),
                            )
                            .map((student) => (
                              <option key={student.id} value={student.id}>
                                {`${student.fname} ${student.mname ? student.mname + " " : ""}${student.lname}`}
                              </option>
                            ))}
                        </DropdownSelect>
                      </div>

                      <CounselingActionButton
                        onClick={() => removeAdditionalSessionStudent(index)}
                        title="Remove student"
                        ariaLabel="Remove student"
                        baseStyle={modalFilterButton}
                      >
                        <X size={18} />
                      </CounselingActionButton>
                    </div>
                  );
                })}
              </div>
            )}

            {!editingCaseId && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <CounselingActionButton
                  onClick={addSessionStudent}
                  disabled={availableAdditionalStudents.length === 0}
                  title={
                    availableAdditionalStudents.length === 0
                      ? "No more students available"
                      : "Add another student"
                  }
                  ariaLabel="Add another student"
                  baseStyle={{
                    ...ghostButton,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    opacity: availableAdditionalStudents.length === 0 ? 0.62 : 1,
                    cursor:
                      availableAdditionalStudents.length === 0
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  <Plus size={16} />
                  Add Student
                </CounselingActionButton>
              </div>
            )}

            {filteredStudents.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No students found in this filter. Add students in User
                Management.
              </div>
            )}
          </div>

          <div>
            <div style={editingCaseId ? counselingNotesLabel : label}>
              {editingCaseId ? "Counselor" : "Assigned Staff"}
            </div>
            <DropdownSelect
              value={staffUserId}
              onChange={(e) => setStaffUserId(Number(e.target.value))}
              style={{
                ...(editingCaseId ? counselingNotesInputStyle : inputStyle),
                color: staffUserId ? "var(--text)" : "#6b7280",
              }}
            >
              <option value={0}>To be assigned</option>
              {staffUsers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {`${staff.fname} ${staff.mname ? staff.mname + " " : ""}${staff.lname}`}
                </option>
              ))}
            </DropdownSelect>
            {staffUsers.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No staff accounts found in User Management.
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: editingCaseId
                ? "repeat(auto-fit, minmax(150px, 1fr))"
                : "1fr 1fr",
            }}
          >
            <div>
              <div style={editingCaseId ? counselingNotesLabel : label}>Date</div>
              <FormattedDateInput
                value={date}
                onChange={(e) => setDate(e.target.value)}
                displayStyle={
                  editingCaseId ? counselingNotesInputStyle : inputStyle
                }
              />
            </div>

            {editingCaseId && (
              <div>
                <div style={counselingNotesLabel}>Session No.</div>
                <input
                  value={`#${editingCaseId}`}
                  readOnly
                  style={counselingNotesReadOnlyInputStyle}
                />
              </div>
            )}

            <div>
              <div style={editingCaseId ? counselingNotesLabel : label}>
                {editingCaseId ? "Time Start" : "Time"}
              </div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={editingCaseId ? counselingNotesInputStyle : inputStyle}
              />
            </div>

            {editingCaseId && (
              <div>
                <div style={counselingNotesLabel}>Time Finished</div>
                <input
                  type="time"
                  value={timeFinished}
                  onChange={(e) => setTimeFinished(e.target.value)}
                  style={counselingNotesInputStyle}
                />
              </div>
            )}
          </div>

          {editingCaseId && (
            <>
              <div>
                <div style={counselingNotesLabel}>Background</div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={counselingNotesTextareaStyle}
                  placeholder="Enter the student's background..."
                />
              </div>

              <div>
                <div style={counselingNotesLabel}>
                  Behavioral Observations and Relevant History
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={counselingNotesTextareaStyle}
                  placeholder="Add observations and relevant history..."
                />
              </div>

              <div>
                <div style={counselingNotesLabel}>Intervention</div>
                <textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  style={counselingNotesTextareaStyle}
                  placeholder="Describe the intervention..."
                />
              </div>
            </>
          )}

          {!editingCaseId && missingCreateSessionFields.length > 0 && (
            <div style={sessionWarningText}>
              Please fill in {missingCreateSessionFields.join(", ")} before
              creating the session.
            </div>
          )}

          {editingCaseId && (
            <div>
              <div style={counselingNotesLabel}>
                Assignment / Recommendation
              </div>
              <textarea
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                style={counselingNotesTextareaStyle}
                placeholder="Enter assignment or recommendation..."
              />
              <div style={{ marginTop: 10 }}>
                <div style={counselingNotesLabel}>Follow-up Date</div>
              <FormattedDateInput
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                displayStyle={counselingNotesInputStyle}
                min={
                  followUpDate && followUpDate < todayIsoDate()
                    ? undefined
                    : (() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const year = tomorrow.getFullYear();
                        const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
                        const day = String(tomorrow.getDate()).padStart(2, "0");
                        return `${year}-${month}-${day}`;
                      })()
                }
              />
              </div>
              <div
                style={{
                  margin: "16px auto 0",
                  width: "min(320px, 70%)",
                  borderTop: "1px solid #334155",
                  paddingTop: 6,
                  textAlign: "center",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Guidance Counselor
              </div>
            </div>
          )}

          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              ...(editingCaseId
                ? {
                    position: "sticky",
                    bottom: 0,
                    paddingTop: 12,
                    background: "white",
                    zIndex: 1,
                  }
                : {}),
            }}
          >
            <button
              onClick={closeModal}
              style={ghostButton}
              disabled={savingSession || sessionCreateSuccess}
            >
              Cancel
            </button>
              <button
              onClick={handleSaveSession}
              style={primaryButton}
              disabled={
                savingSession ||
                sessionCreateSuccess ||
                filteredStudents.length === 0 ||
                selectedSessionStudentIds.length === 0 ||
                !date ||
                (!editingCaseId && missingCreateSessionFields.length > 0) ||
                Boolean(
                  editingCaseId &&
                    (!resolvedModalCollegeId || !resolvedModalYearLevelId),
                )
              }
            >
              <span style={buttonContent}>
                <span>
                  {savingSession
                    ? editingCaseId
                      ? "Saving..."
                      : "Creating..."
                    : editingCaseId
                      ? "Save Changes"
                      : "Create Session"}
                </span>
              </span>
            </button>
          </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={mediationOpen}
        onClose={savingMediationCase ? () => {} : closeMediationModal}
        title="Create Mediation Case"
      >
        <div style={sessionModalBody}>
          {savingMediationCase &&
            renderMediationLoadingOverlay(
              "Creating Mediation Case...",
              "Please wait while we prepare the mediation case.",
            )}

          <div
            style={{
              display: "grid",
              gap: 12,
              opacity: savingMediationCase ? 0.12 : 1,
              pointerEvents: savingMediationCase ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
          <div>
            <div style={label}>Case Title</div>
            <input
              value={mediationCaseTitle}
              onChange={(e) => setMediationCaseTitle(e.target.value)}
              style={inputStyle}
              placeholder="Enter mediation case title..."
            />
          </div>

          <div>
            <div style={label}>Issue / Conflict Description</div>
            <textarea
              value={mediationIssueDescription}
              onChange={(e) => setMediationIssueDescription(e.target.value)}
              style={textareaStyle}
              placeholder="Describe the issue or conflict..."
            />
          </div>

          <div>
            <div style={label}>Date</div>
            <FormattedDateInput
              value={mediationDate}
              onChange={(e) => setMediationDate(e.target.value)}
              displayStyle={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={label}>Participants (select at least 2 students)</div>

            {selectedMediationParticipants.length > 0 && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                  background: "rgba(248,250,252,0.7)",
                }}
              >
                <div style={{ ...label, margin: 0 }}>Selected Participants</div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {selectedMediationParticipants.map((student) => (
                    <span
                      key={student.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(15,23,42,0.12)",
                        background: "white",
                        color: "#0f172a",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {getStudentName(student.id)}
                      <button
                        type="button"
                        onClick={() => toggleMediationParticipant(student.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#64748b",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1,
                        }}
                        aria-label={`Remove ${getStudentName(student.id)}`}
                        title={`Remove ${getStudentName(student.id)}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  alignItems: "end",
                }}
              >
                <div>
                  <DropdownSelect
                    value={mediationCandidateStudentId}
                    onChange={(e) => setMediationCandidateStudentId(Number(e.target.value))}
                  >
                    <option value={0}>
                      {mediationAvailableStudents.length
                        ? "Select student"
                        : "No students found"}
                    </option>
                    {mediationAvailableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {getStudentName(student.id)}
                      </option>
                    ))}
                  </DropdownSelect>
                </div>

                <div style={{ position: "relative", flexShrink: 0 }}>
                  <CounselingActionButton
                    onClick={() => setShowMediationModalFilters((value) => !value)}
                    active={showMediationModalFilters}
                    title={
                      showMediationModalFilters
                        ? "Hide participant filters"
                        : "Show participant filters"
                    }
                    ariaLabel={
                      showMediationModalFilters
                        ? "Hide participant filters"
                        : "Show participant filters"
                    }
                    baseStyle={modalFilterButton}
                  >
                    <List size={18} />
                  </CounselingActionButton>
                </div>
              </div>

              {showMediationModalFilters && (
                <div style={mediationModalCompactFilterPanel}>
                  <div style={compactField}>
                    <div style={compactLabel}>College</div>
                    <DropdownSelect
                      value={mediationFilterCollegeId}
                      onChange={(e) => setMediationFilterCollegeId(Number(e.target.value))}
                    >
                      <option value={0}>All colleges</option>
                      {colleges.map((college) => (
                        <option key={college.id} value={college.id}>
                          {college.name}
                        </option>
                      ))}
                    </DropdownSelect>
                  </div>

                  <div style={compactField}>
                    <div style={compactLabel}>Course</div>
                    <DropdownSelect
                      value={mediationFilterCourseId}
                      onChange={(e) => setMediationFilterCourseId(Number(e.target.value))}
                      disabled={!mediationFilterCollegeId}
                    >
                      <option value={0}>
                        {!mediationFilterCollegeId
                          ? "Select college first"
                          : mediationFilteredCourses.length
                            ? "All courses"
                            : "No courses found"}
                      </option>
                      {mediationFilteredCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </DropdownSelect>
                  </div>

                  <div style={compactField}>
                    <div style={compactLabel}>Year Level</div>
                    <DropdownSelect
                      value={mediationFilterYearLevelId}
                      onChange={(e) => setMediationFilterYearLevelId(Number(e.target.value))}
                      disabled={!mediationFilterCourseId}
                    >
                      <option value={0}>
                        {!mediationFilterCourseId
                          ? "Select course first"
                          : mediationFilteredYearLevels.length
                            ? "All year levels"
                            : "No year levels found"}
                      </option>
                      {mediationFilteredYearLevels.map((yl) => (
                        <option key={yl.id} value={yl.id}>
                          {yl.name}
                        </option>
                      ))}
                    </DropdownSelect>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <CounselingActionButton
                      onClick={resetMediationParticipantFilters}
                      title="Clear participant filters"
                      ariaLabel="Clear participant filters"
                      baseStyle={compactClearButton}
                    >
                      <X size={14} />
                      Clear
                    </CounselingActionButton>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button
                type="button"
                onClick={addMediationParticipant}
                style={primaryButton}
                disabled={!mediationCandidateStudentId || savingMediationCase}
              >
                Add Participant
              </button>
            </div>

          </div>
          {missingCreateMediationFields.length > 0 && (
            <div style={sessionWarningText}>
              Please fill in {missingCreateMediationFields.join(", ")} before
              creating the mediation case.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={closeMediationModal}
              style={ghostButton}
              disabled={savingMediationCase}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMediationCase}
              style={primaryButton}
              disabled={savingMediationCase || missingCreateMediationFields.length > 0}
            >
              Create Mediation Case
            </button>
          </div>
        </div>
        </div>
      </Modal>

      <Modal
        open={mediationParticipantsOpen}
        onClose={savingMediationParticipants ? () => {} : closeParticipantsModal}
        title="Add Participants"
      >
        <div style={sessionModalBody}>
          {savingMediationParticipants &&
            renderMediationLoadingOverlay(
              "Saving Participants...",
              "Please wait while we update the mediation participants.",
            )}

          <div
            style={{
              display: "grid",
              gap: 12,
              opacity: savingMediationParticipants ? 0.12 : 1,
              pointerEvents: savingMediationParticipants ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
          <div style={{ fontSize: 13.5, color: "#475569" }}>
            Select at least 2 students for this mediation case.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(220px, 1.2fr)",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div>
              <div style={label}>College</div>
              <DropdownSelect
                value={mediationParticipantsFilterCollegeId}
                onChange={(e) =>
                  setMediationParticipantsFilterCollegeId(Number(e.target.value))
                }
              >
                <option value={0}>All colleges</option>
                {colleges.map((college) => (
                  <option key={college.id} value={college.id}>
                    {college.name}
                  </option>
                ))}
              </DropdownSelect>
            </div>

            <div>
              <div style={label}>Course</div>
              <DropdownSelect
                value={mediationParticipantsFilterCourseId}
                onChange={(e) =>
                  setMediationParticipantsFilterCourseId(Number(e.target.value))
                }
                disabled={!mediationParticipantsFilterCollegeId}
              >
                <option value={0}>
                  {!mediationParticipantsFilterCollegeId
                    ? "Select college first"
                    : mediationParticipantsFilteredCourses.length
                      ? "All courses"
                      : "No courses found"}
                </option>
                {mediationParticipantsFilteredCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </DropdownSelect>
            </div>

            <div>
              <div style={label}>Year Level</div>
              <DropdownSelect
                value={mediationParticipantsFilterYearLevelId}
                onChange={(e) =>
                  setMediationParticipantsFilterYearLevelId(Number(e.target.value))
                }
                disabled={!mediationParticipantsFilterCollegeId}
              >
                <option value={0}>
                  {!mediationParticipantsFilterCollegeId
                    ? "Select college first"
                    : "All year levels"}
                </option>
                {mediationParticipantsFilteredYearLevels.map((yl) => (
                  <option key={yl.id} value={yl.id}>
                    {yl.name}
                  </option>
                ))}
              </DropdownSelect>
            </div>

            <div>
              <div style={label}>Search Name</div>
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
                  value={mediationParticipantsSearch}
                  onChange={(e) => setMediationParticipantsSearch(e.target.value)}
                  placeholder="Search student name..."
                  style={{
                    ...inputStyle,
                    paddingLeft: 38,
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              maxHeight: 280,
              overflow: "auto",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 10,
              display: "grid",
              gap: 8,
            }}
          >
            {mediationParticipantsFilteredStudents.length === 0 ? (
              <div style={{ padding: "10px 8px", fontSize: 13.5, color: "#64748b" }}>
                No students matched the selected filters or search.
              </div>
            ) : (
              mediationParticipantsFilteredStudents.map((student) => (
                <label
                  key={student.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: mediationParticipantIds.includes(student.id)
                      ? "rgba(95,109,122,0.08)"
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={mediationParticipantIds.includes(student.id)}
                    onChange={() => toggleMediationParticipant(student.id)}
                  />
                  <div style={{ display: "grid", gap: 2 }}>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>
                      {getStudentName(student.id)}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {student.email}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>

          {missingMediationParticipantsFields.length > 0 && (
            <div style={sessionWarningText}>
              Please fill in {missingMediationParticipantsFields.join(", ")} before
              saving the participants.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={closeParticipantsModal}
              style={ghostButton}
              disabled={savingMediationParticipants}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMediationParticipants}
              style={primaryButton}
              disabled={
                savingMediationParticipants ||
                missingMediationParticipantsFields.length > 0
              }
            >
              Save Participants
            </button>
          </div>
        </div>
        </div>
      </Modal>

      <Modal
        open={mediationNotesOpen}
        onClose={savingMediationNotes ? () => {} : closeNotesModal}
        title="Add Notes"
      >
        <div style={sessionModalBody}>
          {savingMediationNotes &&
            renderMediationLoadingOverlay(
              "Saving Notes...",
              "Please wait while we save the mediation notes.",
            )}

          <div
            style={{
              display: "grid",
              gap: 12,
              opacity: savingMediationNotes ? 0.12 : 1,
              pointerEvents: savingMediationNotes ? "none" : "auto",
              transition: "opacity 180ms ease",
            }}
          >
          <div>
            <div style={label}>Agreements Made</div>
            <textarea
              value={mediationAgreementsMade}
              onChange={(e) => setMediationAgreementsMade(e.target.value)}
              style={textareaStyle}
              placeholder="Record the agreements made during mediation..."
            />
          </div>

          <div>
            <div style={label}>Outcome</div>
            <textarea
              value={mediationOutcome}
              onChange={(e) => setMediationOutcome(e.target.value)}
              style={textareaStyle}
              placeholder="Summarize the mediation outcome..."
            />
          </div>

          <div>
            <div style={label}>Remarks</div>
            <textarea
              value={mediationRemarks}
              onChange={(e) => setMediationRemarks(e.target.value)}
              style={textareaStyle}
              placeholder="Add remarks or follow-up notes..."
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={closeNotesModal}
              style={ghostButton}
              disabled={savingMediationNotes}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMediationNotes}
              style={primaryButton}
              disabled={savingMediationNotes}
            >
              Save Notes
            </button>
          </div>
        </div>
        </div>
      </Modal>

    </div>
  );
}

