import type { components } from "./api";
import { ReportLink } from "./ReportLink";

export function PendingQueue({ items, asOf }: { items: components["schemas"]["PendingItem"][]; asOf: string }) {
  return <section aria-labelledby="pending-title">
    <h2 id="pending-title">Pending human queue ({items.length})</h2>
    <p>Current queue as of <time dateTime={asOf}>{asOf}</time>. Ages are measured at that time.</p>
    {items.length === 0 ? <p>No gates waiting on a human.</p> : <ul aria-label="Pending human gates">
      {[...items].sort((a, b) => Date.parse(a.waiting_since) - Date.parse(b.waiting_since) || a.issue - b.issue).map(item => <li key={item.issue}>
        <h3><ReportLink url={item.issue_url}>{item.title || `Issue #${item.issue}`}</ReportLink></h3>
        <p>{item.workflow} · {Math.max(0, item.age_hours).toLocaleString(undefined, { maximumFractionDigits: 1 })} hours · Issue #{item.issue}</p>
        <p>{item.reason || "No reason supplied."}</p>
        <small>Waiting since <time dateTime={item.waiting_since}>{item.waiting_since}</time> · Run {item.run}</small>
      </li>)}
    </ul>}
  </section>;
}
