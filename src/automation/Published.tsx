import type { AutomationReport } from "./report";
import { ReportLink } from "./ReportLink";

export function Published({ items }: { items: AutomationReport["published"] }) {
  return <section><h2>Published recipes</h2>{items.length ? <ul>{items.map((item, index) => <li key={`${item.run}-${index}`}>
    <h3><ReportLink url={item.url}>{item.title || item.identifier || item.run}</ReportLink></h3>
    <p><time dateTime={item.at}>{item.at}</time> · Decided by {item.decided_by}</p>
  </li>)}</ul> : <p>No recipes published in this report window.</p>}</section>;
}
