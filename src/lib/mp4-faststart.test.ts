// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { faststartMp4 } from './mp4-faststart';
function box(type: string, ...parts: Uint8Array[]) {
  const bytes = new Uint8Array(8 + parts.reduce((sum, part) => sum + part.length, 0));
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode(type), 4);
  let at = 8; for (const part of parts) { bytes.set(part, at); at += part.length; }
  return bytes;
}
function fixture(wide = false, extraMedia = false) {
  const ftyp = box('ftyp', new Uint8Array(16));
  const samples = new Uint8Array([10, 20, 30, 40]);
  const mdat = box('mdat', samples);
  const table = new Uint8Array(8 + (wide ? 8 : 4) * (extraMedia ? 2 : 1));
  const view = new DataView(table.buffer); view.setUint32(4, extraMedia ? 2 : 1);
  if (wide) view.setBigUint64(8, BigInt(ftyp.length + 8)); else view.setUint32(8, ftyp.length + 8);
  const moov = box('moov', box('trak', box('mdia', box('minf', box('stbl', box(wide ? 'co64' : 'stco', table))))));
  if (extraMedia) {
    const position = ftyp.length + mdat.length + moov.length + 8;
    if (wide) view.setBigUint64(16, BigInt(position)); else view.setUint32(12, position);
    // The table was copied into moov; rebuild with the updated offsets.
  }
  const index = box('moov', box('trak', box('mdia', box('minf', box('stbl', box(wide ? 'co64' : 'stco', table))))));
  return { file: new File([ftyp, mdat, index, ...(extraMedia ? [mdat] : [])], 'movie.mp4'), samples, ftyp, mdat, index };
}
describe('lossless automatic MP4 startup', () => {
  it.each([false, true])('moves the index ahead of unchanged media, with wide offsets %s', async (wide) => {
    const { file, samples, ftyp, index } = fixture(wide);
    const output = await faststartMp4(file);
    const bytes = new Uint8Array(await output.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(ftyp.length + 4, ftyp.length + 8))).toBe('moov');
    expect(bytes.slice(ftyp.length + index.length + 8)).toEqual(samples);
    const at = ftyp.length + 5 * 8 + 16;
    const offset = wide ? new DataView(bytes.buffer).getBigUint64(at) : BigInt(new DataView(bytes.buffer).getUint32(at));
    expect(offset).toBe(BigInt(ftyp.length + index.length + 8));
    expect(output.size).toBe(file.size);
    expect(output.name).toBe('movie.mp4');
  });
  it('keeps already optimized files byte-identical', async () => {
    const output = await faststartMp4(fixture().file);
    expect(await faststartMp4(output)).toBe(output);
  });
  it('updates only media offsets moved by the index', async () => {
    const { file, ftyp, index, mdat } = fixture(true, true);
    const output = new DataView(await (await faststartMp4(file)).arrayBuffer());
    const at = ftyp.length + 5 * 8 + 16;
    expect(output.getBigUint64(at)).toBe(BigInt(ftyp.length + index.length + 8));
    expect(output.getBigUint64(at + 8)).toBe(BigInt(ftyp.length + mdat.length + index.length + 8));
  });
  it('rejects invalid MP4 before any upload', async () => {
    await expect(faststartMp4(new File(['not mp4'], 'movie.mp4'))).rejects.toThrow();
  });
  it('honors cancellation before reading/uploading', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(faststartMp4(fixture().file, controller.signal)).rejects.toThrow();
  });
  it('rejects fragmented late-index layouts rather than corrupting offsets', async () => {
    const { ftyp, mdat, index } = fixture();
    await expect(faststartMp4(new File([ftyp, box('moof'), mdat, index], 'movie.mp4'))).rejects.toThrow('cannot be optimized safely');
  });
});