/**
 * Node.js emoji data loading.
 *
 * In the browser, emoji.json is fetched from the asset directory served next to
 * converse-headless.js. Under Node there is no such server: the file ships in
 * the package next to the emoji plugin, so it is read from disk instead.
 *
 * @module shims/node-emoji
 */
import fs from 'node:fs';
import { setEmojiJSONLoader } from '../plugins/emoji/api.js';

setEmojiJSONLoader(async () =>
    JSON.parse(fs.readFileSync(new URL('../plugins/emoji/emoji.json', import.meta.url)).toString('utf-8')),
);
