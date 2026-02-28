import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function Login() {
  const nav = useNavigate();
  const loginWithApi = useAuthStore((s) => s.loginWithApi);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Email is required");
      return;
    }

    try {
      setLoading(true);

      // ✅ Debug: open DevTools console to see this
      console.log("Attempt login:", cleanEmail);

      const res = await loginWithApi(cleanEmail);

      if (!res.ok) {
        setError(res.message || "Login failed");
        return;
      }

      const role = String(res.user.role || "").toUpperCase();

      if (role === "STUDENT") nav("/app/my-counseling");
      else nav("/app/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
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
    };
    return s;
  }, [loading]);

  return (
    <div style={styles.page}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div style={styles.card}>
        <div style={styles.topRow}>
          <div style={styles.brand}>GCS Portal</div>
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
          Enter your email to log in. You’ll be redirected automatically based
          on your role.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={styles.label}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="e.g. pink.acas@gmail.com"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
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
