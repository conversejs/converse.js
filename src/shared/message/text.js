import URI from 'urijs';
import log from '@converse/headless/log';
import { _converse, api, converse } from '@converse/headless/converse-core';
import { convertASCII2Emoji } from '@converse/headless/converse-emoji.js';
import { html } from 'lit-html';
import { containsDirectives, getDirectiveAndLength, getDirectiveTemplate, isQuoteDirective } from './styling.js';
import { getCodePointReferences, getEmojiMarkup, getShortnameReferences } from '../../headless/converse-emoji.js';

const u = converse.env.utils;

const isString = (s) => typeof s === 'string';

const tpl_mention_with_nick = (o) => html`<span class="mention mention--self badge badge-info">${o.mention}</span>`;
const tpl_mention = (o) => html`<span class="mention">${o.mention}</span>`;


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
export class MessageText extends String {

    /**
     * Create a new {@link MessageText} instance.
     * @param { String } text - The plain text that was received from the `<message>` stanza.
     * @param { Message } model - The model representing the message to which
     *  this MessageText instance belongs
     * @param { Integer } offset - The offset of this particular piece of text
     *  from the start of the original message text. This is necessary because
     *  MessageText instances can be nested when templates call directives
     *  which create new MessageText instances (as happens with XEP-393 styling directives).
     * @param { Boolean } show_images - Whether image URLs should be rendered as <img> tags.
     * @param { Function } onImgLoad - Callback for when an inline rendered image has been loaded
     * @param { Function } onImgClick - Callback for when an inline rendered image has been clicked
     */
    constructor (text, model, offset=0, show_images, onImgLoad, onImgClick) {
        super(text);
        this.model = model;
        this.offset = offset;
        this.onImgClick = onImgClick;
        this.onImgLoad = onImgLoad;
        this.references = [];
        this.show_images = show_images;
        this.payload = [];
    }

    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param { String } text
     * @param { Integer } offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addHyperlinks (text, offset) {
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
        objs.forEach(url_obj => {
            const url_text = text.slice(url_obj.start, url_obj.end);
            const filtered_url = u.filterQueryParamsFromURL(url_text);
            this.addTemplateResult(
                url_obj.start+offset,
                url_obj.end+offset,
                this.show_images && u.isImageURL(url_text) && u.isImageDomainAllowed(url_text) ?
                    u.convertToImageTag(filtered_url, this.onImgLoad, this.onImgClick) :
                    u.convertUrlToHyperlink(filtered_url),
            );
        });
    }

    /**
     * Look for `geo` URIs and return templates that render them as URL links
     * @param { String } text
     * @param { Integer } offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addMapURLs (text, offset) {
        const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
        const matches = text.matchAll(regex);
        for (const m of matches) {
            this.addTemplateResult(
                m.index+offset,
                m.index+m.input.length+offset,
                u.convertUrlToHyperlink(m.input.replace(regex, _converse.geouri_replacement))
            );
        }
    }

    /**
     * Look for emojis (shortnames or unicode) and add templates for rendering them.
     * @param { String } text
     * @param { Integer } offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addEmojis (text, offset) {
        const references = [...getShortnameReferences(text.toString()), ...getCodePointReferences(text.toString())];
        references.forEach(e => {
            this.addTemplateResult(
                e.begin+offset,
                e.end+offset,
                getEmojiMarkup(e, {'add_title_wrapper': true})
            );
        });
    }

    /**
     * Look for mentions included as XEP-0372 references and add templates for
     * rendering them.
     * @param { String } text
     * @param { Integer } offset - The index of the passed in text relative to
     *  the start of the MessageText.
     */
    addMentions (text, offset) {
        offset += this.offset;
        if (!this.model.collection) {
            // This model doesn't belong to a collection anymore, so it must be
            // have been removed in the meantime and can be ignored.
            log.debug('addMentions: ignoring dangling model');
            return;
        }
        const nick = this.model.collection.chatbox.get('nick');
        this.model.get('references')?.forEach(ref => {
            const begin = Number(ref.begin)-offset;
            if (begin >= text.length) {
                return;
            }
            const end = Number(ref.end)-offset;
            const mention = text.slice(begin, end);
            if (mention === nick) {
                this.addTemplateResult(begin, end, tpl_mention_with_nick({mention}));
            } else {
                this.addTemplateResult(begin, end, tpl_mention({mention}));
            }
        });
    }

    /**
     * Look for XEP-0393 styling directives and add templates for rendering
     * them.
     */
    addStyling () {
        if (this.model.get('is_unstyled') || !api.settings.get('allow_message_styling')) {
            return;
        }
        let i = 0;
        const references = [];
        if (containsDirectives(this)) {
            while (i < this.length) {
                const { d, length } = getDirectiveAndLength(this, i);
                if (d && length) {
                    const begin = d === '```' ? i+d.length+1 : i+d.length;
                    const end = isQuoteDirective(d) ? i+length+1 : i+length;
                    const slice_end = isQuoteDirective(d) ? end : end-d.length;
                    references.push({
                        'begin': i,
                        'template': getDirectiveTemplate(d, this.slice(begin, slice_end), this.model, i+d.length),
                        end,
                    });
                    i = end;
                }
                i++;
            }
        }
        references.forEach(ref => this.addTemplateResult(ref.begin, ref.end, ref.template));
    }

    trimMeMessage () {
        if (this.offset === 0) {
            // Subtract `/me ` from 3rd person messages
            if (this.isMeCommand()) {
                this.payload[0] = this.payload[0].substring(4);
            }
        }
    }


    /**
     * Look for plaintext (i.e. non-templated) sections of this MessageText
     * instance and add references via the passed in function.
     * @param { Function } func
     */
    addReferences (func) {
        const payload = this.marshall();
        let idx = 0; // The text index of the element in the payload
        for (const text of payload) {
            if (!text) {
                continue
            } else if (isString(text)) {
                func.call(this, text, idx);
                idx += text.length;
            } else {
                idx = text.end;
            }
        }
    }


    /**
     * Parse the text and add template references for rendering the "rich" parts.
     *
     * @param { MessageText } text
     * @param { Boolean } show_images - Should URLs of images be rendered as `<img>` tags?
     * @param { Function } onImgLoad
     * @param { Function } onImgClick
     **/
    async addTemplates() {
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param { MessageText } text - A {@link MessageText } instance. You
         *  can call {@link MessageText#addTemplateResult } on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('beforeMessageBodyTransformed', this, {'Synchronous': true});

        this.addStyling();
        this.addReferences(this.addMentions);
        this.addReferences(this.addHyperlinks);
        this.addReferences(this.addMapURLs);

        await api.emojis.initialize();
        this.addReferences(this.addEmojis);

        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { MessageText } text - A {@link MessageText } instance. You
         *  can call {@link MessageText#addTemplateResult} on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this, {'Synchronous': true});

        this.payload = this.marshall();
        this.trimMeMessage();
        this.payload = this.payload.map(item => isString(item) ? item : item.template);
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
    addTemplateResult (begin, end, template) {
        this.references.push({begin, end, template});
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

    marshall () {
        let list = [this.toString()];
        this.references
            .sort((a, b) => b.begin - a.begin)
            .forEach(ref => {
                const text = list.shift();
                list = [
                    text.slice(0, ref.begin),
                    ref,
                    text.slice(ref.end),
                    ...list
                ];
            });
        return list.reduce((acc, i) => isString(i) ? [...acc, MessageText.replaceText(i)] : [...acc, i], []);
    }
}
