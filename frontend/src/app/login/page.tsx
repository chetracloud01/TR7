"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/login", { email, password });
      // Hard navigation so the (app) layout's server-side session check
      // sees the cookie the browser just received.
      window.location.href = "/predict";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--text)" }} data-theme="warm">
      <form onSubmit={onSubmit} className="w-[360px] flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <span className="tr7-display text-lg font-bold" style={{ color: "var(--accent-contrast)" }}>7</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="tr7-display text-xl font-bold">TR7</span>
            <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>Personal Ops</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: "var(--text-2)" }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[10px] border px-3.5 py-2.5 text-sm outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: "var(--text-2)" }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-[10px] border px-3.5 py-2.5 text-sm outline-none"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>

        {error && <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>}

        <button type="submit" disabled={loading} className="tr7-btn-primary cursor-pointer disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
