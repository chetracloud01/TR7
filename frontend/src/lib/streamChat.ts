/** Reads the SSE stream from POST /api/chat/sessions/{id}/messages.
 *
 * Uses a plain fetch + ReadableStream reader rather than EventSource —
 * EventSource can only send GET requests, and this needs to POST the
 * message body. */

export interface StreamHandlers {
  onToken: (text: string) => void;
  onDone: (info: { provider: string; model: string }) => void;
  onError: (message: string) => void;
}

export async function streamChat(sessionId: number, content: string, taskType: string, handlers: StreamHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, task_type: taskType }),
    });
  } catch {
    handlers.onError("Couldn't reach the server.");
    return;
  }

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    handlers.onError(body?.detail ?? `Request failed (${res.status}).`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; a frame may arrive split
    // across chunks, so only consume complete frames from the buffer.
    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;

      const payload = JSON.parse(line.slice("data: ".length));
      if (payload.type === "token") handlers.onToken(payload.text);
      else if (payload.type === "done") handlers.onDone({ provider: payload.provider, model: payload.model });
      else if (payload.type === "error") handlers.onError(payload.message);
    }
  }
}
