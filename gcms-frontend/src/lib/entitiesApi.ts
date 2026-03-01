import { postJSON } from "./api";

export type Role =
  | "ADMIN"
  | "COUNSELOR"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

export type User = {
  id: number;
  fname: string;
  mname?: string;
  lname: string;
  email: string;
  role: Role;
  collegeId?: number;
  yearLevelId?: number;
};

export type College = { id: number; name: string };
export type AcademicYear = { id: number; name: string; isActive: boolean };
export type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

export type CounselingCase = {
  id: number;
  studentId: number;
  counselorUserId?: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  date: string;
  status: "Pending" | "Ongoing" | "Completed";
  notes?: string;
  createdAt: string;
};

export type Referral = {
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate: string;
  reason: string;
  notes?: string;
  status: "New" | "Reviewed" | "Closed";
  createdAt: string;
};

export type ReferralLog = {
  id: number;
  referralId: number;
  createdByUserId: number;
  actionDate: string;
  actionType: "Follow-up" | "Meeting" | "Phone Call" | "Resolved" | "Other";
  note: string;
};

export type GroupSession = {
  id: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  counselorUserId: number;
  date: string;
  location: string;
  topic: string;
  notes?: string;
  attachment?: string;
  createdAt: string;
};

export type GroupSessionMember = {
  id: number;
  groupSessionId: number;
  studentUserId: number;
};

export async function fetchEntitiesBootstrap() {
  return postJSON<{
    ok: boolean;
    users: User[];
    colleges: College[];
    academicYears: AcademicYear[];
    yearLevels: YearLevel[];
  }>("/entities_bootstrap.php", {});
}

export async function listCounselingCases() {
  return postJSON<{ ok: boolean; cases: CounselingCase[] }>("/counseling_api.php", {
    action: "list",
  });
}

export async function getCounselingCase(id: number) {
  return postJSON<{ ok: boolean; item: CounselingCase }>("/counseling_api.php", {
    action: "get",
    id,
  });
}

export async function createCounselingCase(payload: {
  studentId: number;
  counselorUserId?: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  date: string;
  status?: CounselingCase["status"];
  notes?: string;
}) {
  return postJSON<{ ok: boolean; id: number; cases: CounselingCase[] }>(
    "/counseling_api.php",
    { action: "create", ...payload },
  );
}

export async function updateCounselingCase(payload: {
  id: number;
  status: CounselingCase["status"];
  notes?: string;
}) {
  return postJSON<{ ok: boolean; cases: CounselingCase[] }>("/counseling_api.php", {
    action: "update",
    ...payload,
  });
}

export async function listReferrals() {
  return postJSON<{ ok: boolean; referrals: Referral[] }>("/referrals_api.php", {
    action: "list",
  });
}

export async function getReferral(id: number) {
  return postJSON<{ ok: boolean; item: Referral }>("/referrals_api.php", {
    action: "get",
    id,
  });
}

export async function createReferral(payload: {
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate: string;
  reason: string;
  notes?: string;
  status?: Referral["status"];
}) {
  return postJSON<{ ok: boolean; id: number; referrals: Referral[] }>(
    "/referrals_api.php",
    { action: "create", ...payload },
  );
}

export async function updateReferral(payload: {
  id: number;
  status: Referral["status"];
  notes?: string;
}) {
  return postJSON<{ ok: boolean; referrals: Referral[] }>("/referrals_api.php", {
    action: "update",
    ...payload,
  });
}

export async function listReferralLogs(referralId: number) {
  return postJSON<{ ok: boolean; logs: ReferralLog[] }>("/referral_logs_api.php", {
    action: "list",
    referralId,
  });
}

export async function createReferralLog(payload: {
  referralId: number;
  createdByUserId: number;
  actionDate: string;
  actionType: ReferralLog["actionType"];
  note: string;
}) {
  return postJSON<{ ok: boolean; id: number; logs: ReferralLog[] }>(
    "/referral_logs_api.php",
    { action: "create", ...payload },
  );
}

export async function deleteReferralLog(payload: { id: number; referralId?: number }) {
  return postJSON<{ ok: boolean; logs: ReferralLog[] }>("/referral_logs_api.php", {
    action: "delete",
    ...payload,
  });
}

export async function listGroupSessions() {
  return postJSON<{
    ok: boolean;
    sessions: GroupSession[];
    members: GroupSessionMember[];
  }>("/group_sessions_api.php", { action: "list" });
}

export async function getGroupSession(id: number) {
  return postJSON<{
    ok: boolean;
    item: GroupSession;
    members: GroupSessionMember[];
  }>("/group_sessions_api.php", { action: "get", id });
}

export async function createGroupSession(payload: {
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  counselorUserId: number;
  date: string;
  location: string;
  topic: string;
  notes?: string;
  attachment?: string;
  studentIds: number[];
}) {
  return postJSON<{
    ok: boolean;
    sessions: GroupSession[];
    members: GroupSessionMember[];
  }>("/group_sessions_api.php", { action: "create", ...payload });
}

export async function removeGroupSessionMember(payload: {
  memberId: number;
  sessionId?: number;
}) {
  return postJSON<{
    ok: boolean;
    members: GroupSessionMember[];
  }>("/group_sessions_api.php", { action: "remove_member", ...payload });
}
