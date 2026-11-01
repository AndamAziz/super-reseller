/** Read at most one bounded prefix, replaying all bytes without buffering the media. */
export async function peekStream(body: ReadableStream<Uint8Array> | null, limit = 4096, deadlineMs = 15000) {
  if (!body) return { bytes: new Uint8Array(), body: null };
  const reader = body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const first = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Media data timeout")), deadlineMs); }),
    ]);
    clearTimeout(timer);
    const prefix = first.value ?? new Uint8Array();
    let replay = !first.done;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (replay) { replay = false; controller.enqueue(prefix); return; }
        if (first.done) { controller.close(); return; }
        try {
          const next = await reader.read();
          if (next.done) controller.close(); else controller.enqueue(next.value);
        } catch (error) { controller.error(error); }
      },
      cancel: (reason) => reader.cancel(reason),
    });
    return { bytes: prefix.slice(0, limit), body: stream };
  } catch (error) {
    clearTimeout(timer);
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}