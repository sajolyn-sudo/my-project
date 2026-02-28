import React from "react";
import {
  CalendarDays,
  ClipboardList,
  UsersRound,
  Activity,
} from "lucide-react";

import StatCard from "../components/StatCard";
import LineChartMock from "../components/charts/LineChartMock";
import DoughnutMock from "../components/charts/DoughnutMock";

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
  background: "var(--card)", // ✅ matches admin dashboard
  transition: "transform 140ms ease, box-shadow 140ms ease",
};

export default function CounselorDashboard() {
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
      {/* Header */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Overview</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Your dashboard will show your cases, sessions, and tasks.
          </div>
        </div>

        {/* Small badge */}
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--card)",
            fontSize: 12,
            fontWeight: 800,
            opacity: 0.9,
            whiteSpace: "nowrap",
          }}
        >
          Counselor View
        </div>
      </div>

      {/* Stats */}
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
          value={22}
          hint="Students, counselors, admins"
          icon={<UsersRound size={20} />}
          tone="blue"
        />

        <StatCard
          label="Active Counseling Cases"
          value={23}
          hint="Ongoing / scheduled"
          icon={<ClipboardList size={20} />}
          tone="yellow"
        />

        <StatCard
          label="Referrals This Month"
          value={14}
          hint="New referrals logged"
          icon={<Activity size={20} />}
          tone="blue"
        />

        <StatCard
          label="Today’s Schedule"
          value={3}
          hint="Appointments"
          icon={<CalendarDays size={20} />}
          tone="yellow"
        />
      </div>

      {/* Charts row */}
      <div
        className="dash-grid-2-1"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 14,
        }}
      >
        <LineChartMock
          title="Monthly Sessions Trend"
          subtitle="Sessions conducted over the last 6 months"
        />
        <DoughnutMock
          title="Case Categories"
          subtitle="Distribution of case types"
        />
      </div>

      {/* Lists row */}
      <div
        className="dash-grid-1-1"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 14,
        }}
      >
        {/* Today Schedule */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <span>Today’s Schedule</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>3 items</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { time: "9:00 AM", student: "Juan Dela Cruz", type: "Academic" },
              { time: "1:30 PM", student: "Ana Reyes", type: "Personal" },
              { time: "3:00 PM", student: "Mark Santos", type: "Career" },
            ].map((row, idx) => (
              <div
                key={idx}
                style={listItemStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(-1px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "var(--shadow)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800 }}>{row.student}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{row.type}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 900 }}>{row.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Requests */}
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>
            <span>Pending Requests</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>3 items</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { who: "Lisa Gomez", what: "Referral Request", when: "Feb 22" },
              { who: "Kevin Tan", what: "Session Reschedule", when: "Feb 21" },
              { who: "Mia Lopez", what: "New Case", when: "Feb 20" },
            ].map((row, idx) => (
              <div
                key={idx}
                style={listItemStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(-1px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "var(--shadow)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800 }}>{row.who}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{row.what}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 900 }}>{row.when}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive fallback */}
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
