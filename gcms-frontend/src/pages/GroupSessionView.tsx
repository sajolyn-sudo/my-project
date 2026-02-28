import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";

type Role = "ADMIN" | "COUNSELOR" | "STUDENT";

type User = {
  id: number;
  fname: string;
  mname?: string;
  lname: string;
  email: string;
  role: Role;
  collegeId?: number;
  yearLevelId?: number;
};

type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

type GroupSession = {
  id: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;

  counselorUserId: number;
  date: string;
  location: string;
  topic: string;
  notes?: string;
  attachment?: string;
  createdAt: string;
};

type GroupSessionMember = {
  id: number;
  groupSessionId: number;
  studentUserId: number;
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const GS_KEY = "gcms_mock_group_sessions_v1";
const GSM_KEY = "gcms_mock_group_session_members_v1";

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

export default function GroupSessionView() {
  const { id } = useParams();
  const sessionId = Number(id);

  const users = useMemo<User[]>(() => load<User[]>(USERS_KEY, []), []);
  const colleges = useMemo<College[]>(
    () => load<College[]>(COLLEGES_KEY, []),
    [],
  );
  const years = useMemo<AcademicYear[]>(
    () => load<AcademicYear[]>(YEARS_KEY, []),
    [],
  );
  const yearLevels = useMemo<YearLevel[]>(
    () => load<YearLevel[]>(YL_KEY, []),
    [],
  );

  const sessions = useMemo<GroupSession[]>(
    () => load<GroupSession[]>(GS_KEY, []),
    [],
  );
  const [members, setMembers] = useState<GroupSessionMember[]>(() =>
    load<GroupSessionMember[]>(GSM_KEY, []),
  );

  const found = sessions.find((s) => s.id === sessionId);

  const labelUser = (uid: number) => {
    const u = users.find((x) => x.id === uid);
    if (!u) return "Unknown";
    const full = `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`;
    return `${full} (${u.email})`;
  };

  const labelCollege = (cid: number) =>
    colleges.find((c) => c.id === cid)?.name ?? "—";
  const labelAY = (ayid: number) =>
    years.find((y) => y.id === ayid)?.name ?? "—";
  const labelYL = (ylid: number) =>
    yearLevels.find((y) => y.id === ylid)?.name ?? "—";

  // ===== Styles =====
  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 16,
    borderRadius: 16,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.65)",
    fontWeight: 800,
    fontSize: 13,
  };

  const dangerButton: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 10,
    border: "none",
    background: "#D9534F",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    opacity: 0.85,
    marginBottom: 6,
  };

  const printButton: React.CSSProperties = {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 900,
  };

  // ===== Call Slip Print Helpers =====
  const escapeHtml = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtLongDate = (yyyy_mm_dd: string) => {
    const parts = yyyy_mm_dd.split("-");
    if (parts.length !== 3) return yyyy_mm_dd;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return yyyy_mm_dd;
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[m - 1]} ${d}, ${y}`;
  };

  const openCallSlipPrint = (session: GroupSession) => {
    const sessionMembers = members
      .filter((m) => m.groupSessionId === session.id)
      .map((m) => users.find((u) => u.id === m.studentUserId))
      .filter(Boolean) as User[];

    const counselor = users.find((u) => u.id === session.counselorUserId);
    const counselorName = counselor
      ? `${counselor.fname} ${counselor.mname ? counselor.mname + " " : ""}${counselor.lname}`
      : "Guidance Counselor";

    const collegeName = labelCollege(session.collegeId);
    const ylName = labelYL(session.yearLevelId);
    const courseYear = `${collegeName} • ${ylName}`;

    // chunk members (like your photo list)
    const chunkSize = 10;
    const chunks: User[][] = [];
    for (let i = 0; i < sessionMembers.length; i += chunkSize) {
      chunks.push(sessionMembers.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) chunks.push([]);

    const dateIssued = fmtLongDate(new Date().toISOString().slice(0, 10));
    const scheduleText = `${fmtLongDate(session.date)} (see counselor)`;
    const reasonText = session.topic;

    const pages = chunks
      .map((chunk) => {
        const rows = chunk
          .map((s) => {
            const full = `${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`;
            return `
              <tr>
                <td>${escapeHtml(full)}</td>
                <td style="text-align:center;">${escapeHtml(courseYear)}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="page">
            <div class="grid">
              <div class="card">
                <div class="header">
                  <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
                  <div class="office">Guidance and Counseling Services Center</div>
                </div>

                <div class="title">CALL SLIP – GUIDANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <b>${escapeHtml(dateIssued)}</b></div>
                </div>

                <div class="para">
                  Please see your guidance counselor at the Guidance and Counseling Services Center on
                  <b>${escapeHtml(scheduleText)}</b>. This is in connection with
                  <b>${escapeHtml(reasonText)}</b>.
                  <br/>Please bring this paper with you upon your visit. See you!
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Student's Name</th>
                      <th style="text-align:center;">Course &amp; Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || `<tr><td colspan="2" style="opacity:.7">No members.</td></tr>`}
                  </tbody>
                </table>

                <div class="conf">CONFIDENTIAL</div>

                <div class="sig">
                  <div class="name">
                    ${escapeHtml(counselorName)}
                    <div style="font-size:11px; opacity:.8">Guidance Counselor</div>
                  </div>
                </div>

                <div class="foot">
                  <div>GCMS • Call Slip</div>
                  <div>Page 1 of 2</div>
                </div>
              </div>

              <div class="card appearance">
                <div class="header">
                  <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
                  <div class="office">Guidance and Counseling Services Center</div>
                </div>

                <div class="title">CALL SLIP – GUIDANCE</div>
                <div class="subtitle">APPEARANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <span class="line"></span></div>
                </div>

                <div class="meta">
                  <div>Time Started: <span class="line"></span></div>
                  <div>Time Ended: <span class="line"></span></div>
                </div>

                <div class="para">
                  This is to certify that <span class="line" style="min-width:260px;"></span>
                  has visited the Guidance Office last <span class="line" style="min-width:140px;"></span>
                  per referral of <span class="line" style="min-width:180px;"></span>.
                </div>

                <div class="para" style="margin-top:14px;">
                  Remarks:
                </div>
                <div class="ln"></div>
                <div class="ln"></div>
                <div class="ln"></div>

                <div class="sig" style="margin-top:24px;">
                  <div class="name">Name and Signature of Guidance Counselor</div>
                </div>

                <div class="foot">
                  <div>GCMS • Appearance</div>
                  <div>Page 2 of 2</div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Call Slip - Guidance</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 14px; color: #111; }
    .page { margin-bottom: 14px; page-break-after: always; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 2px solid #222; padding: 12px; border-radius: 6px; background: #fff; }
    .header { text-align: center; line-height: 1.2; }
    .uni { font-weight: 800; font-size: 12px; }
    .office { font-size: 11px; margin-top: 2px; }
    .title { text-align: center; font-weight: 900; margin: 10px 0 6px; }
    .subtitle { text-align: center; font-weight: 800; margin-top: 0; font-size: 12px; }
    .meta { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; margin: 8px 0; }
    .line { border-bottom: 1px solid #333; min-width: 140px; display: inline-block; height: 14px; vertical-align: baseline; }
    .para { font-size: 12px; line-height: 1.35; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 6px; font-size: 12px; }
    th { background: #f3f3f3; text-align: left; }
    .conf { font-size: 11px; font-weight: 800; margin-top: 10px; }
    .sig { margin-top: 16px; display: flex; justify-content: center; }
    .sig .name { border-top: 1px solid #111; padding-top: 6px; width: 80%; text-align: center; font-size: 12px; }
    .foot { font-size: 10px; margin-top: 6px; opacity: 0.85; display: flex; justify-content: space-between; }
    .appearance .ln { border-bottom: 1px solid #333; height: 18px; margin: 10px 0; }
    @media print {
      body { padding: 0; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  ${pages}
  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (!found) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <h2 style={{ fontWeight: 900 }}>Group Session Details</h2>
        <div style={card}>
          <div style={{ opacity: 0.8 }}>Session not found.</div>
          <div style={{ marginTop: 12 }}>
            <Link
              to="/app/group-sessions"
              style={{
                color: "var(--primary)",
                fontWeight: 900,
                textDecoration: "none",
              }}
            >
              ← Back to Group Sessions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sessionMembers = members.filter((m) => m.groupSessionId === found.id);

  const removeMember = (memberId: number) => {
    const next = members.filter((m) => m.id !== memberId);
    setMembers(next);
    save(GSM_KEY, next);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 900, marginRight: "auto" }}>
          Group Session Details
        </h2>

        <button onClick={() => openCallSlipPrint(found)} style={printButton}>
          <Printer size={18} />
          Print Call Slip
        </button>

        <Link
          to="/app/group-sessions"
          style={{
            textDecoration: "none",
            color: "var(--primary)",
            fontWeight: 900,
          }}
        >
          ← Back
        </Link>
      </div>

      {/* Details */}
      <div style={card}>
        <div style={{ fontSize: 14, opacity: 0.8 }}>Topic</div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{found.topic}</div>
        <div style={{ opacity: 0.85 }}>{found.location}</div>

        <div
          style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <span style={pill}>📅 {found.date}</span>
          <span style={pill}>🎓 {labelAY(found.academicYearId)}</span>
          <span style={pill}>🏫 {labelCollege(found.collegeId)}</span>
          <span style={pill}>📌 {labelYL(found.yearLevelId)}</span>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <div>
            <span style={{ opacity: 0.8 }}>Counselor: </span>
            <b>{labelUser(found.counselorUserId)}</b>
          </div>

          {found.notes && (
            <div>
              <span style={{ opacity: 0.8 }}>Notes: </span>
              <b>{found.notes}</b>
            </div>
          )}

          {found.attachment && (
            <div>
              <span style={{ opacity: 0.8 }}>Attachment: </span>
              <b>{found.attachment}</b>
            </div>
          )}

          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Session ID: <b>#{found.id}</b> • Created: <b>{found.createdAt}</b>
          </div>
        </div>
      </div>

      {/* Members */}
      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Members</h3>

        {sessionMembers.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No members for this session.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sessionMembers.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.6)",
                }}
              >
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 900 }}>
                    {labelUser(m.studentUserId)}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.75 }}>
                    Member ID: #{m.id}
                  </div>
                </div>

                <button onClick={() => removeMember(m.id)} style={dangerButton}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={label}>
            Total Members: <b>{sessionMembers.length}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
