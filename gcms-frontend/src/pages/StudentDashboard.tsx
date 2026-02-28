import React, { useMemo, useState } from "react";
import { useGCMS, fullName } from "../store/gcmsStore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * StudentDashboard.tsx (COMPACT / LESS SPACE)
 * ✅ Smaller paddings, fonts, radii, chart heights
 * ✅ Survey Progress: removed buttons (Take Survey / My Counseling)
 * ✅ Keeps: stats row, activity line chart, survey pie, sessions carousel, activity carousel
 */

type AnyRecord = Record<string, any>;

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
    }
    @media (max-width: 700px) {
      .statsGrid { grid-template-columns: 1fr !important; }
      .grid12 { grid-template-columns: 1fr !important; }
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
  const store = useGCMS() as AnyRecord;
  const currentUser = store.currentUser as AnyRecord | null;

  const counseling: AnyRecord[] = store.counseling ?? store.counselings ?? [];
  const referral: AnyRecord[] = store.referral ?? store.referrals ?? [];
  const group_session: AnyRecord[] =
    store.group_session ?? store.groupSessions ?? [];
  const group_session_member: AnyRecord[] =
    store.group_session_member ?? store.groupSessionMembers ?? [];
  const survey_interview: AnyRecord[] =
    store.survey_interview ?? store.surveyInterviews ?? [];
  const academic_year: AnyRecord[] =
    store.academic_year ?? store.academicYears ?? [];

  const myUserId =
    currentUser?.users_id ?? currentUser?.id ?? currentUser?.user_id;

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

    const myReferrals = referral
      .filter(
        (r) =>
          (r.student_user_id ?? r.referred_student_user_id ?? r.studentId) ===
          myUserId,
      )
      .slice()
      .sort(
        (a, b) =>
          new Date(b.referred_date ?? b.date ?? 0).getTime() -
          new Date(a.referred_date ?? a.date ?? 0).getTime(),
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

    const mySurveys = survey_interview
      .filter(
        (sv) => (sv.student_user_id ?? sv.user_id ?? sv.studentId) === myUserId,
      )
      .slice()
      .sort(
        (a, b) =>
          new Date(b.submitted_at ?? b.created_at ?? 0).getTime() -
          new Date(a.submitted_at ?? a.created_at ?? 0).getTime(),
      );

    const latestSurvey = mySurveys[0] ?? null;
    const surveySubmitted = !!latestSurvey?.submitted_at;

    const activity: {
      ts: number;
      title: string;
      meta?: string;
      kind: "counseling" | "referral" | "session" | "survey";
    }[] = [];

    for (const c of myCounselings.slice(0, 10)) {
      const t = new Date(c.counseling_date ?? c.created_at ?? 0).getTime();
      activity.push({
        ts: t || 0,
        kind: "counseling",
        title: `Counseling case ${c.status ? `(${c.status})` : ""}`,
        meta: `Date: ${formatDateTime(c.counseling_date ?? c.created_at)}`,
      });
    }
    for (const r of myReferrals.slice(0, 10)) {
      const t = new Date(r.referred_date ?? r.created_at ?? 0).getTime();
      activity.push({
        ts: t || 0,
        kind: "referral",
        title: "Referral recorded",
        meta: `Date: ${formatDateTime(r.referred_date ?? r.created_at)}`,
      });
    }
    for (const s of mySessions.slice(0, 10)) {
      const t = new Date(s.session_date ?? s.date ?? 0).getTime();
      activity.push({
        ts: t || 0,
        kind: "session",
        title: "Group session",
        meta: `Schedule: ${formatDateTime(s.session_date ?? s.date)}`,
      });
    }
    for (const sv of mySurveys.slice(0, 10)) {
      const t = new Date(sv.submitted_at ?? sv.created_at ?? 0).getTime();
      activity.push({
        ts: t || 0,
        kind: "survey",
        title: sv.submitted_at ? "Survey submitted" : "Survey started",
        meta: `Date: ${formatDateTime(sv.submitted_at ?? sv.created_at)}`,
      });
    }

    activity.sort((a, b) => b.ts - a.ts);

    return {
      myCounselings,
      latestCounseling,
      myReferrals,
      nextSession,
      upcomingSessions,
      latestSurvey,
      surveySubmitted,
      activity: activity.slice(0, 12),
    };
  }, [
    myUserId,
    counseling,
    referral,
    group_session,
    group_session_member,
    survey_interview,
  ]);

  const greetingName = currentUser ? fullName(currentUser as any) : "Student";
  const latestAY =
    academic_year?.[0]?.ay_name ??
    academic_year?.[0]?.sy_name ??
    "Current Academic Year";

  const activityGraphData = useMemo(() => {
    const buckets = new Map<string, number>();
    const items = dashboard.activity.slice(0, 20);

    for (const a of items) {
      const d = a.ts ? new Date(a.ts) : null;
      const label = d
        ? d.toLocaleDateString(undefined, { month: "short" })
        : "—";
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }

    const arr = Array.from(buckets.entries()).map(([name, activity]) => ({
      name,
      activity,
    }));
    return arr.length
      ? arr
      : [
          { name: "Jan", activity: 0 },
          { name: "Feb", activity: 0 },
          { name: "Mar", activity: 0 },
          { name: "Apr", activity: 0 },
        ];
  }, [dashboard.activity]);

  const surveyPercent = dashboard.surveySubmitted ? 100 : 0;
  const pieData = useMemo(
    () => [
      { name: "Completed", value: surveyPercent },
      { name: "Remaining", value: Math.max(0, 100 - surveyPercent) },
    ],
    [surveyPercent],
  );

  // keep simple color set
  const pieColors = ["#1d4ed8", "#e2e8f0"];

  const carouselSessions = useMemo(() => {
    if (!dashboard.upcomingSessions.length) return [];
    return dashboard.upcomingSessions.map((s, i) => ({
      id: s.group_session_id ?? s.id ?? `session-${i}`,
      title: s.title ?? "Group Session",
      when: formatDateTime(s.session_date ?? s.date ?? s.schedule),
      location: s.location ?? "TBA",
      note: s.description ?? s.notes ?? "",
    }));
  }, [dashboard.upcomingSessions]);

  const carouselActivity = useMemo(() => {
    if (!dashboard.activity.length) return [];
    return dashboard.activity.map((a, i) => ({
      id: `act-${i}-${a.ts}`,
      kind: a.kind,
      title: a.title,
      meta: a.meta,
      date: a.ts ? new Date(a.ts).toLocaleDateString() : "—",
    }));
  }, [dashboard.activity]);

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
            icon={<span style={{ fontSize: 16 }}>🗂️</span>}
            title="My Cases"
            value={dashboard.myCounselings.length}
            helper={
              dashboard.latestCounseling
                ? `Latest: ${formatDateTime(dashboard.latestCounseling.counseling_date)}`
                : "No cases yet"
            }
          />
          <StatCard
            icon={<span style={{ fontSize: 16 }}>📅</span>}
            title="Next Session"
            value={dashboard.nextSession ? "Scheduled" : "None"}
            helper={
              dashboard.nextSession
                ? formatDateTime(
                    dashboard.nextSession.session_date ??
                      dashboard.nextSession.date,
                  )
                : "No upcoming sessions"
            }
          />
          <StatCard
            icon={<span style={{ fontSize: 16 }}>📩</span>}
            title="Referrals"
            value={dashboard.myReferrals.length}
            helper={
              dashboard.myReferrals[0]
                ? `Latest: ${formatDateTime(dashboard.myReferrals[0].referred_date)}`
                : "No referrals recorded"
            }
          />
          <StatCard
            icon={<span style={{ fontSize: 16 }}>📝</span>}
            title="Survey"
            value={dashboard.surveySubmitted ? "Done" : "Pending"}
            helper={dashboard.surveySubmitted ? "Submitted" : "Not submitted"}
          />
        </div>

        {/* GRID */}
        <div className="grid12" style={styles.dashboardGrid}>
          {/* Activity Overview */}
          <div style={{ gridColumn: "span 8", minHeight: 250 }}>
            <Card title="Activity Overview">
              <div style={{ height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityGraphData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="activity"
                      stroke="#1d4ed8"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.divider} />
              <div style={styles.muted}>
                A quick view of your recent activity.
              </div>
            </Card>
          </div>

          {/* Survey Progress */}
          <div style={{ gridColumn: "span 4", minHeight: 250 }}>
            <Card
              title="Survey Progress"
              right={<span style={styles.pill}>{surveyPercent}%</span>}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ width: "100%", height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        innerRadius={45}
                        outerRadius={62}
                        paddingAngle={2}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={pieColors[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ fontWeight: 950, fontSize: 13 }}>
                  {dashboard.surveySubmitted ? "Completed ✅" : "Not submitted"}
                </div>
                <div style={styles.muted}>
                  {dashboard.surveySubmitted
                    ? `Submitted on ${formatDateTime(dashboard.latestSurvey?.submitted_at)}.`
                    : "Please complete your survey when available."}
                </div>
              </div>
            </Card>
          </div>

          {/* Upcoming Sessions Carousel */}
          <div style={{ gridColumn: "span 6", minHeight: 210 }}>
            <Carousel
              title="Upcoming Group Sessions"
              items={carouselSessions}
              emptyTitle="No upcoming sessions"
              emptySubtitle="If you join a group session, it will show here."
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

          {/* Recent Activity Carousel */}
          <div style={{ gridColumn: "span 6", minHeight: 210 }}>
            <Carousel
              title="Recent Activity"
              items={carouselActivity}
              emptyTitle="No activity yet"
              emptySubtitle="Once you have actions, you’ll see them here."
              render={(a: AnyRecord) => (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={styles.iconBubble}>
                    {a.kind === "counseling"
                      ? "🗂️"
                      : a.kind === "referral"
                        ? "📩"
                        : a.kind === "session"
                          ? "👥"
                          : "📝"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 950, fontSize: 13 }}>
                      {a.title}
                    </div>
                    <div style={styles.muted}>{a.meta}</div>
                  </div>
                  <span style={styles.chip}>⏱ {a.date}</span>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
