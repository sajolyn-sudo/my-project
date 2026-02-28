import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../types/auth";

import logo from "../assets/logo.png";
import Modal from "../components/Modal";

import {
  Home,
  Users as UsersIcon,
  BriefcaseMedical,
  UsersRound,
  Share2,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  LifeBuoy, // ✅ Get Support icon
  UserRound,
} from "lucide-react";

type NavItem = {
  label: string;
  to: string;
  roles: Role[];
  icon: React.ReactNode;
};

/** ✅ Slide-in Toast (no library) */
function Toast({
  open,
  message,
  tone = "success",
  onClose,
}: {
  open: boolean;
  message: string;
  tone?: "success" | "error" | "info";
  onClose: () => void;
}) {
  // keep mounted briefly for exit animation
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  const palette =
    tone === "success"
      ? {
          bg: "rgba(34,197,94,0.14)",
          border: "rgba(34,197,94,0.35)",
          text: "#166534",
          dot: "#22c55e",
          icon: "✓",
          title: "Success",
        }
      : tone === "error"
        ? {
            bg: "rgba(239,68,68,0.12)",
            border: "rgba(239,68,68,0.30)",
            text: "#991b1b",
            dot: "#ef4444",
            icon: "!",
            title: "Error",
          }
        : {
            bg: "rgba(59,130,246,0.12)",
            border: "rgba(59,130,246,0.30)",
            text: "#1d4ed8",
            dot: "#3b82f6",
            icon: "i",
            title: "Info",
          };

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 200,
        width: "min(420px, calc(100vw - 36px))",
        transform: open ? "translateX(0)" : "translateX(12px)",
        opacity: open ? 1 : 0,
        transition: "transform 220ms ease, opacity 220ms ease",
        pointerEvents: open ? "auto" : "none",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 12,
          borderRadius: 14,
          border: `1px solid ${palette.border}`,
          background: palette.bg,
          boxShadow: "0 14px 40px rgba(15,23,42,0.18)",
          color: palette.text,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            width: 8,
            height: 8,
            borderRadius: 99,
            background: palette.dot,
          }}
        />

        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.75)",
            border: "1px solid rgba(15,23,42,0.08)",
            flex: "0 0 auto",
            fontWeight: 1000,
          }}
        >
          {palette.icon}
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 13 }}>{palette.title}</div>
          <div style={{ fontWeight: 850, fontSize: 13, opacity: 0.9 }}>
            {message}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: "1px solid rgba(15,23,42,0.12)",
            background: "rgba(255,255,255,0.75)",
            borderRadius: 10,
            height: 30,
            padding: "0 10px",
            cursor: "pointer",
            fontWeight: 950,
            color: palette.text,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const loc = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);

  // ✅ Confirm logout modal
  const [logoutOpen, setLogoutOpen] = useState(false);

  // ✅ Loading state (backend-ready)
  const [logoutLoading, setLogoutLoading] = useState(false);

  // ✅ Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({ open: false, message: "", tone: "success" });

  const showToast = (
    message: string,
    tone: "success" | "error" | "info" = "success",
  ) => {
    setToast({ open: true, message, tone });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => {
      setToast((p) => ({ ...p, open: false }));
    }, 2500);
  };

  // Theme: blue + yellow
  const blueSoft = "rgba(37, 99, 235, 0.14)";
  const yellow = "rgba(251, 191, 36, 1)";
  const yellowSoft = "rgba(251, 191, 36, 0.18)";

  const handleLogout = async () => {
    if (logoutLoading) return;

    try {
      setLogoutLoading(true);

      // Later: await fetch(...) to backend logout endpoint
      logout();

      showToast("You have been logged out.", "info");
      setLogoutOpen(false);

      setTimeout(() => navigate("/login"), 250);
    } catch {
      showToast("Logout failed. Please try again.", "error");
    } finally {
      setLogoutLoading(false);
    }
  };

  /** ✅ ESC closes modal, Enter confirms */
  useEffect(() => {
    if (!logoutOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!logoutLoading) setLogoutOpen(false);
        return;
      }

      if (e.key === "Enter") {
        const tag = (document.activeElement?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;

        e.preventDefault();
        handleLogout();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoutOpen, logoutLoading]);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        label: "Dashboard",
        to: "/app/dashboard",
        roles: ["ADMIN", "COUNSELOR", "STUDENT"],
        icon: <Home size={18} />,
      },

      // ADMIN
      {
        label: "User Management",
        to: "/app/users",
        roles: ["ADMIN"],
        icon: <UsersIcon size={18} />,
      },
      {
        label: "Academic Structure",
        to: "/app/academic-structure",
        roles: ["ADMIN"],
        icon: <ClipboardList size={18} />,
      },

      // COUNSELOR + ADMIN
      {
        label: "Counseling Cases",
        to: "/app/counseling",
        roles: ["COUNSELOR", "ADMIN"],
        icon: <BriefcaseMedical size={18} />,
      },
      {
        label: "Group Sessions",
        to: "/app/group-sessions",
        roles: ["COUNSELOR", "ADMIN"],
        icon: <UsersRound size={18} />,
      },
      {
        label: "Referrals",
        to: "/app/referrals",
        roles: ["COUNSELOR", "ADMIN"],
        icon: <Share2 size={18} />,
      },

      // STUDENT
      {
        label: "My Counseling",
        to: "/app/my-counseling",
        roles: ["STUDENT"],
        icon: <BriefcaseMedical size={18} />,
      },
      {
        label: "My Referrals",
        to: "/app/my-referrals",
        roles: ["STUDENT"],
        icon: <Share2 size={18} />,
      },
      {
        label: "Survey",
        to: "/app/survey",
        roles: ["STUDENT"],
        icon: <ClipboardList size={18} />,
      },
      {
        label: "Get Support",
        to: "/app/get-support",
        roles: ["STUDENT"],
        icon: <LifeBuoy size={18} />,
      },
      {
        label: "Account",
        to: "/app/account",
        roles: ["STUDENT"],
        icon: <UserRound size={18} />,
      },
    ],
    [],
  );

  const visibleNav = user
    ? navItems.filter((n) => n.roles.includes(user.role))
    : [];

  const isActive = (to: string) => {
    if (loc.pathname === to) return true;
    if (to === "/app/dashboard")
      return loc.pathname.startsWith("/app/dashboard");
    return loc.pathname.startsWith(to + "/") || loc.pathname.startsWith(to);
  };

  if (!user) return <Navigate to="/login" replace />;

  const sidebarWidth = collapsed ? 86 : 276;

  const iconBox = (active: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: active ? yellowSoft : "rgba(255,255,255,0.06)",
    border: active
      ? "1px solid rgba(251,191,36,0.22)"
      : "1px solid rgba(255,255,255,0.08)",
    flex: "0 0 auto" as const,
  });

  // Modal buttons themed (yellow/blue)
  const cancelBtn: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(37,99,235,0.28)",
    background: "rgba(37,99,235,0.08)",
    color: "rgba(37,99,235,1)",
    fontWeight: 1000,
    cursor: logoutLoading ? "not-allowed" : "pointer",
    opacity: logoutLoading ? 0.75 : 1,
  };

  const confirmBtn: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(251,191,36,0.35)",
    background:
      "linear-gradient(135deg, rgba(251,191,36,1) 0%, rgba(245,158,11,1) 100%)",
    color: "rgba(9,14,25,1)",
    fontWeight: 1100,
    cursor: logoutLoading ? "not-allowed" : "pointer",
    opacity: logoutLoading ? 0.85 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 18px 32px rgba(245,158,11,0.22)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        transition: "grid-template-columns .18s ease",
        background: "#f5f7fb",
      }}
    >
      <Toast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
      />

      <Modal
        open={logoutOpen}
        onClose={() => !logoutLoading && setLogoutOpen(false)}
        title="Confirm Logout"
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 950, opacity: 0.92 }}>
            Are you sure you want to log out?
          </div>

          <div style={{ fontSize: 13, opacity: 0.78, fontWeight: 850 }}>
            Press <b>ESC</b> to cancel • Press <b>Enter</b> to confirm
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => setLogoutOpen(false)}
              disabled={logoutLoading}
              style={cancelBtn}
            >
              Cancel
            </button>

            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              style={confirmBtn}
            >
              {logoutLoading ? (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 99,
                      border: "2px solid rgba(9,14,25,0.35)",
                      borderTopColor: "rgba(9,14,25,0.95)",
                      display: "inline-block",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Logging out...
                </>
              ) : (
                "Yes, Logout"
              )}
            </button>
          </div>

          <style>{`
            @keyframes spin { 
              from { transform: rotate(0deg); } 
              to { transform: rotate(360deg); } 
            }
          `}</style>
        </div>
      </Modal>

      <aside
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(180deg, rgba(9,14,25,1) 0%, rgba(8,18,34,1) 45%, rgba(8,22,40,1) 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 22px 70px rgba(0,0,0,0.26)",
          color: "white",
          overflow: "visible",
        }}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            position: "absolute",
            top: 16,
            right: -14,
            width: 34,
            height: 48,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(10,16,28,0.92)",
            color: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 14px 28px rgba(0,0,0,0.35)",
            zIndex: 50,
          }}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flex: "0 0 auto",
            }}
            title="GCMS"
          >
            <img
              src={logo}
              alt="GCMS Logo"
              style={{ width: "82%", height: "82%", objectFit: "contain" }}
            />
          </div>

          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{ fontWeight: 1000, letterSpacing: 0.3, fontSize: 16 }}
              >
                GCMS
              </div>
              <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.15 }}>
                Guidance and Counselling Management System
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div style={{ marginTop: 10, padding: "0 6px" }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Welcome</div>
            <div style={{ fontWeight: 1000, fontSize: 14, marginTop: 2 }}>
              {user.fname} {user.lname}
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
              {user.role}
            </div>
          </div>
        )}

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "10px 6px 8px",
          }}
        />

        <nav style={{ display: "grid", gap: 6, padding: "0 6px" }}>
          {visibleNav.map((item) => {
            const active = isActive(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                style={{
                  textDecoration: "none",
                  color: "rgba(255,255,255,0.92)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: 12,
                  padding: collapsed ? "7px 8px" : "7px 10px",
                  borderRadius: 14,
                  border: active
                    ? "1px solid rgba(251,191,36,0.22)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: active
                    ? `linear-gradient(135deg, ${yellowSoft} 0%, ${blueSoft} 100%)`
                    : "rgba(255,255,255,0.035)",
                  boxShadow: active ? "0 18px 34px rgba(0,0,0,0.22)" : "none",
                  transition:
                    "transform .12s ease, background .12s ease, border .12s ease",
                  fontWeight: active ? 950 : 800,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  if (!active)
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  if (!active)
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.035)";
                }}
              >
                <span style={iconBox(active)} aria-hidden>
                  <span
                    style={{
                      color: active ? yellow : "rgba(255,255,255,0.88)",
                    }}
                  >
                    {item.icon}
                  </span>
                </span>

                {!collapsed && (
                  <span style={{ fontSize: 13.5 }}>{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.08)",
            margin: "10px 6px 8px",
          }}
        />

        <div style={{ padding: "0 6px 6px" }}>
          <button
            onClick={() => setLogoutOpen(true)}
            title="Logout"
            style={{
              height: 48,
              width: "100%",
              borderRadius: 18,
              border: "1px solid rgba(251,191,36,0.28)",
              background:
                "linear-gradient(135deg, rgba(251,191,36,1) 0%, rgba(245,158,11,1) 100%)",
              color: "rgba(9,14,25,1)",
              fontWeight: 1000,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 18px 32px rgba(245,158,11,0.22)",
            }}
          >
            <LogOut size={18} />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
