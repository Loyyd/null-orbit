import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase = repositoryName ? `/${repositoryName}/` : '/';

function rewritePrettyRoutes() {
  const rewrite = (req, _res, next) => {
    if (req.url === '/options') {
      req.url = '/options.html';
    }
    next();
  };

  return {
    name: 'rewrite-pretty-routes',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? githubPagesBase : '/',
  plugins: [rewritePrettyRoutes()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
        options: resolve(__dirname, 'options.html'),
      },
    },
  },
});
