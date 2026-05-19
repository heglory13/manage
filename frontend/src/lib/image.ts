async function compressImage(
  file: File,
  maxPx: number,
  targetBytes: number,
  qualitySteps: number[],
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const scale = Math.min(maxPx / image.width, maxPx / image.height, 1);
    const width = Math.max(Math.round(image.width * scale), 1);
    const height = Math.max(Math.round(image.height * scale), 1);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let blob: Blob | null = null;
    for (const quality of qualitySteps) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= targetBytes) break;
    }

    if (!blob) return file;

    const name = file.name.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Dùng cho avatar / thumbnail nhỏ — giới hạn 120 KB */
export function compressImageForUpload(file: File): Promise<File> {
  return compressImage(file, 960, 120 * 1024, [0.32, 0.24, 0.16, 0.1]);
}

/**
 * Dùng cho ảnh chứng từ / phiếu nhập kho.
 * Resize xuống tối đa 1200 px, giữ dung lượng dưới 300 KB.
 */
export function compressReceiptImage(file: File): Promise<File> {
  return compressImage(file, 1200, 300 * 1024, [0.82, 0.70, 0.58, 0.46, 0.36]);
}
