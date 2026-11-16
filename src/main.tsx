import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const AutomationRoute = lazy(() => import("./automation/AutomationRoute").then(module => ({ default: module.AutomationRoute })));
const isAutomation = location.pathname === "/automation" || location.pathname.startsWith("/orgs/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p role="status">Loading…</p>}>{isAutomation ? <AutomationRoute /> : <App />}</Suspense>
  </StrictMode>,
);
