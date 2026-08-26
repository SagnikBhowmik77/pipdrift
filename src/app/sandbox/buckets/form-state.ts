export type BucketFormState =
  | { status: "idle"; message: null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const EMPTY_BUCKET_FORM_STATE: BucketFormState = {
  status: "idle",
  message: null,
};
