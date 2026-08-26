export type AuthorityState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const EMPTY_AUTHORITY_STATE: AuthorityState = {
  status: "idle",
  message: null,
};
