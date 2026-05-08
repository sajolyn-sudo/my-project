import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Layers3,
  MapPin,
  Printer,
  Trash2,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getGroupSession, removeGroupSessionMember } from "../lib/entitiesApi";

type Role =
  | "ADMIN"
  | "STAFF"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

type UserEntity = {
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
type Course = { id: number; name: string; collegeId: number };
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
  courseId?: number | null;
  yearLevelId: number;
  STAFFUserId: number;
  date: string;
  time?: string | null;
  location: string;
  topic: string;
  facilitatorUserId?: number | null;
  facilitator?: string;
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
const COURSES_KEY = "gcms_mock_courses_v1";
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

function detailActionStyle(
  base: React.CSSProperties,
  {
    active = false,
    hovered = false,
    keepBorder = false,
  }: { active?: boolean; hovered?: boolean; keepBorder?: boolean } = {},
): React.CSSProperties {
  return {
    ...base,
    border: keepBorder
      ? active
        ? "2px solid #5F6D7A"
        : "2px solid #000000"
      : active
        ? "1px solid #5F6D7A"
        : "1px solid var(--border)",
    background: active ? "#5F6D7A" : "white",
    color: active ? "white" : "#000000",
    boxShadow: "none",
    transform: active
      ? "translateY(1px) scale(0.98)"
      : hovered
        ? "translateY(-1px)"
        : "translateY(0)",
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
    textDecoration: "none",
    cursor: "pointer",
  };
}

type DetailActionButtonProps = {
  baseStyle: React.CSSProperties;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
};

function DetailActionButton({
  baseStyle,
  onClick,
  title,
  ariaLabel,
  children,
  type = "button",
}: DetailActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      style={detailActionStyle(baseStyle, {
        active: pressed,
        hovered,
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

type DetailActionLinkProps = {
  to: string;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  keepBorder?: boolean;
};

function DetailActionLink({
  to,
  title,
  ariaLabel,
  baseStyle,
  children,
  keepBorder = false,
}: DetailActionLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      title={title}
      aria-label={ariaLabel ?? title}
      style={detailActionStyle(baseStyle, {
        active: pressed,
        hovered,
        keepBorder,
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
    >
      {children}
    </Link>
  );
}

export default function GroupSessionView() {
  const location = useLocation();
  const { id } = useParams();
  const sessionId = Number(id);

  const listHref = useMemo(
    () => `/app/group-sessions${location.search || ""}`,
    [location.search],
  );

  const users = useMemo<UserEntity[]>(() => load<UserEntity[]>(USERS_KEY, []), []);
  const colleges = useMemo<College[]>(() => load<College[]>(COLLEGES_KEY, []), []);
  const courses = useMemo<Course[]>(() => load<Course[]>(COURSES_KEY, []), []);
  const years = useMemo<AcademicYear[]>(() => load<AcademicYear[]>(YEARS_KEY, []), []);
  const yearLevels = useMemo<YearLevel[]>(() => load<YearLevel[]>(YL_KEY, []), []);

  const sessions = useMemo<GroupSession[]>(() => load<GroupSession[]>(GS_KEY, []), []);
  const [members, setMembers] = useState<GroupSessionMember[]>(() =>
    load<GroupSessionMember[]>(GSM_KEY, []),
  );
  const [found, setFound] = useState<GroupSession | undefined>(() =>
    sessions.find((s) => s.id === sessionId),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    let alive = true;

    getGroupSession(sessionId)
      .then((res) => {
        if (!alive) return;

        const item = res.item;
        const nextMembers = res.members ?? [];

        setFound(item);
        setMembers(nextMembers);
        save(GSM_KEY, nextMembers);

        const current = load<GroupSession[]>(GS_KEY, []);
        const idx = current.findIndex((s) => s.id === item.id);
        const nextSessions =
          idx === -1
            ? [item, ...current]
            : current.map((s) => (s.id === item.id ? item : s));
        save(GS_KEY, nextSessions);
      })
      .catch(() => {
        // Keep cached fallback if API is unreachable.
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [sessionId]);

  const labelCollege = (cid: number) =>
    colleges.find((c) => c.id === cid)?.name ?? "-";
  const labelCourse = (courseId?: number | null) =>
    courses.find((course) => course.id === courseId)?.name ?? "-";
  const labelAY = (ayid: number) => years.find((y) => y.id === ayid)?.name ?? "-";
  const labelYL = (ylid: number) =>
    yearLevels.find((y) => y.id === ylid)?.name ?? "-";

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

  const fmtSessionTime = (value?: string | null) => {
    if (!value) return "-";
    const [hourPart, minutePart] = value.split(":");
    const hours = Number(hourPart);
    const minutes = Number(minutePart);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    const key = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    if (key === "09:00") return "9 AM - 11 AM";
    if (key === "13:00") return "1 PM - 3 PM";
    if (key === "15:00") return "3 PM - 5 PM";
    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
  };

  const openCallSlipPrint = (session: GroupSession) => {
    const sessionMembers = members
      .filter((m) => m.groupSessionId === session.id)
      .map((m) => users.find((u) => u.id === m.studentUserId))
      .filter(Boolean) as UserEntity[];

    const collegeName = labelCollege(session.collegeId);
    const ylName = labelYL(session.yearLevelId);
    const courseYear = `${collegeName} / ${ylName}`;

    const chunkSize = 10;
    const chunks: UserEntity[][] = [];
    for (let i = 0; i < sessionMembers.length; i += chunkSize) {
      chunks.push(sessionMembers.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) chunks.push([]);

    const dateIssued = fmtLongDate(new Date().toISOString().slice(0, 10));
    const scheduleTimeText = fmtSessionTime(session.time);
    const scheduleText = `${fmtLongDate(session.date)} - ${scheduleTimeText} (see STAFF)`;
    const reasonText = session.topic;

    const pages = chunks
      .map((chunk) => {
        const rows = chunk
          .map((s) => {
            const full = `${s.fname} ${s.mname ? `${s.mname} ` : ""}${s.lname}`;
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

                <div class="title">CALL SLIP - GUIDANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <b>${escapeHtml(dateIssued)}</b></div>
                </div>

                <div class="para">
                  Please see your guidance STAFF at the Guidance and Counseling Services Center on
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
                  <div class="name">Guidance STAFF</div>
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

                <div class="title">CALL SLIP - GUIDANCE</div>
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

                <div class="para" style="margin-top:14px;">Remarks:</div>
                <div class="ln"></div>
                <div class="ln"></div>
                <div class="ln"></div>

                <div class="sig" style="margin-top:24px;">
                  <div class="name">Name and Signature of Guidance STAFF</div>
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

  const sessionMembers = found
    ? members.filter((m) => m.groupSessionId === found.id)
    : [];
  const sessionMemberRows = sessionMembers.map((member) => {
    const user = users.find((item) => item.id === member.studentUserId);
    const fullName = user
      ? `${user.fname} ${user.mname ? `${user.mname} ` : ""}${user.lname}`.trim()
      : "Unknown";
    return {
      id: member.id,
      name: fullName,
      email: user?.email ?? "-",
    };
  });

  const removeMember = async (memberId: number) => {
    if (!found) return;
    try {
      const res = await removeGroupSessionMember({
        memberId,
        sessionId: found.id,
      });
      const next = res.members ?? [];
      setMembers(next);
      save(GSM_KEY, next);
    } catch (e: any) {
      alert(e?.message || "Failed to remove member.");
    }
  };

  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 16,
    borderRadius: 16,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.75)",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: 1.2,
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
    color: "var(--primary)",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const iconAction: React.CSSProperties = {
    height: 40,
    width: 40,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const dangerButton: React.CSSProperties = {
    height: 36,
    width: 36,
    borderRadius: 10,
    border: "1px solid rgba(220, 38, 38, 0.18)",
    background: "rgba(254, 242, 242, 0.95)",
    color: "#DC2626",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (!found) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontWeight: 900, margin: 0 }}>Student Circle Details</h2>
          <DetailActionLink
            to={listHref}
            title="Back to Student Circle"
            ariaLabel="Back to Student Circle"
            baseStyle={iconAction}
          >
            <ArrowLeft size={18} />
          </DetailActionLink>
        </div>
        <div style={card}>
          <div style={{ opacity: 0.8 }}>{loaded ? "Student Circle not found." : "Loading Student Circle..."}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 900, margin: 0, marginRight: "auto" }}>
          Student Circle Details
        </h2>

        <DetailActionButton
          onClick={() => openCallSlipPrint(found)}
          title="Print Call Slip"
          ariaLabel="Print Call Slip"
          baseStyle={printButton}
        >
          <Printer size={18} />
          Print Call Slip
        </DetailActionButton>

        <DetailActionLink
          to={listHref}
          title="Back to Student Circle"
          ariaLabel="Back to Student Circle"
          baseStyle={iconAction}
        >
          <ArrowLeft size={18} />
        </DetailActionLink>
      </div>

      <div style={card}>
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={chip}>
            <CalendarDays size={14} />
            {fmtLongDate(found.date)} / {fmtSessionTime(found.time)}
          </span>
          <span style={chip}>
            <GraduationCap size={14} />
            {labelAY(found.academicYearId)}
          </span>
          <span style={chip}>
            <Building2 size={14} />
            {labelCollege(found.collegeId)}
          </span>
          <span style={chip}>
            <Layers3 size={14} />
            {labelYL(found.yearLevelId)}
          </span>
          <span style={chip}>
            <MapPin size={14} />
            {found.location}
          </span>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <BookOpen size={15} />
            <span style={{ opacity: 0.8 }}>Course:</span>
            <b>{labelCourse(found.courseId)}</b>
          </div>

          {found.facilitator?.trim() ? (
            <div>
              <span style={{ opacity: 0.8 }}>Facilitator:</span>{" "}
              <b>{found.facilitator}</b>
            </div>
          ) : null}

          {found.notes ? (
            <div>
              <span style={{ opacity: 0.8 }}>Notes:</span> <b>{found.notes}</b>
            </div>
          ) : null}

          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Student Circle ID: <b>#{found.id}</b> | Created: <b>{found.createdAt}</b>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Members</h3>

        {sessionMembers.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No members for this session.</div>
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.65)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(15, 23, 42, 0.04)" }}>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 13 }}>
                    Name
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 13 }}>
                    Email
                  </th>
                  <th style={{ width: 72, padding: "12px 14px", fontSize: 13 }}> </th>
                </tr>
              </thead>
              <tbody>
                {sessionMemberRows.map((member, idx) => (
                  <tr key={member.id}>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderTop: idx === 0 ? "1px solid var(--border)" : "1px solid var(--border)",
                        fontWeight: 900,
                      }}
                    >
                      {member.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderTop: "1px solid var(--border)",
                        opacity: 0.82,
                      }}
                    >
                      {member.email}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        borderTop: "1px solid var(--border)",
                        textAlign: "center",
                      }}
                    >
                      <button
                        onClick={() => removeMember(member.id)}
                        style={dangerButton}
                        title="Remove member"
                        aria-label="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, opacity: 0.82, fontWeight: 800 }}>
          Total Members: {sessionMembers.length}
        </div>
      </div>
    </div>
  );
}
