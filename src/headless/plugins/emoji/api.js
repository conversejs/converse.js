import log from '@converse/log';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { unique } from '../../utils/array.js';

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

    const url = `${api.settings.get('assets_path')}/emoji.json`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `Could not load ${url} (HTTP ${response.status}). ` +
                'Set assets_path to the directory that holds the Converse assets.',
        );
    }
    return response.json();
}

/**
 * @param {object} json
 */
function setEmojiData(json) {
    converse.emojis.json = json;

    converse.emojis.by_sn = Object.keys(json).reduce((result, cat) => Object.assign(result, json[cat]), {});
    converse.emojis.list = Object.values(converse.emojis.by_sn);
    converse.emojis.list.sort((a, b) => (a.sn < b.sn ? -1 : a.sn > b.sn ? 1 : 0));
    converse.emojis.shortnames = converse.emojis.list.map((m) => m.sn);
    // Skin tone variants are in the `people` category, which a `loadEmojis` hook may remove.
    converse.emojis.toned = unique(
        Object.values(json.people ?? {})
            .filter((person) => person.sn.includes('_tone'))
            .map((person) => person.sn.replace(/_tone[1-5]/, '')),
    );
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
                log.error('Could not load the emoji data, so emojis are disabled.', e);
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
            let hooked;
            try {
                // Listeners get a copy, so that `json` stays as it was if one of them fails.
                hooked = await api.hook('loadEmojis', {}, structuredClone(json));
            } catch (e) {
                log.error('A loadEmojis hook listener failed, so its changes to the emoji data are ignored.', e);
                hooked = json;
            }
            try {
                setEmojiData(hooked);
            } catch (e) {
                log.error('The emoji data is malformed, so emojis are disabled.', e);
                setEmojiData({});
            }
            converse.emojis.initialized_promise.resolve();
        }
        return converse.emojis.initialized_promise;
    },
};

const emojis_api = { emojis };

export default emojis_api;
