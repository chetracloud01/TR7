import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
