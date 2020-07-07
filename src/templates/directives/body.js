import { _converse, api, converse } from  "@converse/headless/converse-core";
import { directive, html } from "lit-html";
import URI from "urijs";

const u = converse.env.utils;


class MessageBodyRenderer extends String {

    constructor (component) {
        super();
        this.text = component.model.getMessageText();
        this.model = component.model;
        this.component = component;
    }

    async transform () {
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { string } text - The message text
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('beforeMessageBodyTransformed', this.model, this.text, {'Synchronous': true});
        await api.waitUntil('emojisInitialized');
        
        const text = this.component.is_me_message ? this.text.substring(4) : this.text;
        const reduceSpaces = text => text.replace(/\n\n+/g, '\n\n');
        const transformGeoUriToHttp = text => u.geoUriToHttp(_converse.geouri_replacement, text);
        const references = this.model.get('references')?.sort((a, b) => a.begin - b.begin);
        const nickname = this.model.collection.chatbox.get('nick');
        const must_show_images = api.settings.get('show_images_inline');

        const referenceCutPointsReducer = (cut_indexes, reference) =>
            [...cut_indexes, reference.begin, reference.end]

        const separateMentionsFromText = (acc, text) => {
            if (!references || !references.length) return [text];
            const indexes = references.reduce(referenceCutPointsReducer, []);
            const mentions_start_at_zero = indexes[0] === 0;
            const cut_indexes = mentions_start_at_zero ? indexes : [0, ...indexes];
            const sorted_cut_indexes = cut_indexes.sort((a, b) => a - b)
            const slices = u.stringToChunks(sorted_cut_indexes, text);
            const mapped_slices = slices.map((value, index) => {
                const is_index_even = index % 2 == 0;
                const is_mention = is_index_even === mentions_start_at_zero;
                return is_mention ? { mention: value } : value;
            });
            return [...acc, ...mapped_slices];
        }

        const replaceMentionsWithTemplates = list_item => {
            if (typeof list_item == 'object' && typeof list_item.mention == 'string') {
                const { mention } = list_item;
                return mention == nickname
                    ? tpl_mention_with_nick(list_item)
                    : tpl_mention(list_item)
            }
            return list_item
        }

        const parseUrl = url => must_show_images && u.isImageURL(url)
            ? u.convertToImageTag(url)
            : u.convertUrlToHyperlink(url);

        const getURLPartsFromString = str => {
            const parse_options = { 'start': /\b(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi };
            const res = [];
            // @TODO: Does not correctly parse multiple URLs
            URI.withinString(str, (url, start, end) => {
                res.push([
                    str.slice(0, start),
                    parseUrl(url),
                    str.slice(end)
                ])
            }, parse_options);
            return res.length ? res : [str];
        }

        const addEmojis = (new_list, list_item) =>
            [...new_list, ...u.addEmoji(list_item)]

        const addHyperlinks = (new_list, list_item) =>
            [...new_list, ...getURLPartsFromString(list_item)]

        // parsing mentions has to happen first, otherwise
        // begin and end indexes won't coincide with text.
        const list = [text]
            .reduce(separateMentionsFromText, [])
            .map(replaceMentionsWithTemplates)
            .map(u.ifIsMappingText(reduceSpaces))
            .map(u.ifIsMappingText(transformGeoUriToHttp))
            .reduce(u.ifIsReducingText(addEmojis), [])
            .reduce(u.ifIsReducingText(addHyperlinks), []);

        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { string } text - The message text
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this.model, text, {'Synchronous': true});
        return list;
    }

    async render () {
        return html`${await this.transform()}`
    }

    get length () {
        return this.text.length;
    }

    toString () {
        return "" + this.text;
    }

    textOf () {
        return this.toString();
    }
}

const tpl_mention_with_nick = (o) => html`<span class="mention mention--self badge badge-info">${o.mention}</span>`;
const tpl_mention = (o) => html`<span class="mention">${o.mention}</span>`;

export const renderBodyText = directive(component => async part => {
    const model = component.model;
    const renderer = new MessageBodyRenderer(component);
    part.setValue(await renderer.render());
    part.commit();
    model.collection?.trigger('rendered', model);
});
