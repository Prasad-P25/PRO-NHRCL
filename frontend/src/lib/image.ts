/**
 * Downscale + JPEG-compress large photos in the browser before upload, so on-site
 * phone photos (often 3–8 MB) become ~200–500 KB. Faster uploads, far less mobile
 * data. Non-images or already-small files are returned unchanged.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) return file;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.7)
    );
    if (!blob || blob.size >= file.size) return file; // no gain — keep original
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Build a viewable URL for an uploaded file path returned by the API. */
export function uploadUrl(filePath?: string, cacheKey?: number | string): string {
  if (!filePath) return '';
  const base = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';
  return `${base}/${filePath.replace(/\\/g, '/')}${cacheKey != null ? `?e=${cacheKey}` : ''}`;
}
