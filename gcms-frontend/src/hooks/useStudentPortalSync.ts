import { useEffect, useState } from "react";
import {
  fetchEntitiesBootstrap,
  listCounselingCases,
  listGroupSessions,
  listReferrals,
} from "../lib/entitiesApi";
import { useAuthStore } from "../store/authStore";
import {
  useGCMS,
  type CounselingCase as LegacyCounselingCase,
  type GroupSession as LegacyGroupSession,
  type GroupSessionMember as LegacyGroupSessionMember,
  type Referral as LegacyReferral,
  type User as LegacyUser,
} from "../store/gcmsStore";

function toLegacyUserType(role: string): "admin" | "counselor" | "student" {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "ADMIN") return "admin";
  if (normalized === "STUDENT") return "student";
  return "counselor";
}

function toLegacyCounselingStatus(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "ongoing") return "ongoing" as const;
  if (normalized === "completed") return "done" as const;
  if (normalized === "cancelled") return "cancelled" as const;
  return "pending" as const;
}

function toLegacyReferralStatus(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (
    normalized === "approved" ||
    normalized === "ongoing" ||
    normalized === "reviewed"
  ) {
    return "approved" as const;
  }
  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "resolved"
  ) {
    return "complete" as const;
  }
  return "pending" as const;
}

export default function useStudentPortalSync() {
  const authUser = useAuthStore((s) => s.user);
  const {
    setCurrentUser,
    setUsers,
    setCounseling,
    setReferrals,
    setGroupSessions,
    setGroupSessionMembers,
  } = useGCMS();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    if (!authUser?.id) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    setLoading(true);

    Promise.allSettled([
      fetchEntitiesBootstrap(),
      listCounselingCases(),
      listReferrals(),
      listGroupSessions(),
    ])
      .then(([bootstrapRes, casesRes, referralsRes, sessionsRes]) => {
        if (!alive) return;

        if (bootstrapRes.status === "fulfilled") {
          const legacyUsers: LegacyUser[] = (bootstrapRes.value.users ?? []).map((user) => ({
            users_id: user.id,
            user_type: toLegacyUserType(user.role),
            fname: user.fname,
            mname: user.mname,
            lname: user.lname,
            email: user.email,
            collegeId: user.collegeId,
            courseId: user.courseId,
            courseName: user.courseName,
            yearLevelId: user.yearLevelId,
            section: user.section,
          }));

          setUsers(() => legacyUsers);

          const current = legacyUsers.find((user) => user.users_id === authUser.id);
          if (current) {
            setCurrentUser(current);
          }
        }

        if (casesRes.status === "fulfilled") {
          const legacyCases: LegacyCounselingCase[] = (casesRes.value.cases ?? []).map((item) => ({
            counseling_id: item.id,
            student_user_id: item.studentId,
            counselor_user_id:
              (item as { STAFFUserId?: number }).STAFFUserId ??
              (item as { counselorUserId?: number }).counselorUserId ??
              null,
            counseling_date: item.date,
            counseling_time: item.time ?? undefined,
            status: toLegacyCounselingStatus(item.status),
            reason:
              typeof (item as { reason?: unknown }).reason === "string"
                ? String((item as { reason?: unknown }).reason)
                : undefined,
            notes: item.notes,
          }));

          setCounseling(() => legacyCases);
        }

        if (referralsRes.status === "fulfilled") {
          const legacyReferrals: LegacyReferral[] = (referralsRes.value.referrals ?? []).map((item) => ({
            referral_id: item.id,
            student_user_id: item.studentId,
            referred_by_user_id: item.referredByUserId,
            referred_date: item.referredDate ?? undefined,
            referred_time: item.referredTime ?? undefined,
            reason: item.reason,
            status: toLegacyReferralStatus(item.status),
            notes: item.notes,
            created_at: item.createdAt,
          }));

          setReferrals(() => legacyReferrals);
        }

        if (sessionsRes.status === "fulfilled") {
          const legacySessions: LegacyGroupSession[] = (sessionsRes.value.sessions ?? []).map((item) => ({
            group_session_id: item.id,
            counselor_user_id:
              (item as { STAFFUserId?: number }).STAFFUserId ??
              (item as { counselorUserId?: number }).counselorUserId ??
              0,
            session_date: item.date,
            session_time: item.time ?? undefined,
            location: item.location,
            notes: item.notes,
            topic: item.topic,
            facilitator: item.facilitator,
            created_at: item.createdAt,
          }));
          const legacyMembers: LegacyGroupSessionMember[] = (sessionsRes.value.members ?? []).map((item) => ({
            group_session_id: item.groupSessionId,
            student_user_id: item.studentUserId,
          }));

          setGroupSessions(() => legacySessions);
          setGroupSessionMembers(() => legacyMembers);
        }

        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [
    authUser?.id,
    setCounseling,
    setCurrentUser,
    setGroupSessionMembers,
    setGroupSessions,
    setReferrals,
    setUsers,
  ]);

  return { loading };
}
