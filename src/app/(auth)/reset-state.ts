export type ForgotFormState = {
  status: "idle" | "sent" | "error";
  /** Set only when no mail transport is configured, so the link is on screen. */
  devLink?: string;
  errors: Partial<Record<"email" | "form", string>>;
};

export const EMPTY_FORGOT_STATE: ForgotFormState = { status: "idle", errors: {} };

export type ResetFormState = {
  status: "idle" | "error";
  errors: Partial<Record<"password" | "confirm" | "form", string>>;
};

export const EMPTY_RESET_STATE: ResetFormState = { status: "idle", errors: {} };
