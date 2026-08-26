import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      className="ml-auto"
    >
      <button
        type="submit"
        className="text-sm text-slate-500 transition hover:text-slate-300"
      >
        Sign out
      </button>
    </form>
  );
}
