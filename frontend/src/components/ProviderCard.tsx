"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export interface ProviderOut {
  id: number;
  name: string;
  enabled: boolean;
  capabilities: string[];
  connected: boolean;
  masked_key: string | null;
}

export interface ProviderCatalogEntry {
  name: string;
  label: string;
  modelsHint: string;
  capabilities: string[];
}

export function ProviderCard({
  entry,
  provider,
  onChange,
}: {
  entry: ProviderCatalogEntry;
  provider: ProviderOut | undefined;
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connected = provider?.connected ?? false;

  async function save() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/providers", { name: entry.name, api_key: keyInput, capabilities: entry.capabilities });
      setKeyInput("");
      setTestResult(null);
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the key.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!provider) return;
    setTestResult(null);
    try {
      const result = await api.post<{ ok: boolean; message: string }>(`/providers/${provider.id}/test`);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof ApiError ? err.message : "Test failed." });
    }
  }

  async function disconnect() {
    if (!provider) return;
    await api.del(`/providers/${provider.id}`);
    setTestResult(null);
    onChange();
  }

  return (
    <div className="tr7-card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[9px] border flex items-center justify-center" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
            <span className="tr7-mono text-[11px]" style={{ color: connected ? "var(--accent)" : "var(--text-3)" }}>
              {entry.label[0]}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[13.5px] font-semibold" style={{ color: connected ? "var(--text)" : "var(--text-2)" }}>{entry.label}</span>
            <span className="text-[11.5px]" style={{ color: connected ? "var(--text-2)" : "var(--text-3)" }}>
              {connected ? entry.modelsHint : "No API key added"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? "var(--positive)" : "var(--border-2)" }} />
            <span className="text-xs" style={{ color: "var(--text-3)" }}>{connected ? "Connected" : "Not connected"}</span>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="tr7-btn-ghost cursor-pointer !py-1.5 !px-3.5 text-xs"
            style={{ background: connected ? "transparent" : "var(--surface-2)" }}
          >
            {expanded ? "Hide" : connected ? "Manage" : "Connect"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2.5 pt-1.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
          <div className="flex gap-2.5 items-center">
            <div className="flex-1 rounded-[10px] border px-3.5 py-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
              {provider?.masked_key && !keyInput ? (
                <span className="tr7-mono text-[12.5px]" style={{ color: "var(--text-2)" }}>{provider.masked_key}</span>
              ) : (
                <input
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={`Paste your ${entry.label} API key`}
                  type="password"
                  className="w-full bg-transparent outline-none tr7-mono text-[12.5px]"
                  style={{ color: "var(--text)" }}
                />
              )}
            </div>
            <button onClick={test} disabled={!provider} className="tr7-btn-ghost cursor-pointer !py-2.5 disabled:opacity-40" style={{ background: "var(--surface-2)" }}>
              Test
            </button>
            <button onClick={save} disabled={saving || !keyInput.trim()} className="tr7-btn-primary cursor-pointer disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {testResult && (
            <span className="text-xs" style={{ color: testResult.ok ? "var(--positive)" : "var(--danger)" }}>{testResult.message}</span>
          )}
          {error && <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>}

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {entry.capabilities.map((cap) => (
                <span key={cap} className="text-[11px] rounded-full border px-2.5 py-1" style={{ color: "var(--text-2)", background: "var(--bg)", borderColor: "var(--border)" }}>
                  {cap}
                </span>
              ))}
            </div>
            {provider && (
              <button onClick={disconnect} className="text-xs cursor-pointer bg-transparent border-none" style={{ color: "var(--danger)" }}>
                Remove key
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
