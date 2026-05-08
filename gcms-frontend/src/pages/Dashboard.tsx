import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  UsersRound,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import {
  fetchEntitiesBootstrap,
  listGroupSessions,
  listCounselingCases,
  listReferrals,
  type AcademicYear as EntityAcademicYear,
  type CounselingCase as EntityCounselingCase,
  type GroupSession as EntityGroupSession,
  type Referral as EntityReferral,
  type User as EntityUser,
} from "../lib/entitiesApi";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Sector,
} from "recharts";

type AcademicYear = EntityAcademicYear;
type CounselingCase = EntityCounselingCase;
type Referral = EntityReferral;
type GroupSession = EntityGroupSession;

type DashboardUser = EntityUser & {
  createdAt?: string;
  academicYearId?: number;
};
type MonthlyReferral = { month: string; count: number };
type DashboardScheduleItem = {
  id: string;
  title: string;
  type: "Counseling Case" | "Referral Meeting" | "Student Circle";
  dateKey: string;
  timeLabel: string;
  timestamp: number;
  accent: string;
  detail: string;
};

const USERS_KEY = "gcms_mock_users_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const REF_KEY = "gcms_mock_referrals_v1";
const CASES_KEY = "gcms_mock_counseling_cases_v2";
const GS_KEY = "gcms_mock_group_sessions_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateKey(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "";
  return dateKeyFromDate(dt);
}

function parseScheduleTimestamp(date?: string | null, time?: string | null): number {
  const dateKey = toDateKey(date);
  if (!dateKey) return 0;

  const timeText = String(time || "").trim() || "00:00";
  const parsed = new Date(`${dateKey}T${timeText}:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const fallback = new Date(dateKey);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
}

function formatDateLong(value?: string | null): string {
  const dateKey = toDateKey(value);
  if (!dateKey) return "No date selected";
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(value?: string | null): string {
  const dateKey = toDateKey(value);
  if (!dateKey) return "Date not set";
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTimeShort(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "Time not set";
  const [hourPart, minutePart] = raw.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return raw;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
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

function animateTo(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (v: number) => void,
) {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (prefersReduced) {
    onUpdate(Math.round(to));
    return;
  }

  const start = performance.now();
  const diff = to - from;

  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    onUpdate(Math.round(from + diff * eased));
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const fallbackAcademicYears: AcademicYear[] = [
  { id: 1, name: "2024-2025", isActive: false },
  { id: 2, name: "2025-2026", isActive: true },
];

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const dashboardDisplayName = user.role === "ADMIN" ? "Maam" : user.fname;
  const isAdmin = user.role === "ADMIN";
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() =>
    load<AcademicYear[]>(YEARS_KEY, fallbackAcademicYears),
  );
  const [allUsers, setAllUsers] = useState<DashboardUser[]>(() =>
    load<DashboardUser[]>(USERS_KEY, []),
  );
  const [allCases, setAllCases] = useState<CounselingCase[]>(() =>
    load<CounselingCase[]>(CASES_KEY, []),
  );
  const [allReferrals, setAllReferrals] = useState<Referral[]>(() =>
    load<Referral[]>(REF_KEY, []),
  );
  const [allSessions, setAllSessions] = useState<GroupSession[]>(() =>
    load<GroupSession[]>(GS_KEY, []),
  );

  const [selectedAyId, setSelectedAyId] = useState<number>(() => {
    const years = load<AcademicYear[]>(YEARS_KEY, fallbackAcademicYears);
    return years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0;
  });
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    dateKeyFromDate(new Date()),
  );
  const [scheduleCollapsed, setScheduleCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    const cachedUsers = load<DashboardUser[]>(USERS_KEY, []);

    Promise.allSettled([
      fetchEntitiesBootstrap(),
      listCounselingCases(),
      listReferrals(),
      listGroupSessions(),
    ]).then((results) => {
      if (!alive) return;
      const [bootstrapResult, casesResult, referralsResult, sessionsResult] = results;

      if (bootstrapResult.status === "fulfilled") {
        const payload = bootstrapResult.value;

        const nextYears = payload.academicYears ?? [];
        if (nextYears.length) {
          setAcademicYears(nextYears);
          save(YEARS_KEY, nextYears);
        }

        const byId = new Map<number, DashboardUser>();
        for (const cached of cachedUsers) byId.set(cached.id, cached);
        for (const live of payload.users ?? []) {
          const cached = byId.get(live.id);
          byId.set(live.id, {
            ...cached,
            ...live,
            createdAt: (live as DashboardUser).createdAt ?? cached?.createdAt ?? "",
            academicYearId:
              Number((live as DashboardUser).academicYearId ?? cached?.academicYearId ?? 0) ||
              undefined,
          });
        }
        const mergedUsers = Array.from(byId.values());
        setAllUsers(mergedUsers);
        save(USERS_KEY, mergedUsers);
      }

      if (casesResult.status === "fulfilled") {
        const nextCases = casesResult.value.cases ?? [];
        setAllCases(nextCases);
        save(CASES_KEY, nextCases);
      }

      if (referralsResult.status === "fulfilled") {
        const nextReferrals = referralsResult.value.referrals ?? [];
        setAllReferrals(nextReferrals);
        save(REF_KEY, nextReferrals);
      }

      if (sessionsResult.status === "fulfilled") {
        const nextSessions = sessionsResult.value.sessions ?? [];
        setAllSessions(nextSessions);
        save(GS_KEY, nextSessions);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!academicYears.length) return;
    const exists = academicYears.some((ay) => ay.id === selectedAyId);
    if (!exists) {
      setSelectedAyId(academicYears.find((ay) => ay.isActive)?.id ?? academicYears[0].id);
    }
  }, [academicYears, selectedAyId]);

  const usersById = useMemo(() => {
    const map = new Map<number, DashboardUser>();
    for (const entry of allUsers) map.set(entry.id, entry);
    return map;
  }, [allUsers]);

  // ---------- Filtered data ----------
  const userCategoryData = useMemo(() => {
    let students = 0;
    let teachers = 0;
    let nonTeaching = 0;

    for (const u of allUsers) {
      const ay = Number((u as DashboardUser).academicYearId ?? 0);
      if (ay && ay !== selectedAyId) continue;

      const role = String(u.role || "").toUpperCase();
      if (role === "STUDENT") students += 1;
      else if (role === "TEACHER") teachers += 1;
      else if (role === "NON_TEACHING_PERSONNEL") nonTeaching += 1;
    }

    return [
      {
        key: "students",
        name: "Students",
        value: students,
        color: "rgba(37,99,235,1)",
      },
      {
        key: "teachers",
        name: "Teachers",
        value: teachers,
        color: "rgba(16,185,129,1)",
      },
      {
        key: "non_teaching",
        name: "Non Teaching Personnel",
        value: nonTeaching,
        color: "rgba(251,191,36,1)",
      },
    ];
  }, [allUsers, selectedAyId]);
  const totalCategoryUsers = useMemo(
    () => userCategoryData.reduce((sum, item) => sum + item.value, 0),
    [userCategoryData],
  );

  const chartData = useMemo(() => {
    const counts = new Array<number>(12).fill(0);
    for (const r of allReferrals) {
      if (r.academicYearId !== selectedAyId) continue;
      const dt = new Date(String(r.referredDate || ""));
      if (Number.isNaN(dt.getTime())) continue;
      counts[dt.getMonth()] += 1;
    }
    return monthLabels.map<MonthlyReferral>((month, idx) => ({
      month,
      count: counts[idx],
    }));
  }, [allReferrals, selectedAyId]);

  const targetStats = useMemo(() => {
    const now = new Date();
    const usersCount = allUsers.length;
    const referralsThisMonth = allReferrals.filter((r) => {
      if (r.academicYearId !== selectedAyId) return false;
      const dt = new Date(String(r.referredDate || ""));
      if (Number.isNaN(dt.getTime())) return false;
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;

    return { totalUsers: usersCount, referralsThisMonth };
  }, [allUsers, allReferrals, selectedAyId]);

  const scheduleItems = useMemo<DashboardScheduleItem[]>(() => {
    const next: DashboardScheduleItem[] = [];

    for (const item of allCases) {
      if (item.academicYearId !== selectedAyId) continue;
      if (item.status === "Completed") continue;
      const dateKey = toDateKey(item.date);
      if (!dateKey) continue;

      const student = usersById.get(item.studentId);
      next.push({
        id: `case-${item.id}`,
        title: student
          ? `${student.fname} ${student.lname}`
          : `Student #${item.studentId}`,
        type: "Counseling Case",
        dateKey,
        timeLabel: formatTimeShort(item.time),
        timestamp: parseScheduleTimestamp(item.date, item.time),
        accent: "rgba(37,99,235,1)",
        detail: `Location: Guidance Office · Status: ${item.status}`,
      });
    }

    for (const item of allReferrals) {
      if (item.academicYearId !== selectedAyId) continue;
      const statusText = String(item.status || "").trim().toLowerCase();
      if (
        [
          "pending",
          "new",
          "complete",
          "completed",
          "closed",
          "resolved",
        ].includes(statusText)
      ) {
        continue;
      }
      const dateKey = toDateKey(item.referredDate);
      if (!dateKey) continue;

      const student = usersById.get(item.studentId);
      next.push({
        id: `referral-${item.id}`,
        title: student
          ? `${student.fname} ${student.lname}`
          : `Student #${item.studentId}`,
        type: "Referral Meeting",
        dateKey,
        timeLabel: formatTimeShort(item.referredTime),
        timestamp: parseScheduleTimestamp(item.referredDate, item.referredTime),
        accent: "rgba(251,191,36,1)",
        detail: `Location: Guidance Office · Status: ${String(item.status || "Approved")}`,
      });
    }

    for (const item of allSessions) {
      if (item.academicYearId !== selectedAyId) continue;
      const dateKey = toDateKey(item.date);
      if (!dateKey) continue;

      next.push({
        id: `session-${item.id}`,
        title: item.topic || `Session #${item.id}`,
        type: "Student Circle",
        dateKey,
        timeLabel: formatTimeShort(item.time),
        timestamp: parseScheduleTimestamp(item.date, item.time),
        accent: "rgba(9,14,25,1)",
        detail: item.location ? `Location: ${item.location}` : "Student Circle",
      });
    }

    next.sort((a, b) => a.timestamp - b.timestamp || a.title.localeCompare(b.title));
    return next;
  }, [allCases, allReferrals, allSessions, selectedAyId, usersById]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const todayScheduleCount = useMemo(
    () => scheduleItems.filter((item) => item.dateKey === todayKey).length,
    [scheduleItems, todayKey],
  );

  const upcomingWeekCount = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    const weekEndKey = dateKeyFromDate(weekEnd);
    return scheduleItems.filter(
      (item) => item.dateKey >= todayKey && item.dateKey <= weekEndKey,
    ).length;
  }, [scheduleItems, todayKey]);

  const scheduledThisMonthCount = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const startKey = dateKeyFromDate(monthStart);
    const endKey = dateKeyFromDate(monthEnd);
    return scheduleItems.filter(
      (item) => item.dateKey >= startKey && item.dateKey <= endKey,
    ).length;
  }, [calendarMonth, scheduleItems]);

  const upcomingAgenda = useMemo(
    () => scheduleItems.filter((item) => item.dateKey >= todayKey).slice(0, 6),
    [scheduleItems, todayKey],
  );

  const selectedDateItems = useMemo(
    () =>
      scheduleItems.filter((item) => item.dateKey === selectedDateKey),
    [scheduleItems, selectedDateKey],
  );

  const scheduleDateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of scheduleItems) {
      map.set(item.dateKey, (map.get(item.dateKey) ?? 0) + 1);
    }
    return map;
  }, [scheduleItems]);

  const scheduleItemsByDate = useMemo(() => {
    const map = new Map<string, DashboardScheduleItem[]>();
    for (const item of scheduleItems) {
      const current = map.get(item.dateKey) ?? [];
      current.push(item);
      map.set(item.dateKey, current);
    }
    return map;
  }, [scheduleItems]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + index);
      const key = dateKeyFromDate(cellDate);
      const count = scheduleDateCounts.get(key) ?? 0;
      const items = scheduleItemsByDate.get(key) ?? [];
      return {
        key,
        label: cellDate.getDate(),
        count,
        isCurrentMonth: sameMonth(cellDate, calendarMonth),
        isSelected: key === selectedDateKey,
        isToday: key === todayKey,
        tooltip:
          items.length > 0
            ? items
                .map((item) => `${item.timeLabel} · ${item.title} · ${item.detail}`)
                .join("\n")
            : "No schedules",
      };
    });
  }, [calendarMonth, scheduleDateCounts, scheduleItemsByDate, selectedDateKey, todayKey]);

  // ---------- Animated counters ----------
  const [totalUsers, setTotalUsers] = useState(0);
  const [referralsThisMonth, setReferralsThisMonth] = useState(0);

  useEffect(() => {
    animateTo(totalUsers, targetStats.totalUsers, 650, setTotalUsers);
  }, [targetStats.totalUsers]);

  useEffect(() => {
    animateTo(
      referralsThisMonth,
      targetStats.referralsThisMonth,
      650,
      setReferralsThisMonth,
    );
  }, [targetStats.referralsThisMonth]);

  // ---------- Theme (match sidebar vibe: deep navy + blue/yellow accents) ----------
  const fontFamily =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif';

  const navy = "rgba(9,14,25,1)";
  const blue = "rgba(37,99,235,1)";
  const blueSoft = "rgba(37,99,235,0.14)";
  const yellow = "rgba(251,191,36,1)";
  const yellowSoft = "rgba(251,191,36,0.18)";
  const ink = "rgba(15,23,42,0.92)";
  const mutedInk = "rgba(15,23,42,0.65)";

  const page: CSSProperties = {
    fontFamily,
    maxWidth: 1180,
    margin: "0 auto",
    padding: "16px 16px 28px",
    display: "grid",
    gap: 14,
  };

  const shellBg: CSSProperties = {
    borderRadius: 20,
    padding: 2,
    background: `linear-gradient(135deg, ${yellowSoft} 0%, ${blueSoft} 45%, rgba(255,255,255,0) 100%)`,
  };

  const card: CSSProperties = {
    borderRadius: 20,
    border: "1px solid rgba(15,23,42,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.86) 100%)",
    boxShadow: "0 1px 0 rgba(15,23,42,0.04), 0 16px 34px rgba(15,23,42,0.10)",
    backdropFilter: "blur(10px)",
    padding: 16,
  };

  const headerCard: CSSProperties = {
    ...card,
    padding: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  };

  const title: CSSProperties = {
    fontSize: 26,
    fontWeight: 1000,
    letterSpacing: -0.4,
    color: ink,
    lineHeight: 1.05,
  };

  const sub: CSSProperties = {
    color: mutedInk,
    fontSize: 13.5,
  };

  const selectWrap: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.75)",
  };

  const select: CSSProperties = {
    height: 40,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.14)",
    padding: "0 12px",
    outline: "none",
    background: "rgba(255,255,255,0.95)",
    color: ink,
    fontWeight: 900,
    minWidth: 170,
  };

  const statsGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  };

  const grid2: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.25fr 0.85fr",
    gap: 12,
  };

  const calendarGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, 0.85fr)",
    gap: 14,
    alignItems: "start",
  };

  const statCard: CSSProperties = {
    ...card,
    padding: 16,
    display: "flex",
    gap: 14,
    alignItems: "stretch",
    justifyContent: "space-between",
  };

  const statLeft: CSSProperties = { display: "grid", gap: 6 };

  const statLabel: CSSProperties = {
    fontSize: 12.5,
    letterSpacing: 0.6,
    fontWeight: 950,
    color: mutedInk,
    textTransform: "uppercase",
  };

  const statValue: CSSProperties = {
    fontSize: 34,
    fontWeight: 1000,
    letterSpacing: -0.8,
    color: ink,
    lineHeight: 1,
  };

  const statHint: CSSProperties = { ...sub };

  const accentPill = (mode: "blue" | "yellow"): CSSProperties => ({
    width: 54,
    height: 54,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    border:
      mode === "blue"
        ? "1px solid rgba(37,99,235,0.22)"
        : "1px solid rgba(251,191,36,0.28)",
    background:
      mode === "blue"
        ? "linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(37,99,235,0.06) 100%)"
        : "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(251,191,36,0.08) 100%)",
    boxShadow:
      mode === "blue"
        ? "0 14px 24px rgba(37,99,235,0.14)"
        : "0 14px 24px rgba(245,158,11,0.14)",
  });

  const leftStripe = (mode: "blue" | "yellow"): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    background: mode === "blue" ? blue : yellow,
  });

  const chartCard: CSSProperties = { ...card, padding: 16 };

  const toggleWrap: CSSProperties = {
    display: "inline-flex",
    borderRadius: 14,
    padding: 4,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.75)",
    gap: 6,
  };

  const toggleBtn = (active: boolean): CSSProperties => ({
    height: 32,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    cursor: "pointer",
    fontWeight: 950,
    background: active
      ? `linear-gradient(135deg, ${blue} 0%, rgba(29,78,216,1) 100%)`
      : "rgba(255,255,255,0.85)",
    color: active ? "white" : "rgba(15,23,42,0.78)",
    boxShadow: active ? "0 12px 20px rgba(37,99,235,0.18)" : "none",
  });

  const pieWrap: CSSProperties = {
    marginTop: 10,
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.78)",
    padding: 12,
  };

  const sectionHeader: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };

  const monthNavButton = (disabled = false): CSSProperties => ({
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.85)",
    color: ink,
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  });

  const collapseButton: CSSProperties = {
    ...monthNavButton(),
    width: 42,
    height: 42,
  };

  const indicatorGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
  };

  const indicatorCard: CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.82)",
    padding: "14px 14px 12px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
    display: "grid",
    gap: 4,
  };

  const indicatorLabel: CSSProperties = {
    fontSize: 11.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontWeight: 900,
    color: mutedInk,
  };

  const indicatorValue: CSSProperties = {
    fontSize: 28,
    fontWeight: 1000,
    color: ink,
    lineHeight: 1,
  };

  const calendarWrap: CSSProperties = {
    borderRadius: 22,
    border: "1px solid rgba(15,23,42,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.95) 100%)",
    padding: 16,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  };

  const weekdayGrid: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 8,
  };

  const weekdayCell: CSSProperties = {
    fontSize: 11.5,
    fontWeight: 900,
    color: mutedInk,
    textTransform: "uppercase",
    textAlign: "center",
    padding: "6px 0",
  };

  const calendarGridCells: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  };

  const agendaCard: CSSProperties = {
    ...card,
    padding: 16,
    display: "grid",
    gap: 12,
  };

  const agendaList: CSSProperties = {
    display: "grid",
    gap: 10,
  };

  const agendaRow: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 12,
    alignItems: "start",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.84)",
  };

  // Chart mode
  const [chartMode, setChartMode] = useState<"line" | "bar">("line");
  const [activeUserSlice, setActiveUserSlice] = useState<number>(0);
  useEffect(() => {
    if (!userCategoryData.length) {
      if (activeUserSlice !== 0) setActiveUserSlice(0);
      return;
    }
    if (activeUserSlice >= userCategoryData.length) setActiveUserSlice(0);
  }, [activeUserSlice, userCategoryData]);
  useEffect(() => {
    if (!userCategoryData.length) return;
    let maxIdx = 0;
    for (let i = 1; i < userCategoryData.length; i += 1) {
      if (userCategoryData[i].value > userCategoryData[maxIdx].value) maxIdx = i;
    }
    setActiveUserSlice(maxIdx);
  }, [userCategoryData]);

  const renderUserSlice = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
      payload,
    } = props;

    const isActive = payload?.key === userCategoryData[activeUserSlice]?.key;
    const ringOuter = outerRadius + (isActive ? 6 : 2);

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          cornerRadius={6}
        />
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={ringOuter - 1}
          outerRadius={ringOuter}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          opacity={0.95}
        />
      </g>
    );
  };

  const renderUserLabel = (props: any) => {
    const {
      cx,
      cy,
      outerRadius,
      midAngle,
      fill,
      percent,
      value,
      name,
    } = props;
    if (!value) return null;

    const RAD = Math.PI / 180;
    const side = Math.cos(-midAngle * RAD) >= 0 ? 1 : -1;
    const sx = cx + (outerRadius + 3) * Math.cos(-midAngle * RAD);
    const sy = cy + (outerRadius + 3) * Math.sin(-midAngle * RAD);
    const mx = cx + (outerRadius + 17) * Math.cos(-midAngle * RAD);
    const my = cy + (outerRadius + 17) * Math.sin(-midAngle * RAD);
    const ex = mx + side * 20;
    const ey = my;
    const bx = ex + side * 32;
    const by = ey;
    const pctText = `${((percent || 0) * 100).toFixed(1)}%`;
    const shortName =
      String(name || "").toLowerCase() === "non teaching personnel"
        ? "Non Teaching"
        : String(name || "");

    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={fill}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={bx} cy={by} r={33} fill="white" stroke={fill} strokeWidth={2} />
        <text
          x={bx}
          y={by - 5}
          textAnchor="middle"
          fill={fill}
          style={{ fontSize: 12.5, fontWeight: 900 }}
        >
          {pctText}
        </text>
        <text
          x={bx}
          y={by + 12}
          textAnchor="middle"
          fill={fill}
          style={{ fontSize: 11, fontWeight: 800 }}
        >
          {shortName}
        </text>
      </g>
    );
  };

  // Non-admin placeholder (keep minimal)
  if (!isAdmin) {
    return (
      <div style={page}>
        <div style={shellBg}>
          <div style={card}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 950,
                marginBottom: 8,
                color: ink,
              }}
            >
              Overview
            </div>
            <div style={sub}>
              Your dashboard will show your cases, sessions, and tasks.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {/* Header */}
      <div style={shellBg}>
        <div style={headerCard}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={title}>Dashboard</div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={sub}>
                Welcome, <b style={{ color: ink }}>{dashboardDisplayName}</b>
              </span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.35)",
                }}
              />
              <span style={sub}>
                Role:{" "}
                <b style={{ color: ink }}>
                  {user.role}
                </b>
              </span>
            </div>
          </div>

          <div style={selectWrap}>
            <div style={{ fontSize: 12.5, fontWeight: 950, color: mutedInk }}>
              Academic Year
            </div>
            <select
              value={selectedAyId}
              onChange={(e) => setSelectedAyId(Number(e.target.value))}
              style={select}
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="__dash_stats_grid" style={statsGrid}>
        <div style={shellBg}>
          <div
            style={{ ...statCard, position: "relative", overflow: "hidden" }}
          >
            <div style={leftStripe("blue")} aria-hidden />
            <div style={statLeft}>
              <div style={statLabel}>Total Users</div>
              <div style={statValue}>{totalUsers}</div>
              <div style={statHint}>
                Students, STAFFs, teachers, admins
              </div>
            </div>
            <div style={accentPill("blue")} aria-hidden>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${blue} 0%, rgba(29,78,216,1) 100%)`,
                  boxShadow: "0 10px 18px rgba(37,99,235,0.22)",
                }}
              />
            </div>
          </div>
        </div>

        <div style={shellBg}>
          <div
            style={{ ...statCard, position: "relative", overflow: "hidden" }}
          >
            <div style={leftStripe("blue")} aria-hidden />
            <div style={statLeft}>
              <div style={statLabel}>Referrals This Month</div>
              <div style={statValue}>{referralsThisMonth}</div>
              <div style={statHint}>New referrals logged</div>
            </div>
            <div style={accentPill("blue")} aria-hidden>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${blue} 0%, rgba(29,78,216,1) 100%)`,
                  boxShadow: "0 10px 18px rgba(37,99,235,0.22)",
                }}
              />
            </div>
          </div>
        </div>

        <div style={shellBg}>
          <div
            style={{ ...statCard, position: "relative", overflow: "hidden" }}
          >
            <div style={leftStripe("yellow")} aria-hidden />
            <div style={statLeft}>
              <div style={statLabel}>Upcoming This Week</div>
              <div style={statValue}>{upcomingWeekCount}</div>
              <div style={statHint}>Schedules across cases, referrals, and sessions</div>
            </div>
            <div style={accentPill("yellow")} aria-hidden>
              <CalendarDays size={22} color="rgba(161,98,7,0.92)" />
            </div>
          </div>
        </div>
      </div>

      <div style={shellBg}>
        <div style={card}>
          <div style={sectionHeader}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 950, color: ink }}>
                Upcoming Schedules
              </div>
              <div style={sub}>
                A unified calendar view for counseling cases, referral meetings, and Student Circle sessions.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}
                style={monthNavButton()}
                aria-label="Previous month"
                disabled={scheduleCollapsed}
              >
                <ChevronLeft size={18} />
              </button>
              <div
                style={{
                  minWidth: 170,
                  textAlign: "center",
                  fontWeight: 900,
                  color: ink,
                  padding: "0 6px",
                }}
              >
                {calendarMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <button
                type="button"
                onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}
                style={monthNavButton()}
                aria-label="Next month"
                disabled={scheduleCollapsed}
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => setScheduleCollapsed((current) => !current)}
                style={collapseButton}
                aria-label={scheduleCollapsed ? "Expand calendar" : "Collapse calendar"}
                title={scheduleCollapsed ? "Expand calendar" : "Collapse calendar"}
              >
                {scheduleCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>

          {scheduleCollapsed ? (
            <div
              style={{
                marginTop: 14,
                borderRadius: 18,
                border: "1px dashed rgba(15,23,42,0.12)",
                background: "rgba(248,250,252,0.75)",
                padding: "14px 16px",
                color: mutedInk,
                fontSize: 13,
              }}
            >
              Calendar hidden. Use the collapse icon to expand the schedule view again.
            </div>
          ) : (
            <>
              <div style={indicatorGrid}>
                <div style={indicatorCard}>
                  <div style={indicatorLabel}>Today</div>
                  <div style={indicatorValue}>{todayScheduleCount}</div>
                  <div style={sub}>Scheduled items on {formatDateShort(todayKey)}</div>
                </div>
                <div style={indicatorCard}>
                  <div style={indicatorLabel}>Next 7 Days</div>
                  <div style={indicatorValue}>{upcomingWeekCount}</div>
                  <div style={sub}>All upcoming sessions and meetings</div>
                </div>
                <div style={indicatorCard}>
                  <div style={indicatorLabel}>This Month</div>
                  <div style={indicatorValue}>{scheduledThisMonthCount}</div>
                  <div style={sub}>Items plotted on the visible calendar month</div>
                </div>
              </div>

              <div className="__dash_calendar_grid" style={calendarGrid}>
                <div style={calendarWrap}>
                  <div style={weekdayGrid}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                      <div key={label} style={weekdayCell}>
                        {label}
                      </div>
                    ))}
                  </div>

                  <div style={calendarGridCells}>
                    {calendarCells.map((cell) => (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedDateKey(cell.key)}
                        style={{
                          minHeight: 104,
                          borderRadius: 18,
                          border: cell.isSelected
                            ? `1px solid ${blue}`
                            : cell.isToday
                              ? "1px solid rgba(37,99,235,0.25)"
                              : "1px solid rgba(15,23,42,0.08)",
                          background: cell.isSelected
                            ? "linear-gradient(180deg, rgba(219,234,254,0.86) 0%, rgba(255,255,255,0.96) 100%)"
                            : cell.isCurrentMonth
                              ? "rgba(255,255,255,0.92)"
                              : "rgba(241,245,249,0.78)",
                          color: cell.isCurrentMonth ? ink : "rgba(15,23,42,0.42)",
                          padding: 10,
                          textAlign: "left",
                          cursor: "pointer",
                          display: "grid",
                          alignContent: "space-between",
                          gap: 10,
                          boxShadow: cell.isSelected
                            ? "0 12px 24px rgba(37,99,235,0.14)"
                            : "none",
                        }}
                        aria-label={`Select ${cell.key}`}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 900,
                              color: cell.isToday ? blue : undefined,
                            }}
                          >
                            {cell.label}
                          </span>
                          {cell.count > 0 && (
                            <span
                              style={{
                                minWidth: 22,
                                height: 22,
                                borderRadius: 999,
                                padding: "0 7px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11.5,
                                fontWeight: 900,
                                background: "rgba(37,99,235,0.12)",
                                color: blue,
                              }}
                            >
                              {cell.count}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "grid", gap: 8 }}>
                          <div
                            style={{
                              height: 6,
                              borderRadius: 999,
                              background:
                                cell.count > 0
                                  ? "linear-gradient(90deg, rgba(37,99,235,0.9) 0%, rgba(251,191,36,0.85) 100%)"
                                  : "rgba(15,23,42,0.06)",
                            }}
                          />
                          <div
                            style={{
                              fontSize: 11.5,
                              lineHeight: 1.35,
                              color: cell.count > 0 ? ink : mutedInk,
                              fontWeight: cell.count > 0 ? 700 : 500,
                            }}
                          >
                            {cell.count > 0
                              ? `${cell.count} scheduled item${cell.count > 1 ? "s" : ""}`
                              : "No schedules"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={agendaCard}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 950, color: ink }}>
                      {formatDateLong(selectedDateKey)}
                    </div>
                    <div style={sub}>
                      {selectedDateItems.length > 0
                        ? `${selectedDateItems.length} scheduled item${selectedDateItems.length > 1 ? "s" : ""} on this date`
                        : "No scheduled items on the selected date."}
                    </div>
                  </div>

                  <div style={agendaList}>
                    {selectedDateItems.length === 0 ? (
                      <div
                        style={{
                          borderRadius: 16,
                          border: "1px dashed rgba(15,23,42,0.14)",
                          padding: 16,
                          color: mutedInk,
                          fontSize: 13,
                        }}
                      >
                        Pick a highlighted date to inspect the schedule details.
                      </div>
                    ) : (
                      selectedDateItems.map((item) => (
                        <div key={item.id} style={agendaRow}>
                          <div
                            style={{
                              width: 10,
                              height: 44,
                              borderRadius: 999,
                              background: item.accent,
                            }}
                          />
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 900, color: ink }}>{item.title}</span>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 900,
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  background: "rgba(15,23,42,0.06)",
                                  color: mutedInk,
                                }}
                              >
                                {item.type}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: mutedInk, fontSize: 12.5 }}>
                              <Clock3 size={14} />
                              <span>{item.timeLabel}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: mutedInk }}>{item.detail}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: ink }}>
                      Next Up
                    </div>
                    {upcomingAgenda.length === 0 ? (
                      <div style={{ color: mutedInk, fontSize: 13 }}>
                        No upcoming schedules recorded yet.
                      </div>
                    ) : (
                      upcomingAgenda.map((item) => (
                        <div key={`${item.id}-next`} style={{ ...agendaRow, padding: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              background: "rgba(15,23,42,0.04)",
                              display: "grid",
                              placeItems: "center",
                              color: item.accent,
                            }}
                          >
                            {item.type === "Referral Meeting" ? (
                              <FileText size={16} />
                            ) : item.type === "Student Circle" ? (
                              <UsersRound size={16} />
                            ) : (
                              <CalendarDays size={16} />
                            )}
                          </div>
                          <div style={{ display: "grid", gap: 2 }}>
                            <div style={{ fontWeight: 800, color: ink }}>{item.title}</div>
                            <div style={{ fontSize: 12, color: mutedInk }}>
                              {item.type} · {formatDateShort(item.dateKey)} · {item.timeLabel}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart + User Distribution */}
      <div className="__dash_grid2" style={grid2}>
        <div style={shellBg}>
          <div style={chartCard}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 950, color: ink }}>
                  Referrals by Month
                </div>
                <div style={sub}>Hover points/bars to see values</div>
              </div>

              <div style={toggleWrap}>
                <button
                  style={toggleBtn(chartMode === "line")}
                  onClick={() => setChartMode("line")}
                >
                  Line
                </button>
                <button
                  style={toggleBtn(chartMode === "bar")}
                  onClick={() => setChartMode("bar")}
                >
                  Bar
                </button>
              </div>
            </div>

            <div style={{ height: 300, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === "line" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="referrals"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      stroke={blue}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="referrals"
                      fill={blue}
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 16,
                border: "1px solid rgba(15,23,42,0.10)",
                background: `linear-gradient(135deg, ${yellowSoft} 0%, ${blueSoft} 100%)`,
                color: "rgba(15,23,42,0.82)",
                fontSize: 13,
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <span>
                Tip: Keep your data clean - use consistent month naming to avoid
                duplicate points.
              </span>
              <span style={{ fontWeight: 950, color: navy }}>GCMS</span>
            </div>
          </div>
        </div>

        <div style={shellBg}>
          <div style={card}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 950, color: ink }}>
                User Category Distribution
              </div>
              <div style={sub}>Students, teachers, and non teaching personnel</div>
            </div>

            <div style={pieWrap}>
              {totalCategoryUsers === 0 ? (
                <div style={{ ...sub, padding: "20px 6px" }}>
                  No users found for this academic year.
                </div>
              ) : (
                <div style={{ height: 330 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={userCategoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="52%"
                        innerRadius={62}
                        outerRadius={98}
                        paddingAngle={6}
                        shape={renderUserSlice}
                        label={renderUserLabel}
                        labelLine={false}
                        isAnimationActive
                        animationBegin={120}
                        animationDuration={950}
                        animationEasing="ease-out"
                        onMouseEnter={(_, idx) => setActiveUserSlice(idx)}
                      >
                        {userCategoryData.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number | string | undefined, _name, item: any) => {
                          const safeValue = Number(value ?? 0);
                          const pct = totalCategoryUsers
                            ? Math.round((safeValue / totalCategoryUsers) * 100)
                            : 0;
                          return [`${safeValue} users (${pct}%)`, item.payload?.name || ""];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, ...sub }}>
              Tip: Hover each slice to highlight and see values.
            </div>
          </div>
        </div>
      </div>

      {/* Responsive tweak */}
      <style>
        {`
          @media (max-width: 980px){
            .__dash_stats_grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .__dash_grid2 { grid-template-columns: 1fr !important; }
            .__dash_calendar_grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 720px){
            .__dash_stats_grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 640px){
            .__dash_calendar_grid button[aria-label^="Select"] {
              min-height: 88px !important;
            }
          }
        `}
      </style>
    </div>
  );
}

