import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clipboard,
  Clock,
  ExternalLink,
  ImageUp,
  MapPin,
  QrCode,
  ScanLine,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Modal from "../components/Modal";
import {
  getStudentCircleAttendanceLink,
  listStudentCircleAttendance,
  type StudentCircleAttendanceRecord,
} from "../lib/entitiesApi";
import {
  fullName,
  useGCMS,
  type GroupSession,
  type User,
} from "../store/gcmsStore";
import useStudentPortalSync from "../hooks/useStudentPortalSync";

type AttendanceRecord = {
  sessionId: number;
  studentUserId: number;
  code: string;
  attendedAt: string;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

const ATTENDANCE_KEY = "gcms_student_circle_attendance_v1";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background:
    "radial-gradient(1100px 500px at 18% -22%, rgba(37,99,235,0.14), transparent 55%), #f4f6fb",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 14px 34px rgba(15,23,42,0.08)",
};

const iconCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const iconBubble: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "#f8fafc",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#0f172a",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
  textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#0f172a",
  fontWeight: 950,
};

const tableWrap: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 14,
  overflowX: "auto",
  background: "rgba(248,250,252,0.8)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  verticalAlign: "top",
};

const floatingScanButton: React.CSSProperties = {
  position: "fixed",
  right: 28,
  bottom: 28,
  width: 58,
  height: 58,
  borderRadius: 18,
  border: "1px solid rgba(15,23,42,0.16)",
  background: "linear-gradient(180deg, #0f172a, #020617)",
  color: "white",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 18px 38px rgba(2,6,23,0.28)",
  cursor: "pointer",
  zIndex: 20,
};

const scanActionButton: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.14)",
  background: "white",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryScanActionButton: React.CSSProperties = {
  ...scanActionButton,
  border: "none",
  background: "#2563eb",
  color: "white",
};

function loadAttendance(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(ATTENDANCE_KEY);
    return raw ? (JSON.parse(raw) as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAttendance(records: AttendanceRecord[]) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

function formatDate(value?: string) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string) {
  const normalized = value?.includes("T") ? value : value?.replace(" ", "T");
  const dt = normalized ? new Date(normalized) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateKey(value?: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const dt =
    value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSessionTime(value?: string) {
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

function getUserName(user?: User) {
  return user ? fullName(user) : "Unknown student";
}

function getAttendanceLinkTarget(
  rawCode: string,
): { sessionId: number; href: string } | null {
  try {
    const url = new URL(rawCode, window.location.origin);
    const match = url.pathname.match(/\/student-circle-attendance\/(\d+)/);
    if (!match) return null;
    return {
      sessionId: Number(match[1]),
      href: `${url.pathname}${url.search}${url.hash}`,
    };
  } catch {
    return null;
  }
}

function getBarcodeDetectorCtor() {
  if (typeof window === "undefined") return null;
  return (
    window as Window & {
      BarcodeDetector?: BarcodeDetectorConstructor;
    }
  ).BarcodeDetector ?? null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read that QR image."));
    };
    image.src = url;
  });
}

function buildAttendanceFormHref(sessionId: number, token?: string | null) {
  const query = token ? `?t=${encodeURIComponent(token)}` : "";
  return `/student-circle-attendance/${sessionId}${query}`;
}

export default function MyStudentCircleView() {
  const { loading } = useStudentPortalSync();
  const { id } = useParams();
  const sessionId = Number(id);
  const { currentUser, users, group_sessions, group_session_members } = useGCMS();
  const myUserId = currentUser?.users_id ?? 0;
  const [scanOpen, setScanOpen] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [qrImageBusy, setQrImageBusy] = useState(false);
  const [attendanceFormLoading, setAttendanceFormLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() =>
    loadAttendance(),
  );
  const [serverAttendance, setServerAttendance] =
    useState<StudentCircleAttendanceRecord | null>(null);
  const [serverAttendanceLoading, setServerAttendanceLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRequestedRef = useRef(false);

  const session = useMemo(() => {
    if (!sessionId) return null;
    return group_sessions.find(
      (item) => item.group_session_id === sessionId,
    ) as GroupSession | undefined;
  }, [group_sessions, sessionId]);

  const memberRows = useMemo(() => {
    return group_session_members
      .filter((item) => item.group_session_id === sessionId)
      .map((item) => ({
        ...item,
        user: users.find((user) => user.users_id === item.student_user_id),
      }))
      .sort((a, b) => getUserName(a.user).localeCompare(getUserName(b.user)));
  }, [group_session_members, sessionId, users]);

  const isMember = useMemo(() => {
    return memberRows.some((item) => item.student_user_id === myUserId);
  }, [memberRows, myUserId]);

  const localAttendanceRecord = useMemo(() => {
    return attendance.find(
      (item) =>
        item.sessionId === sessionId && item.studentUserId === myUserId,
    );
  }, [attendance, myUserId, sessionId]);

  useEffect(() => {
    const currentEmailValue = String(currentUser?.email || "").trim();
    if (!sessionId || !myUserId || !currentEmailValue) {
      setServerAttendance(null);
      return;
    }

    let alive = true;
    setServerAttendanceLoading(true);
    listStudentCircleAttendance(sessionId)
      .then((res) => {
        if (!alive) return;
        const currentEmail = currentEmailValue.toLowerCase();
        const found =
          (res.attendance ?? []).find((row) => {
            const sameUser =
              row.studentUserId != null && row.studentUserId === myUserId;
            const sameEmail = row.email.trim().toLowerCase() === currentEmail;
            return sameUser || sameEmail;
          }) ?? null;
        setServerAttendance(found);
      })
      .catch(() => {
        if (alive) setServerAttendance(null);
      })
      .finally(() => {
        if (alive) setServerAttendanceLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [currentUser?.email, myUserId, sessionId]);

  const attendanceRecord = serverAttendance
    ? {
        attendedAt: serverAttendance.submittedAt,
        source: "QR form",
      }
    : localAttendanceRecord
      ? {
          attendedAt: localAttendanceRecord.attendedAt,
          source: "Scanner",
        }
      : null;

  const todayKey = useMemo(() => toDateKey(), []);
  const circleType =
    session && toDateKey(session.session_date) >= todayKey
      ? "Upcoming"
      : "History";
  const expectedCode = `GCMS-SC-${sessionId}`;
  const supportsQrImageScan = !!getBarcodeDetectorCtor();
  const supportsCameraScanner =
    supportsQrImageScan &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";
  const cameraUnavailableMessage = !supportsQrImageScan
    ? "This browser cannot read QR codes directly. Open the attendance form, upload a QR image, or paste the link."
    : typeof window !== "undefined" && !window.isSecureContext
      ? "Camera scanning needs HTTPS or localhost. Open the attendance form, upload a QR image, or paste the link."
      : "Camera scanning is unavailable in this browser. Open the attendance form, upload a QR image, or paste the link.";

  const openAttendanceForm = async () => {
    if (!sessionId || attendanceFormLoading) return;

    stopScanner();
    setAttendanceFormLoading(true);
    setScannerMessage("Opening attendance form...");

    try {
      const res = await getStudentCircleAttendanceLink(sessionId);
      window.location.assign(buildAttendanceFormHref(sessionId, res.token));
    } catch {
      window.location.assign(buildAttendanceFormHref(sessionId));
    } finally {
      setAttendanceFormLoading(false);
    }
  };

  const recordAttendance = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      setScannerMessage("Please scan or enter a QR code first.");
      return;
    }

    const linkTarget = getAttendanceLinkTarget(code);
    if (linkTarget) {
      if (linkTarget.sessionId !== sessionId) {
        setScannerMessage("This attendance QR belongs to a different Group Counselling session.");
        return;
      }
      window.location.assign(linkTarget.href);
      return;
    }

    if (code !== expectedCode) {
      setScannerMessage("This QR code is not for this Group Counselling session.");
      return;
    }

    const nextRecord: AttendanceRecord = {
      sessionId,
      studentUserId: myUserId,
      code,
      attendedAt: new Date().toISOString(),
    };
    const next = [
      ...attendance.filter(
        (item) =>
          !(
            item.sessionId === sessionId &&
            item.studentUserId === myUserId
          ),
      ),
      nextRecord,
    ];
    setAttendance(next);
    saveAttendance(next);
    setManualCode("");
    setScannerMessage("Attendance recorded for this Group Counselling session.");
    setScannerActive(false);
  };

  const stopScanner = () => {
    stopRequestedRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerActive(false);
  };

  const pasteAttendanceCode = async () => {
    if (!navigator.clipboard?.readText) {
      setScannerMessage("Clipboard paste is unavailable. Type or paste the QR link in the field.");
      return;
    }

    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setScannerMessage("Clipboard is empty.");
        return;
      }
      setManualCode(text);
      recordAttendance(text);
    } catch {
      setScannerMessage("Clipboard permission was unavailable. Paste the QR link in the field.");
    }
  };

  const handleQrImageFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScannerMessage("Choose an image that contains the attendance QR code.");
      return;
    }

    const BarcodeDetectorCtor = getBarcodeDetectorCtor();
    if (!BarcodeDetectorCtor) {
      setScannerMessage("This browser cannot read QR images. Paste the attendance link or code.");
      return;
    }

    stopScanner();
    setQrImageBusy(true);
    setScannerMessage("Reading QR image...");

    try {
      const image = await loadImageFromFile(file);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      const maxSide = 1600;
      const largestSide = Math.max(image.naturalWidth, image.naturalHeight, 1);
      const scale = Math.min(1, maxSide / largestSide);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to read QR image.");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      const codes = await detector.detect(canvas);
      const rawValue = codes.find((code) => code.rawValue)?.rawValue?.trim();
      if (!rawValue) {
        setScannerMessage("No attendance QR code was found in that image.");
        return;
      }

      setManualCode(rawValue);
      recordAttendance(rawValue);
    } catch (error) {
      setScannerMessage(
        error instanceof Error ? error.message : "Unable to read that QR image.",
      );
    } finally {
      setQrImageBusy(false);
    }
  };

  const startScanner = async () => {
    const BarcodeDetectorCtor = getBarcodeDetectorCtor();

    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setScannerMessage(cameraUnavailableMessage);
      return;
    }

    stopScanner();
    stopRequestedRef.current = false;
    setScannerMessage("Starting camera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      setScannerActive(true);
      setScannerMessage("Point the camera at the attendance QR code.");

      const scanFrame = async () => {
        if (stopRequestedRef.current || !videoRef.current || !canvasRef.current) {
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const codes = await detector.detect(canvas);
            const rawValue = codes[0]?.rawValue;
            if (rawValue) {
              recordAttendance(rawValue);
              stopScanner();
              return;
            }
          }
        }

        window.requestAnimationFrame(scanFrame);
      };

      window.requestAnimationFrame(scanFrame);
    } catch {
      setScannerMessage(
        "Camera permission was denied or unavailable. Enter the QR code manually.",
      );
      stopScanner();
    }
  };

  useEffect(() => {
    if (scanOpen) {
      void startScanner();
    } else {
      stopScanner();
      setScannerMessage("");
    }

    return () => stopScanner();
  }, [scanOpen]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (loading && !session) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>Loading Group Counselling details...</div>
        </div>
      </div>
    );
  }
  if (!session || !isMember) return <Navigate to="/app/my-counseling" replace />;

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
            <h1 style={{ margin: 0, fontSize: 28 }}>
              {session.topic || "Group Counselling"}
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700 }}>
              View the full details for this Group Counselling session.
            </p>
          </div>

          <Link
            to="/app/my-counseling"
            title="Back to My Counseling"
            aria-label="Back to My Counseling"
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
              textDecoration: "none",
              boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
            }}
          >
            <ArrowLeft size={18} />
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div style={iconCardStyle}>
            <span style={iconBubble}>
              <CalendarDays size={18} />
            </span>
            <div>
              <div style={labelStyle}>Date</div>
              <div style={valueStyle}>{formatDate(session.session_date)}</div>
            </div>
          </div>

          <div style={iconCardStyle}>
            <span style={iconBubble}>
              <Clock size={18} />
            </span>
            <div>
              <div style={labelStyle}>Time</div>
              <div style={valueStyle}>
                {formatSessionTime(session.session_time)}
              </div>
            </div>
          </div>

          <div style={iconCardStyle}>
            <span style={iconBubble}>
              <MapPin size={18} />
            </span>
            <div>
              <div style={labelStyle}>Location</div>
              <div style={valueStyle}>{session.location || "TBA"}</div>
            </div>
          </div>

          <div style={iconCardStyle}>
            <span style={iconBubble}>
              <UserRound size={18} />
            </span>
            <div>
              <div style={labelStyle}>Facilitator</div>
              <div style={valueStyle}>
                {session.facilitator || "To be announced"}
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={labelStyle}>Group Counselling Information</div>
              <div style={{ ...valueStyle, fontSize: 18 }}>
                {session.topic || "Group Counselling"}
              </div>
            </div>
            <span
              style={{
                borderRadius: 999,
                padding: "7px 12px",
                background:
                  circleType === "Upcoming"
                    ? "rgba(37,99,235,0.12)"
                    : "rgba(100,116,139,0.14)",
                color: circleType === "Upcoming" ? "#1d4ed8" : "#475569",
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {circleType}
            </span>
          </div>

          <div
            style={{
              marginTop: 14,
              color: "#334155",
              fontWeight: 700,
              whiteSpace: "pre-wrap",
              lineHeight: 1.55,
            }}
          >
            {session.notes || "No additional notes were provided."}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={iconBubble}>
              <CheckCircle2 size={18} />
            </span>
            <div>
              <div style={labelStyle}>Attendance</div>
              <div style={valueStyle}>
                {serverAttendanceLoading
                  ? "Checking attendance..."
                  : attendanceRecord
                    ? `Already took attendance - ${formatDateTime(
                        attendanceRecord.attendedAt,
                      )}`
                    : "Not recorded yet"}
              </div>
            </div>
          </div>
          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
            {attendanceRecord
              ? `Attendance source: ${attendanceRecord.source}.`
              : "Open the attendance form for this Group Counselling session. If your facilitator requires QR scanning, use Scan QR."}
          </div>
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() => void openAttendanceForm()}
              disabled={attendanceFormLoading}
              style={primaryScanActionButton}
            >
              <ExternalLink size={17} />
              {attendanceFormLoading
                ? "Opening..."
                : attendanceRecord
                  ? "Open Attendance"
                  : "Take Attendance"}
            </button>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              style={scanActionButton}
            >
              <ScanLine size={17} />
              Scan QR
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={iconBubble}>
              <Users size={18} />
            </span>
            <div>
              <div style={labelStyle}>Participants</div>
              <div style={valueStyle}>{memberRows.length} student(s)</div>
            </div>
          </div>

          <div style={tableWrap}>
            <table
              style={{
                width: "100%",
                minWidth: 620,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.72)" }}>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.map((member, index) => (
                  <tr
                    key={`${member.group_session_id}-${member.student_user_id}`}
                    style={{
                      borderTop:
                        index === 0
                          ? "none"
                          : "1px solid rgba(15,23,42,0.08)",
                    }}
                  >
                    <td style={tdStyle}>{getUserName(member.user)}</td>
                    <td style={tdStyle}>{member.user?.email || "-"}</td>
                    <td style={tdStyle}>
                      {member.student_user_id === myUserId ? "You" : "Member"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button
        type="button"
        title="Scan attendance QR code"
        aria-label="Scan attendance QR code"
        onClick={() => setScanOpen(true)}
        style={floatingScanButton}
      >
        <ScanLine size={24} />
      </button>

      <Modal
        open={scanOpen}
        title="Scan Attendance QR"
        onClose={() => setScanOpen(false)}
        contentStyle={{ width: "min(560px, 100%)" }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 14,
              background: "#020617",
              minHeight: 260,
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
              position: "relative",
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                minHeight: 260,
                objectFit: "cover",
                display: scannerActive ? "block" : "none",
              }}
            />
            {!scannerActive && (
              <div
                style={{
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  gap: 10,
                  textAlign: "center",
                  padding: 22,
                }}
              >
                <QrCode size={42} />
                <div style={{ fontWeight: 900 }}>
                  {supportsCameraScanner
                    ? "Preparing camera scanner"
                    : "Camera scanner unavailable"}
                </div>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => void openAttendanceForm()}
              disabled={attendanceFormLoading}
              style={{
                ...primaryScanActionButton,
                opacity: attendanceFormLoading ? 0.72 : 1,
                cursor: attendanceFormLoading ? "not-allowed" : "pointer",
              }}
            >
              <ExternalLink size={16} />
              {attendanceFormLoading ? "Opening..." : "Open Form"}
            </button>
            <button
              type="button"
              onClick={startScanner}
              disabled={!supportsCameraScanner || scannerActive}
              style={{
                ...scanActionButton,
                opacity: !supportsCameraScanner || scannerActive ? 0.62 : 1,
                cursor:
                  !supportsCameraScanner || scannerActive
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <Camera size={16} />
              {scannerActive ? "Camera Active" : "Camera"}
            </button>
            <label
              style={{
                ...scanActionButton,
                opacity: qrImageBusy || !supportsQrImageScan ? 0.62 : 1,
                cursor:
                  qrImageBusy || !supportsQrImageScan
                    ? "not-allowed"
                    : "pointer",
              }}
              title="Take a photo of the attendance QR code"
            >
              <Camera size={16} />
              Camera Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={qrImageBusy || !supportsQrImageScan}
                onChange={(event) => {
                  void handleQrImageFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            <label
              style={{
                ...scanActionButton,
                opacity: qrImageBusy || !supportsQrImageScan ? 0.62 : 1,
                cursor:
                  qrImageBusy || !supportsQrImageScan
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <ImageUp size={16} />
              {qrImageBusy ? "Reading..." : "QR Image"}
              <input
                type="file"
                accept="image/*"
                disabled={qrImageBusy || !supportsQrImageScan}
                onChange={(event) => {
                  void handleQrImageFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            <button
              type="button"
              onClick={() => void pasteAttendanceCode()}
              style={scanActionButton}
            >
              <Clipboard size={16} />
              Paste
            </button>
          </div>

          <div style={{ color: "#475569", fontWeight: 800, fontSize: 13 }}>
            {scannerMessage ||
              "Open the attendance form directly, scan the QR from your facilitator, upload a QR image, or paste the QR link."}
          </div>

          <div>
            <div style={labelStyle}>QR Link or Code</div>
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder={`Paste /student-circle-attendance/${sessionId} or GCMS-SC-${sessionId}`}
              style={{
                marginTop: 6,
                width: "100%",
                height: 42,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.14)",
                padding: "0 12px",
                fontWeight: 800,
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={() => setScanOpen(false)}
              style={{
                height: 38,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.14)",
                background: "white",
                padding: "0 14px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              <X size={16} style={{ verticalAlign: "middle" }} /> Close
            </button>
            <button
              type="button"
              onClick={() => recordAttendance(manualCode)}
              style={{
                ...primaryScanActionButton,
                minHeight: 38,
              }}
            >
              <ExternalLink size={16} />
              Continue
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
