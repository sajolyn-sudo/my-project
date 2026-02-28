import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Forbidden from "./pages/Forbidden";

import Users from "./pages/Users";
import Colleges from "./pages/Colleges";
import AcademicYears from "./pages/AcademicYears";
import YearLevels from "./pages/YearLevels";
import AcademicStructure from "./pages/AcademicStructure";

import Counseling from "./pages/Counseling";
import CounselingView from "./pages/CounselingView";

import GroupSessions from "./pages/GroupSessions";
import GroupSessionView from "./pages/GroupSessionView";

import Referrals from "./pages/Referrals";
import ReferralView from "./pages/ReferralView";

import Survey from "./pages/Survey";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import StudentDashboard from "./pages/StudentDashboard";
import Dashboard from "./pages/Dashboard";
import MyCounseling from "./pages/MyCounseling";
import MyCounselingView from "./pages/MyCounselingView";
import MyReferrals from "./pages/MyReferrals";
import MyReferralView from "./pages/MyReferralView";
import Account from "./pages/Account";
import GetSupport from "./pages/GetSupport";

import CounselorDashboard from "./pages/CounselorDashboard";

import { useAuthStore } from "./store/authStore";

function DashboardRouter() {
  const user = useAuthStore((s) => s.user);

  if (user?.role === "STUDENT") return <StudentDashboard />;
  if (user?.role === "COUNSELOR") return <CounselorDashboard />;

  // ADMIN (and fallback)
  return <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute allowedRoles={["ADMIN", "COUNSELOR", "STUDENT"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />

        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="academic-structure"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AcademicStructure />
            </ProtectedRoute>
          }
        />
        <Route
          path="account"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="colleges"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <Colleges />
            </ProtectedRoute>
          }
        />
        <Route
          path="academic-years"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AcademicYears />
            </ProtectedRoute>
          }
        />

        <Route
          path="year-levels"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <YearLevels />
            </ProtectedRoute>
          }
        />

        <Route
          path="counseling"
          element={
            <ProtectedRoute allowedRoles={["COUNSELOR", "ADMIN"]}>
              <Counseling />
            </ProtectedRoute>
          }
        />
        <Route
          path="counseling/:id"
          element={
            <ProtectedRoute allowedRoles={["COUNSELOR", "ADMIN"]}>
              <CounselingView />
            </ProtectedRoute>
          }
        />

        <Route
          path="group-sessions"
          element={
            <ProtectedRoute allowedRoles={["COUNSELOR", "ADMIN"]}>
              <GroupSessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="group-sessions/:id"
          element={
            <ProtectedRoute allowedRoles={["COUNSELOR", "ADMIN"]}>
              <GroupSessionView />
            </ProtectedRoute>
          }
        />

        <Route
          path="referrals"
          element={
            <ProtectedRoute allowedRoles={["COUNSELOR", "ADMIN"]}>
              <Referrals />
            </ProtectedRoute>
          }
        />
        <Route
          path="referrals/:id"
          element={
            <ProtectedRoute allowedRoles={["COUNSELOR", "ADMIN"]}>
              <ReferralView />
            </ProtectedRoute>
          }
        />

        <Route
          path="survey"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <Survey />
            </ProtectedRoute>
          }
        />

        <Route
          path="my-counseling"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <MyCounseling />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-counseling/:id"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <MyCounselingView />
            </ProtectedRoute>
          }
        />

        <Route
          path="my-referrals"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <MyReferrals />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-referrals/:id"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <MyReferralView />
            </ProtectedRoute>
          }
        />
        <Route
          path="get-support"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <GetSupport />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
