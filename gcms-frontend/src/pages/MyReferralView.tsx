import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FileDown,
  GraduationCap,
  ListChecks,
  StickyNote,
  UserRound,
} from "lucide-react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useGCMS, fullName } from "../store/gcmsStore";
import useStudentPortalSync from "../hooks/useStudentPortalSync";
import {
  canPrintReferralCallSlip,
  openReferralCallSlipPrint,
} from "../lib/referralCallSlipPrint";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background:
    "radial-gradient(1100px 500px at 20% -20%, rgba(99,102,241,0.16), transparent 55%), #f4f6fb",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "rgba(15,23,42,0.08)",
  margin: "12px 0",
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.14)",
  background: "rgba(255,255,255,0.96)",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
};

function formatDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value?: string) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes))
    return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function statusColor(status: string) {
  return status === "pending" ? "#b45309" : "#1d4ed8";
}

function isStudentReferralApproved(status: string) {
  return status === "approved" || status === "complete" || status === "ongoing";
}

function hasCompleteSchedule(date?: string, time?: string) {
  return Boolean(String(date || "").trim() && String(time || "").trim());
}

function studentReferralStatusLabel(status: string) {
  return status === "pending" ? "Waiting for Approval" : "Approved";
}

function parseReferralNotes(notes?: string) {
  const lines = String(notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let name = "";
  let course = "";
  const extra: string[] = [];

  for (const line of lines) {
    if (/^name\s*:/i.test(line)) {
      name = line.replace(/^name\s*:/i, "").trim();
      continue;
    }
    if (/^course\s*:/i.test(line)) {
      course = line.replace(/^course\s*:/i, "").trim();
      continue;
    }
    extra.push(line);
  }

  return {
    name,
    course,
    extraText: extra.join("\n"),
  };
}

export default function MyReferralView() {
  const { loading } = useStudentPortalSync();
  const { id } = useParams();
  const navigate = useNavigate();
  const referralId = Number(id);
  const [backActive, setBackActive] = useState(false);

  const { currentUser, referrals } = useGCMS();
  const myUserId = currentUser?.users_id;

  const r = useMemo(() => {
    if (!myUserId || !referralId) return null;
    return (
      referrals.find(
        (x) =>
          x.referral_id === referralId &&
          (x.student_user_id === myUserId ||
            x.referred_by_user_id === myUserId),
      ) ?? null
    );
  }, [myUserId, referralId, referrals]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (loading && !r) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>Loading your referral...</div>
        </div>
      </div>
    );
  }
  if (!r) return <Navigate to="/app/my-referrals" replace />;

  const parsed = parseReferralNotes(r.notes);
  const reasonList = r.reason
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const approved = isStudentReferralApproved(r.status);
  const scheduleDate = approved ? r.referred_date : "";
  const scheduleTime = approved ? r.referred_time : "";
  const completeSchedule = approved
    ? hasCompleteSchedule(scheduleDate, scheduleTime)
    : false;
  const canDownloadCallSlip =
    r.student_user_id === myUserId &&
    canPrintReferralCallSlip({
      status: r.status,
      referredDate: r.referred_date,
      referredTime: r.referred_time,
    });
  const openStudentCallSlip = () => {
    if (!canDownloadCallSlip) return;

    openReferralCallSlipPrint({
      referralId: r.referral_id,
      studentName: parsed.name || fullName(currentUser),
      studentEmail: currentUser.email,
      courseYearSection: parsed.course || "-",
      scheduleDate: String(r.referred_date || ""),
      scheduleTime: String(r.referred_time || ""),
      reason: r.reason,
      referredByName: "Guidance Office",
      issuedDate: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.3 }}>
              Referral #{r.referral_id}
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              Full details of your referral record.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {canDownloadCallSlip && (
              <button
                type="button"
                onClick={openStudentCallSlip}
                title="Download or print call slip"
                aria-label="Download or print call slip"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  border: "1px solid rgba(15,23,42,0.16)",
                  background: "white",
                  color: "#0f172a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
                }}
              >
                <FileDown size={18} />
              </button>
            )}
            <button
              type="button"
              onMouseDown={() => setBackActive(true)}
              onMouseUp={() => setBackActive(false)}
              onMouseLeave={() => setBackActive(false)}
              onClick={() => navigate("/app/my-referrals")}
              title="Back"
              aria-label="Back"
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                border: backActive
                  ? "1px solid rgba(2,6,23,0.98)"
                  : "1px solid rgba(15,23,42,0.16)",
                background: backActive
                  ? "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))"
                  : "white",
                color: backActive ? "white" : "#0f172a",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
              }}
            >
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 950 }}>Status</div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 950,
                color: statusColor(r.status),
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              {studentReferralStatusLabel(r.status)}
            </span>
          </div>

          <div style={divider} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <div style={labelStyle}>
                <CalendarDays size={14} />
                Schedule Date
              </div>
              <div style={{ fontWeight: 950 }}>
                {completeSchedule
                  ? formatDate(scheduleDate || "")
                  : approved
                    ? "Schedule pending"
                    : "Waiting for approval"}
              </div>
            </div>

            <div>
              <div style={labelStyle}>
                <CalendarDays size={14} />
                Schedule Time
              </div>
              <div style={{ fontWeight: 950 }}>
                {completeSchedule ? formatTime(scheduleTime) : "-"}
              </div>
            </div>

            <div>
              <div style={labelStyle}>
                <UserRound size={14} />
                Name
              </div>
              <div style={{ fontWeight: 950 }}>
                {parsed.name || fullName(currentUser)}
              </div>
            </div>

            <div>
              <div style={labelStyle}>
                <GraduationCap size={14} />
                Course
              </div>
              <div style={{ fontWeight: 950 }}>{parsed.course || "-"}</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>
              <ListChecks size={14} />
              Reason
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              {reasonList.length > 0 ? (
                reasonList.map((reason) => (
                  <span key={reason} style={chip}>
                    {reason}
                  </span>
                ))
              ) : (
                <span style={{ color: "#64748b", fontWeight: 700 }}>-</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>
              <StickyNote size={14} />
              Notes
            </div>
            <div
              style={{
                marginTop: 8,
                border: "1px solid rgba(15,23,42,0.10)",
                borderRadius: 12,
                background: "rgba(248,250,252,0.92)",
                padding: "10px 12px",
                color: "#334155",
                fontWeight: 700,
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
              }}
            >
              {parsed.extraText || "No notes."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
