import createClient from "openapi-fetch";
import type { paths, components } from "./api";
import type { AutomationReport } from "./report";

// No configurable remote origin or browser token. The proxy supplies identity.
const client = createClient<paths>({ baseUrl: window.location.origin, credentials: "omit", fetch: (request: Request) => fetch(request) });
type Result<T> = { data?: T; error?: components["schemas"]["ObserveError"]; response: Response };
function unwrap<T>({ data, error, response }: Result<T>): T {
  if (!response.ok || data === undefined) throw new Error(error ? `${error.error.code}: ${error.error.message}` : `Observe request failed (${response.status})`);
  return data;
}
export type Tenant = { org: string; space: string };
export type WindowFilter = { from?: string; to?: string };
export const observe = {
  orgs: async (signal?: AbortSignal) => unwrap<components["schemas"]["Orgs"]>(await client.GET("/v1/orgs", { signal })),
  spaces: async (org: string, signal?: AbortSignal) => unwrap<components["schemas"]["Spaces"]>(await client.GET("/v1/orgs/{org}/spaces", { params: { path: { org } }, signal })),
  reports: async (tenant: Tenant, window: WindowFilter, cursor?: string, signal?: AbortSignal) => unwrap<components["schemas"]["Reports"]>(await client.GET("/v1/orgs/{org}/spaces/{space}/reports", { params: { path: tenant, query: { ...window, cursor, limit: 25 } }, signal })),
  report: async (tenant: Tenant, id: string, signal?: AbortSignal) => {
    const data = unwrap(await client.GET("/v1/orgs/{org}/spaces/{space}/reports/{report_id}", { params: { path: { ...tenant, report_id: id } }, signal }));
    // B1 validates this body against the vendored schema before returning 200.
    return data as unknown as AutomationReport;
  },
  pending: async (tenant: Tenant, signal?: AbortSignal) => unwrap<components["schemas"]["Pending"]>(await client.GET("/v1/orgs/{org}/spaces/{space}/pending", { params: { path: tenant }, signal })),
  trends: async (tenant: Tenant, field: string, window: WindowFilter, signal?: AbortSignal) => unwrap<components["schemas"]["Trends"]>(await client.GET("/v1/orgs/{org}/spaces/{space}/trends", { params: { path: tenant, query: { field, ...window } }, signal })),
};
