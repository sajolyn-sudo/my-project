export type Role =
  | "ADMIN"
  | "COUNSELOR"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

export type AuthUser = {
  id: number;
  fname: string;
  lname: string;
  email: string;
  role: Role;
  profilePhoto?: string;
  collegeId?: number;
  yearLevelId?: number;
};
