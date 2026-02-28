import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

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
} from "recharts";

type AcademicYear = { id: number; name: string };

type RecentUser = {
  id: number;
  fname: string;
  mname?: string;
  lname: string;
  email: string;
  role: "student" | "counselor" | "admin";
  createdAt: string;
  academicYearId: number;
};

type MonthlyReferral = { month: string; count: number; academicYearId: number };

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

const roleLabel: Record<RecentUser["role"], string> = {
  student: "Student",
  counselor: "Counselor",
  admin: "Admin",
};

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  // ---------- Mock data ----------
  const academicYears: AcademicYear[] = [
    { id: 1, name: "2024–2025" },
    { id: 2, name: "2025–2026" },
  ];

  const [selectedAyId, setSelectedAyId] = useState<number>(academicYears[1].id);

  const allRecentUsers: RecentUser[] = [
    {
      id: 101,
      fname: "Ana",
      lname: "Dela Cruz",
      email: "ana@gcms.demo",
      role: "student",
      createdAt: "2026-02-12",
      academicYearId: 2,
    },
    {
      id: 102,
      fname: "John",
      lname: "Reyes",
      email: "john@gcms.demo",
      role: "counselor",
      createdAt: "2026-02-10",
      academicYearId: 2,
    },
    {
      id: 103,
      fname: "Maria",
      mname: "L.",
      lname: "Santos",
      email: "maria@gcms.demo",
      role: "counselor",
      createdAt: "2026-02-08",
      academicYearId: 2,
    },
    {
      id: 104,
      fname: "Pink",
      lname: "Acas",
      email: "pink.acas@gmail.com",
      role: "student",
      createdAt: "2026-01-28",
      academicYearId: 2,
    },
    {
      id: 105,
      fname: "System",
      lname: "Admin",
      email: "admin@gcms.demo",
      role: "admin",
      createdAt: "2025-08-01",
      academicYearId: 1,
    },
  ];

  const referralMonthly: MonthlyReferral[] = [
    { month: "Aug", count: 4, academicYearId: 1 },
    { month: "Sep", count: 7, academicYearId: 1 },
    { month: "Oct", count: 6, academicYearId: 1 },
    { month: "Nov", count: 9, academicYearId: 1 },
    { month: "Dec", count: 8, academicYearId: 1 },

    { month: "Jan", count: 10, academicYearId: 2 },
    { month: "Feb", count: 14, academicYearId: 2 },
    { month: "Mar", count: 9, academicYearId: 2 },
    { month: "Apr", count: 12, academicYearId: 2 },
    { month: "May", count: 7, academicYearId: 2 },
  ];

  // ---------- Filtered data ----------
  const recentUsers = useMemo(() => {
    return allRecentUsers
      .filter((u) => u.academicYearId === selectedAyId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 6);
  }, [selectedAyId]);

  const chartData = useMemo(() => {
    return referralMonthly.filter((r) => r.academicYearId === selectedAyId);
  }, [selectedAyId]);

  const targetStats = useMemo(() => {
    const usersCount =
      allRecentUsers.filter((u) => u.academicYearId === selectedAyId).length +
      18;
    const activeCases = selectedAyId === 2 ? 23 : 15;
    const referralsThisMonth =
      selectedAyId === 2
        ? (chartData.find((c) => c.month === "Feb")?.count ?? 14)
        : 8;

    return { totalUsers: usersCount, activeCases, referralsThisMonth };
  }, [selectedAyId, chartData]);

  // ---------- Animated counters ----------
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeCases, setActiveCases] = useState(0);
  const [referralsThisMonth, setReferralsThisMonth] = useState(0);

  useEffect(() => {
    animateTo(totalUsers, targetStats.totalUsers, 650, setTotalUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStats.totalUsers]);

  useEffect(() => {
    animateTo(activeCases, targetStats.activeCases, 650, setActiveCases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStats.activeCases]);

  useEffect(() => {
    animateTo(
      referralsThisMonth,
      targetStats.referralsThisMonth,
      650,
      setReferralsThisMonth,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const grid3: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  };

  const grid2: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.25fr 0.85fr",
    gap: 12,
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

  const tableWrap: CSSProperties = {
    marginTop: 10,
    overflowX: "auto",
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.78)",
  };

  const table: CSSProperties = {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
  };

  const th: CSSProperties = {
    textAlign: "left",
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: mutedInk,
    padding: "12px 12px",
    background: "rgba(248,250,252,0.88)",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  const td: CSSProperties = {
    padding: "12px 12px",
    borderTop: "1px solid rgba(15,23,42,0.08)",
    color: "rgba(15,23,42,0.86)",
    fontSize: 13.5,
  };

  const badge = (role: RecentUser["role"]): CSSProperties => {
    const common: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      fontSize: 12,
      fontWeight: 950,
      background: "rgba(248,250,252,0.92)",
      color: "rgba(15,23,42,0.82)",
      whiteSpace: "nowrap",
    };

    if (role === "admin")
      return {
        ...common,
        border: "1px solid rgba(37,99,235,0.20)",
        background: "rgba(37,99,235,0.10)",
        color: "rgba(29,78,216,1)",
      };
    if (role === "counselor")
      return {
        ...common,
        border: "1px solid rgba(251,191,36,0.26)",
        background: "rgba(251,191,36,0.16)",
        color: "rgba(146,64,14,1)",
      };
    return {
      ...common,
      border: "1px solid rgba(37,99,235,0.18)",
      background: "rgba(37,99,235,0.08)",
      color: "rgba(29,78,216,1)",
    };
  };

  // Chart mode
  const [chartMode, setChartMode] = useState<"line" | "bar">("line");

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
                Welcome, <b style={{ color: ink }}>{user.fname}</b>
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
                Role: <b style={{ color: ink }}>{user.role}</b>
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
      <div style={grid3}>
        <div style={shellBg}>
          <div
            style={{ ...statCard, position: "relative", overflow: "hidden" }}
          >
            <div style={leftStripe("blue")} aria-hidden />
            <div style={statLeft}>
              <div style={statLabel}>Total Users</div>
              <div style={statValue}>{totalUsers}</div>
              <div style={statHint}>Students, counselors, admins</div>
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
              <div style={statLabel}>Active Counseling Cases</div>
              <div style={statValue}>{activeCases}</div>
              <div style={statHint}>Ongoing / scheduled</div>
            </div>
            <div style={accentPill("yellow")} aria-hidden>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${yellow} 0%, rgba(245,158,11,1) 100%)`,
                  boxShadow: "0 10px 18px rgba(245,158,11,0.20)",
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
      </div>

      {/* Chart + Recent Users */}
      <div style={grid2}>
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
                Tip: Keep your data clean—use consistent month naming to avoid
                duplicate points.
              </span>
              <span style={{ fontWeight: 950, color: navy }}>GCMS</span>
            </div>
          </div>
        </div>

        <div style={shellBg}>
          <div style={card}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 950, color: ink }}>
                Recent Users
              </div>

              <Link
                to="/app/users"
                style={{
                  textDecoration: "none",
                  fontWeight: 950,
                  color: ink,
                  padding: "8px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(15, 23, 42, 0.10)",
                  background: "rgba(255,255,255,0.75)",
                }}
              >
                View all →
              </Link>
            </div>

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={{ ...th, borderTopLeftRadius: 18 }}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Role</th>
                    <th style={{ ...th, borderTopRightRadius: 18 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.length === 0 ? (
                    <tr>
                      <td style={td} colSpan={4}>
                        <span style={sub}>
                          No users found for this academic year.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    recentUsers.map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...td, fontWeight: 850 }}>
                          {u.fname} {u.mname ? u.mname + " " : ""}
                          {u.lname}
                        </td>
                        <td style={td}>{u.email}</td>
                        <td style={td}>
                          <span style={badge(u.role)}>{roleLabel[u.role]}</span>
                        </td>
                        <td style={td}>{u.createdAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, ...sub }}>
              Tip: On smaller screens, scroll the table horizontally.
            </div>
          </div>
        </div>
      </div>

      {/* Responsive tweak */}
      <style>
        {`
          @media (max-width: 980px){
            .__dash_grid3 { grid-template-columns: 1fr !important; }
            .__dash_grid2 { grid-template-columns: 1fr !important; }
          }
        `}
      </style>
    </div>
  );
}
