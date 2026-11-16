import { AdminContext } from "react-admin";
import { Box, Button } from "@mui/material";
import { useEffect, useState } from "react";

import { appConfig } from "./config";
import { createDataProvider } from "./dataProvider";
import { WorkflowConsole } from "./WorkflowConsole";
import { RunHistory } from "./RunHistory";

const dataProvider = createDataProvider(appConfig.apiBaseUrl);

export function App() {
  const [view, setView] = useState<"run" | "history">(
    new URLSearchParams(window.location.search).get("view") === "history" ? "history" : "run",
  );
  useEffect(() => {
    const onPopState = () => setView(new URLSearchParams(window.location.search).get("view") === "history" ? "history" : "run");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (next: "run" | "history") => {
    const query = new URLSearchParams(window.location.search);
    if (next === "history") query.set("view", "history");
    else query.delete("view");
    window.history.pushState(null, "", `${window.location.pathname}${query.size ? `?${query}` : ""}`);
    setView(next);
  };
  return (
    <AdminContext dataProvider={dataProvider}>
      <Box aria-label="Operator console" sx={{ maxWidth: 1120, mx: "auto", px: 3, pt: 2, display: "flex", gap: 1 }} component="nav">
        <Button variant={view === "run" ? "contained" : "text"} onClick={() => navigate("run")}>Run workflow</Button>
        <Button variant={view === "history" ? "contained" : "text"} onClick={() => navigate("history")}>Previous runs</Button>
        <Button href="/automation">Automation</Button>
      </Box>
      {view === "run" ? <WorkflowConsole dataProvider={dataProvider} /> : (
        <Box component="main" sx={{ maxWidth: 1120, mx: "auto", p: 3 }}><RunHistory dataProvider={dataProvider} /></Box>
      )}
    </AdminContext>
  );
}
