import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

import StatCard from "../components/StatCard";
import { useAuthStore } from "../store/authStore";
import { canApproveSystemReferrals } from "../lib/referralApproval";
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

function toDateKey(iso?: string | null): string {
  const dt = new Date(String(iso || ""));
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${dt.getMonth() + 1}`;
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

type ScheduleRow = {
  id: string;
  title: string;
  type: string;
  date: string;
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

  const studentUsers = useMemo(
    () => users.filter((u) => String(u.role).toUpperCase() === "STUDENT"),
    [users],
  );

  const myCases = useMemo(
    () => cases.filter((c) => c.STAFFUserId === STAFFId),
    [cases, STAFFId],
  );
  const mySessions = useMemo(
    () => sessions.filter((s) => s.STAFFUserId === STAFFId),
    [sessions, STAFFId],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const totalStudents = studentUsers.length;
  const activeCases = myCases.filter((c) => c.status !== "Completed").length;
  const referralsThisMonth = useMemo(() => {
    const now = new Date();
    return referrals.filter((r) => {
      const dt = new Date(String(r.referredDate || ""));
      if (Number.isNaN(dt.getTime())) return false;
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;
  }, [referrals]);
  const todayScheduleCount =
    myCases.filter((c) => c.date === todayIso).length +
    mySessions.filter((s) => s.date === todayIso).length;

  const monthlySessionsData = useMemo(() => {
    const now = new Date();
    const monthStarts: Date[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }

    const caseCounts = new Map<string, number>();
    const sessionCounts = new Map<string, number>();

    for (const c of myCases) {
      const key = toDateKey(c.date);
      if (!key) continue;
      caseCounts.set(key, (caseCounts.get(key) ?? 0) + 1);
    }
    for (const s of mySessions) {
      const key = toDateKey(s.date);
      if (!key) continue;
      sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
    }

    return monthStarts.map((d) => {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      return {
        month: d.toLocaleDateString(undefined, { month: "short" }),
        count: (caseCounts.get(key) ?? 0) + (sessionCounts.get(key) ?? 0),
      };
    });
  }, [myCases, mySessions]);

  const caseCategoryData = useMemo(() => {
    const pending = myCases.filter((c) => c.status === "Pending").length;
    const ongoing = myCases.filter((c) => c.status === "Ongoing").length;
    const completed = myCases.filter((c) => c.status === "Completed").length;
    return [
      { name: "Pending", value: pending, color: "#3366D6" },
      { name: "Ongoing", value: ongoing, color: "#F59E0B" },
      { name: "Completed", value: completed, color: "#10B981" },
    ];
  }, [myCases]);
  const totalCaseCategory = caseCategoryData.reduce((sum, x) => sum + x.value, 0);
  const hasCaseCategoryData = totalCaseCategory > 0;
  const caseCategoryPieData = useMemo(
    () =>
      hasCaseCategoryData
        ? caseCategoryData
        : [
            { name: "Pending", value: 1, color: "#D9E4FF" },
            { name: "Ongoing", value: 1, color: "#FFE7BF" },
            { name: "Completed", value: 1, color: "#CFF3E7" },
          ],
    [caseCategoryData, hasCaseCategoryData],
  );

  const todayScheduleList = useMemo<ScheduleRow[]>(() => {
    const rows: ScheduleRow[] = [];

    for (const c of myCases) {
      if (c.date !== todayIso) continue;
      const student = usersById.get(c.studentId);
      rows.push({
        id: `case-${c.id}`,
        title: student
          ? `${student.fname} ${student.lname}`
          : `Student #${c.studentId}`,
        type: "Counseling Case",
        date: c.date,
      });
    }

    for (const s of mySessions) {
      if (s.date !== todayIso) continue;
      rows.push({
        id: `session-${s.id}`,
        title: s.topic,
        type: "Student Circle",
        date: s.date,
      });
    }

    return rows.slice(0, 5);
  }, [myCases, mySessions, todayIso, usersById]);

  const pendingReferralRows = useMemo<PendingRow[]>(() => {
    const rows: PendingRow[] = [];

    for (const r of referrals) {
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
  }, [referrals, usersById]);

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
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <StatCard
          label="Total Students"
          value={totalStudents}
          hint="Registered student users"
          icon={<UsersRound size={20} />}
          tone="blue"
        />

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

        <StatCard
          label="Today's Schedule"
          value={todayScheduleCount}
          hint="Cases + sessions today"
          icon={<CalendarDays size={20} />}
          tone="yellow"
        />
      </div>

      <div
        className="dash-grid-2-1"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 14,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Monthly Sessions Trend</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            Combined counseling cases + Student Circle records (last 6 months)
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

        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Case Categories</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            Distribution by case status
          </div>
          <div style={{ marginTop: 12, height: 300, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={caseCategoryPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={100}
                  paddingAngle={4}
                  isAnimationActive
                  animationDuration={900}
                >
                  {caseCategoryPieData.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Cases</div>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{totalCaseCategory}</div>
              </div>
            </div>
          </div>
          {!hasCaseCategoryData ? (
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>
              No assigned counseling cases yet.
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="dash-grid-1-1"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 14,
        }}
      >
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <span>Today's Schedule</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{todayScheduleList.length} items</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {todayScheduleList.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 13 }}>No schedule for today.</div>
            ) : (
              todayScheduleList.map((row) => (
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
                    <div style={{ fontWeight: 800 }}>{row.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{row.type}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{formatDateShort(row.date)}</div>
                </div>
              ))
            )}
          </div>
        </div>

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
          }
          @media (max-width: 640px) {
            .dash-grid-4 { grid-template-columns: 1fr !important; }
          }
        `}
      </style>
    </div>
  );
}
