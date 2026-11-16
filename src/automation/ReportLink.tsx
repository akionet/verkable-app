import type { ReactNode } from "react";

export function ReportLink({ url, children }: { url?: string | null; children: ReactNode }) {
  let safe = false;
  try { const parsed = new URL(url ?? ""); safe = ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { /* Missing/relative links are displayed as text. */ }
  return safe ? <a href={url!} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>;
}
