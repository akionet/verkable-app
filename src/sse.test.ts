import { describe, expect, it, vi } from "vitest";

import { readSse } from "./sse";

function streamed(chunks: Uint8Array[]): Response {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }));
}

describe("readSse", () => {
  it("preserves split UTF-8, split fields, comments, CRLF, and multiple frames", async () => {
    const bytes = new TextEncoder().encode(
      ': keepalive\r\nevent: token\r\ndata: {"text":"hé"}\r\n\r\n' +
      'event: final\ndata: {"output":\ndata: {}}\n\n',
    );
    const onFrame = vi.fn();
    const crlfSplit = bytes.indexOf(13) + 1;
    await readSse(
      streamed([bytes.slice(0, crlfSplit), bytes.slice(crlfSplit, 36), bytes.slice(36)]),
      onFrame,
    );
    expect(onFrame).toHaveBeenNthCalledWith(1, { event: "token", data: '{"text":"hé"}' });
    expect(onFrame).toHaveBeenNthCalledWith(2, { event: "final", data: '{"output":\n{}}' });
  });

  it("dispatches a final non-blank frame at EOF", async () => {
    const onFrame = vi.fn();
    await readSse(streamed([new TextEncoder().encode("event: node\ndata: {}")]), onFrame);
    expect(onFrame).toHaveBeenCalledWith({ event: "node", data: "{}" });
  });

  it("rejects a response without a stream", async () => {
    const response = new Response();
    Object.defineProperty(response, "body", { value: null });
    await expect(readSse(response, vi.fn())).rejects.toThrow("no body");
  });
});
