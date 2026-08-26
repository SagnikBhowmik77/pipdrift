import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset your password · Pipdrift" };

export default function ForgotPasswordPage() {
  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-50">
        Reset your password
      </h1>
      <p className="mb-7 text-slate-400">
        We&apos;ll email you a link that works once.
      </p>
      <ForgotForm />
    </main>
  );
}
