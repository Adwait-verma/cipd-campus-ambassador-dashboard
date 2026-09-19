"use client";

import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!token) return setError("This password-reset link is incomplete.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not reset your password.");
      setMessage(data.message);
      setPassword("");
      setConfirmation("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
      <h1 className="text-3xl font-bold text-[#202629]">Choose a new password</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">The link can be used once and expires 30 minutes after it was requested.</p>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">New password
          <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Confirm password
          <input type="password" required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
        </label>
        <button disabled={loading || Boolean(message)} className="w-full rounded-xl bg-[#202629] py-3 font-semibold text-white disabled:opacity-60">{loading ? "Saving..." : "Save new password"}</button>
      </form>
      {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-[#238C89] hover:underline">Back to sign in</Link>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7F7] px-6 py-12">
      <div className="w-full max-w-md">
        <BrandLogo className="mx-auto w-40" />
        <Suspense fallback={<p className="mt-8 text-center text-gray-600">Loading reset form...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
