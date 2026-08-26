/**
 * Shared by the marketing forms and the enquiry actions. Kept out of
 * enquiries.ts because a "use server" module may only export async functions -
 * exporting a constant from one compiles fine and fails at runtime.
 */
export type EnquiryState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const EMPTY_ENQUIRY_STATE: EnquiryState = {
  status: "idle",
  message: null,
};
