import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AutomationHome, AutomationView } from "./AutomationView";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
export function AutomationRoute() {
  const match = location.pathname.match(/^\/orgs\/([^/]+)\/spaces\/([^/]+)\/automation\/?$/);
  let tenant: { org: string; space: string } | undefined;
  try { if (match) tenant = { org: decodeURIComponent(match[1]), space: decodeURIComponent(match[2]) }; } catch { /* Malformed route. */ }
  return <QueryClientProvider client={queryClient}>
    <nav className="observe-nav"><a href="/">Workflow console</a></nav>
    {tenant ? <AutomationView key={`${tenant.org}/${tenant.space}`} {...tenant} /> : location.pathname === "/automation" ? <AutomationHome /> : <main className="automation"><h1>Automation route not found</h1><a href="/automation">Choose a space</a></main>}
  </QueryClientProvider>;
}
