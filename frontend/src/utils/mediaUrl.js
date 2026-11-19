export function getSafeMediaUrl(rawUrl, cacheBuster = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return rawUrl;

  let finalUrl = rawUrl.trim();

  // 1. NEVER rewrite Cloudinary URLs (even when '/media/' is in the folder path)
  if (finalUrl.includes('res.cloudinary.com')) {
    if (finalUrl.startsWith('http://')) {
      finalUrl = 'https://' + finalUrl.substring('http://'.length);
    }
    if (cacheBuster) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      return `${finalUrl}${sep}v=${cacheBuster}`;
    }
    return finalUrl;
  }

  // 2. Fallback for local development / legacy relative paths
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  let backendOrigin = 'http://localhost:8000';
  try {
    backendOrigin = new URL(apiBase).origin;
  } catch {
    backendOrigin = 'http://localhost:8000';
  }

  const mediaIndex = finalUrl.indexOf('/media/');
  if (mediaIndex !== -1) {
    finalUrl = `${backendOrigin}${finalUrl.substring(mediaIndex)}`;
  } else if (finalUrl.startsWith('/')) {
    finalUrl = `${backendOrigin}${finalUrl}`;
  }

  if (
    finalUrl.startsWith('http://') &&
    !finalUrl.includes('localhost') &&
    !finalUrl.includes('127.0.0.1') &&
    !finalUrl.includes('192.168.')
  ) {
    finalUrl = 'https://' + finalUrl.substring('http://'.length);
  }

  if (cacheBuster) {
    const sep = finalUrl.includes('?') ? '&' : '?';
    return `${finalUrl}${sep}v=${cacheBuster}`;
  }
  return finalUrl;
}