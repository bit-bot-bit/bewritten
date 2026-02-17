export function generateId() {
  if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is not available (should be rare in modern Node/Browsers)
  // Simple UUID v4 polyfill
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
