import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import logo from "../assets/logo.png";

export default function Login() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const loginWithApi = useAuthStore((s) => s.loginWithApi);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const nextPath = useMemo(() => {
    const next = String(searchParams.get("next") || "").trim();
    if (!next || !next.startsWith("/") || next.startsWith("//")) return "";
    return next;
  }, [searchParams]);

  // Force a blank login form on page load.
  useEffect(() => {
    setEmail("");
    setPassword("");
    requestAnimationFrame(() => {
      if (emailRef.current) emailRef.current.value = "";
      if (passwordRef.current) passwordRef.current.value = "";
    });
  }, []);

  const handleLogin = async () => {
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Username is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    try {
      setLoading(true);

      const res = await loginWithApi(cleanEmail, password);

      if (!res.ok) {
        setError(res.message || "Login failed");
        setPassword("");
        requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }

      const role = String(res.user.role || "").toUpperCase();

      if (nextPath) nav(nextPath);
      else if (role === "STUDENT") nav("/app/my-counseling");
      else if (role === "TEACHER" || role === "NON_TEACHING_PERSONNEL") {
        nav("/app/referrals");
      } else nav("/app/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
      setPassword("");
      requestAnimationFrame(() => passwordRef.current?.focus());
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
        width: 440,
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
        margin: "0 0 18px 0",
        fontSize: 13.5,
        lineHeight: 1.55,
        opacity: 0.9,
      },
      label: {
        fontSize: 13,
        fontWeight: 900,
        opacity: 0.9,
        color: "#2A0F52",
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
      passwordField: {
        position: "relative",
      },
      passwordInput: {
        paddingRight: 46,
      },
      passwordReveal: {
        position: "absolute",
        top: "50%",
        right: 10,
        transform: "translateY(-50%)",
        width: 28,
        height: 28,
        border: "none",
        background: "transparent",
        color: "#4A1AA6",
        display: "grid",
        placeItems: "center",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.55 : 0.85,
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
      note: {
        fontSize: 12.8,
        opacity: 0.75,
        lineHeight: 1.45,
      },
      switchRow: {
        textAlign: "center",
        fontSize: 13,
        color: "#2A0F52",
      },
      switchBtn: {
        border: "none",
        background: "transparent",
        color: "#4A1AA6",
        cursor: loading ? "not-allowed" : "pointer",
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

        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.subtitle}>
          Enter your username and password to log in. You'll be redirected
          automatically based on your role.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>Username</div>
            <input
              ref={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="Enter username"
              disabled={loading}
              autoComplete="off"
              name="gcms_username"
              data-lpignore="true"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>Password</div>
            <div style={styles.passwordField}>
              <input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, ...styles.passwordInput }}
                placeholder="Enter password"
                disabled={loading}
                autoComplete="new-password"
                name="gcms_password"
                data-lpignore="true"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
              <button
                type="button"
                style={styles.passwordReveal}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
                onMouseEnter={() => setShowPassword(true)}
                onMouseLeave={() => setShowPassword(false)}
                onFocus={() => setShowPassword(true)}
                onBlur={() => setShowPassword(false)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <div style={styles.error}>{error}</div>}

          <button
            className="gcms-btn gcms-btn-primary"
            style={styles.primaryBtn}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div style={styles.switchRow}>
            Don't have an account?{" "}
            <button
              style={styles.switchBtn}
              onClick={() => nav("/signup")}
              disabled={loading}
            >
              Sign Up
            </button>
          </div>

          <div style={styles.note}>
            Note: Accounts must exist in <b>User Management</b>.
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
        `}
      </style>
    </div>
  );
}
