export async function collectContentPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await read(from, from + size - 1);
    if (result.error || !result.data) throw new Error('Content temporarily unavailable');
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}