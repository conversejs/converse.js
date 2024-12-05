import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

/** @type {(() => Promise<object>)|null} */
let _json_loader = null;

/**
 * Overrides how `emoji.json` is loaded. Registered by `shims/node-emoji.js`
 * under Node, where the file is read from the package rather than fetched from
 * the asset directory served next to the bundle.
 * @param {() => Promise<object>} loader
 */
export function setEmojiJSONLoader(loader) {
    _json_loader = loader;
}

/**
 * @returns {Promise<object>}
 */
async function loadEmojiJSON() {
    if (_json_loader) return _json_loader();

    const path = api.settings.get('assets_path');
    const response = await fetch(`${path}/emoji.json`);
    if (!response.ok) throw new Error('Failed to fetch emoji.json');

    return response.json();
}

/**
 * @namespace api.emojis
 * @memberOf api
 */
const emojis = {
    /**
     * Initializes Emoji support by downloading the emojis JSON (and any applicable images).
     * @method api.emojis.initialize
     * @returns {Promise}
     */
    async initialize() {
        if (!converse.emojis.initialized) {
            converse.emojis.initialized = true;

            let json;
            try {
                json = await loadEmojiJSON();
            } catch (e) {
                console.error('Failed to load emoji.json:', e);
                json = {};
            }

            /**
             * *Hook* which allows plugins to modify emojis definition.
             *
             * Note: This hook is only fired one time, when Converse is initialized.
             *
             * @event _converse#loadEmojis
             * @param context
             *      An empty context object.
             * @param json
             *      See {@link src/headless/emojis.json} for more information about the content of
             *      this parameter.
             * @example
             *  api.listen.on('loadEmojis', (context, json) => {
             *      json.custom??= {};
             *      json.custom[":my_emoji"] = {
             *          "sn":":my_emoji:","url":"https://example.com/my_emoji.png","c":"custom"
             *      };
             *      delete json.custom[":converse:"];
             *      return json;
             *  });
             */
            json = await api.hook('loadEmojis', {}, json);
            converse.emojis.json = json;

            converse.emojis.by_sn = Object.keys(json).reduce((result, cat) => Object.assign(result, json[cat]), {});
            converse.emojis.list = Object.values(converse.emojis.by_sn);
            converse.emojis.list.sort((a, b) => (a.sn < b.sn ? -1 : a.sn > b.sn ? 1 : 0));
            converse.emojis.shortnames = converse.emojis.list.map((m) => m.sn);
            // Sort by length descending for the regex so longer shortnames
            // match before shorter ones.
            const getShortNames = () =>
                converse.emojis.shortnames
                    // Escape every regex metacharacter, not just `+`, because
                    // shortnames can also come from custom emoji added via the `loadEmojis` hook.
                    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .sort((a, b) => b.length - a.length)
                    .join('|');
            // Shortnames are matched case-sensitively, because `by_sn` is keyed on the exact
            // shortname and may legitimately contain both `:abc:` and `:ABC:` as distinct emoji.
            converse.emojis.shortnames_regex = new RegExp(getShortNames(), 'g');
            converse.emojis.initialized_promise.resolve();
        }
        return converse.emojis.initialized_promise;
    },
};

const emojis_api = { emojis };

export default emojis_api;
