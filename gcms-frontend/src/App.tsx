import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
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
import Reports from "./pages/Reports";

import Referrals from "./pages/Referrals";
import ReferralView from "./pages/ReferralView";

import Survey from "./pages/Survey";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import StudentDashboard from "./pages/StudentDashboard";
import Dashboard from "./pages/Dashboard";
import MyCounseling from "./pages/MyCounseling";
import MyCounselingView from "./pages/MyCounselingView";
import MyStudentCircleView from "./pages/MyStudentCircleView";
import StudentCircleAttendance from "./pages/StudentCircleAttendance";
import MyReferrals from "./pages/MyReferrals";
import MyReferralView from "./pages/MyReferralView";
import Account from "./pages/Account";
import GetSupport from "./pages/GetSupport";

import CounselorDashboard from "./pages/CounselorDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";

import { useAuthStore } from "./store/authStore";
import { canUseGroupCounselling, canViewReports } from "./lib/staffPermissions";

function DashboardRouter() {
  const user = useAuthStore((s) => s.user);

  if (user?.role === "STUDENT") return <StudentDashboard />;
  if (user?.role === "STAFF") return <CounselorDashboard />;
  if (user?.role === "TEACHER" || user?.role === "NON_TEACHING_PERSONNEL") {
    return <TeacherDashboard />;
  }

  // ADMIN (and fallback)
  return <Dashboard />;
}

function AppHomeRedirect() {
  const user = useAuthStore((s) => s.user);
  const role = String(user?.role || "").toUpperCase();

  if (role === "STUDENT") return <Navigate to="my-counseling" replace />;
  if (role === "TEACHER" || role === "NON_TEACHING_PERSONNEL") {
    return <Navigate to="referrals" replace />;
  }
  return <Navigate to="dashboard" replace />;
}

function ReferralsRoute() {
  return <Referrals />;
}

function GroupSessionsRoute() {
  const user = useAuthStore((s) => s.user);

  if (!canUseGroupCounselling(user)) return <Navigate to="/403" replace />;
  return <GroupSessions />;
}

function GroupSessionViewRoute() {
  const user = useAuthStore((s) => s.user);

  if (!canUseGroupCounselling(user)) return <Navigate to="/403" replace />;
  return <GroupSessionView />;
}

function ReportsRoute() {
  const user = useAuthStore((s) => s.user);

  if (!canViewReports(user)) return <Navigate to="/403" replace />;
  return <Reports />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/student-circle-attendance/:id" element={<StudentCircleAttendance />} />
      <Route path="/403" element={<Forbidden />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute
            allowedRoles={[
              "ADMIN",
              "STAFF",
              "TEACHER",
              "NON_TEACHING_PERSONNEL",
              "STUDENT",
            ]}
          >
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AppHomeRedirect />} />
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
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "STAFF",
                "TEACHER",
                "NON_TEACHING_PERSONNEL",
                "STUDENT",
              ]}
            >
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
            <ProtectedRoute allowedRoles={["STAFF", "ADMIN"]}>
              <Counseling />
            </ProtectedRoute>
          }
        />
        <Route
          path="counseling/:id"
          element={
            <ProtectedRoute allowedRoles={["STAFF", "ADMIN"]}>
              <CounselingView />
            </ProtectedRoute>
          }
        />

        <Route
          path="group-sessions"
          element={
            <ProtectedRoute allowedRoles={["STAFF", "ADMIN"]}>
              <GroupSessionsRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="group-sessions/:id"
          element={
            <ProtectedRoute allowedRoles={["STAFF", "ADMIN"]}>
              <GroupSessionViewRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={["STAFF", "ADMIN"]}>
              <ReportsRoute />
            </ProtectedRoute>
          }
        />

        <Route
          path="referrals"
          element={
            <ProtectedRoute
              allowedRoles={[
                "STAFF",
                "TEACHER",
                "NON_TEACHING_PERSONNEL",
                "ADMIN",
              ]}
            >
              <ReferralsRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="referrals/:id"
          element={
            <ProtectedRoute
              allowedRoles={[
                "STAFF",
                "TEACHER",
                "NON_TEACHING_PERSONNEL",
                "ADMIN",
              ]}
            >
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
          path="my-counseling/student-circles/:id"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <MyStudentCircleView />
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

        <Route path="*" element={<AppHomeRedirect />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
