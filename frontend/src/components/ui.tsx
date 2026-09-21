export function Stars({ count }: { count: number }) {
  return (
    <span className="text-[13px]" style={{ color: count > 1 ? "var(--accent)" : "var(--text-3)" }}>
      {"★".repeat(count)}
      {"☆".repeat(5 - count)}
    </span>
  );
}

const PILL_COLORS = {
  positive: { color: "var(--positive)", background: "var(--positive-bg)" },
  danger: { color: "var(--danger)", background: "var(--danger-bg)" },
  pending: { color: "var(--pending)", background: "var(--pending-bg)" },
  neutral: { color: "var(--text-2)", background: "var(--bg)" },
} as const;

export function Pill({ tone, children }: { tone: keyof typeof PILL_COLORS; children: React.ReactNode }) {
  return (
    <span className="tr7-pill" style={PILL_COLORS[tone]}>
      {children}
    </span>
  );
}

export function riskTone(risk: "LOW" | "MED" | "HIGH") {
  return risk === "LOW" ? "positive" : risk === "MED" ? "pending" : "danger";
}
