import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  Eraser,
  ImageUp,
  LoaderCircle,
  LogIn,
  MapPin,
  PenLine,
  Upload,
  UserRound,
} from "lucide-react";
import {
  getStudentCircleAttendanceSession,
  getStudentCircleAttendanceStatus,
  submitStudentCircleAttendance,
  type StudentCirclePublicSession,
} from "../lib/entitiesApi";
import { useAuthStore } from "../store/authStore";

type SignatureMode = "DRAW" | "UPLOAD";
type SignatureSource = "DRAW" | "UPLOAD" | "CAMERA";

const SIGNATURE_IMAGE_MAX_DATA_URL_LENGTH = 320_000;
const SIGNATURE_IMAGE_MAX_SIDES = [900, 720, 560, 420];
const SIGNATURE_IMAGE_QUALITIES = [0.74, 0.64, 0.54, 0.44];

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#eef2f7",
  padding: 18,
  color: "#0f172a",
};

const shellStyle: React.CSSProperties = {
  width: "min(980px, 100%)",
  margin: "0 auto",
  display: "grid",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(15,23,42,0.10)",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 14px 34px rgba(15,23,42,0.08)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#475569",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.16)",
  padding: "0 12px",
  fontSize: 14,
  fontWeight: 800,
  background: "white",
  color: "#0f172a",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const iconChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 36,
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "#f8fafc",
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 850,
};

const iconButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
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

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const [hourPart, minutePart] = value.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDateTime(value?: string) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read signature image."));
    reader.readAsDataURL(file);
  });
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
      reject(new Error("Unable to prepare signature image."));
    };
    image.src = url;
  });
}

function getResizedDimensions(
  width: number,
  height: number,
  maxSide: number,
) {
  const largestSide = Math.max(width, height, 1);
  const scale = Math.min(1, maxSide / largestSide);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function compressSignatureFile(file: File): Promise<string> {
  const image = await loadImageFromFile(file);
  let fallbackDataUrl = "";

  for (const maxSide of SIGNATURE_IMAGE_MAX_SIDES) {
    const dimensions = getResizedDimensions(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      maxSide,
    );
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of SIGNATURE_IMAGE_QUALITIES) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      fallbackDataUrl = dataUrl;
      if (dataUrl.length <= SIGNATURE_IMAGE_MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
  }

  return fallbackDataUrl || readFileAsDataUrl(file);
}

export default function StudentCircleAttendance() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const sessionId = Number(id);
  const attendanceToken = String(searchParams.get("t") || "").trim();
  const loggedInStudent = authUser?.role === "STUDENT" ? authUser : null;
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const prefilledUserIdRef = useRef<number | null>(null);
  const [session, setSession] = useState<StudentCirclePublicSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [existingSubmittedAt, setExistingSubmittedAt] = useState("");
  const [studentName, setStudentName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [yearLevelName, setYearLevelName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("DRAW");
  const [signatureImage, setSignatureImage] = useState("");
  const [signatureSource, setSignatureSource] =
    useState<SignatureSource>("UPLOAD");
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const courseId = session?.courseId ?? null;
  const yearLevelId = session?.yearLevelId ?? null;
  const loggedInStudentName = loggedInStudent
    ? `${loggedInStudent.fname || ""} ${loggedInStudent.lname || ""}`.trim()
    : "";

  useEffect(() => {
    let alive = true;

    if (!sessionId) {
      setLoading(false);
      setMessage("Invalid Group Counselling link.");
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    getStudentCircleAttendanceSession(sessionId, attendanceToken)
      .then((res) => {
        if (!alive) return;
        const nextSession = res.session;
        setSession(nextSession);
        setCourseName(String(nextSession.courseName || "").trim());
        setYearLevelName(String(nextSession.yearLevelName || "").trim());
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Group Counselling.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [attendanceToken, sessionId]);

  useEffect(() => {
    const cleanEmail = email.trim();
    if (!session?.id || !cleanEmail.includes("@") || submitted) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      getStudentCircleAttendanceStatus({
        sessionId: session.id,
        token: attendanceToken,
        email: cleanEmail,
        studentUserId: loggedInStudent?.id,
      })
        .then((res) => {
          if (!alive) return;
          if (res.submitted) {
            setExistingSubmittedAt(res.submittedAt || "");
            setSubmitted(true);
          }
        })
        .catch(() => {
          // The attendance form still works if this status check is unavailable.
        });
    }, 450);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [attendanceToken, email, loggedInStudent?.id, session?.id, submitted]);

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    prepareCanvas();
  }, []);

  useEffect(() => {
    if (!loggedInStudent || prefilledUserIdRef.current === loggedInStudent.id) {
      return;
    }

    setStudentName((current) =>
      current.trim() || !loggedInStudentName ? current : loggedInStudentName,
    );
    setEmail((current) =>
      current.trim() || !loggedInStudent.email ? current : loggedInStudent.email,
    );
    prefilledUserIdRef.current = loggedInStudent.id;
  }, [loggedInStudent, loggedInStudentName]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setHasDrawnSignature(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    prepareCanvas();
    setHasDrawnSignature(false);
  };

  const handleSignatureFile = async (
    file: File | undefined,
    source: SignatureSource,
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file for the signature.");
      return;
    }
    try {
      const dataUrl = await compressSignatureFile(file);
      setSignatureImage(dataUrl);
      setSignatureSource(source);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to read signature.",
      );
    }
  };

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!studentName.trim()) missing.push("name");
    if (!courseName.trim()) missing.push("course");
    if (!yearLevelName.trim()) missing.push("year level");
    if (!phoneNumber.trim()) missing.push("phone number");
    if (!email.trim()) missing.push("email");
    if (signatureMode === "DRAW" && !hasDrawnSignature) missing.push("signature");
    if (signatureMode === "UPLOAD" && !signatureImage) missing.push("signature image");
    return missing;
  }, [
    courseName,
    email,
    hasDrawnSignature,
    phoneNumber,
    signatureImage,
    signatureMode,
    studentName,
    yearLevelName,
  ]);

  const handleSubmit = async () => {
    if (!session) return;
    if (missingFields.length > 0) {
      setMessage(`Please complete: ${missingFields.join(", ")}.`);
      return;
    }

    const signatureData =
      signatureMode === "DRAW"
        ? canvasRef.current?.toDataURL("image/jpeg", 0.74) || ""
        : signatureImage;
    const finalSignatureSource =
      signatureMode === "DRAW" ? "DRAW" : signatureSource;

    setSaving(true);
    setMessage("");

    try {
      await submitStudentCircleAttendance({
        sessionId: session.id,
        token: attendanceToken,
        studentUserId: loggedInStudent?.id ?? null,
        studentName: studentName.trim(),
        courseId,
        courseName: courseName.trim(),
        yearLevelId,
        yearLevelName: yearLevelName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        signatureData,
        signatureSource: finalSignatureSource,
      });
      setSubmitted(true);
      setExistingSubmittedAt(new Date().toISOString());
      setMessage("Attendance submitted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit attendance.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={cardStyle}>
            <LoaderCircle size={20} style={{ verticalAlign: "middle" }} />{" "}
            Loading Group Counselling...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={cardStyle}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Group Counselling Attendance</h1>
            <p style={{ color: "#64748b", fontWeight: 800 }}>
              {message || "This attendance link is unavailable."}
            </p>
            <Link to="/" style={{ color: "#0f172a", fontWeight: 900 }}>
              Back to GCMS
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>
              Group Counselling Attendance
            </h1>
            <div style={{ marginTop: 6, color: "#64748b", fontWeight: 800 }}>
              {session.topic || "Group Counselling"}
            </div>
            <div style={{ marginTop: 10 }}>
              {loggedInStudent ? (
                <span style={iconChipStyle}>
                  <CheckCircle2 size={15} />
                  {loggedInStudentName || loggedInStudent.email}
                </span>
              ) : (
                <Link
                  to={`/login?next=${encodeURIComponent(returnTo)}`}
                  style={{ ...iconButtonStyle, textDecoration: "none" }}
                >
                  <LogIn size={16} />
                  Student Login
                </Link>
              )}
            </div>
          </div>
          <Link
            to="/"
            title="Back to GCMS"
            aria-label="Back to GCMS"
            style={{
              ...iconButtonStyle,
              width: 42,
              padding: 0,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={18} />
          </Link>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span style={iconChipStyle}>
              <CalendarDays size={15} />
              {formatDate(session.date)} / {formatTime(session.time)}
            </span>
            <span style={iconChipStyle}>
              <MapPin size={15} />
              {session.location}
            </span>
            <span style={iconChipStyle}>
              <UserRound size={15} />
              {session.facilitator || "Facilitator TBA"}
            </span>
          </div>
        </div>

        {submitted ? (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={24} color="#15803d" />
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Attendance Recorded</h2>
                <div style={{ marginTop: 4, color: "#475569", fontWeight: 800 }}>
                  You already took attendance for this Group Counselling session
                  {existingSubmittedAt
                    ? ` on ${formatDateTime(existingSubmittedAt)}`
                    : ""}
                  .
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, display: "grid", gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <label style={fieldStyle}>
                <span style={labelStyle}>Name</span>
                <input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  style={inputStyle}
                  autoComplete="off"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Course</span>
                <input
                  value={courseName}
                  onChange={(event) => setCourseName(event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Year Level</span>
                <input
                  value={yearLevelName}
                  onChange={(event) => setYearLevelName(event.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Phone Number</span>
                <input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  style={inputStyle}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={inputStyle}
                  inputMode="email"
                  autoComplete="off"
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={labelStyle}>Signature</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setSignatureMode("DRAW")}
                  style={{
                    ...iconButtonStyle,
                    background: signatureMode === "DRAW" ? "#0f172a" : "white",
                    color: signatureMode === "DRAW" ? "white" : "#0f172a",
                  }}
                >
                  <PenLine size={16} />
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode("UPLOAD")}
                  style={{
                    ...iconButtonStyle,
                    background: signatureMode === "UPLOAD" ? "#0f172a" : "white",
                    color: signatureMode === "UPLOAD" ? "white" : "#0f172a",
                  }}
                >
                  <ImageUp size={16} />
                  Upload / Camera
                </button>
              </div>

              {signatureMode === "DRAW" ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <canvas
                    ref={canvasRef}
                    width={720}
                    height={240}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    onPointerLeave={stopDrawing}
                    style={{
                      width: "100%",
                      height: 220,
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.16)",
                      background: "white",
                      touchAction: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={clearSignature}
                    style={{ ...iconButtonStyle, width: "fit-content" }}
                  >
                    <Eraser size={16} />
                    Clear
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={iconButtonStyle}>
                      <Upload size={16} />
                      Choose Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          void handleSignatureFile(
                            event.target.files?.[0],
                            "UPLOAD",
                          );
                          event.currentTarget.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                    <label style={iconButtonStyle}>
                      <Camera size={16} />
                      Take Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => {
                          void handleSignatureFile(
                            event.target.files?.[0],
                            "CAMERA",
                          );
                          event.currentTarget.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                  {signatureImage ? (
                    <img
                      src={signatureImage}
                      alt="Signature preview"
                      style={{
                        width: "min(360px, 100%)",
                        maxHeight: 180,
                        objectFit: "contain",
                        border: "1px solid rgba(15,23,42,0.14)",
                        borderRadius: 8,
                        background: "white",
                      }}
                    />
                  ) : null}
                </div>
              )}
            </div>

            {message ? (
              <div
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(220,38,38,0.18)",
                  background: "rgba(254,242,242,0.92)",
                  color: "#991b1b",
                  padding: "10px 12px",
                  fontWeight: 850,
                }}
              >
                {message}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  ...iconButtonStyle,
                  minWidth: 170,
                  border: "none",
                  background: "#1d4ed8",
                  color: "white",
                  opacity: saving ? 0.72 : 1,
                }}
              >
                {saving ? <LoaderCircle size={17} /> : <CheckCircle2 size={17} />}
                {saving ? "Submitting..." : "Submit Attendance"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
