export type AuthFormState = {
  status: "idle" | "error";
  errors: Partial<Record<"email" | "password" | "name" | "form", string>>;
};

export const EMPTY_AUTH_FORM_STATE: AuthFormState = { status: "idle", errors: {} };
