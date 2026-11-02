// Lossless, bounded-memory faststart: only the index is read into memory.
// Media samples are reused as Blob slices, never decoded or re-encoded.
type Box = { type: string; start: number; size: number; header: number };
const MAX_INDEX_BYTES = 128 * 1024 ** 2;
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
const UNSUPPORTED = new Set(['cmov', 'mvex', 'moof', 'sidx', 'mfra', 'iloc', 'saio']);
function typeAt(view: DataView, offset: number) {
  return String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + offset, 4));
}
function boxAt(view: DataView, offset: number, end: number): Box {
  if (offset + 8 > end) throw new Error('Incomplete MP4 box.');
  let size = view.getUint32(offset);
  const type = typeAt(view, offset + 4);
  let header = 8;
  if (size === 1) {
    if (offset + 16 > end) throw new Error('Incomplete MP4 box.');
    const extended = view.getBigUint64(offset + 8);
    if (extended > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MP4 box too large.');
    size = Number(extended); header = 16;
  } else if (size === 0) size = end - offset;
  if (size < header || offset + size > end) throw new Error('Invalid MP4 box size.');
  return { type, start: offset, size, header };
}
async function topBoxes(file: Blob, signal?: AbortSignal) {
  const boxes: Box[] = [];
  for (let start = 0; start < file.size;) {
    signal?.throwIfAborted();
    const bytes = await file.slice(start, start + 16).arrayBuffer();
    const box = boxAt(new DataView(bytes), 0, file.size - start);
    boxes.push({ ...box, start });
    if (boxes.length > 100_000) throw new Error('Too many MP4 boxes.');
    start += box.size;
  }
  return boxes;
}
export async function faststartMp4(file: File, signal?: AbortSignal): Promise<File> {
  const boxes = await topBoxes(file, signal);
  const indexes = boxes.filter((box) => box.type === 'moov');
  const media = boxes.filter((box) => box.type === 'mdat');
  const moov = indexes[0]; const firstMedia = media[0];
  if (indexes.length !== 1 || !moov || !firstMedia || !boxes.some((box) => box.type === 'ftyp')) {
    throw new Error('Choose a valid MP4 file with a playback index.');
  }
  if (moov.start < firstMedia.start) return file;
  if (boxes.some((box) => UNSUPPORTED.has(box.type))) throw new Error('This MP4 layout cannot be optimized safely. Export it with faststart enabled.');
  if (moov.size > MAX_INDEX_BYTES) throw new Error('MP4 playback index too large to prepare safely.');
  const index = await file.slice(moov.start, moov.start + moov.size).arrayBuffer();
  signal?.throwIfAborted();
  const view = new DataView(index);
  const originalIndexStart = BigInt(moov.start);
  const indexSize = BigInt(moov.size);
  let tables = 0;
  function patch(start: number, end: number, depth: number) {
    if (depth > 16) throw new Error('Invalid MP4 index nesting.');
    for (let offset = start; offset < end;) {
      const box = boxAt(view, offset, end);
      if (UNSUPPORTED.has(box.type)) throw new Error('This MP4 index cannot be optimized safely. Export it with faststart enabled.');
      const body = offset + box.header;
      if (CONTAINERS.has(box.type)) patch(body, offset + box.size, depth + 1);
      else if (box.type === 'stco' || box.type === 'co64') {
        if (body + 8 > offset + box.size || view.getUint32(body) !== 0) throw new Error('Invalid MP4 chunk table.');
        const count = view.getUint32(body + 4); const width = box.type === 'co64' ? 8 : 4;
        if (body + 8 + count * width !== offset + box.size) throw new Error('Invalid MP4 chunk table size.');
        for (let i = 0; i < count; i++) {
          const position = body + 8 + i * width;
          const original = width === 8 ? view.getBigUint64(position) : BigInt(view.getUint32(position));
          if (!media.some((item) => original >= BigInt(item.start + item.header) && original < BigInt(item.start + item.size))) throw new Error('MP4 references external or invalid media.');
          const updated = original + (original < originalIndexStart ? indexSize : 0n);
          if (width === 4) {
            if (updated > 0xffffffffn) throw new Error('MP4 needs 64-bit offsets. Export it with faststart enabled.');
            view.setUint32(position, Number(updated));
          } else view.setBigUint64(position, updated);
        }
        tables++;
      }
      offset += box.size;
    }
  }
  patch(0, index.byteLength, 0);
  if (!tables) throw new Error('MP4 has no local media chunk table.');
  signal?.throwIfAborted();
  return new File([
    file.slice(0, firstMedia.start), index,
    file.slice(firstMedia.start, moov.start), file.slice(moov.start + moov.size),
  ], file.name, { type: 'video/mp4', lastModified: file.lastModified });
}