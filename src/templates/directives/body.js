import URI from "urijs";
import log from '@converse/headless/log';
import { _converse, api, converse } from  "@converse/headless/converse-core";
import { convertASCII2Emoji, getEmojiMarkup, getCodePointReferences, getShortnameReferences } from "@converse/headless/converse-emoji.js";
import { directive, html } from "lit-html";
import { getStylingReferences } from "@converse/headless/utils/parse-helpers";
import { until } from 'lit-html/directives/until.js';

const u = converse.env.utils;


/**
 * @class MessageText
 * A String subclass that is used to represent the rich text
 * of a chat message.
 *
 * The "rich" parts of the text is represented by lit-html TemplateResult
 * objects which are added via the {@link MessageText.addTemplateResult}
 * method and saved as metadata.
 *
 * By default Converse adds TemplateResults to support emojis, hyperlinks,
 * images, map URIs and mentions.
 *
 * 3rd party plugins can listen for the `beforeMessageBodyTransformed`
 * and/or `afterMessageBodyTransformed` events and then call
 * `addTemplateResult` on the MessageText instance in order to add their own
 * rich features.
 */
class MessageText extends String {

    /**
     * Create a new {@link MessageText} instance.
     * @param { String } text - The plain text that was received from the `<message>` stanza.
     */
    constructor (text) {
        super(text);
        this.references = [];
    }

    /**
     * The "rich" markup parts of a chat message are represented by lit-html
     * TemplateResult objects.
     *
     * This method can be used to add new template results to this message's
     * text.
     *
     * @method MessageText.addTemplateResult
     * @param { Number } begin - The starting index of the plain message text
     * which is being replaced with markup.
     * @param { Number } end - The ending index of the plain message text
     * which is being replaced with markup.
     * @param { Object } template - The lit-html TemplateResult instance
     */
    // addTemplateResult (begin, end, template) {
    //     this.references.push({begin, end, template});
    // }
    addTemplate(begin, end, template, ref_object = '', references = this.references) {
        for (let ref of references) {
          if (ref.begin < begin && end <= ref.end) {
            return this.addTemplate(begin, end, template, ref.references, ref_object);
          }
        }
        const reference = { begin, end, references: [], template };
        if (ref_object)  reference.ref = {...ref_object}
        const inner_references = [];
        const current_references = [];
        for (let ref of references) {
          if (ref.begin > reference.begin && reference.end >= ref.end) {
            inner_references.push({ ...ref });
          } else {
            current_references.push({ ...ref });
          }
        }
        reference.references = [...inner_references];
        current_references.push({ ...reference });
        references.splice(0, references.length, ...current_references);
    }

    isMeCommand () {
        const text = this.toString();
        if (!text) {
            return false;
        }
        return text.startsWith('/me ');
    }

    static replaceText (text) {
        return convertASCII2Emoji(text.replace(/\n\n+/g, '\n\n'));
    }

    innerMarshall (references, message, original_text, outer_ref_begin=0, inner=false) {
        let list = [message.toString()];
        references
            .sort((a, b) => b.begin - a.begin)
            .forEach(ref => {
                const text = list.shift();
                list = [
                    text.slice(0, ref.begin - outer_ref_begin),
                    typeof ref.template === 'function'
                    ? ref.template(
                        this.innerMarshall(ref.references, original_text.slice(ref.begin, ref.end), original_text, ref.begin, true),
                        ref.ref)
                    : ref.template,
                    text.slice(ref.end - outer_ref_begin),
                    ...list
                ];
            });
        // return inner ? list.filter(n => n).join('') : list.filter(n => n);
        return inner ? list.filter(n => n) : list.filter(n => n);
    }

    marshall () {
        // let list = [this.toString()];
        // this.references
        //     .sort((a, b) => b.begin - a.begin)
        //     .forEach(ref => {
        //         const text = list.shift();
        //         list = [
        //             text.slice(0, ref.begin),
        //             ref.template,
        //             text.slice(ref.end),
        //             ...list
        //         ];
        //     });
        const list = this.innerMarshall (this.references, this.toString(), this.toString());

        // Subtract `/me ` from 3rd person messages
        if (this.isMeCommand()) list[0] = list[0].substring(4);

        const isString = (s) => typeof s === 'string';
        return list.reduce((acc, i) => isString(i) ? [...acc, MessageText.replaceText(i)] : [...acc, i], []);
    }
}

const styling_templates = {
    strong: (text) => {
      return html`<b>${text}</b>`;
    },
    strike: (text) => {
      return html`<del>${text}</del>`;
    },
    emphasis: (text) => {
      return html`<i>${text}</i>`;
    },
    preformated: (text) => {
      return html`<code>${text}</code>`;
    },
    BLANK: function (text) {
      return "";
    },
    PREFORMATED: function (text, ref) {
      return html`<div class="code_block">${extractStylingDirectives (text, ref)}</div>`;
    },
    QUOTE: function (text, ref) {
      return html`<div class="quote">${extractStylingDirectives (text, ref)}</div>`;
    },
};

function extractStylingDirectives (text, ref) {
    if (typeof text === 'string') {
        return text.slice(ref.beginning_offset, text.length - ref.closing_offset);
    }
    else if (Array.isArray(text)) {
        if (text.length === 1 && typeof text[0] === 'string') {
            return text[0].slice(ref.beginning_offset, text[0].length - ref.closing_offset);
        }
        if (typeof text[0] === 'string') {
            text[0] = text[0].slice(ref.beginning_offset);
        }
        if (typeof text[text.length - 1] === 'string') {
            text[text.length - 1] = text[text.length - 1].slice(0, text[text.length - 1].length - ref.closing_offset);
        }
    }
    return text;
}

function addStylingReferences(text) {
    getStylingReferences(text).forEach((ref) => {
      if (styling_templates[ref.type]) {
        text.addTemplate(ref.begin, ref.end, styling_templates[ref.type], ref);
      }
    });
}

function addMapURLs (text) {
    const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
    const matches = text.matchAll(regex);
    for (const m of matches) {
        text.addTemplate(
            m.index,
            m.index+m.input.length,
            u.convertUrlToHyperlink(m.input.replace(regex, _converse.geouri_replacement))
        );
    }
}


function addHyperlinks (text, onImgLoad, onImgClick) {
    const objs = [];
    try {
        const parse_options = { 'start': /\b(?:([a-z][a-z0-9.+-]*:\/\/)|xmpp:|mailto:|www\.)/gi };
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
        const filtered_url = u.filterQueryParamsFromURL(url_text);
        text.addTemplate(
            url_obj.start,
            url_obj.end,
            show_images && u.isImageURL(url_text) && u.isImageDomainAllowed(url_text) ?
                u.convertToImageTag(filtered_url, onImgLoad, onImgClick) :
                u.convertUrlToHyperlink(filtered_url),
        );
    });
}


async function addEmojis (text) {
    await api.emojis.initialize();
    const references = [...getShortnameReferences(text.toString()), ...getCodePointReferences(text.toString())];
    references.forEach(e => {
        text.addTemplate(
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
            text.addTemplate(ref.begin, ref.end, tpl_mention_with_nick({mention}));
        } else {
            text.addTemplate(ref.begin, ref.end, tpl_mention({mention}));
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
        const text = new MessageText(this.text);
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { MessageText } text - A {@link MessageText } instance. You
         * can call {@link MessageText#addTemplateResult } on it in order to
         * add TemplateResult objects meant to render rich parts of the
         * message.
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('beforeMessageBodyTransformed', this.model, text, {'Synchronous': true});

        addHyperlinks(
            text,
            () => this.scrollDownOnImageLoad(),
            ev => this.component.showImageModal(ev)
        );
        addMapURLs(text);
        await addEmojis(text);
        addReferences(text, this.model);
        addStylingReferences(text);
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { _converse.Message } model - The model representing the message
         * @param { MessageText } text - A {@link MessageText } instance. You
         * can call {@link MessageText#addTemplateResult} on it in order to
         * add TemplateResult objects meant to render rich parts of the
         * message.
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this.model, text, {'Synchronous': true});
        return text.marshall();
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
