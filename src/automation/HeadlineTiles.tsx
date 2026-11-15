import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TopLevelSpec } from "vega-lite";
import { observe, type Tenant, type WindowFilter } from "./client";
import { VegaChart } from "./VegaChart";

export function HeadlineTiles({ headline, tenant, window }: { headline: { [key: string]: number }; tenant: Tenant; window: WindowFilter }) {
  return <section><h2>Headline</h2><p>Counts for the selected report; trends cover the filtered timeline.</p><div className="observe-tiles">
    {Object.entries(headline).map(([field, value]) => <Tile key={field} {...{ field, value, tenant, window }} />)}
  </div></section>;
}
function Tile({ field, value, tenant, window }: { field: string; value: number; tenant: Tenant; window: WindowFilter }) {
  const label = field.replaceAll("_", " ").replace(/^./, s => s.toUpperCase());
  const trend = useQuery({ queryKey: ["observe", tenant.org, tenant.space, "trends", field, window], queryFn: ({ signal }) => observe.trends(tenant, `headline.${field}`, window, signal) });
  const spec = useMemo<TopLevelSpec>(() => ({
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    description: `${label} over time`, width: 180, height: 60,
    data: { values: trend.data?.items ?? [] },
    mark: { type: "line", point: true, invalid: "break-paths-show-domains", color: "#267357" },
    encoding: { x: { field: "at", type: "temporal", axis: null }, y: { field: "value", type: "quantitative", axis: null }, tooltip: [{ field: "at", type: "temporal" }, { field: "value", type: "quantitative" }] },
  }), [label, trend.data]);
  return <article className="observe-tile"><h3>{label}</h3><strong>{value}</strong>
    {trend.isPending ? <p>Loading trend…</p> : trend.error ? <p role="alert">Trend unavailable: {trend.error.message}</p> : !trend.data.items.length ? <p>No trend data.</p> : <>
      <VegaChart spec={spec} /><details><summary>Trend values</summary><ul>{trend.data.items.map(point => <li key={point.report_id}>{point.at}: {point.value ?? "Not reported"}</li>)}</ul></details>
    </>}
  </article>;
}
