import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { observe, type Tenant, type WindowFilter } from "./client";
import { HeadlineTiles } from "./HeadlineTiles";
import { ReportTimeline } from "./ReportTimeline";
import { PendingQueue } from "./PendingQueue";
import { Published } from "./Published";
import { JudgeStops } from "./JudgeStops";
import { Errors } from "./Errors";

export function automationPath(org: string, space: string) {
  return `/orgs/${encodeURIComponent(org)}/spaces/${encodeURIComponent(space)}/automation`;
}

export function AutomationView({ org, space }: Tenant) {
  const tenant = { org, space };
  const [window, setWindow] = useState<WindowFilter>({});
  const [selected, setSelected] = useState<string>();
  const spaces = useQuery({ queryKey: ["observe", org, "spaces"], queryFn: ({ signal }) => observe.spaces(org, signal) });
  const reports = useInfiniteQuery({
    queryKey: ["observe", org, space, "reports", window], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => observe.reports(tenant, window, pageParam, signal),
    getNextPageParam: page => page.next_cursor ?? undefined,
  });
  const items = [...new Map((reports.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()];
  const reportId = selected ?? items[0]?.id;
  const report = useQuery({ queryKey: ["observe", org, space, "report", reportId], queryFn: ({ signal }) => observe.report(tenant, reportId!, signal), enabled: !!reportId });
  const pending = useQuery({ queryKey: ["observe", org, space, "pending"], queryFn: ({ signal }) => observe.pending(tenant, signal), refetchInterval: 60_000 });
  return <main className="automation">
    <header><a href="/automation">Organisations</a><h1>Automation</h1><p>{org} / {space} · Read-only</p>
      <label>Space <select aria-label="Space" value={space} onChange={event => { location.assign(automationPath(org, event.target.value)); }}>
        {!spaces.data?.items.some(item => item.id === space) && <option value={space}>{space}</option>}
        {spaces.data?.items.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
      </select></label>
      {spaces.error && <p role="alert">Spaces unavailable: {spaces.error.message}</p>}
    </header>
    <form className="observe-filters" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const from = String(values.get("from") || ""); const to = String(values.get("to") || "");
      setWindow({ from: from ? `${from}T00:00:00Z` : undefined, to: to ? `${to}T23:59:59Z` : undefined });
      setSelected(undefined);
    }}>
      <label>From (UTC) <input name="from" type="date" /></label>
      <label>To (UTC) <input name="to" type="date" /></label>
      <button type="submit">Filter reports</button>
    </form>
    <div className="observe-columns"><aside>
      {reports.isPending && <p role="status">Loading reports…</p>}
      {reports.error && <p role="alert">Reports unavailable: {reports.error.message} <button onClick={() => void reports.refetch()}>Retry reports</button></p>}
      {reports.data && <ReportTimeline items={items} selected={reportId} onSelect={setSelected} />}
      {reports.hasNextPage && <button disabled={reports.isFetchingNextPage} onClick={() => void reports.fetchNextPage()}>Load older reports</button>}
    </aside><div>
      {reportId && report.isPending && <p role="status">Loading report…</p>}
      {report.error && <p role="alert">Report unavailable: {report.error.message} <button onClick={() => void report.refetch()}>Retry report</button></p>}
      {report.data && <>
        <h2>Report {reportId}</h2><p>{report.data.window.from} to {report.data.window.to}</p>
        <HeadlineTiles headline={report.data.headline} tenant={tenant} window={window} />
        <Published items={report.data.published} /><JudgeStops judge={report.data.judge} /><Errors items={report.data.errors} />
      </>}
    </div></div>
    {pending.isPending && <p role="status">Loading current pending queue…</p>}
    {pending.error && <p role="alert">Current queue unavailable: {pending.error.message} <button onClick={() => void pending.refetch()}>Retry queue</button></p>}
    {pending.data && !pending.error && <PendingQueue items={pending.data.items} asOf={pending.data.as_of} />}
  </main>;
}

export function AutomationHome() {
  const orgs = useQuery({ queryKey: ["observe", "orgs"], queryFn: ({ signal }) => observe.orgs(signal) });
  return <main className="automation"><h1>Automation</h1><p>Choose an organisation and space.</p>
    {orgs.isPending && <p role="status">Loading organisations…</p>}
    {orgs.error && <p role="alert">Organisations unavailable: {orgs.error.message}</p>}
    {orgs.data?.items.length === 0 && <p>No organisations available.</p>}
    {orgs.data?.items.map(org => <OrgSpaces key={org.id} org={org.id} />)}
  </main>;
}
function OrgSpaces({ org }: { org: string }) {
  const spaces = useQuery({ queryKey: ["observe", org, "spaces"], queryFn: ({ signal }) => observe.spaces(org, signal) });
  return <section><h2>{org}</h2>{spaces.isPending && <p>Loading spaces…</p>}{spaces.error && <p role="alert">{spaces.error.message}</p>}
    {spaces.data?.items.length === 0 && <p>No spaces available.</p>}
    <ul>{spaces.data?.items.map(space => <li key={space.id}><a href={automationPath(org, space.id)}>{space.id}</a>{space.latest_report_at && <small> · Latest report {space.latest_report_at}</small>}</li>)}</ul>
  </section>;
}
