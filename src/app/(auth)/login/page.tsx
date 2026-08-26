import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in · Pipdrift" };

export default function LoginPage() {
  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-50">
        Sign in
      </h1>
      <p className="mb-7 text-slate-400">
        Your buckets are where you left them.
      </p>
      <AuthForm mode="login" />
    </main>
  );
}
