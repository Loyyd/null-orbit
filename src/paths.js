export const APP_BASE_URL = import.meta.env.BASE_URL;

export function getAssetPath(path) {
  return `${APP_BASE_URL}${path.replace(/^\//, '')}`;
}

export function getAppUrl(path = '') {
  return new URL(path.replace(/^\//, ''), window.location.origin + APP_BASE_URL).toString();
}

function isGithubPagesHost() {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
}

function getGithubPagesRepo() {
  const repo = APP_BASE_URL.replace(/^\/|\/$/g, '');
  return repo || null;
}

function getGithubPagesOwner() {
  if (typeof window === 'undefined') return null;
  return window.location.hostname.split('.')[0] || null;
}

export function getModelPath(path) {
  const normalizedPath = path.replace(/^\//, '');

  if (isGithubPagesHost()) {
    const owner = getGithubPagesOwner();
    const repo = getGithubPagesRepo();

    if (owner && repo) {
      return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/public/${normalizedPath}`;
    }
  }

  return getAssetPath(normalizedPath);
}
