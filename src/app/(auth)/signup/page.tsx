import { AuthForm } from "../auth-form";

export const metadata = { title: "Create account · Pipdrift" };

export default function SignupPage() {
  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-50">
        Create your account
      </h1>
      <p className="mb-7 text-slate-400">
        Three ETF buckets, set up with a balanced mix you can change any time.
      </p>
      <AuthForm mode="signup" />
    </main>
  );
}
