import { postJSON } from "./api";

export type Role =
  | "ADMIN"
  | "STAFF"
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
  courseId?: number | null;
  courseName?: string | null;
  section?: string | null;
};

export type College = { id: number; name: string };
export type Course = { id: number; name: string; collegeId: number };
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
  STAFFUserId?: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  date: string;
  time?: string | null;
  status: "Pending" | "Ongoing" | "Completed";
  reason?: string;
  notes?: string;
  actionTaken?: string;
  followUpDate?: string;
  createdAt: string;
};

export type Referral = {
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate?: string | null;
  referredTime?: string | null;
  reason: string;
  notes?: string;
  status:
    | "Pending"
    | "Approved"
    | "Complete"
    | "New"
    | "Reviewed"
    | "Ongoing"
    | "Closed";
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
  courseId?: number | null;
  yearLevelId: number;
  STAFFUserId: number;
  date: string;
  time?: string | null;
  location: string;
  topic: string;
  facilitatorUserId?: number | null;
  facilitator?: string;
  notes?: string;
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
    courses: Course[];
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
  STAFFUserId?: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  date: string;
  time?: string;
  status?: CounselingCase["status"];
  reason?: string;
  notes?: string;
  actionTaken?: string;
  followUpDate?: string;
}) {
  return postJSON<{ ok: boolean; id: number; cases: CounselingCase[] }>(
    "/counseling_api.php",
    { action: "create", ...payload },
  );
}

export async function updateCounselingCase(payload: {
  id: number;
  status: CounselingCase["status"];
  time?: string;
  reason?: string;
  notes?: string;
  actionTaken?: string;
  followUpDate?: string;
}) {
  return postJSON<{ ok: boolean; cases: CounselingCase[] }>("/counseling_api.php", {
    action: "update",
    ...payload,
  });
}

export async function listReferrals() {
  return postJSON<{ ok: boolean; referrals: Referral[]; reasonOptions?: string[] }>(
    "/referrals_api.php",
    {
      action: "list",
    },
  );
}

export async function listReferralReasonOptions() {
  return postJSON<{ ok: boolean; reasonOptions: string[] }>("/referrals_api.php", {
    action: "list_reasons",
  });
}

export async function getReferral(id: number) {
  return postJSON<{ ok: boolean; item: Referral; reasonOptions?: string[] }>(
    "/referrals_api.php",
    {
      action: "get",
      id,
    },
  );
}

export async function createReferral(payload: {
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate?: string;
  referredTime?: string;
  reason: string;
  notes?: string;
  customReasons?: string[];
  status?: Referral["status"];
}) {
  return postJSON<{ ok: boolean; id: number; referrals: Referral[]; reasonOptions?: string[] }>(
    "/referrals_api.php",
    { action: "create", ...payload },
  );
}

export async function updateReferral(payload: {
  id: number;
  status: Referral["status"];
  notes?: string;
  referredDate?: string;
  referredTime?: string;
}) {
  return postJSON<{ ok: boolean; referrals: Referral[]; reasonOptions?: string[] }>(
    "/referrals_api.php",
    {
      action: "update",
      ...payload,
    },
  );
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
  courseId: number;
  yearLevelId: number;
  STAFFUserId: number;
  date: string;
  time: string;
  location: string;
  topic: string;
  facilitatorUserId: number;
  facilitator: string;
  notes?: string;
  studentIds: number[];
}) {
  return postJSON<{
    ok: boolean;
    sessions: GroupSession[];
    members: GroupSessionMember[];
  }>("/group_sessions_api.php", {
    action: "create",
    ...payload,
    counselorUserId: payload.STAFFUserId,
  });
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
