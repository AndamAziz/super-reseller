export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const IMAGE_QUALITY = 0.85;
export type ImageFormat = 'webp' | 'png' | 'jpg';
export type ConvertedImage = { blob: Blob; width: number; height: number; format: ImageFormat };
export const imageMime = (format: ImageFormat) => format === 'jpg' ? 'image/jpeg' : `image/${format}`;

export function validateImage(file: Pick<File, 'size' | 'name' | 'type'>) {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 15 MB or smaller.');
  if (!file.size) throw new Error('This image is empty.');
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp|avif|svg|heic|heif)$/i.test(file.name)) throw new Error('Choose an image file.');
}
export function resizedDimensions(width: number, height: number, maxWidth: number | null) {
  if (maxWidth !== null && (!Number.isFinite(maxWidth) || maxWidth < 1)) throw new Error('Enter a positive maximum width.');
  const scale = maxWidth === null ? 1 : Math.min(1, maxWidth / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export async function convertImage(file: File, format: ImageFormat, maxWidth: number | null): Promise<ConvertedImage> {
  validateImage(file);
  let source: Blob = file;
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    const { default: heic2any } = await import('heic2any');
    const decoded = await heic2any({ blob: file, toType: 'image/png' });
    source = Array.isArray(decoded) ? decoded[0] : decoded;
    if (!source) throw new Error('Could not decode this iPhone image.');
  }
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('This browser could not read the image.'); });
    const dimensions = resizedDimensions(image.naturalWidth, image.naturalHeight, maxWidth);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image conversion is unavailable.');
    if (format === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image conversion failed.')), imageMime(format), IMAGE_QUALITY));
    if (blob.type !== imageMime(format)) throw new Error(`This browser cannot create ${format.toUpperCase()} images. Try PNG.`);
    return { blob, ...dimensions, format };
  } finally { URL.revokeObjectURL(url); }
}

export async function copyImageLink(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const field = document.createElement('textarea');
    field.value = text; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.appendChild(field); field.focus(); field.select(); field.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy'); field.remove();
    if (!copied) throw new Error('Could not copy. Select the link and copy it manually.');
  }
}