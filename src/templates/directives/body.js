import URI from "urijs";
import log from '@converse/headless/log';
import tpl_avatar from "templates/avatar.js";
import xss from "xss/dist/xss";
import { _converse, api, converse } from  "@converse/headless/converse-core";
import { directive, html } from "lit-html";
import { isString } from "lodash";

const u = converse.env.utils;


function onTagFoundDuringXSSFilter (tag, html, options) {
    /* This function gets called by the XSS library whenever it finds
     * what it thinks is a new HTML tag.
     *
     * It thinks that something like <https://example.com> is an HTML
     * tag and then escapes the <> chars.
     *
     * We want to avoid this, because it prevents these URLs from being
     * shown properly (whithout the trailing &gt;).
     *
     * The URI lib correctly trims a trailing >, but not a trailing &gt;
     */
    if (options.isClosing) {
        // Closing tags don't match our use-case
        return;
    }
    const uri = new URI(tag);
    const protocol = uri.protocol().toLowerCase();
    if (!["https", "http", "xmpp", "ftp"].includes(protocol)) {
        // Not a URL, the tag will get filtered as usual
        return;
    }
    if (uri.equals(tag) && `<${tag}>` === html.toLocaleLowerCase()) {
        // We have something like <https://example.com>, and don't want
        // to filter it.
        return html;
    }
}


class Markup extends String {

    constructor (data) {
        super();
        this.markup = data.markup;
        this.text = data.text;
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

        let text = xss.filterXSS(this.text, {'whiteList': {}, 'onTag': onTagFoundDuringXSSFilter});
        text = this.component.is_me_message ? text.substring(4) : text;
        text = u.geoUriToHttp(text, _converse.geouri_replacement);

        const process = (text) => {
            text = u.addEmoji(text);
            return addMentionsMarkup(text, this.model.get('references'), this.model.collection.chatbox);
        }
        const list = await Promise.all(addHyperlinks(text));
        this.list = list.reduce((acc, i) => isString(i) ? [...acc, ...process(i)] : [...acc, i], []);
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { string } text - The message text
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this.model, text, {'Synchronous': true});

        return this.list;
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


function addHyperlinks (text) {
    const objs = [];
    const parse_options = { 'start': /\b(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi };
    try {
        URI.withinString(text, (url, start, end) => {
            objs.push({url, start, end})
            return url;
        } , parse_options);
    } catch (error) {
        log.debug(error);
        return [text];
    }
    let list = [];
    objs.sort((a, b) => b.start - a.start)
        .forEach(url_obj => {
            const new_list = [
                text.slice(0, url_obj.start),
                u.isImageURL(text) ? u.convertToImageTag(text) : u.convertUrlToHyperlink(text),
                text.slice(url_obj.end),
                ...list
            ];
            list = new_list.filter(i => i);
            text = text.slice(0, url_obj.start);
        });
    return list;
}


function addMentionsMarkup (text, references, chatbox) {
    if (chatbox.get('message_type') !== 'groupchat') {
        return [text];
    }
    const nick = chatbox.get('nick');
    let list = [];
    references
        .sort((a, b) => b.begin - a.begin)
        .forEach(ref => {
            const mention = text.slice(ref.begin, ref.end)
            chatbox;
            if (mention === nick) {
                list = [text.slice(0, ref.begin), new Markup(mention, tpl_mention_with_nick({mention})), text.slice(ref.end),  ...list];
            } else {
                list = [text.slice(0, ref.begin), new Markup(mention, tpl_mention({mention})), text.slice(ref.end), ...list];
            }
            text = text.slice(0, ref.begin);
        });
    return list;
}


export const renderBodyText = directive(component => async part => {
    const model = component.model;
    const renderer = new MessageBodyRenderer(component);
    part.setValue(await renderer.render());
    part.commit();
    model.collection && model.collection.trigger('rendered', model);
    component.registerClickHandlers();
});


export const renderAvatar = directive(o => part => {
    if (o.type === 'headline' || o.is_me_message) {
        part.setValue('');
        return;
    }
    if (o.model.vcard) {
        const data = {
            'classes': 'avatar chat-msg__avatar',
            'width': 36,
            'height': 36,
        }
        const image_type = o.model.vcard.get('image_type');
        const image = o.model.vcard.get('image');
        data['image'] = "data:" + image_type + ";base64," + image;
        part.setValue(tpl_avatar(data));
    }
});
