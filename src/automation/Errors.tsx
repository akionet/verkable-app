import type { AutomationReport } from "./report";

export function Errors({ items }: { items: AutomationReport["errors"] }) {
  return <section><h2>Errors</h2>{items.length ? <ul>{items.map((item, index) => <li key={index}>
    <time dateTime={item.at}>{item.at}</time><p className="observe-error-text">{item.text}</p>
  </li>)}</ul> : <p>No errors recorded in this report window.</p>}</section>;
}
