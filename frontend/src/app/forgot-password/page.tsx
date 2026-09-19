"use client";

import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:8000/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not request a reset link.");
      setMessage(data.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not request a reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7F7] px-6 py-12">
      <div className="w-full max-w-md">
        <BrandLogo className="mx-auto w-40" />
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-bold text-[#202629]">Reset your password</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Enter your registered email. If the account exists, you will receive a single-use link valid for 30 minutes.
          </p>
          <form onSubmit={submit} className="mt-6">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Registered email
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
            </label>
            <button disabled={loading} className="mt-6 w-full rounded-xl bg-[#202629] py-3 font-semibold text-white disabled:opacity-60">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
          {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-[#238C89] hover:underline">Back to sign in</Link>
        </section>
      </div>
    </main>
  );
}
