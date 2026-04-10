export const APP_BASE_URL = import.meta.env.BASE_URL;

export function getAssetPath(path) {
  return `${APP_BASE_URL}${path.replace(/^\//, '')}`;
}

export function getAppUrl(path = '') {
  return new URL(path.replace(/^\//, ''), window.location.origin + APP_BASE_URL).toString();
}

export function getModelPath(path) {
  return getAssetPath(path);
}
