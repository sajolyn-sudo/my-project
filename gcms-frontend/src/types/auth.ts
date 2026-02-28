export type Role = "ADMIN" | "COUNSELOR" | "STUDENT";

export type AuthUser = {
  id: number;
  fname: string;
  lname: string;
  email: string;
  role: Role;
  collegeId?: number;
  yearLevelId?: number;
};
