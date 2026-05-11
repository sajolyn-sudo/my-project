import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  FileText,
  UsersRound,
} from "lucide-react";
import useStudentPortalSync from "../hooks/useStudentPortalSync";
import { useGCMS, fullName } from "../store/gcmsStore";

/**
 * StudentDashboard.tsx
 * Focused student overview: group counselling schedule, referrals, and counselling request status.
 */

type AnyRecord = Record<string, any>;
type StudentScheduleItem = {
  id: string;
  title: string;
  type: "Counselling Request" | "Referral Meeting" | "Group Counselling";
  dateKey: string;
  timeLabel: string;
  timestamp: number;
  accent: string;
  detail: string;
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1000px 420px at 20% -10%, rgba(29,78,216,0.14), transparent 60%), radial-gradient(900px 420px at 100% 0%, rgba(250,204,21,0.12), transparent 55%), #f6f7fb",
    padding: 14,
    color: "#0f172a",
  } as React.CSSProperties,

  container: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 12,
  } as React.CSSProperties,

  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  } as React.CSSProperties,

  title: {
    fontSize: 22,
    margin: 0,
    letterSpacing: -0.3,
  } as React.CSSProperties,

  subtitle: {
    margin: "4px 0 0 0",
    color: "#475569",
    fontSize: 12.5,
  } as React.CSSProperties,

  pillRow: {
    marginTop: 8,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  } as React.CSSProperties,

  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontSize: 11.5,
    fontWeight: 750,
  } as React.CSSProperties,

  card: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
    boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
    padding: 12,
    backdropFilter: "blur(8px)",
    height: "100%",
  } as React.CSSProperties,

  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  } as React.CSSProperties,

  cardTitle: {
    margin: 0,
    fontSize: 12,
    color: "#334155",
    fontWeight: 950,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  } as React.CSSProperties,

  muted: { color: "#64748b", fontSize: 12 } as React.CSSProperties,

  divider: {
    height: 1,
    background: "rgba(15,23,42,0.08)",
    margin: "10px 0",
  } as React.CSSProperties,

  // Stats row (smaller)
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  } as React.CSSProperties,

  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 18px rgba(15,23,42,0.06)",
    flex: "0 0 auto",
  } as React.CSSProperties,

  bigNumber: {
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: -0.4,
    lineHeight: 1.05,
  } as React.CSSProperties,

  // Dense grid
  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: 12,
    gridAutoFlow: "dense",
    alignItems: "stretch",
  } as React.CSSProperties,

  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.85fr)",
    gap: 14,
    alignItems: "start",
  } as React.CSSProperties,

  calendarWrap: {
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.95) 100%)",
    padding: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  } as React.CSSProperties,

  weekdayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 8,
  } as React.CSSProperties,

  weekdayCell: {
    fontSize: 11,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    textAlign: "center",
    padding: "6px 0",
  } as React.CSSProperties,

  calendarGridCells: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 8,
  } as React.CSSProperties,

  agendaColumn: {
    display: "grid",
    gap: 12,
  } as React.CSSProperties,

  agendaCard: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 14,
    boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
    padding: 12,
    display: "grid",
    gap: 10,
  } as React.CSSProperties,

  agendaList: {
    display: "grid",
    gap: 10,
  } as React.CSSProperties,

  agendaRow: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(248,250,252,0.8)",
  } as React.CSSProperties,

  // Carousel
  carouselControls: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  } as React.CSSProperties,

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 6px 12px rgba(15,23,42,0.06)",
    cursor: "pointer",
    fontWeight: 950,
    transition: "all 0.2s ease",
  } as React.CSSProperties,

  carouselTrack: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(240px, 1fr)",
    gap: 10,
    overflow: "hidden",
    alignItems: "stretch",
  } as React.CSSProperties,

  carouselCard: {
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.93), rgba(255,255,255,0.78))",
    boxShadow: "0 10px 20px rgba(15,23,42,0.06)",
    padding: 12,
    display: "grid",
    gap: 8,
    minHeight: 130,
    height: "100%",
  } as React.CSSProperties,

  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.92)",
    fontSize: 11.5,
    fontWeight: 850,
    color: "#0f172a",
    width: "fit-content",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  responsive: `
    @media (max-width: 1100px) {
      .statsGrid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .grid12 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
      .studentCalendarGrid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 700px) {
      .statsGrid { grid-template-columns: 1fr !important; }
      .grid12 { grid-template-columns: 1fr !important; }
      .studentCalendarCells button { min-height: 76px !important; padding: 8px !important; }
    }
  `,
};

function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return dateKeyFromDate(parsed);
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

function buildScheduleDateTime(date?: string | null, time?: string | null) {
  const cleanDate = String(date || "").trim();
  if (!cleanDate) return null;
  const cleanTime = String(time || "").trim();
  const parsed = new Date(
    cleanTime ? `${cleanDate}T${cleanTime}` : `${cleanDate}T23:59:00`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatScheduleDateTime(date?: string | null, time?: string | null) {
  const parsed = buildScheduleDateTime(date, time);
  return parsed ? formatDateTime(parsed) : "â€”";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function StatusChip({ status }: { status?: string }) {
  const s = (status || "No Case").toLowerCase();
  const palette = s.includes("pending")
    ? {
        bg: "rgba(245,158,11,0.14)",
        br: "rgba(245,158,11,0.35)",
        tx: "#92400e",
        dot: "#f59e0b",
      }
    : s.includes("scheduled")
      ? {
          bg: "rgba(59,130,246,0.14)",
          br: "rgba(59,130,246,0.35)",
          tx: "#1d4ed8",
          dot: "#3b82f6",
        }
      : s.includes("ongoing")
        ? {
            bg: "rgba(34,197,94,0.14)",
            br: "rgba(34,197,94,0.35)",
            tx: "#166534",
            dot: "#22c55e",
          }
        : s.includes("complete") || s.includes("done")
          ? {
              bg: "rgba(100,116,139,0.14)",
              br: "rgba(100,116,139,0.35)",
              tx: "#334155",
              dot: "#64748b",
            }
          : {
              bg: "rgba(148,163,184,0.14)",
              br: "rgba(148,163,184,0.35)",
              tx: "#475569",
              dot: "#94a3b8",
            };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px",
        borderRadius: 999,
        border: `1px solid ${palette.br}`,
        background: palette.bg,
        color: palette.tx,
        fontSize: 11.5,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: palette.dot,
        }}
      />
      {status || "No Case"}
    </span>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      {title ? (
        <div style={styles.cardTitleRow}>
          <h3 style={styles.cardTitle}>{title}</h3>
          {right}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  helper,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div style={{ ...styles.card, padding: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={styles.iconBubble}>{icon}</div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              color: "#64748b",
              fontSize: 11.5,
              fontWeight: 950,
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          <div style={styles.bigNumber}>{value}</div>
        </div>
      </div>
      {helper ? (
        <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 14,
        border: "1px dashed rgba(15,23,42,0.18)",
        background: "rgba(255,255,255,0.6)",
      }}
    >
      <div style={{ fontWeight: 950, marginBottom: 4, fontSize: 13 }}>
        {title}
      </div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{subtitle}</div>
    </div>
  );
}

function Carousel({
  title,
  items,
  render,
  right,
  emptyTitle,
  emptySubtitle,
}: {
  title: string;
  items: AnyRecord[];
  render: (item: AnyRecord, idx: number) => React.ReactNode;
  right?: React.ReactNode;
  emptyTitle: string;
  emptySubtitle: string;
}) {
  const [index, setIndex] = useState(0);
  const pageSize = 2;
  const maxIndex = Math.max(0, items.length - pageSize);
  const view = items.slice(index, index + pageSize);

  return (
    <Card
      title={title}
      right={
        <div style={styles.carouselControls}>
          {right}
          <button
            type="button"
            style={styles.iconBtn}
            onClick={() => setIndex((v) => clamp(v - 1, 0, maxIndex))}
            aria-label="Previous"
          >
            ◀
          </button>
          <button
            type="button"
            style={styles.iconBtn}
            onClick={() => setIndex((v) => clamp(v + 1, 0, maxIndex))}
            aria-label="Next"
          >
            ▶
          </button>
        </div>
      }
    >
      {items.length ? (
        <div style={styles.carouselTrack}>
          {view.map((it, i) => (
            <div key={it.id ?? `${index}-${i}`} style={styles.carouselCard}>
              {render(it, index + i)}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      )}
    </Card>
  );
}

export default function StudentDashboard() {
  useStudentPortalSync();
  const store = useGCMS() as AnyRecord;
  const currentUser = store.currentUser as AnyRecord | null;

  const counseling: AnyRecord[] = store.counseling ?? store.counselings ?? [];
  const referral: AnyRecord[] = store.referral ?? store.referrals ?? [];
  const group_session: AnyRecord[] =
    store.group_sessions ?? store.group_session ?? store.groupSessions ?? [];
  const group_session_member: AnyRecord[] =
    store.group_session_members ??
    store.group_session_member ??
    store.groupSessionMembers ??
    [];
  const academic_year: AnyRecord[] =
    store.academic_year ?? store.academicYears ?? [];

  const myUserId =
    currentUser?.users_id ?? currentUser?.id ?? currentUser?.user_id;
  const [calendarMonth, setCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    dateKeyFromDate(new Date()),
  );
  const [scheduleCollapsed, setScheduleCollapsed] = useState(false);

  const dashboard = useMemo(() => {
    const myCounselings = counseling
      .filter((c) => (c.student_user_id ?? c.studentId) === myUserId)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.counseling_date ?? b.date ?? 0).getTime() -
          new Date(a.counseling_date ?? a.date ?? 0).getTime(),
      );

    const latestCounseling = myCounselings[0] ?? null;

    const allMyReferrals = referral
      .filter(
        (r) =>
          (r.student_user_id ?? r.referred_student_user_id ?? r.studentId) ===
            myUserId ||
          (r.referred_by_user_id ?? r.referredByUserId) === myUserId,
      )
      .slice()
      .sort(
        (a, b) =>
          new Date(
            b.referred_date ?? b.referredDate ?? b.created_at ?? b.createdAt ?? 0,
          ).getTime() -
          new Date(
            a.referred_date ?? a.referredDate ?? a.created_at ?? a.createdAt ?? 0,
          ).getTime(),
      );

    const receivedReferrals = allMyReferrals.filter(
      (r) =>
        (r.student_user_id ?? r.referred_student_user_id ?? r.studentId) ===
          myUserId &&
        (r.referred_by_user_id ?? r.referredByUserId) !== myUserId,
    );

    const submittedReferrals = allMyReferrals.filter(
      (r) => (r.referred_by_user_id ?? r.referredByUserId) === myUserId,
    );

    const memberRows = group_session_member.filter(
      (m) => (m.student_user_id ?? m.studentId) === myUserId,
    );

    const mySessions = memberRows
      .map((m) => {
        const sid = m.group_session_id ?? m.session_id ?? m.groupSessionId;
        const s =
          group_session.find((gs) => (gs.group_session_id ?? gs.id) === sid) ??
          null;
        return s;
      })
      .filter(Boolean) as AnyRecord[];

    const now = Date.now();
    const upcomingSessions = mySessions
      .filter(
        (s) =>
          new Date(s.session_date ?? s.date ?? s.schedule ?? 0).getTime() >=
          now,
      )
      .slice()
      .sort(
        (a, b) =>
          new Date(a.session_date ?? a.date ?? 0).getTime() -
          new Date(b.session_date ?? b.date ?? 0).getTime(),
      );

    const nextSession = upcomingSessions[0] ?? null;

    return {
      myCounselings,
      latestCounseling,
      allMyReferrals,
      receivedReferrals,
      submittedReferrals,
      nextSession,
      mySessions,
      upcomingSessions,
    };
  }, [
    myUserId,
    counseling,
    referral,
    group_session,
    group_session_member,
  ]);

  const greetingName = currentUser ? fullName(currentUser as any) : "Student";
  const latestAY =
    academic_year?.[0]?.ay_name ??
    academic_year?.[0]?.sy_name ??
    "Current Academic Year";

  const carouselSessions = useMemo(() => {
    if (!dashboard.upcomingSessions.length) return [];
    return dashboard.upcomingSessions.map((s, i) => ({
      id: s.group_session_id ?? s.id ?? `session-${i}`,
      title: s.topic ?? s.title ?? "Group Counselling",
      when: formatDateTime(s.session_date ?? s.date ?? s.schedule),
      location: s.location ?? "TBA",
      note: s.description ?? s.notes ?? "",
    }));
  }, [dashboard.upcomingSessions]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const scheduleItems = useMemo<StudentScheduleItem[]>(() => {
    const next: StudentScheduleItem[] = [];

    for (const item of dashboard.myCounselings) {
      const status = String(item.status || "Pending");
      const normalizedStatus = status.toLowerCase();
      if (
        normalizedStatus.includes("cancel") ||
        normalizedStatus.includes("complete") ||
        normalizedStatus.includes("done")
      ) {
        continue;
      }

      const date = item.counseling_date ?? item.date ?? item.created_at ?? item.createdAt;
      const time = item.counseling_time ?? item.time;
      const dateKey = toDateKey(date);
      if (!dateKey) continue;

      next.push({
        id: `counselling-${item.counseling_id ?? item.id ?? dateKey}`,
        title: item.reason ?? item.notes ?? "Counselling request",
        type: "Counselling Request",
        dateKey,
        timeLabel: formatTimeShort(time),
        timestamp: parseScheduleTimestamp(date, time),
        accent: "rgba(37,99,235,1)",
        detail: `Status: ${status}`,
      });
    }

    for (const item of dashboard.allMyReferrals) {
      const status = String(item.status || "Pending");
      const normalizedStatus = status.toLowerCase();
      if (
        normalizedStatus.includes("pending") ||
        normalizedStatus.includes("complete") ||
        normalizedStatus.includes("closed") ||
        normalizedStatus.includes("resolved")
      ) {
        continue;
      }

      const date = item.referred_date ?? item.referredDate;
      const time = item.referred_time ?? item.referredTime;
      const dateKey = toDateKey(date);
      if (!dateKey) continue;

      const referredById = item.referred_by_user_id ?? item.referredByUserId;
      next.push({
        id: `referral-${item.referral_id ?? item.id ?? dateKey}`,
        title: item.reason ?? "Referral meeting",
        type: "Referral Meeting",
        dateKey,
        timeLabel: formatTimeShort(time),
        timestamp: parseScheduleTimestamp(date, time),
        accent: "rgba(251,191,36,1)",
        detail: `${referredById === myUserId ? "Submitted" : "Received"} referral · Status: ${status}`,
      });
    }

    for (const item of dashboard.mySessions) {
      const date = item.session_date ?? item.date ?? item.schedule;
      const time = item.session_time ?? item.time;
      const dateKey = toDateKey(date);
      if (!dateKey) continue;

      next.push({
        id: `group-${item.group_session_id ?? item.id ?? dateKey}`,
        title: item.topic ?? item.title ?? "Group Counselling",
        type: "Group Counselling",
        dateKey,
        timeLabel: formatTimeShort(time),
        timestamp: parseScheduleTimestamp(date, time),
        accent: "rgba(9,14,25,1)",
        detail: item.location ? `Location: ${item.location}` : "Group Counselling",
      });
    }

    next.sort((a, b) => a.timestamp - b.timestamp || a.title.localeCompare(b.title));
    return next;
  }, [
    dashboard.myCounselings,
    dashboard.allMyReferrals,
    dashboard.mySessions,
    myUserId,
  ]);

  const selectedDateItems = useMemo(
    () => scheduleItems.filter((item) => item.dateKey === selectedDateKey),
    [scheduleItems, selectedDateKey],
  );

  const upcomingAgenda = useMemo(
    () => scheduleItems.filter((item) => item.dateKey >= todayKey).slice(0, 6),
    [scheduleItems, todayKey],
  );

  const scheduleDateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of scheduleItems) {
      map.set(item.dateKey, (map.get(item.dateKey) ?? 0) + 1);
    }
    return map;
  }, [scheduleItems]);

  const scheduleItemsByDate = useMemo(() => {
    const map = new Map<string, StudentScheduleItem[]>();
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
        tooltip: items.length
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

  const referralRows = useMemo(
    () =>
      dashboard.allMyReferrals.slice(0, 6).map((r, i) => {
        const referredById = r.referred_by_user_id ?? r.referredByUserId;
        return {
          id: r.referral_id ?? r.id ?? `referral-${i}`,
          direction: referredById === myUserId ? "Submitted" : "Received",
          reason: r.reason ?? "Referral",
          status: r.status ?? "Pending",
          date: formatDateTime(
            r.referred_date ?? r.referredDate ?? r.created_at ?? r.createdAt,
          ),
        };
      }),
    [dashboard.allMyReferrals, myUserId],
  );

  const counsellingRows = useMemo(
    () =>
      dashboard.myCounselings.slice(0, 6).map((c, i) => ({
        id: c.counseling_id ?? c.id ?? `counselling-${i}`,
        reason: c.reason ?? c.notes ?? "Counselling request",
        status: c.status ?? "Pending",
        date: formatScheduleDateTime(
          c.counseling_date ?? c.date,
          c.counseling_time ?? c.time,
        ),
      })),
    [dashboard.myCounselings],
  );

  const calendarNavButton = (disabled = false): React.CSSProperties => ({
    width: 34,
    height: 34,
    borderRadius: 11,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    display: "grid",
    placeItems: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  });

  return (
    <div style={styles.page}>
      <style>{styles.responsive}</style>

      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Hi, {greetingName} 👋</h1>
            <p style={styles.subtitle}>Here’s your overview for today.</p>
            <div style={styles.pillRow}>
              <span style={styles.pill}>🎓 {latestAY}</span>
              <span style={styles.pill}>🧭 Student Portal</span>
              <span style={styles.pill}>
                📌 Status:{" "}
                <span style={{ marginLeft: 6 }}>
                  <StatusChip status={dashboard.latestCounseling?.status} />
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="statsGrid" style={styles.statsGrid}>
          <StatCard
            icon={<span style={{ fontSize: 16 }}>📅</span>}
            title="Group Counselling Sched"
            value={dashboard.nextSession ? "Scheduled" : "None"}
            helper={
              dashboard.nextSession
                ? formatScheduleDateTime(
                    dashboard.nextSession.session_date ??
                      dashboard.nextSession.date,
                    dashboard.nextSession.session_time ??
                      dashboard.nextSession.time,
                  )
                : "No upcoming group counselling"
            }
          />
          <StatCard
            icon={<span style={{ fontSize: 16 }}>📤</span>}
            title="Referrals Submitted"
            value={dashboard.submittedReferrals.length}
            helper={
              dashboard.submittedReferrals[0]
                ? `Latest: ${formatDateTime(
                    dashboard.submittedReferrals[0].referred_date ??
                      dashboard.submittedReferrals[0].referredDate ??
                      dashboard.submittedReferrals[0].created_at,
                  )}`
                : "No submitted referrals"
            }
          />
          <StatCard
            icon={<span style={{ fontSize: 16 }}>📩</span>}
            title="Referrals Received"
            value={dashboard.receivedReferrals.length}
            helper={
              dashboard.receivedReferrals[0]
                ? `Latest: ${formatDateTime(
                    dashboard.receivedReferrals[0].referred_date ??
                      dashboard.receivedReferrals[0].referredDate ??
                      dashboard.receivedReferrals[0].created_at,
                  )}`
                : "No received referrals"
            }
          />
          <StatCard
            icon={<span style={{ fontSize: 16 }}>🗂️</span>}
            title="Requested Counselling"
            value={dashboard.latestCounseling?.status ?? "None"}
            helper={
              dashboard.latestCounseling
                ? `Latest: ${formatDateTime(
                    dashboard.latestCounseling.counseling_date ??
                      dashboard.latestCounseling.date,
                  )}`
                : "No counselling requests"
            }
          />
        </div>

        <Card
          title="Schedule Calendar"
          right={
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
                style={calendarNavButton(scheduleCollapsed)}
                aria-label="Previous month"
                disabled={scheduleCollapsed}
              >
                <ChevronLeft size={17} />
              </button>
              <div
                style={{
                  minWidth: 150,
                  textAlign: "center",
                  fontWeight: 950,
                  color: "#0f172a",
                  fontSize: 13,
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
                style={calendarNavButton(scheduleCollapsed)}
                aria-label="Next month"
                disabled={scheduleCollapsed}
              >
                <ChevronRight size={17} />
              </button>
              <button
                type="button"
                onClick={() => setScheduleCollapsed((current) => !current)}
                style={calendarNavButton()}
                aria-label={scheduleCollapsed ? "Expand calendar" : "Collapse calendar"}
                title={scheduleCollapsed ? "Expand calendar" : "Collapse calendar"}
              >
                {scheduleCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
              </button>
            </div>
          }
        >
          {scheduleCollapsed ? (
            <div
              style={{
                borderRadius: 14,
                border: "1px dashed rgba(15,23,42,0.14)",
                background: "rgba(248,250,252,0.75)",
                padding: "12px 14px",
                color: "#64748b",
                fontSize: 12.5,
              }}
            >
              Calendar hidden. Use the collapse icon to expand the schedule view again.
            </div>
          ) : (
            <div className="studentCalendarGrid" style={styles.calendarGrid}>
              <div style={styles.calendarWrap}>
                <div style={styles.weekdayGrid}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                    <div key={label} style={styles.weekdayCell}>
                      {label}
                    </div>
                  ))}
                </div>

                <div className="studentCalendarCells" style={styles.calendarGridCells}>
                  {calendarCells.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDateKey(cell.key)}
                      title={cell.tooltip}
                      style={{
                        minHeight: 96,
                        borderRadius: 16,
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
                        color: cell.isCurrentMonth ? "#0f172a" : "rgba(15,23,42,0.42)",
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
                            color: cell.count > 0 ? "#0f172a" : "#64748b",
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

              <div style={styles.agendaColumn}>
                <div style={styles.agendaCard}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a" }}>
                      {formatDateLong(selectedDateKey)}
                    </div>
                    <div style={styles.muted}>
                      {selectedDateItems.length > 0
                        ? `${selectedDateItems.length} scheduled item${selectedDateItems.length > 1 ? "s" : ""} on this date`
                        : "No scheduled items on the selected date."}
                    </div>
                  </div>

                  <div style={styles.agendaList}>
                    {selectedDateItems.length === 0 ? (
                      <EmptyState
                        title="No schedule selected"
                        subtitle="Pick a highlighted date to inspect your schedule."
                      />
                    ) : (
                      selectedDateItems.map((item) => (
                        <div key={item.id} style={styles.agendaRow}>
                          <div
                            style={{
                              width: 9,
                              height: 42,
                              borderRadius: 999,
                              background: item.accent,
                            }}
                          />
                          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span style={{ fontWeight: 900, color: "#0f172a" }}>
                                {item.title}
                              </span>
                              <span style={styles.chip}>{item.type}</span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                color: "#64748b",
                                fontSize: 12.5,
                              }}
                            >
                              <Clock3 size={14} />
                              <span>{item.timeLabel}</span>
                            </div>
                            <div style={styles.muted}>{item.detail}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={styles.agendaCard}>
                  <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>
                    Next Up
                  </div>
                  {upcomingAgenda.length === 0 ? (
                    <div style={styles.muted}>No upcoming schedules recorded yet.</div>
                  ) : (
                    <div style={styles.agendaList}>
                      {upcomingAgenda.map((item) => (
                        <div key={`${item.id}-next`} style={styles.agendaRow}>
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
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>
                              {item.title}
                            </div>
                            <div style={styles.muted}>
                              {item.type} · {formatDateShort(item.dateKey)} ·{" "}
                              {item.timeLabel}
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
        </Card>

        {/* GRID */}
        <div className="grid12" style={styles.dashboardGrid}>
          <div style={{ gridColumn: "span 6", minHeight: 210 }}>
            <Carousel
              title="Group Counselling Schedule"
              items={carouselSessions}
              emptyTitle="No upcoming sessions"
              emptySubtitle="If you join a Group Counselling session, it will show here."
              render={(s: AnyRecord) => (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 13 }}>
                      {s.title}
                    </div>
                    <span style={styles.chip}>📍 {s.location}</span>
                  </div>
                  <div style={styles.muted}>🗓 {s.when}</div>
                  {s.note ? <div style={styles.muted}>{s.note}</div> : null}
                </>
              )}
            />
          </div>

          <div style={{ gridColumn: "span 6", minHeight: 210 }}>
            <Card
              title="Referrals Submitted and Received"
              right={
                <span style={styles.pill}>
                  {dashboard.submittedReferrals.length} submitted /{" "}
                  {dashboard.receivedReferrals.length} received
                </span>
              }
            >
              {referralRows.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {referralRows.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, fontSize: 13 }}>
                          {item.reason}
                        </div>
                        <div style={styles.muted}>{item.date}</div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={styles.chip}>{item.direction}</span>
                        <StatusChip status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No referrals yet"
                  subtitle="Submitted and received referrals will appear here."
                />
              )}
            </Card>
          </div>

          <div style={{ gridColumn: "span 12", minHeight: 210 }}>
            <Card title="Requested Counselling Status">
              {counsellingRows.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {counsellingRows.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, fontSize: 13 }}>
                          {item.reason}
                        </div>
                        <div style={styles.muted}>{item.date}</div>
                      </div>
                      <StatusChip status={item.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No counselling requests"
                  subtitle="Your requested counselling status will show here."
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
