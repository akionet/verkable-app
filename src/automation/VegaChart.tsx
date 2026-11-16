import { useEffect, useRef } from "react";
import embed, { type VisualizationSpec } from "vega-embed";

export function VegaChart({ spec }: { spec: VisualizationSpec }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let finalize: (() => void) | undefined;
    const element = document.createElement("div");
    container.current!.replaceChildren(element);
    embed(element, spec, { actions: false, renderer: "svg" }).then(result => {
      if (disposed) result.finalize();
      else finalize = () => result.finalize();
    }).catch(() => { if (!disposed) element.textContent = "Chart unavailable. Trend values are listed below."; });
    return () => { disposed = true; finalize?.(); element.remove(); };
  }, [spec]);
  return <div ref={container} role="img" aria-label="Trend chart" />;
}
