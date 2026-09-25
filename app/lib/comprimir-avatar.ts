import imageCompression from 'browser-image-compression';

export async function comprimirAvatar(file: File) {
  let processado = file;
  const nome = file.name.toLowerCase();
  const heic = file.type === 'image/heic' || file.type === 'image/heif' || nome.endsWith('.heic') || nome.endsWith('.heif');
  if (heic) {
    const heic2any = (await import('heic2any')).default;
    const convertido = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
    const blob = Array.isArray(convertido) ? convertido[0] : convertido;
    processado = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' });
  }
  if (processado.size > 10 * 1024 * 1024) throw new Error('Foto muito grande.');
  const comprimida = await imageCompression(processado, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 500,
    useWebWorker: true,
    fileType: 'image/webp',
  });
  return new File([comprimida], 'avatar.webp', { type: 'image/webp', lastModified: Date.now() });
}

export async function comprimirCapa(file: File) {
  let processado = file;
  const nome = file.name.toLowerCase();
  if (file.type === 'image/heic' || file.type === 'image/heif' || nome.endsWith('.heic') || nome.endsWith('.heif')) {
    const heic2any = (await import('heic2any')).default;
    const convertido = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(convertido) ? convertido[0] : convertido;
    processado = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' });
  }
  if (processado.size > 25 * 1024 * 1024) throw new Error('Imagem muito grande.');
  const comprimida = await imageCompression(processado, {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp',
  });
  return new File([comprimida], 'capa.webp', { type: 'image/webp', lastModified: Date.now() });
}

export async function comprimirLogo(file: File) {
  const base = await comprimirAvatar(file);
  const comprimida = await imageCompression(base, {
    maxSizeMB: 0.05,
    maxWidthOrHeight: 256,
    useWebWorker: true,
    fileType: 'image/webp',
  });
  return new File([comprimida], 'logo.webp', { type: 'image/webp', lastModified: Date.now() });
}
