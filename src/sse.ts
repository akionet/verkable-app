export interface SseFrame {
  event: string;
  data: string;
}

export async function readSse(
  response: Response,
  onFrame: (frame: SseFrame) => void,
): Promise<void> {
  if (!response.body) throw new Error("Streaming response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
    while (boundary?.index !== undefined) {
      dispatchFrame(normalizeLines(buffer.slice(0, boundary.index)), onFrame);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
    }
    if (done) break;
  }
  if (buffer.trim()) dispatchFrame(normalizeLines(buffer), onFrame);
}

const normalizeLines = (value: string) => value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

function dispatchFrame(frame: string, onFrame: (frame: SseFrame) => void) {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length) onFrame({ event, data: data.join("\n") });
}
