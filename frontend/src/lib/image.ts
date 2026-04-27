export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const maxWidth = 1280;
    const maxHeight = 1280;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.max(Math.round(image.width * scale), 1);
    const height = Math.max(Math.round(image.height * scale), 1);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    const mimeType = 'image/jpeg';
    const qualitySteps = [0.45, 0.32, 0.22];
    let blob: Blob | null = null;

    for (const quality of qualitySteps) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, quality);
      });

      if (!blob) {
        continue;
      }

      // Keep compressing until the image is reasonably small while remaining readable.
      if (blob.size <= 220 * 1024) {
        break;
      }
    }

    if (!blob) {
      return file;
    }

    const compressedName = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '.jpg';
    return new File([blob], compressedName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
