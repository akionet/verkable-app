import { Box, Tab, Tabs } from "@mui/material";
import { useState } from "react";

import type { RunLogEntry } from "./dataProvider";
import { BoundedPre } from "./BoundedPre";

export function RunLogPanel({ entries }: { entries: RunLogEntry[] }) {
  const [tab, setTab] = useState<"timeline" | "raw">("timeline");
  return (
    <Box sx={{ mt: 2 }}>
      <Tabs value={tab} onChange={(_event, value: "timeline" | "raw") => setTab(value)}>
        <Tab label="Timeline" value="timeline" />
        <Tab label="Raw log" value="raw" />
      </Tabs>
      {tab === "timeline" ? (
        entries.length ? (
          <ol aria-label="Persisted run timeline">
            {entries.map((entry) => (
              <li key={entry.seq}>
                {entry.seq}. {entry.step ? `${entry.step}: ` : ""}{entry.status}
              </li>
            ))}
          </ol>
        ) : <p>No persisted log entries.</p>
      ) : (
        <BoundedPre label="Raw persisted run log" testId="raw-run-log" value={{ entries }} />
      )}
    </Box>
  );
}
