import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../types/auth";

type ProtectedRouteProps = {
  allowedRoles: Role[];
  children: ReactNode;
};

export default function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const loc = useLocation();

  if (!user) {
    // optional: keep the page they tried to access
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
