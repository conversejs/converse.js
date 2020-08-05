import URI from "urijs";

import { api, _converse, converse } from "@converse/headless/converse-core";
import { getEmojiMarkup, getCodePointReferences, getShortnameReferences } from "@converse/headless/converse-emoji.js";

import plugin_settings from './settings';
import { URL_START_REGEX } from '../../utils/html';


const u = converse.env.utils;

const filterUrl = (unwanted_query_params) => (url) => {
    const uri = URI(url)
    uri.removeQuery(unwanted_query_params);
    uri.hasQuery('s', 21) && uri.removeQuery('s'); // remove twitter's ?s=21
    return uri.toString();
}

const filterQueryParams = (unwanted_query_params) => (text) => 
    URI.withinString(text, filterUrl(unwanted_query_params), { start: URL_START_REGEX });

function mapURLsMiddleware (message_text) {
    const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
    const matches = message_text.matchAll(regex);
    const references = [...matches].map(url => ({
        begin: url.index,
        end: url.index + url[0].length,
        template: u.convertUrlToHyperlink(url[0].replace(regex, _converse.geouri_replacement))
    }));
    return references;
}

// function emojiMiddleware (text) {
//     const matches = [...getShortnameReferences(text.toString()), ...getCodePointReferences(text.toString())];
//     const references = matches.map(emoji => ({
//         begin: emoji.begin,
//         end: emoji.end,
//         template: getEmojiMarkup(e, {'add_title_wrapper': true})
//     }));
//     return references;
// }

const middlewareForMentions = (references, nick) => (message_text) => {
    const result = [...references].map(r => {
        const mention = message_text.slice(r.begin, r.end);
        const template = mention === nick
            ? `<span class="mention mention--self badge badge-info">${mention}</span>`
            : `<span class="mention">${mention}</span>`
        return {
            begin: r.begin,
            end: r.end,
            template
        }
    })
    return result;
}

converse.plugins.add('converse-urlparser', {
    initialize () {
        // Message filters
        api.settings.extend(plugin_settings)
        const settings = api.settings.get('filter_url_query_params');
        const messageFilter = filterQueryParams(settings);
        api.message.addFilters(messageFilter);

        const model = null; // @TODO where is the model here?

        // Message middleware
        const mentionsMiddleware = middlewareForMentions(
            model.get('references'),
            model.collection.chatbox.get('nick')
        );
        api.message.addMiddleware(mapURLsMiddleware);
        // api.message.addMiddleware(mentionsMiddleware);
    }
});
