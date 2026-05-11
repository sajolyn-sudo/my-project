import { create } from "zustand";

export type UserType = "admin" | "counselor" | "student";

export type User = {
  users_id: number;
  user_type: UserType;
  fname: string;
  mname?: string;
  lname: string;
  email?: string;
  collegeId?: number;
  courseId?: number | null;
  courseName?: string | null;
  yearLevelId?: number;
  section?: string | null;
};

export type CounselingStatus = "pending" | "ongoing" | "done" | "cancelled";

export type CounselingCase = {
  counseling_id: number;
  student_user_id: number;
  counselor_user_id?: number | null;
  counseling_date: string; // yyyy-mm-dd
  counseling_time?: string;
  status: CounselingStatus;
  reason?: string;
  notes?: string;
};

// ===== Referrals
export type ReferralStatus = "pending" | "approved" | "complete";

export type Referral = {
  referral_id: number;
  student_user_id: number;
  referred_by_user_id: number;
  referred_date?: string; // yyyy-mm-dd when approved/scheduled
  referred_time?: string;
  reason: string;
  status: ReferralStatus;
  notes?: string;
  created_at?: string;
};

// ===== Group Counselling
export type GroupSession = {
  group_session_id: number;
  counselor_user_id: number;
  facilitator_user_id?: number | null;
  session_date: string; // yyyy-mm-dd
  session_time?: string;
  location?: string;
  topic?: string;
  facilitator?: string;
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

const USERS_KEY = "gcms_store_users_v1";
const COUNSELING_KEY = "gcms_store_counseling_v1";
const REFERRALS_KEY = "gcms_store_referrals_v1";
const GROUP_SESSIONS_KEY = "gcms_store_group_sessions_v1";
const GROUP_SESSION_MEMBERS_KEY = "gcms_store_group_session_members_v1";
const SURVEY_INTERVIEWS_KEY = "gcms_store_survey_interviews_v1";
const CURRENT_USER_KEY = "gcms_store_current_user_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function remove(key: string) {
  localStorage.removeItem(key);
}

const DEFAULT_USERS: User[] = [
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
];

const DEFAULT_COUNSELING: CounselingCase[] = [
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
];

const DEFAULT_REFERRALS: Referral[] = [
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
    status: "approved",
    notes: "Advised counseling session.",
  },
];

const DEFAULT_GROUP_SESSIONS: GroupSession[] = [
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
];

const DEFAULT_GROUP_SESSION_MEMBERS: GroupSessionMember[] = [
  { group_session_id: 1, student_user_id: 4 },
];

const DEFAULT_SURVEY_INTERVIEWS: SurveyInterview[] = [
  {
    survey_interview_id: 1,
    student_user_id: 4,
    academic_year: "2025-2026",
  },
];

export const useGCMS = create<StoreState>((set, get) => ({
  // ======= USERS =======
  users: load<User[]>(USERS_KEY, DEFAULT_USERS),
  setUsers: (updater) =>
    set((s) => {
      const next = updater(s.users);
      save(USERS_KEY, next);
      return { users: next };
    }),

  // ======= COUNSELING =======
  counseling: load<CounselingCase[]>(COUNSELING_KEY, DEFAULT_COUNSELING),
  setCounseling: (updater) =>
    set((s) => {
      const next = updater(s.counseling);
      save(COUNSELING_KEY, next);
      return { counseling: next };
    }),

  // ======= REFERRALS =======
  referrals: load<Referral[]>(REFERRALS_KEY, DEFAULT_REFERRALS),
  setReferrals: (updater) =>
    set((s) => {
      const next = updater(s.referrals);
      save(REFERRALS_KEY, next);
      return { referrals: next };
    }),

  // ======= GROUP COUNSELLING =======
  group_sessions: load<GroupSession[]>(
    GROUP_SESSIONS_KEY,
    DEFAULT_GROUP_SESSIONS,
  ),
  setGroupSessions: (updater) =>
    set((s) => {
      const next = updater(s.group_sessions);
      save(GROUP_SESSIONS_KEY, next);
      return { group_sessions: next };
    }),

  group_session_members: load<GroupSessionMember[]>(
    GROUP_SESSION_MEMBERS_KEY,
    DEFAULT_GROUP_SESSION_MEMBERS,
  ),
  setGroupSessionMembers: (updater) =>
    set((s) => {
      const next = updater(s.group_session_members);
      save(GROUP_SESSION_MEMBERS_KEY, next);
      return { group_session_members: next };
    }),

  // ======= SURVEY =======
  survey_interviews: load<SurveyInterview[]>(
    SURVEY_INTERVIEWS_KEY,
    DEFAULT_SURVEY_INTERVIEWS,
  ),
  setSurveyInterviews: (updater) =>
    set((s) => {
      const next = updater(s.survey_interviews);
      save(SURVEY_INTERVIEWS_KEY, next);
      return { survey_interviews: next };
    }),

  // ======= AUTH =======
  currentUser: load<User | null>(CURRENT_USER_KEY, null),
  setCurrentUser: (u) => {
    if (u) save(CURRENT_USER_KEY, u);
    else remove(CURRENT_USER_KEY);
    set({ currentUser: u });
  },

  loginAs: (role) => {
    const { users } = get();
    const u = users.find((x) => x.user_type === role) ?? null;
    if (u) save(CURRENT_USER_KEY, u);
    else remove(CURRENT_USER_KEY);
    set({ currentUser: u });
  },

  logout: () => {
    remove(CURRENT_USER_KEY);
    set({ currentUser: null });
  },
}));

export function fullName(u: User) {
  return [u.fname, u.mname, u.lname].filter(Boolean).join(" ");
}
