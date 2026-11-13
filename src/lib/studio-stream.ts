// Only public response text is forwarded. Reasoning fields are intentionally ignored.
export async function* sseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader(); const decoder = new TextDecoder(); let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 600000) throw new Error('Stream event too large');
      let boundary;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const match = buffer.slice(boundary).match(/^\r?\n\r?\n/)![0];
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + match.length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (data) yield data;
      }
      if (done) break;
    }
    if (buffer.trim()) { const data = buffer.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'); if (data) yield data; }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
