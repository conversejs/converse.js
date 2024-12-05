import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

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
    async initialize () {
        if (!converse.emojis.initialized) {
            converse.emojis.initialized = true;

            const module = await import(/*webpackChunkName: "emojis" */ './emoji.json');
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
            const json = await api.hook('loadEmojis', {}, module.default);
            converse.emojis.json = json;

            converse.emojis.by_sn = Object.keys(json).reduce(
                (result, cat) => Object.assign(result, json[cat]),
                {}
            );
            converse.emojis.list = Object.values(converse.emojis.by_sn);
            converse.emojis.list.sort((a, b) => (a.sn < b.sn ? -1 : a.sn > b.sn ? 1 : 0));
            converse.emojis.shortnames = converse.emojis.list.map((m) => m.sn);
            const getShortNames = () =>
                converse.emojis.shortnames.map((s) => s.replace(/[+]/g, '\\$&')).join('|');
            converse.emojis.shortnames_regex = new RegExp(getShortNames(), 'g');
            converse.emojis.initialized_promise.resolve();
        }
        return converse.emojis.initialized_promise;
    },
}

const emojis_api = { emojis };

export default emojis_api;
