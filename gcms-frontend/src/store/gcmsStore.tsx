import { create } from "zustand";

export type UserType = "admin" | "counselor" | "student";

export type User = {
  users_id: number;
  user_type: UserType;
  fname: string;
  mname?: string;
  lname: string;
  email?: string;
};

export type CounselingStatus = "pending" | "ongoing" | "done" | "cancelled";

export type CounselingCase = {
  counseling_id: number;
  student_user_id: number;
  counselor_user_id: number;
  counseling_date: string; // yyyy-mm-dd
  status: CounselingStatus;
  reason?: string;
  notes?: string;
};

// ===== Referrals
export type ReferralStatus = "pending" | "reviewed" | "resolved";

export type Referral = {
  referral_id: number;
  student_user_id: number;
  referred_by_user_id: number;
  referred_date: string; // yyyy-mm-dd
  reason: string;
  status: ReferralStatus;
  notes?: string;
};

// ===== Group Sessions
export type GroupSession = {
  group_session_id: number;
  counselor_user_id: number;
  session_date: string; // yyyy-mm-dd
  location?: string;
  notes?: string;
};

export type GroupSessionMember = {
  group_session_id: number;
  student_user_id: number;
};

// ===== Survey
export type SurveyInterview = {
  survey_interview_id: number;
  student_user_id: number;
  academic_year?: string;
  submitted_at?: string; // ISO when submitted
};

type StoreState = {
  // auth
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  loginAs: (role: UserType) => void;
  logout: () => void;

  // data
  users: User[];
  setUsers: (updater: (prev: User[]) => User[]) => void;

  counseling: CounselingCase[];
  setCounseling: (
    updater: (prev: CounselingCase[]) => CounselingCase[],
  ) => void;

  referrals: Referral[];
  setReferrals: (updater: (prev: Referral[]) => Referral[]) => void;

  group_sessions: GroupSession[];
  setGroupSessions: (updater: (prev: GroupSession[]) => GroupSession[]) => void;

  group_session_members: GroupSessionMember[];
  setGroupSessionMembers: (
    updater: (prev: GroupSessionMember[]) => GroupSessionMember[],
  ) => void;

  survey_interviews: SurveyInterview[];
  setSurveyInterviews: (
    updater: (prev: SurveyInterview[]) => SurveyInterview[],
  ) => void;
};

export const useGCMS = create<StoreState>((set, get) => ({
  // ======= DEMO USERS =======
  users: [
    {
      users_id: 1,
      user_type: "admin",
      fname: "System",
      lname: "Admin",
      email: "admin@gcms.demo",
    },
    {
      users_id: 2,
      user_type: "counselor",
      fname: "Maria",
      lname: "Santos",
      email: "maria@gcms.demo",
    },
    {
      users_id: 3,
      user_type: "counselor",
      fname: "John",
      lname: "Reyes",
      email: "john@gcms.demo",
    },
    {
      users_id: 4,
      user_type: "student",
      fname: "Ana",
      lname: "Dela Cruz",
      email: "ana@gcms.demo",
    },
    {
      users_id: 5,
      user_type: "student",
      fname: "Mark",
      lname: "Lopez",
      email: "mark@gcms.demo",
    },
  ],
  setUsers: (updater) => set((s) => ({ users: updater(s.users) })),

  // ======= DEMO COUNSELING =======
  counseling: [
    {
      counseling_id: 1,
      student_user_id: 4,
      counselor_user_id: 2,
      counseling_date: "2026-02-15",
      status: "ongoing",
      reason: "Academic stress",
      notes: "Follow up next week.",
    },
    {
      counseling_id: 2,
      student_user_id: 5,
      counselor_user_id: 3,
      counseling_date: "2026-02-14",
      status: "done",
      reason: "Career guidance",
      notes: "Recommended track options.",
    },
  ],
  setCounseling: (updater) =>
    set((s) => ({ counseling: updater(s.counseling) })),

  // ======= DEMO REFERRALS =======
  referrals: [
    {
      referral_id: 1,
      student_user_id: 4,
      referred_by_user_id: 1,
      referred_date: "2026-02-10",
      reason: "Frequent absences",
      status: "pending",
      notes: "Please check in with the student.",
    },
    {
      referral_id: 2,
      student_user_id: 4,
      referred_by_user_id: 2,
      referred_date: "2026-01-25",
      reason: "Emotional distress observed",
      status: "reviewed",
      notes: "Advised counseling session.",
    },
  ],
  setReferrals: (updater) => set((s) => ({ referrals: updater(s.referrals) })),

  // ======= DEMO GROUP SESSIONS =======
  group_sessions: [
    {
      group_session_id: 1,
      counselor_user_id: 2,
      session_date: "2026-02-20",
      location: "Guidance Office Room 2",
      notes: "Stress management session",
    },
    {
      group_session_id: 2,
      counselor_user_id: 3,
      session_date: "2026-02-28",
      location: "Hall A",
      notes: "Career orientation",
    },
  ],
  setGroupSessions: (updater) =>
    set((s) => ({ group_sessions: updater(s.group_sessions) })),

  group_session_members: [{ group_session_id: 1, student_user_id: 4 }],
  setGroupSessionMembers: (updater) =>
    set((s) => ({ group_session_members: updater(s.group_session_members) })),

  // ======= DEMO SURVEY INTERVIEWS =======
  survey_interviews: [
    {
      survey_interview_id: 1,
      student_user_id: 4,
      academic_year: "2025-2026",
      // submitted_at: "2026-02-12T10:30:00.000Z",
    },
  ],
  setSurveyInterviews: (updater) =>
    set((s) => ({ survey_interviews: updater(s.survey_interviews) })),

  // ======= AUTH =======
  currentUser: null,
  setCurrentUser: (u) => set({ currentUser: u }),

  loginAs: (role) => {
    const { users } = get();
    const u = users.find((x) => x.user_type === role) ?? null;
    set({ currentUser: u });
  },

  logout: () => set({ currentUser: null }),
}));

export function fullName(u: User) {
  return [u.fname, u.mname, u.lname].filter(Boolean).join(" ");
}
