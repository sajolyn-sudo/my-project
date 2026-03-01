import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import {
  fetchEntitiesBootstrap,
  listCounselingCases,
  listReferrals,
  type AcademicYear as EntityAcademicYear,
  type CounselingCase as EntityCounselingCase,
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

type DashboardUser = EntityUser & {
  createdAt?: string;
  academicYearId?: number;
};
type MonthlyReferral = { month: string; count: number };

const USERS_KEY = "gcms_mock_users_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const REF_KEY = "gcms_mock_referrals_v1";
const CASES_KEY = "gcms_mock_counseling_cases_v2";

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

  const [selectedAyId, setSelectedAyId] = useState<number>(() => {
    const years = load<AcademicYear[]>(YEARS_KEY, fallbackAcademicYears);
    return years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0;
  });

  useEffect(() => {
    let alive = true;
    const cachedUsers = load<DashboardUser[]>(USERS_KEY, []);

    Promise.allSettled([
      fetchEntitiesBootstrap(),
      listCounselingCases(),
      listReferrals(),
    ]).then((results) => {
      if (!alive) return;
      const [bootstrapResult, casesResult, referralsResult] = results;

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
      const dt = new Date(r.referredDate);
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
    const activeCases = allCases.filter(
      (c) => c.academicYearId === selectedAyId && c.status !== "Completed",
    ).length;
    const referralsThisMonth = allReferrals.filter((r) => {
      if (r.academicYearId !== selectedAyId) return false;
      const dt = new Date(r.referredDate);
      if (Number.isNaN(dt.getTime())) return false;
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;

    return { totalUsers: usersCount, activeCases, referralsThisMonth };
  }, [allUsers, allCases, allReferrals, selectedAyId]);

  // ---------- Animated counters ----------
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeCases, setActiveCases] = useState(0);
  const [referralsThisMonth, setReferralsThisMonth] = useState(0);

  useEffect(() => {
    animateTo(totalUsers, targetStats.totalUsers, 650, setTotalUsers);
  }, [targetStats.totalUsers]);

  useEffect(() => {
    animateTo(activeCases, targetStats.activeCases, 650, setActiveCases);
  }, [targetStats.activeCases]);

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

  const pieWrap: CSSProperties = {
    marginTop: 10,
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.78)",
    padding: 12,
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
      <div style={grid3}>
        <div style={shellBg}>
          <div
            style={{ ...statCard, position: "relative", overflow: "hidden" }}
          >
            <div style={leftStripe("blue")} aria-hidden />
            <div style={statLeft}>
              <div style={statLabel}>Total Users</div>
              <div style={statValue}>{totalUsers}</div>
              <div style={statHint}>
                Students, counselors, teachers, admins
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

      {/* Chart + User Distribution */}
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
            .__dash_grid3 { grid-template-columns: 1fr !important; }
            .__dash_grid2 { grid-template-columns: 1fr !important; }
          }
        `}
      </style>
    </div>
  );
}

