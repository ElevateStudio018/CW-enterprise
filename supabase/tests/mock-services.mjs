// Stands in for Resend, GitHub and Anthropic in local tests: records every request (GET /__requests lists them,
// DELETE /__requests clears them) and answers like the real services. Run: node supabase/tests/mock-services.mjs
import http from "node:http";

const port = Number(process.env.MOCK_PORT ?? 54399);
let requests = [];
// Scripted answers for the AI, taken in order (POST /__ai with a JSON array to set them).
let aiAnswers = [];

http
  .createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = body ? (() => { try { return JSON.parse(body); } catch { return body; } })() : null;
    const send = (status, payload, headers = { "Content-Type": "application/json" }) => {
      res.writeHead(status, headers);
      res.end(payload === undefined ? "" : typeof payload === "string" ? payload : JSON.stringify(payload));
    };

    if (req.url === "/__requests") {
      if (req.method === "DELETE") { requests = []; return send(204); }
      return send(200, requests);
    }
    if (req.url === "/__ai" && req.method === "POST") { aiAnswers = parsed; return send(204); }

    requests.push({ method: req.method, url: req.url, headers: req.headers, body: parsed, at: new Date().toISOString() });

    if (req.url === "/emails" && req.method === "POST") return send(200, { id: `mail-${requests.length}` });
    if (/\/actions\/workflows\/.+\/dispatches$/.test(req.url) && req.method === "POST") return send(204);
    if (req.url?.startsWith("/v1/messages") && req.method === "POST") {
      const scripted = aiAnswers.shift();
      if (!scripted) return send(500, { type: "error", error: { type: "api_error", message: "No scripted answer" } });
      // A scripted answer is a whole message, or {text, stop_reason?, delayMs?} for a text answer.
      const answer = scripted.content
        ? scripted
        : {
            id: `msg_mock_${requests.length}`,
            type: "message",
            role: "assistant",
            model: parsed?.model ?? "mock",
            content: [{ type: "text", text: scripted.text }],
            stop_reason: scripted.stop_reason ?? "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 50 },
          };
      if (!parsed?.stream) return send(200, answer);
      // Streamed like the Messages API: the text in small pieces between the start and stop events.
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      event("message_start", { message: { ...answer, content: [], stop_reason: null, usage: { input_tokens: 100, output_tokens: 1 } } });
      const text = answer.content.find((block) => block.type === "text")?.text ?? "";
      event("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
      for (let at = 0; at < text.length; at += 40) {
        if (res.destroyed) return;
        event("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(at, at + 40) } });
        if (scripted.delayMs) await new Promise((resolve) => setTimeout(resolve, scripted.delayMs));
      }
      event("content_block_stop", { index: 0 });
      event("message_delta", { delta: { stop_reason: answer.stop_reason, stop_sequence: null }, usage: { output_tokens: 50 } });
      event("message_stop", {});
      return res.end();
    }
    send(404, { error: "not mocked", url: req.url });
  })
  .listen(port, "0.0.0.0", () => console.log(`mock services on ${port}`));
