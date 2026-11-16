import type { components } from "./api";

export function ReportTimeline({ items, selected, onSelect }: { items: components["schemas"]["ReportIndexEntry"][]; selected?: string; onSelect: (id: string) => void }) {
  return <section><h2>Report timeline</h2>{items.length ? <ol aria-label="Report timeline">{items.map(item => <li key={item.id}>
    <button type="button" aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>{item.id}</button>
    <p><time dateTime={item.window.from}>{item.window.from}</time> to <time dateTime={item.window.to}>{item.window.to}</time></p>
    <small>{item.headline.published ?? "—"} published · {item.headline.decisions ?? "—"} decisions</small>
  </li>)}</ol> : <p>No reports in this window.</p>}</section>;
}
