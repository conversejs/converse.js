/**
 * Vite plugin that serves prebuilt/static files verbatim, the way Karma's
 * `files` + `proxies` did. Needed because the test bundle (`dist/converse.js`)
 * and its runtime asset fetches (emoji.json, images, css) expect plain HTTP
 * paths, not Vite-transformed modules.
 *
 * @param {Record<string,string>} mounts route -> absolute directory
 */
import sirv from 'sirv';

export function serveStatic(mounts) {
    return {
        name: 'converse-serve-static',
        configureServer(server) {
            for (const [route, dir] of Object.entries(mounts)) {
                const handler = sirv(dir, { dev: true, etag: true, single: false });
                server.middlewares.use(route, handler);
            }
        },
    };
}
