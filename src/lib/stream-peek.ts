/** Collect a bounded signature across network chunks, then replay every byte. */
export async function peekStream(body: ReadableStream<Uint8Array> | null, limit = 4096, deadlineMs = 15000) {
  if (!body) return { bytes: new Uint8Array(), body: null };
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    let done = false;
    await Promise.race([
      (async () => {
        // Enough for three transport sync bytes, without waiting for a full media buffer.
        while (length < Math.min(limit, 564)) {
          const next = await reader.read();
          if (next.done) { done = true; break; }
          chunks.push(next.value);
          length += next.value.length;
        }
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Media data timeout")), deadlineMs); }),
    ]);
    clearTimeout(timer);
    const prefix = new Uint8Array(Math.min(length, limit));
    let offset = 0;
    for (const chunk of chunks) {
      const count = Math.min(chunk.length, prefix.length - offset);
      if (count <= 0) break;
      prefix.set(chunk.subarray(0, count), offset);
      offset += count;
    }
    let replayIndex = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const chunk = chunks[replayIndex];
        if (chunk) { replayIndex++; controller.enqueue(chunk); return; }
        if (done) { controller.close(); return; }
        try {
          const next = await reader.read();
          if (next.done) controller.close(); else controller.enqueue(next.value);
        } catch (error) { controller.error(error); }
      },
      cancel: (reason) => reader.cancel(reason),
    });
    return { bytes: prefix, body: stream };
  } catch (error) {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}