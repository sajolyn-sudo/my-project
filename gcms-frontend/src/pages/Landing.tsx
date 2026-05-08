import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import logo from "../assets/logo.png";

type PaletteId = 1 | 2 | 3;

type LandingPalette = {
  label: string;
  navy: string;
  blue: string;
  yellow: string;
  yellow2: string;
  background: string;
  blob1: string;
  blob2: string;
};

const LANDING_PALETTES: Record<PaletteId, LandingPalette> = {
  1: {
    label: "Palette 1",
    navy: "rgba(9,14,25,1)",
    blue: "rgba(37,99,235,1)",
    yellow: "rgba(251,191,36,1)",
    yellow2: "rgba(245,158,11,1)",
    background:
      "radial-gradient(700px 420px at 85% 12%, rgba(251,191,36,0.25), transparent 55%)," +
      "linear-gradient(135deg, #0a0f1f 0%, #0f1b3d 40%, #1e3a8a 100%)",
    blob1:
      "radial-gradient(circle at 40% 40%, rgba(37,99,235,0.35), transparent 65%)",
    blob2:
      "radial-gradient(circle at 40% 40%, rgba(251,191,36,0.35), transparent 65%)",
  },
  2: {
    label: "Palette 2",
    navy: "rgba(8,31,38,1)",
    blue: "rgba(13,148,136,1)",
    yellow: "rgba(250,204,21,1)",
    yellow2: "rgba(245,158,11,1)",
    background:
      "radial-gradient(700px 420px at 85% 12%, rgba(250,204,21,0.24), transparent 55%)," +
      "linear-gradient(135deg, #081f26 0%, #0f3a45 45%, #115e59 100%)",
    blob1:
      "radial-gradient(circle at 40% 40%, rgba(13,148,136,0.35), transparent 65%)",
    blob2:
      "radial-gradient(circle at 40% 40%, rgba(250,204,21,0.35), transparent 65%)",
  },
  3: {
    label: "Palette 3",
    navy: "rgba(35,16,62,1)",
    blue: "rgba(74,26,166,1)",
    yellow: "rgba(200,169,81,1)",
    yellow2: "rgba(182,140,62,1)",
    background:
      "radial-gradient(700px 420px at 85% 12%, rgba(200,169,81,0.25), transparent 55%)," +
      "linear-gradient(135deg, #170a2d 0%, #2a0f52 42%, #4a1aa6 100%)",
    blob1:
      "radial-gradient(circle at 40% 40%, rgba(74,26,166,0.35), transparent 65%)",
    blob2:
      "radial-gradient(circle at 40% 40%, rgba(200,169,81,0.35), transparent 65%)",
  },
};

function getPaletteId(): PaletteId {
  const valid = (value: number): value is PaletteId =>
    value === 1 || value === 2 || value === 3;

  const queryValue = Number(
    new URLSearchParams(window.location.search).get("palette"),
  );
  if (valid(queryValue)) return queryValue;

  const storageValue = Number(localStorage.getItem("evondev_palette"));
  if (valid(storageValue)) return storageValue;

  // Default requested by user
  return 3;
}

export default function Landing() {
  const nav = useNavigate();

  const palette = useMemo(() => LANDING_PALETTES[getPaletteId()], []);

  const styles = useMemo(() => {
    const { blue, yellow } = palette;

    const s: Record<string, CSSProperties> = {
      page: {
        minHeight: "100vh",
        padding: 18,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: palette.background,
        position: "relative",
        overflow: "hidden",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
      },
      blob1: {
        position: "absolute",
        width: 520,
        height: 520,
        borderRadius: 999,
        left: -200,
        bottom: -240,
        background: palette.blob1,
        filter: "blur(12px)",
        pointerEvents: "none",
      },
      blob2: {
        position: "absolute",
        width: 560,
        height: 560,
        borderRadius: 999,
        right: -220,
        top: -260,
        background: palette.blob2,
        filter: "blur(12px)",
        pointerEvents: "none",
      },
      container: {
        width: "min(1100px, 100%)",
        display: "grid",
        gap: 18,
        gridTemplateColumns: "1.1fr 0.9fr",
        alignItems: "stretch",
        position: "relative",
        zIndex: 1,
      },
      leftCard: {
        borderRadius: 22,
        padding: 28,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
        backdropFilter: "blur(12px)",
        color: "white",
      },
      rightCard: {
        borderRadius: 22,
        padding: 22,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(255,255,255,0.70)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
        color: "rgba(15,23,42,0.92)",
      },
      brandRow: {
        display: "flex",
        alignItems: "center",
        gap: 12,
      },
      logo: {
        width: 46,
        height: 46,
        borderRadius: 14,
        objectFit: "cover",
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
      },
      brandText: {
        display: "grid",
        gap: 2,
      },
      brandTop: {
        fontWeight: 1000,
        letterSpacing: 0.4,
        fontSize: 14,
        lineHeight: 1.1,
        color: "rgba(255,255,255,0.92)",
      },
      brandSub: {
        fontSize: 12.5,
        opacity: 0.82,
        color: "rgba(255,255,255,0.82)",
      },
      badge: {
        marginTop: 16,
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        color: "rgba(255, 245, 220, 0.96)",
        fontWeight: 850,
        fontSize: 13,
        letterSpacing: 0.2,
      },
      title: {
        marginTop: 14,
        marginBottom: 10,
        fontWeight: 1000,
        fontSize: 40,
        lineHeight: 1.05,
        letterSpacing: -0.7,
      },
      subtitle: {
        margin: 0,
        opacity: 0.92,
        fontSize: 15.5,
        lineHeight: 1.55,
        maxWidth: 600,
      },
      ctas: {
        marginTop: 18,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
      },
      primaryBtn: {
        height: 44,
        padding: "0 16px",
        borderRadius: 14,
        border: "none",
        cursor: "pointer",
        fontWeight: 950,
        color: "#2A0F52",
        background: "linear-gradient(135deg, #FFD600, #FFEB6E)",
        boxShadow: "0 10px 22px rgba(255, 214, 0, 0.22)",
      },
      secondaryBtn: {
        height: 44,
        padding: "0 16px",
        borderRadius: 14,
        cursor: "pointer",
        fontWeight: 900,
        color: "white",
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
      },
      featureGrid: {
        marginTop: 22,
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      },
      feature: {
        borderRadius: 16,
        padding: 14,
        background: "rgba(0,0,0,0.18)",
        border: "1px solid rgba(255,255,255,0.12)",
      },
      featureTitle: {
        margin: "0 0 6px 0",
        fontWeight: 950,
        fontSize: 14,
        color: "rgba(255, 235, 192, 0.95)",
      },
      featureText: {
        margin: 0,
        fontSize: 13,
        opacity: 0.9,
        lineHeight: 1.45,
      },
      rightHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
      },
      rightBrand: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontWeight: 1000,
        fontSize: 14,
        letterSpacing: 0.3,
        color: "rgba(15,23,42,0.92)",
      },
      pill: {
        fontSize: 12,
        fontWeight: 950,
        padding: "7px 10px",
        borderRadius: 999,
        background: "rgba(37, 99, 235, 0.10)",
        border: "1px solid rgba(37, 99, 235, 0.22)",
        color: blue,
      },
      previewCard: {
        borderRadius: 18,
        padding: 16,
        border: "1px solid rgba(15, 23, 42, 0.10)",
        background: `linear-gradient(180deg, ${blue.replace(",1)", ",0.08)")} 0%, ${yellow.replace(",1)", ",0.1)")} 100%)`,
      },
      previewTitle: {
        margin: 0,
        fontWeight: 1000,
        fontSize: 16,
        color: "rgba(15,23,42,0.92)",
      },
      previewText: {
        margin: "8px 0 0 0",
        fontSize: 13.5,
        lineHeight: 1.55,
        opacity: 0.9,
      },
      checklist: {
        marginTop: 12,
        display: "grid",
        gap: 10,
      },
      checkRow: {
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.75)",
        border: "1px solid rgba(15, 23, 42, 0.08)",
      },
      checkDot: {
        width: 10,
        height: 10,
        marginTop: 5,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${blue} 0%, ${yellow} 100%)`,
        boxShadow: "0 10px 20px rgba(37, 99, 235, 0.14)",
        flex: "0 0 auto",
      },
      checkTitle: {
        margin: 0,
        fontSize: 13,
        fontWeight: 1000,
        color: "rgba(15,23,42,0.92)",
      },
      checkDesc: {
        margin: "2px 0 0 0",
        fontSize: 12.5,
        opacity: 0.85,
        lineHeight: 1.4,
      },
      footerNote: {
        marginTop: 14,
        fontSize: 12.5,
        opacity: 0.75,
      },
    };

    return s;
  }, [palette]);

  return (
    <div style={styles.page}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div className="_gcs_container" style={styles.container}>
        <section style={styles.leftCard}>
          <div style={styles.brandRow}>
            <img src={logo} alt="GCMS Logo" style={styles.logo} />
            <div style={styles.brandText}>
              <div style={styles.brandTop}>
                Guidance and Counselling Management System
              </div>
              <div style={styles.brandSub}>GCMS Portal</div>
            </div>
          </div>

          <div style={styles.badge}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: palette.yellow,
                boxShadow: "0 0 0 6px rgba(255,255,255,0.16)",
              }}
            />
            Secure | Role-based | Student-friendly
          </div>

          <h1 style={styles.title}>
            Guidance and Counselling Management System
          </h1>
          <p style={styles.subtitle}>
            A modern platform for scheduling, tracking, and managing counseling
            sessions, built for students, STAFFs, teachers, non teaching
            staff, and admins. Log in with your username and get redirected
            automatically based on your role.
          </p>

          <div style={styles.ctas}>
            <button
              className="gcms-btn gcms-btn-primary"
              style={styles.primaryBtn}
              onClick={() => nav("/signup")}
            >
              Sign Up
            </button>

            <button
              className="gcms-btn gcms-btn-ghost"
              style={styles.secondaryBtn}
              onClick={() => nav("/login")}
              title="Go to Login"
            >
              Login
            </button>
          </div>

          <div style={styles.featureGrid}>
            <div style={styles.feature}>
              <div style={styles.featureTitle}>Role-Based Access</div>
              <p style={styles.featureText}>
                Students, STAFFs, Teachers, Non Teaching Staff, and Admins
                see exactly what they need.
              </p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureTitle}>Fast Scheduling</div>
              <p style={styles.featureText}>
                Book sessions quickly and keep timelines organized.
              </p>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureTitle}>Clean Records</div>
              <p style={styles.featureText}>
                Maintain notes and counseling history with clarity.
              </p>
            </div>
          </div>
        </section>

        <aside style={styles.rightCard}>
          <div style={styles.rightHeader}>
            <div style={styles.rightBrand}>GCMS</div>
          </div>

          <div style={styles.previewCard}>
            <h3 style={styles.previewTitle}>What you can do inside</h3>
            <p style={styles.previewText}>
              The system adapts to your role after login. Students manage
              appointments, STAFFs guide sessions, teachers add referrals,
              non teaching staff assist referrals, and admins oversee users.
            </p>
          </div>

          <div style={styles.checklist}>
            <div style={styles.checkRow}>
              <div style={styles.checkDot} />
              <div>
                <p style={styles.checkTitle}>Students</p>
                <p style={styles.checkDesc}>
                  View counseling status, request sessions, and track updates.
                </p>
              </div>
            </div>

            <div style={styles.checkRow}>
              <div style={styles.checkDot} />
              <div>
                <p style={styles.checkTitle}>STAFFs</p>
                <p style={styles.checkDesc}>
                  Manage appointments, document sessions, and support students.
                </p>
              </div>
            </div>

            <div style={styles.checkRow}>
              <div style={styles.checkDot} />
              <div>
                <p style={styles.checkTitle}>Teachers</p>
                <p style={styles.checkDesc}>
                  Refer students for counseling and track referral status.
                </p>
              </div>
            </div>

            <div style={styles.checkRow}>
              <div style={styles.checkDot} />
              <div>
                <p style={styles.checkTitle}>Non Teaching Staff</p>
                <p style={styles.checkDesc}>
                  Assist referrals and monitor updates assigned to their role.
                </p>
              </div>
            </div>

            <div style={styles.checkRow}>
              <div style={styles.checkDot} />
              <div>
                <p style={styles.checkTitle}>Admins</p>
                <p style={styles.checkDesc}>
                  Maintain user accounts and system-wide visibility.
                </p>
              </div>
            </div>
          </div>

          <div style={styles.footerNote}>
            Tip: Make sure accounts exist in <b>User Management</b> before
            login.
          </div>
        </aside>
      </div>

      <style>
        {`
          @media (max-width: 920px) {
            ._gcs_container {
              grid-template-columns: 1fr !important;
            }
          }

          .gcms-btn {
            transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease, opacity 0.14s ease;
            will-change: transform;
          }

          .gcms-btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.02);
          }

          .gcms-btn:active {
            transform: translateY(0px) scale(0.98);
            filter: brightness(0.98);
          }

          .gcms-btn:focus-visible {
            outline: none;
            box-shadow: 0 0 0 4px rgba(37,99,235,0.22), 0 0 0 8px rgba(251,191,36,0.18);
          }

          .gcms-btn-primary:hover {
            box-shadow: 0 14px 28px rgba(0,0,0,0.22);
          }

          .gcms-btn-ghost:hover {
            box-shadow: 0 14px 28px rgba(0,0,0,0.18);
            opacity: 0.96;
          }
        `}
      </style>
    </div>
  );
}
