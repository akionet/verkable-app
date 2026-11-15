import type { AutomationReport } from "./report";

export function JudgeStops({ judge }: { judge: AutomationReport["judge"] }) {
  return <section><h2>Judge stops</h2>
    <p>{judge.approve} approved · {judge.revise} sent back for revision · {judge.stop} stopped · {judge.with_polish} with polish</p>
    {judge.stops.length ? <ul>{judge.stops.map((stop, index) => <li key={`${stop.run}-${index}`}>
      <h3>{stop.subject || stop.run}</h3><p>{stop.workflow} · Issue #{stop.issue} · Run {stop.run}</p>
      {stop.reasons.length ? <ul>{stop.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : <p>No reason supplied.</p>}
    </li>)}</ul> : <p>No judge stops in this report window.</p>}
  </section>;
}
