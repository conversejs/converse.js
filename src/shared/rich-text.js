import tpl_audio from 'templates/audio.js';
import tpl_gif from 'templates/gif.js';
import tpl_image from 'templates/image.js';
import tpl_video from 'templates/video.js';
import { api } from '@converse/headless/core';
import { containsDirectives, getDirectiveAndLength, getDirectiveTemplate, isQuoteDirective } from './styling.js';
import { getEmojiMarkup } from './chat/utils.js';
import { getHyperlinkTemplate } from 'utils/html.js';
import { getMediaURLs } from '@converse/headless/shared/chat/utils.js';
import { getMediaURLsMetadata } from '@converse/headless/shared/parsers.js';
import {
    convertASCII2Emoji,
    getCodePointReferences,
    getShortnameReferences
} from '@converse/headless/plugins/emoji/utils.js';
import {
    filterQueryParamsFromURL,
    isAudioURL,
    isGIFURL,
    isImageURL,
    isVideoURL,
    shouldRenderMediaFromURL,
} from '@converse/headless/utils/url.js';


import { html } from 'lit';

const isString = s => typeof s === 'string';

// We don't render more than two line-breaks, replace extra line-breaks with
// the zero-width whitespace character
const collapseLineBreaks = text => text.replace(/\n\n+/g, m => `\n${'\u200B'.repeat(m.length - 2)}\n`);

const tpl_mention_with_nick = o => html`<span class="mention mention--self badge badge-info" data-uri="${o.uri}">${o.mention}</span>`;
const tpl_mention = o => html`<span class="mention" data-uri="${o.uri}">${o.mention}</span>`;

/**
 * @class RichText
 * A String subclass that is used to render rich text (i.e. text that contains
 * hyperlinks, images, mentions, styling etc.).
 *
 * The "rich" parts of the text is represented by lit TemplateResult
 * objects which are added via the {@link RichText.addTemplateResult}
 * method and saved as metadata.
 *
 * By default Converse adds TemplateResults to support emojis, hyperlinks,
 * images, map URIs and mentions.
 *
 * 3rd party plugins can listen for the `beforeMessageBodyTransformed`
 * and/or `afterMessageBodyTransformed` events and then call
 * `addTemplateResult` on the RichText instance in order to add their own
 * rich features.
 */
export class RichText extends String {
    /**
     * Create a new {@link RichText} instance.
     * @param { String } text - The text to be annotated
     * @param { Integer } offset - The offset of this particular piece of text
     *  from the start of the original message text. This is necessary because
     *  RichText instances can be nested when templates call directives
     *  which create new RichText instances (as happens with XEP-393 styling directives).
     * @param { Object } options
     * @param { String } options.nick - The current user's nickname (only relevant if the message is in a XEP-0045 MUC)
     * @param { Boolean } options.render_styling - Whether XEP-0393 message styling should be applied to the message
     * @param { Boolean } [options.embed_audio] - Whether audio URLs should be rendered as <audio> elements.
     *  If set to `true`, then audio files will always be rendered with an
     *  audio player. If set to `false`, they won't, and if not defined, then the `embed_audio` setting
     *  is used to determine whether they should be rendered as playable audio or as hyperlinks.
     * @param { Boolean } [options.embed_videos] - Whether video URLs should be rendered as <video> elements.
     *  If set to `true`, then videos will always be rendered with a video
     *  player. If set to `false`, they won't, and if not defined, then the `embed_videos` setting
     *  is used to determine whether they should be rendered as videos or as hyperlinks.
     * @param { Array } [options.mentions] - An array of mention references
     * @param { Array } [options.media_urls] - An array of {@link MediaURLMetadata} objects,
     *  used to render media such as images, videos and audio. It might not be
     *  possible to have the media metadata available, so if this value is
     *  `undefined` then the passed-in `text` will be parsed for URLs. If you
     *  don't want this parsing to happen, pass in an empty array for this
     *  option.
     * @param { Boolean } [options.show_images] - Whether image URLs should be rendered as <img> elements.
     * @param { Boolean } options.show_me_message - Whether /me messages should be rendered differently
     * @param { Function } options.onImgClick - Callback for when an inline rendered image has been clicked
     * @param { Function } options.onImgLoad - Callback for when an inline rendered image has been loaded
     */
    constructor (text, offset = 0, options = {}) {
        super(text);
        this.embed_audio = options?.embed_audio;
        this.embed_videos = options?.embed_videos;
        this.mentions = options?.mentions || [];
        this.media_urls = options?.media_urls;
        this.nick = options?.nick;
        this.offset = offset;
        this.onImgClick = options?.onImgClick;
        this.onImgLoad = options?.onImgLoad;
        this.options = options;
        this.payload = [];
        this.references = [];
        this.render_styling = options?.render_styling;
        this.show_images = options?.show_images;
        this.hide_media_urls = options?.hide_media_urls;
    }

    shouldRenderMedia (url_text, type) {
        let override;
        if (type === 'image') {
            override = this.show_images;
        } else if (type === 'audio') {
            override = this.embed_audio;
        } else if (type === 'video') {
            override = this.embed_videos;
        }
        if (typeof override === 'boolean') {
            return override;
        }
        return shouldRenderMediaFromURL(url_text, type);
    }

    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param { String } text
     * @param { Integer } local_offset - The index of the passed in text relative to
     *  the start of this RichText instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    addHyperlinks (text, local_offset) {
        const full_offset = local_offset + this.offset;
        const urls_meta = this.media_urls || getMediaURLsMetadata(text, local_offset).media_urls || [];
        const media_urls = getMediaURLs(urls_meta, text, full_offset);

        media_urls.filter(o => !o.is_encrypted).forEach(url_obj => {
            const url_text = url_obj.url;
            const filtered_url = filterQueryParamsFromURL(url_text);
            let template;
            if (isGIFURL(url_text) && this.shouldRenderMedia(url_text, 'image')) {
                template = tpl_gif(filtered_url, this.hide_media_urls);
            } else if (isImageURL(url_text) && this.shouldRenderMedia(url_text, 'image')) {
                template = tpl_image({
                    'src': filtered_url,
                    // XXX: bit of an abuse of `hide_media_urls`, might want a dedicated option here
                    'href': this.hide_media_urls ? null : filtered_url,
                    'onClick': this.onImgClick,
                    'onLoad': this.onImgLoad
                });
            } else if (isVideoURL(url_text) && this.shouldRenderMedia(url_text, 'video')) {
                template = tpl_video(filtered_url, this.hide_media_urls);
            } else if (isAudioURL(url_text) && this.shouldRenderMedia(url_text, 'audio')) {
                template = tpl_audio(filtered_url, this.hide_media_urls);
            } else {
                template = getHyperlinkTemplate(filtered_url);
            }
            this.addTemplateResult(url_obj.start + local_offset, url_obj.end + local_offset, template);
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
                m.index + offset,
                m.index + m[0].length + offset,
                getHyperlinkTemplate(m[0].replace(regex, api.settings.get('geouri_replacement')))
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
            this.addTemplateResult(e.begin + offset, e.end + offset, getEmojiMarkup(e, { 'add_title_wrapper': true }));
        });
    }

    /**
     * Look for mentions included as XEP-0372 references and add templates for
     * rendering them.
     * @param { String } text
     * @param { Integer } local_offset - The index of the passed in text relative to
     *  the start of this RichText instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    addMentions (text, local_offset) {
        const full_offset = local_offset + this.offset;
        this.mentions?.forEach(ref => {
            const begin = Number(ref.begin) - full_offset;
            if (begin < 0 || begin >= full_offset + text.length) {
                return;
            }
            const end = Number(ref.end) - full_offset;
            const mention = text.slice(begin, end);
            if (mention === this.nick) {
                this.addTemplateResult(begin + local_offset, end + local_offset, tpl_mention_with_nick({...ref, mention }));
            } else {
                this.addTemplateResult(begin + local_offset, end + local_offset, tpl_mention({...ref, mention }));
            }
        });
    }

    /**
     * Look for XEP-0393 styling directives and add templates for rendering them.
     */
    addStyling () {
        if (!containsDirectives(this, this.mentions)) {
            return;
        }

        const references = [];
        const mention_ranges = this.mentions.map(m =>
            Array.from({ 'length': Number(m.end) }, (_, i) => Number(m.begin) + i)
        );
        let i = 0;
        while (i < this.length) {
            if (mention_ranges.filter(r => r.includes(i)).length) { // eslint-disable-line no-loop-func
                // Don't treat potential directives if they fall within a
                // declared XEP-0372 reference
                i++;
                continue;
            }
            const { d, length } = getDirectiveAndLength(this, i);
            if (d && length) {
                const is_quote = isQuoteDirective(d);
                const end = i + length;
                const slice_end = is_quote ? end : end - d.length;
                let slice_begin = d === '```' ? i + d.length + 1 : i + d.length;
                if (is_quote && this[slice_begin] === ' ') {
                    // Trim leading space inside codeblock
                    slice_begin += 1;
                }
                const offset = slice_begin;
                const text = this.slice(slice_begin, slice_end);
                references.push({
                    'begin': i,
                    'template': getDirectiveTemplate(d, text, offset, this.options),
                    end
                });
                i = end;
            }
            i++;
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
     * Look for plaintext (i.e. non-templated) sections of this RichText
     * instance and add references via the passed in function.
     * @param { Function } func
     */
    addAnnotations (func) {
        const payload = this.marshall();
        let idx = 0; // The text index of the element in the payload
        for (const text of payload) {
            if (!text) {
                continue;
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
     * @param { RichText } text
     * @param { Boolean } show_images - Should URLs of images be rendered as `<img>` tags?
     * @param { Function } onImgLoad
     * @param { Function } onImgClick
     **/
    async addTemplates () {
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param { RichText } text - A {@link RichText } instance. You
         *  can call {@link RichText#addTemplateResult } on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('beforeMessageBodyTransformed', this, { 'Synchronous': true });

        this.render_styling && this.addStyling();
        this.addAnnotations(this.addMentions);
        this.addAnnotations(this.addHyperlinks);
        this.addAnnotations(this.addMapURLs);

        await api.emojis.initialize();
        this.addAnnotations(this.addEmojis);

        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { RichText } text - A {@link RichText } instance. You
         *  can call {@link RichText#addTemplateResult} on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger('afterMessageBodyTransformed', this, { 'Synchronous': true });

        this.payload = this.marshall();
        this.options.show_me_message && this.trimMeMessage();
        this.payload = this.payload.map(item => (isString(item) ? item : item.template));
    }

    /**
     * The "rich" markup parts of a chat message are represented by lit
     * TemplateResult objects.
     *
     * This method can be used to add new template results to this message's
     * text.
     *
     * @method RichText.addTemplateResult
     * @param { Number } begin - The starting index of the plain message text
     * which is being replaced with markup.
     * @param { Number } end - The ending index of the plain message text
     * which is being replaced with markup.
     * @param { Object } template - The lit TemplateResult instance
     */
    addTemplateResult (begin, end, template) {
        this.references.push({ begin, end, template });
    }

    isMeCommand () {
        const text = this.toString();
        if (!text) {
            return false;
        }
        return text.startsWith('/me ');
    }

    /**
     * Take the annotations and return an array of text and TemplateResult
     * instances to be rendered to the DOM.
     * @method RichText#marshall
     */
    marshall () {
        let list = [this.toString()];
        this.references
            .sort((a, b) => b.begin - a.begin)
            .forEach(ref => {
                const text = list.shift();
                list = [text.slice(0, ref.begin), ref, text.slice(ref.end), ...list];
            });
        return list.reduce(
            (acc, i) => (isString(i) ? [...acc, convertASCII2Emoji(collapseLineBreaks(i))] : [...acc, i]),
            []
        );
    }
}
