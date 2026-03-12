export type UserRole = "MASTER" | "ADMIN";

export type JwtPayload = {
  sub: string;
  role: UserRole;
  email: string;
  exp: number;
};

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  email: string;
};

export type AppBindings = {
  Variables: {
    user: AuthenticatedUser;
  };
};
