import { Alert, Box } from "@mui/material";

import { MAX_TRANSIENT_CHARS } from "./runModel";

export function BoundedPre({ value, label, testId }: {
  value: unknown;
  label: string;
  testId?: string;
}) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const truncated = text.length > MAX_TRANSIENT_CHARS;
  return <Box>
    <pre aria-label={label} data-testid={testId}>{text.slice(0, MAX_TRANSIENT_CHARS)}</pre>
    {truncated && <Alert severity="warning">Output truncated after {MAX_TRANSIENT_CHARS.toLocaleString()} characters.</Alert>}
  </Box>;
}
