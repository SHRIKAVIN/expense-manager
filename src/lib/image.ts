/** Max base64 length for receipt storage in Supabase text column (~700KB binary). */
const MAX_DATA_URL_CHARS = 900_000;

/** Compress an image File into a base64 JPEG data URL bounded by maxDim and size. */
export async function compressImage(file: File, maxDim = 1024, quality = 0.65): Promise<string> {
  const source = await decodeImageSource(file);
  let { width, height } = source;

  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(source, 0, 0, width, height);
  closeSource(source);

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > MAX_DATA_URL_CHARS && q > 0.35) {
    q -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }

  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error("Image is too large. Try a smaller photo or screenshot.");
  }

  return dataUrl;
}

type ImageSource = ImageBitmap | HTMLImageElement;

async function decodeImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through — some HEIC files fail here on older browsers.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadImage(objectUrl);
  } catch {
    throw new Error("Could not read this image. Try JPEG/PNG or take a screenshot.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function closeSource(source: ImageSource) {
  if ("close" in source) source.close();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
