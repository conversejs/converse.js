import URI from "urijs";
import log from '@converse/headless/log';
import { _converse, api, converse } from  "@converse/headless/converse-core";
import { getEmojiMarkup, getCodePointReferences, getShortnameReferences } from "@converse/headless/converse-emoji.js";
import { pipe } from '@converse/headless/utils/functional';
import { directive, html } from "lit-html";
import { until } from 'lit-html/directives/until.js';

import { URL_START_REGEX } from '../../utils/html';

const u = converse.env.utils;


function addMapURLs (text) {
    const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
    const matches = text.matchAll(regex);
    for (const m of matches) {
        text.addTemplateResult(
            m.index,
            m.index+m.input.length,
            u.convertUrlToHyperlink(m.input.replace(regex, _converse.geouri_replacement))
        );
    }
}


function addHyperlinks (text, onImgLoad, onImgClick) {
    const objs = [];
    try {
        const parse_options = { 'start': URL_START_REGEX };
        URI.withinString(text, (url, start, end) => {
            objs.push({url, start, end})
            return url;
        } , parse_options);
    } catch (error) {
        log.debug(error);
        return;
    }
    const show_images = api.settings.get('show_images_inline');
    objs.forEach(url_obj => {
        const url_text = text.slice(url_obj.start, url_obj.end);
        text.addTemplateResult(
            url_obj.start,
            url_obj.end,
            show_images && u.isImageURL(url_text) ?
                u.convertToImageTag(url_text, onImgLoad, onImgClick) :
                u.convertUrlToHyperlink(url_text),
        );
    });
}


async function addEmojis (text) {
    await api.emojis.initialize();
    const references = [...getShortnameReferences(text.toString()), ...getCodePointReferences(text.toString())];
    references.forEach(e => {
        text.addTemplateResult(
            e.begin,
            e.end,
            getEmojiMarkup(e, {'add_title_wrapper': true})
        );
    });
}


const tpl_mention_with_nick = (o) => html`<span class="mention mention--self badge badge-info">${o.mention}</span>`;
const tpl_mention = (o) => html`<span class="mention">${o.mention}</span>`;


function addReferences (text, model) {
    const nick = model.collection.chatbox.get('nick');
    model.get('references')?.forEach(ref => {
        const mention = text.slice(ref.begin, ref.end);
        if (mention === nick) {
            text.addTemplateResult(ref.begin, ref.end, tpl_mention_with_nick({mention}));
        } else {
            text.addTemplateResult(ref.begin, ref.end, tpl_mention({mention}));
        }
    });
}


class MessageBodyRenderer {

    constructor (component) {
        this.model = component.model;
        this.component = component;
        this.chatview = u.ancestor(this.component, 'converse-chat-message')?.chatview;
        // We jot down whether we were scrolled down before rendering, because when an
        // image loads, it triggers 'scroll' and the chat will be marked as scrolled,
        // which is technically true, but not what we want because the user
        // didn't initiate the scrolling.
        this.was_scrolled_up = this.chatview.model.get('scrolled');
        this.text = this.component.model.getMessageText();
    }

    scrollDownOnImageLoad () {
        if (!this.was_scrolled_up) {
            this.chatview.scrollDown();
        }
    }

    async transform () {
        const { parser } = api.message;
        let filtered_text = parser.runFilters(this.text);
        const rich_message = parser.richMessageFromText(filtered_text);

        addHyperlinks(
            rich_message,
            () => this.scrollDownOnImageLoad(),
            ev => this.component.showImageModal(ev)
        );
        addMapURLs(rich_message);
        await addEmojis(rich_message);
        addReferences(rich_message, this.model);

        parser.runMiddleware(rich_message);
        return parser.toTransform(rich_message);
    }

    render () {
        return html`${until(this.transform(), html`${this.text}`)}`;
    }
}


export const renderBodyText = directive(component => part => {
    const renderer = new MessageBodyRenderer(component);
    part.setValue(renderer.render());
    const model = component.model;
    model.collection?.trigger('rendered', model);
});
