import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock3,
  FileText,
  UsersRound,
  Activity,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import StatCard from "../components/StatCard";
import { useAuthStore } from "../store/authStore";
import { canApproveSystemReferrals } from "../lib/referralApproval";
import { isSupportedReferralTargetUser } from "../lib/referralScope";
import {
  fetchEntitiesBootstrap,
  listCounselingCases,
  listGroupSessions,
  listReferrals,
  type CounselingCase,
  type GroupSession,
  type Referral,
  type User,
} from "../lib/entitiesApi";

const USERS_KEY = "gcms_mock_users_v1";
const CASES_KEY = "gcms_mock_counseling_cases_v2";
const REF_KEY = "gcms_mock_referrals_v1";
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

function toMonthKey(value?: string | null): string {
  const dateKey = toDateKey(value);
  if (!dateKey) return "";
  return dateKey.slice(0, 7);
}

function parseScheduleTimestamp(date?: string | null, time?: string | null): number {
  const dateKey = toDateKey(date);
  if (!dateKey) return 0;

  const timeText = String(time || "").trim() || "00:00";
  const parsed = new Date(`${dateKey}T${timeText}:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const fallback = new Date(`${dateKey}T00:00:00`);
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

function formatDateShort(iso?: string | null): string {
  const raw = String(iso || "").trim();
  if (!raw) return "No date";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
}

type DashboardScheduleItem = {
  id: string;
  title: string;
  type: "Counseling Case" | "Referral Meeting" | "Group Counselling";
  dateKey: string;
  timeLabel: string;
  timestamp: number;
  accent: string;
  detail: string;
};

type PendingRow = {
  id: string;
  who: string;
  what: string;
  when: string;
  rawDate: string;
};

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "var(--shadow)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--card)",
  transition: "transform 140ms ease, box-shadow 140ms ease",
};

export default function STAFFDashboard() {
  const nav = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const STAFFId = authUser?.id ?? 0;
  const canApproveReferrals = canApproveSystemReferrals(authUser);

  const [users, setUsers] = useState<User[]>(() => load<User[]>(USERS_KEY, []));
  const [cases, setCases] = useState<CounselingCase[]>(() =>
    load<CounselingCase[]>(CASES_KEY, []),
  );
  const [referrals, setReferrals] = useState<Referral[]>(() =>
    load<Referral[]>(REF_KEY, []),
  );
  const [sessions, setSessions] = useState<GroupSession[]>(() =>
    load<GroupSession[]>(GS_KEY, []),
  );
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    dateKeyFromDate(new Date()),
  );
  const [scheduleCollapsed, setScheduleCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      const [bootstrapRes, casesRes, referralsRes, sessionsRes] =
        await Promise.allSettled([
          fetchEntitiesBootstrap(),
          listCounselingCases(),
          listReferrals(),
          listGroupSessions(),
        ]);

      if (!alive) return;

      if (bootstrapRes.status === "fulfilled") {
        const nextUsers = bootstrapRes.value.users ?? [];
        setUsers(nextUsers);
        save(USERS_KEY, nextUsers);
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

      if (sessionsRes.status === "fulfilled") {
        const nextSessions = sessionsRes.value.sessions ?? [];
        const nextMembers = sessionsRes.value.members ?? [];
        setSessions(nextSessions);
        save(GS_KEY, nextSessions);
        save("gcms_mock_group_session_members_v1", nextMembers);
      }

      setLastUpdated(new Date().toISOString());
    };

    refresh();
    const timer = window.setInterval(refresh, 12000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const usersById = useMemo(() => {
    const map = new Map<number, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const scopedReferrals = useMemo(
    () =>
      referrals.filter((referral) =>
        isSupportedReferralTargetUser(usersById.get(referral.studentId)),
      ),
    [referrals, usersById],
  );

  const myCases = useMemo(
    () => cases.filter((c) => c.STAFFUserId === STAFFId),
    [cases, STAFFId],
  );
  const mySessions = useMemo(
    () => sessions.filter((s) => s.STAFFUserId === STAFFId),
    [sessions, STAFFId],
  );

  const activeCases = myCases.filter((c) => c.status !== "Completed").length;
  const referralsThisMonth = useMemo(() => {
    const now = new Date();
    return scopedReferrals.filter((r) => {
      const dt = new Date(String(r.referredDate || ""));
      if (Number.isNaN(dt.getTime())) return false;
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;
  }, [scopedReferrals]);
  const monthlySessionsData = useMemo(() => {
    const now = new Date();
    const monthStarts: Date[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }

    const caseCounts = new Map<string, number>();
    const sessionCounts = new Map<string, number>();

    for (const c of myCases) {
      const key = toMonthKey(c.date);
      if (!key) continue;
      caseCounts.set(key, (caseCounts.get(key) ?? 0) + 1);
    }
    for (const s of mySessions) {
      const key = toMonthKey(s.date);
      if (!key) continue;
      sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
    }

    return monthStarts.map((d) => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        month: d.toLocaleDateString(undefined, { month: "short" }),
        count: (caseCounts.get(key) ?? 0) + (sessionCounts.get(key) ?? 0),
      };
    });
  }, [myCases, mySessions]);

  const scheduleItems = useMemo<DashboardScheduleItem[]>(() => {
    const rows: DashboardScheduleItem[] = [];

    for (const c of myCases) {
      if (c.status === "Completed") continue;
      const dateKey = toDateKey(c.date);
      if (!dateKey) continue;
      const student = usersById.get(c.studentId);
      rows.push({
        id: `case-${c.id}`,
        title: student
          ? `${student.fname} ${student.lname}`
          : `Student #${c.studentId}`,
        type: "Counseling Case",
        dateKey,
        timeLabel: formatTimeShort(c.time),
        timestamp: parseScheduleTimestamp(c.date, c.time),
        accent: "rgba(37,99,235,1)",
        detail: `Location: Guidance Office · Status: ${c.status}`,
      });
    }

    for (const r of scopedReferrals) {
      const statusText = String(r.status || "").trim().toLowerCase();
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
      const dateKey = toDateKey(r.referredDate);
      if (!dateKey) continue;
      const student = usersById.get(r.studentId);
      rows.push({
        id: `referral-${r.id}`,
        title: student
          ? `${student.fname} ${student.lname}`
          : `Student #${r.studentId}`,
        type: "Referral Meeting",
        dateKey,
        timeLabel: formatTimeShort(r.referredTime),
        timestamp: parseScheduleTimestamp(r.referredDate, r.referredTime),
        accent: "rgba(251,191,36,1)",
        detail: `Location: Guidance Office · Status: ${String(r.status || "Approved")}`,
      });
    }

    for (const s of mySessions) {
      const dateKey = toDateKey(s.date);
      if (!dateKey) continue;
      rows.push({
        id: `session-${s.id}`,
        title: s.topic,
        type: "Group Counselling",
        dateKey,
        timeLabel: formatTimeShort(s.time),
        timestamp: parseScheduleTimestamp(s.date, s.time),
        accent: "rgba(9,14,25,1)",
        detail: s.location ? `Location: ${s.location}` : "Group Counselling",
      });
    }

    rows.sort((a, b) => a.timestamp - b.timestamp || a.title.localeCompare(b.title));
    return rows;
  }, [myCases, mySessions, scopedReferrals, usersById]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);
  const upcomingAgenda = useMemo(
    () => scheduleItems.filter((item) => item.dateKey >= todayKey).slice(0, 6),
    [scheduleItems, todayKey],
  );
  const selectedDateItems = useMemo(
    () => scheduleItems.filter((item) => item.dateKey === selectedDateKey),
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
  }, [
    calendarMonth,
    scheduleDateCounts,
    scheduleItemsByDate,
    selectedDateKey,
    todayKey,
  ]);

  const pendingReferralRows = useMemo<PendingRow[]>(() => {
    const rows: PendingRow[] = [];

    for (const r of scopedReferrals) {
      if (!["Pending", "New"].includes(String(r.status))) continue;
      const student = usersById.get(r.studentId);
      rows.push({
        id: `ref-${r.id}`,
        who: student ? `${student.fname} ${student.lname}` : `Student #${r.studentId}`,
        what: "Awaiting approval",
        when: formatDateShort(r.referredDate),
        rawDate: String(r.referredDate || ""),
      });
    }

    rows.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    return rows.slice(0, 5);
  }, [scopedReferrals, usersById]);

  const pendingRows = useMemo<PendingRow[]>(() => {
    const rows: PendingRow[] = [];

    for (const c of myCases) {
      if (c.status !== "Pending") continue;
      const student = usersById.get(c.studentId);
      rows.push({
        id: `case-${c.id}`,
        who: student ? `${student.fname} ${student.lname}` : `Student #${c.studentId}`,
        what: "Pending Counseling Case",
        when: formatDateShort(c.date),
        rawDate: c.date,
      });
    }

    rows.sort((a, b) => (a.rawDate < b.rawDate ? 1 : -1));
    return rows.slice(0, 5);
  }, [myCases, usersById]);

  const calendarGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, 0.85fr)",
    gap: 14,
    alignItems: "start",
  };

  const monthNavButton = (disabled = false): React.CSSProperties => ({
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.85)",
    color: "var(--text)",
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  });

  const calendarWrap: React.CSSProperties = {
    borderRadius: 22,
    border: "1px solid rgba(15,23,42,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.95) 100%)",
    padding: 16,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  };

  const weekdayGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 8,
  };

  const weekdayCell: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 900,
    color: "rgba(15,23,42,0.56)",
    textTransform: "uppercase",
    textAlign: "center",
    padding: "6px 0",
  };

  const calendarGridCells: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  };

  const agendaCard: React.CSSProperties = {
    ...cardStyle,
    display: "grid",
    gap: 12,
  };

  const agendaColumn: React.CSSProperties = {
    display: "grid",
    gap: 14,
    marginTop: 8,
  };

  const agendaList: React.CSSProperties = {
    display: "grid",
    gap: 10,
  };

  const agendaRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(248,250,252,0.78)",
  };

  const actionButtonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 38,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(37,99,235,0.16)",
    background: "linear-gradient(135deg, rgba(37,99,235,1), rgba(29,78,216,1))",
    color: "white",
    fontSize: 12.5,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(37,99,235,0.18)",
  };

  return (
    <div
      style={{
        padding: 28,
        maxWidth: 1300,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Overview</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Live dashboard data for your counseling workload.
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {lastUpdated
            ? `Auto-refreshing every 12s - Updated ${new Date(lastUpdated).toLocaleTimeString()}`
            : "Loading latest data..."}
        </div>
      </div>

      <div
        className="dash-grid-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <StatCard
          label="Active Counseling Cases"
          value={activeCases}
          hint="Pending / ongoing cases"
          icon={<ClipboardList size={20} />}
          tone="yellow"
        />

        <StatCard
          label="Referrals This Month"
          value={referralsThisMonth}
          hint="New referrals logged"
          icon={<Activity size={20} />}
          tone="blue"
        />
      </div>

      <div style={cardStyle}>
        <div
          style={{
            ...sectionTitleStyle,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Schedule Calendar</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              Counseling cases, referral meetings, and Group Counselling schedules.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}
              style={monthNavButton(scheduleCollapsed)}
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
              style={monthNavButton(scheduleCollapsed)}
              aria-label="Next month"
              disabled={scheduleCollapsed}
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => setScheduleCollapsed((current) => !current)}
              style={monthNavButton()}
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
              borderRadius: 18,
              border: "1px dashed rgba(15,23,42,0.12)",
              background: "rgba(248,250,252,0.75)",
              padding: "14px 16px",
              color: "rgba(15,23,42,0.62)",
              fontSize: 13,
            }}
          >
            Calendar hidden. Use the collapse icon to expand the schedule view again.
          </div>
        ) : (
          <div className="dash-calendar-grid" style={calendarGrid}>
            <div style={calendarWrap}>
              <div style={weekdayGrid}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                  <div key={label} style={weekdayCell}>
                    {label}
                  </div>
                ))}
              </div>

              <div className="dash-calendar-cells" style={calendarGridCells}>
                {calendarCells.map((cell) => (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDateKey(cell.key)}
                    title={cell.tooltip}
                    style={{
                      minHeight: 104,
                      borderRadius: 18,
                      border: cell.isSelected
                        ? "1px solid rgba(37,99,235,1)"
                        : cell.isToday
                          ? "1px solid rgba(37,99,235,0.25)"
                          : "1px solid rgba(15,23,42,0.08)",
                      background: cell.isSelected
                        ? "linear-gradient(180deg, rgba(219,234,254,0.86) 0%, rgba(255,255,255,0.96) 100%)"
                        : cell.isCurrentMonth
                          ? "rgba(255,255,255,0.92)"
                          : "rgba(241,245,249,0.78)",
                      color: cell.isCurrentMonth ? "var(--text)" : "rgba(15,23,42,0.42)",
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
                          color: cell.isToday ? "#1d4ed8" : undefined,
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
                            color: "#1d4ed8",
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
                          color: cell.count > 0 ? "var(--text)" : "rgba(15,23,42,0.56)",
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

            <div style={agendaColumn}>
              <div style={agendaCard}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 950 }}>
                    {formatDateLong(selectedDateKey)}
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.7 }}>
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
                        color: "rgba(15,23,42,0.62)",
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
                        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 900 }}>{item.title}</span>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 900,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(15,23,42,0.06)",
                                color: "rgba(15,23,42,0.62)",
                              }}
                            >
                              {item.type}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(15,23,42,0.62)", fontSize: 12.5 }}>
                            <Clock3 size={14} />
                            <span>{item.timeLabel}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: "rgba(15,23,42,0.62)" }}>{item.detail}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={agendaCard}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>Next Up</div>
                {upcomingAgenda.length === 0 ? (
                  <div style={{ color: "rgba(15,23,42,0.62)", fontSize: 13 }}>
                    No upcoming schedules recorded yet.
                  </div>
                ) : (
                  <div style={agendaList}>
                    {upcomingAgenda.map((item) => (
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
                          ) : item.type === "Group Counselling" ? (
                            <UsersRound size={16} />
                          ) : (
                            <CalendarDays size={16} />
                          )}
                        </div>
                        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                          <div style={{ fontWeight: 800 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)" }}>
                            {item.type} · {formatDateShort(item.dateKey)} · {item.timeLabel}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className="dash-grid-2-1"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 14,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Monthly Sessions Trend</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            Combined counseling cases + Group Counselling records (last 6 months)
          </div>
          <div style={{ marginTop: 12, height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlySessionsData}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3366D6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div
        className="dash-grid-1-1"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 14,
        }}
      >
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <span>{canApproveReferrals ? "Referral Approval Queue" : "Pending Requests"}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {canApproveReferrals ? pendingReferralRows.length : pendingRows.length} items
            </span>
          </div>

          {canApproveReferrals ? (
            <div
              style={{
                marginBottom: 12,
                padding: 14,
                borderRadius: 16,
                border: "1px solid rgba(37,99,235,0.10)",
                background: "linear-gradient(135deg, rgba(219,234,254,0.85), rgba(255,255,255,0.96))",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(37,99,235,0.12)",
                    color: "#1d4ed8",
                  }}
                >
                  <CheckCircle2 size={18} />
                </span>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 900 }}>Referral approval access enabled</div>
                  <div style={{ fontSize: 12.5, opacity: 0.75 }}>
                    You can review and approve referrals submitted across the system.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Waiting for approval</div>
                  <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                    {pendingReferralRows.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => nav("/app/counseling?tab=referrals")}
                  style={actionButtonStyle}
                >
                  <FileText size={16} />
                  Open Referrals
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(canApproveReferrals ? pendingReferralRows.length === 0 : pendingRows.length === 0) ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                {canApproveReferrals
                  ? "No referrals are waiting for approval."
                  : "No pending requests."}
              </div>
            ) : (
              (canApproveReferrals ? pendingReferralRows : pendingRows).map((row) => (
                <div
                  key={row.id}
                  style={listItemStyle}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 800 }}>{row.who}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{row.what}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{row.when}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          @media (max-width: 1100px) {
            .dash-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .dash-grid-2-1 { grid-template-columns: 1fr !important; }
            .dash-grid-1-1 { grid-template-columns: 1fr !important; }
            .dash-calendar-grid { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 640px) {
            .dash-grid-4 { grid-template-columns: 1fr !important; }
            .dash-calendar-cells button { min-height: 76px !important; padding: 8px !important; }
          }
        `}
      </style>
    </div>
  );
}
