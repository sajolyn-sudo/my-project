import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJSON } from "../lib/api";
import { fetchEntitiesBootstrap } from "../lib/entitiesApi";
import {
  normalizeSentenceCaseName,
  toSentenceCaseNameInput,
} from "../lib/nameCase";
import { useAuthStore } from "../store/authStore";
import logo from "../assets/logo.png";

type College = { id: number; name: string };

export default function SignUp() {
  const nav = useNavigate();
  const loginWithApi = useAuthStore((s) => s.loginWithApi);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [collegeId, setCollegeId] = useState<number>(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setCollegesLoading(true);
    fetchEntitiesBootstrap()
      .then((res) => {
        if (!alive) return;
        const next = res.colleges ?? [];
        setColleges(next);
        if (next.length > 0) {
          setCollegeId(next[0].id);
        }
      })
      .catch(() => {
        if (!alive) return;
        setColleges([]);
      })
      .finally(() => {
        if (!alive) return;
        setCollegesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedCollegeName = useMemo(
    () => colleges.find((c) => c.id === collegeId)?.name ?? "",
    [colleges, collegeId],
  );

  const inputStyle = (base: CSSProperties): CSSProperties => ({
    ...base,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  });

  const handleCreateAccount = async () => {
    setError("");
    setSuccess("");

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !collegeId ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!email.toLowerCase().endsWith("@bisu.edu.ph")) {
      setError("Use your BISU email address (@bisu.edu.ph).");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const cleanEmail = email.trim();
      const res = await postJSON<{
        ok: boolean;
        message?: string;
      }>("/register.php", {
        firstName: normalizeSentenceCaseName(firstName),
        middleName: normalizeSentenceCaseName(middleName),
        lastName: normalizeSentenceCaseName(lastName),
        username: username.trim(),
        email: cleanEmail,
        collegeId,
        collegeName: selectedCollegeName,
        password,
        confirmPassword,
      });
      setSuccess(res.message || "Account created. Signing you in...");

      const loginRes = await loginWithApi(cleanEmail, password);
      if (!loginRes.ok) {
        setError(
          "Account created, but automatic sign in failed. Please log in using your new account.",
        );
        return;
      }

      const role = String(loginRes.user.role || "").toUpperCase();
      if (role === "STUDENT") nav("/app/my-counseling");
      else if (role === "TEACHER" || role === "NON_TEACHING_PERSONNEL") {
        nav("/app/referrals");
      } else nav("/app/dashboard");
    } catch (e: any) {
      const msg = String(e?.message || "Failed to register account.");
      const lower = msg.toLowerCase();

      if (lower.includes("already registered")) {
        const loginRes = await loginWithApi(email.trim(), password);
        if (loginRes.ok) {
          const role = String(loginRes.user.role || "").toUpperCase();
          if (role === "STUDENT") nav("/app/my-counseling");
          else if (role === "TEACHER" || role === "NON_TEACHING_PERSONNEL") {
            nav("/app/referrals");
          } else nav("/app/dashboard");
          return;
        }
        setError(
          "This email is already registered. Sign in instead, or use the correct password.",
        );
        return;
      }

      if (lower.includes("not authorized")) {
        setError(
          "Cannot sign up: this BISU email is not yet authorized in GCMS. Ask the admin to add your email first.",
        );
        return;
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => {
    const s: Record<string, CSSProperties> = {
      page: {
        minHeight: "100vh",
        padding: 18,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "radial-gradient(700px 400px at 85% 10%, rgba(251,191,36,0.25), transparent 55%)," +
          "linear-gradient(135deg, #0a0f1f 0%, #0f1b3d 40%, #1e3a8a 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
      },
      blob1: {
        position: "absolute",
        width: 480,
        height: 480,
        borderRadius: 999,
        left: -160,
        bottom: -200,
        background:
          "radial-gradient(circle at 40% 40%, rgba(37,99,235,0.35), transparent 65%)",
        filter: "blur(10px)",
        pointerEvents: "none",
      },
      blob2: {
        position: "absolute",
        width: 520,
        height: 520,
        borderRadius: 999,
        right: -200,
        top: -220,
        background:
          "radial-gradient(circle at 40% 40%, rgba(251,191,36,0.35), transparent 65%)",
        filter: "blur(10px)",
        pointerEvents: "none",
      },
      card: {
        width: 640,
        maxWidth: "100%",
        padding: 26,
        borderRadius: 22,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(255,255,255,0.70)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
        position: "relative",
        zIndex: 1,
        color: "#23103E",
      },
      topRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
      },
      brandRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
      },
      logo: {
        width: 32,
        height: 32,
        borderRadius: 10,
        objectFit: "cover",
        border: "1px solid rgba(35, 16, 62, 0.12)",
        background: "white",
      },
      brand: {
        fontWeight: 950,
        fontSize: 13.5,
        letterSpacing: 0.25,
        color: "#3B1B6F",
      },
      pill: {
        fontSize: 12,
        fontWeight: 900,
        padding: "7px 10px",
        borderRadius: 999,
        background: "rgba(106, 43, 217, 0.10)",
        border: "1px solid rgba(106, 43, 217, 0.22)",
        color: "#4A1AA6",
        cursor: "pointer",
        opacity: loading ? 0.7 : 1,
      },
      title: {
        margin: "8px 0 6px 0",
        fontWeight: 950,
        fontSize: 26,
        letterSpacing: -0.3,
        color: "#2A0F52",
      },
      subtitle: {
        margin: "0 0 16px 0",
        fontSize: 13.5,
        lineHeight: 1.55,
        opacity: 0.9,
      },
      fieldGrid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
      },
      fieldGrid3: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
      },
      label: {
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.85,
        color: "#2A0F52",
        letterSpacing: 0.4,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      },
      input: {
        height: 44,
        borderRadius: 14,
        border: "1px solid rgba(35, 16, 62, 0.18)",
        padding: "0 12px",
        outline: "none",
        background: "white",
        color: "#23103E",
        width: "100%",
        fontWeight: 700,
      },
      error: {
        background: "rgba(217, 83, 79, 0.10)",
        border: "1px solid rgba(217, 83, 79, 0.28)",
        padding: 10,
        borderRadius: 14,
        color: "#B53A36",
        fontWeight: 800,
        fontSize: 13,
      },
      success: {
        background: "rgba(22, 163, 74, 0.10)",
        border: "1px solid rgba(22, 163, 74, 0.28)",
        padding: 10,
        borderRadius: 14,
        color: "#166534",
        fontWeight: 800,
        fontSize: 13,
      },
      note: {
        fontSize: 12.8,
        opacity: 0.75,
        lineHeight: 1.45,
      },
      primaryBtn: {
        height: 44,
        borderRadius: 14,
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        width: "100%",
        fontWeight: 950,
        color: "#2A0F52",
        background: "linear-gradient(135deg, #FFD600, #FFEB6E)",
        boxShadow: "0 10px 22px rgba(255, 214, 0, 0.22)",
        opacity: loading ? 0.75 : 1,
      },
      switchRow: {
        marginTop: 2,
        textAlign: "center",
        fontSize: 13,
        color: "#2A0F52",
      },
      switchBtn: {
        border: "none",
        background: "transparent",
        color: "#4A1AA6",
        cursor: "pointer",
        fontWeight: 900,
        padding: 0,
      },
    };
    return s;
  }, [loading]);

  return (
    <div style={styles.page}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div style={styles.card}>
        <div style={styles.topRow}>
          <div style={styles.brandRow}>
            <img src={logo} alt="GCMS Logo" style={styles.logo} />
            <div style={styles.brand}>GCS Portal</div>
          </div>
          <button
            className="gcms-btn gcms-btn-pill"
            style={styles.pill}
            onClick={() => nav("/")}
            disabled={loading}
          >
            Back to Landing
          </button>
        </div>

        <h2 style={styles.title}>Sign Up</h2>
        <p style={styles.subtitle}>
          Create your account using your BISU email and complete your profile
          details.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <div className="gcms-signup-grid-3" style={styles.fieldGrid3}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={styles.label}>First Name</div>
              <input
                value={firstName}
                onChange={(e) =>
                  setFirstName(toSentenceCaseNameInput(e.target.value))
                }
                style={styles.input}
                placeholder="e.g. Juan"
                disabled={loading}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={styles.label}>Middle Name</div>
              <input
                value={middleName}
                onChange={(e) =>
                  setMiddleName(toSentenceCaseNameInput(e.target.value))
                }
                style={styles.input}
                placeholder="Optional"
                disabled={loading}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={styles.label}>Last Name</div>
              <input
                value={lastName}
                onChange={(e) =>
                  setLastName(toSentenceCaseNameInput(e.target.value))
                }
                style={styles.input}
                placeholder="e.g. Dela Cruz"
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Choose username"
              disabled={loading}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@bisu.edu.ph"
              disabled={loading}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>College</div>
            <select
              value={collegeId}
              onChange={(e) => setCollegeId(Number(e.target.value))}
              style={inputStyle(styles.input)}
              disabled={loading || collegesLoading || colleges.length === 0}
            >
              {colleges.length === 0 ? (
                <option value={0}>No colleges available</option>
              ) : (
                colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
            {collegesLoading && (
              <div style={styles.note}>Loading colleges from database...</div>
            )}
          </div>

          <div className="gcms-signup-grid-2" style={styles.fieldGrid2}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={styles.label}>Password</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Create password"
                disabled={loading}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={styles.label}>Confirm Password</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                placeholder="Confirm password"
                disabled={loading}
              />
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.note}>
            Role is automatically assigned based on your authorized BISU email.
          </div>

          <button
            className="gcms-btn gcms-btn-primary"
            style={styles.primaryBtn}
            onClick={handleCreateAccount}
            disabled={loading || collegesLoading || colleges.length === 0}
          >
            {loading ? "Signing Up..." : "Sign Up"}
          </button>

          <div style={styles.switchRow}>
            Already have an account?{" "}
            <button
              style={styles.switchBtn}
              onClick={() => nav("/login")}
              disabled={loading}
            >
              Login
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          .gcms-btn{
            transition: transform .14s ease, box-shadow .14s ease, filter .14s ease, opacity .14s ease;
            will-change: transform;
          }
          .gcms-btn:hover{ transform: translateY(-2px); filter: brightness(1.02); }
          .gcms-btn:active{ transform: translateY(0px) scale(0.98); filter: brightness(0.98); }
          .gcms-btn:focus-visible{
            outline: none;
            box-shadow: 0 0 0 4px rgba(37,99,235,0.22), 0 0 0 8px rgba(251,191,36,0.18);
          }
          .gcms-btn:disabled{ transform:none !important; filter:none !important; box-shadow:none !important; }

          @media (max-width: 900px){
            .gcms-signup-grid-3{
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 720px){
            .gcms-signup-grid-2{
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}
