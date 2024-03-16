import tplAudio from 'templates/audio.js';
import tplGif from 'templates/gif.js';
import tplImage from 'templates/image.js';
import tplVideo from 'templates/video.js';
import { Directive, directive } from 'lit/directive.js';
import { api, log } from '@converse/headless';
import { getEmojiMarkup } from './chat/utils.js';
import { getHyperlinkTemplate } from '../utils/html.js';
import { getMediaURLs } from '@converse/headless/shared/chat/utils.js';
import { getMediaURLsMetadata } from '@converse/headless/shared/parsers.js';
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
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
     * @param {string} text - The text to be annotated
     * @param {number} offset - The offset of this particular piece of text
     *  from the start of the original message text. This is necessary because
     *  RichText instances can be nested when templates call directives
     *  which create new RichText instances (as happens with XEP-393 styling directives).
     * @param {Object} [options]
     * @param {string} [options.nick] - The current user's nickname (only relevant if the message is in a XEP-0045 MUC)
     * @param {boolean} [options.render_styling] - Whether XEP-0393 message styling should be applied to the message
     * @param {boolean} [options.embed_audio] - Whether audio URLs should be rendered as <audio> elements.
     *  If set to `true`, then audio files will always be rendered with an
     *  audio player. If set to `false`, they won't, and if not defined, then the `embed_audio` setting
     *  is used to determine whether they should be rendered as playable audio or as hyperlinks.
     * @param {boolean} [options.embed_videos] - Whether video URLs should be rendered as <video> elements.
     *  If set to `true`, then videos will always be rendered with a video
     *  player. If set to `false`, they won't, and if not defined, then the `embed_videos` setting
     *  is used to determine whether they should be rendered as videos or as hyperlinks.
     * @param {Array} [options.mentions] - An array of mention references
     * @param {Array} [options.media_urls] - An array of {@link MediaURLMetadata} objects,
     *  used to render media such as images, videos and audio. It might not be
     *  possible to have the media metadata available, so if this value is
     *  `undefined` then the passed-in `text` will be parsed for URLs. If you
     *  don't want this parsing to happen, pass in an empty array for this
     *  option.
     * @param {boolean} [options.show_images] - Whether image URLs should be rendered as <img> elements.
     * @param {boolean} [options.show_me_message] - Whether /me messages should be rendered differently
     * @param {Function} [options.onImgClick] - Callback for when an inline rendered image has been clicked
     * @param {Function} [options.onImgLoad] - Callback for when an inline rendered image has been loaded
     * @param {boolean} [options.hide_media_urls] - Callback for when an inline rendered image has been loaded
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
     * @param { number } local_offset - The index of the passed in text relative to
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
                template = tplGif(filtered_url, this.hide_media_urls);
            } else if (isImageURL(url_text) && this.shouldRenderMedia(url_text, 'image')) {
                template = tplImage({
                    'src': filtered_url,
                    // XXX: bit of an abuse of `hide_media_urls`, might want a dedicated option here
                    'href': this.hide_media_urls ? null : filtered_url,
                    'onClick': this.onImgClick,
                    'onLoad': this.onImgLoad
                });
            } else if (isVideoURL(url_text) && this.shouldRenderMedia(url_text, 'video')) {
                template = tplVideo(filtered_url, this.hide_media_urls);
            } else if (isAudioURL(url_text) && this.shouldRenderMedia(url_text, 'audio')) {
                template = tplAudio(filtered_url, this.hide_media_urls);
            } else {
                template = getHyperlinkTemplate(filtered_url);
            }
            this.addTemplateResult(url_obj.start + local_offset, url_obj.end + local_offset, template);
        });
    }

    /**
     * Look for `geo` URIs and return templates that render them as URL links
     * @param { String } text
     * @param { number } offset - The index of the passed in text relative to
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
     * @param {String} text
     * @param {number} offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addEmojis (text, offset) {
        const references = [...getShortnameReferences(text.toString()), ...getCodePointReferences(text.toString())];
        references.forEach(e => {
            this.addTemplateResult(
                e.begin + offset,
                e.end + offset,
                getEmojiMarkup(e, { add_title_wrapper: true })
            );
        });
    }

    /**
     * Look for mentions included as XEP-0372 references and add templates for
     * rendering them.
     * @param { String } text
     * @param { number } local_offset - The index of the passed in text relative to
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
                this.addTemplateResult(
                    begin + local_offset,
                    end + local_offset,
                    tplMentionWithNick({...ref, mention })
                );
            } else {
                this.addTemplateResult(begin + local_offset, end + local_offset, tplMention({...ref, mention }));
            }
        });
    }

    /**
     * Look for XEP-0393 styling directives and add templates for rendering them.
     */
    addStyling () {
        if (!containsDirectives(this)) {
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
        console.log(`addTemplateResult called with ${begin}, ${end}, ${template}`);
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

const isString = (s) => typeof s === 'string';

// We don't render more than two line-breaks, replace extra line-breaks with
// the zero-width whitespace character
// This takes into account other characters that may have been removed by
// being replaced with a zero-width space, such as '> ' in the case of
// multi-line quotes.
const collapseLineBreaks = (text) => text.replace(/\n(\u200B*\n)+/g, m => `\n${'\u200B'.repeat(m.length - 2)}\n`);

const tplMentionWithNick = (o) =>
    html`<span class="mention mention--self badge badge-info" data-uri="${o.uri}">${o.mention}</span>`;

const tplMention = (o) => html`<span class="mention" data-uri="${o.uri}">${o.mention}</span>`;

async function transform (t) {
    try {
        await t.addTemplates();
    } catch (e) {
        log.error(e);
    }
    return t.payload;
}

class StylingDirective extends Directive {
    render (txt, offset, options) {
        const t = new RichText(
            txt,
            offset,
            Object.assign(options, { 'show_images': false, 'embed_videos': false, 'embed_audio': false })
        );
        return html`${until(transform(t), html`${t}`)}`;
    }
}

const renderStylingDirectiveBody = directive(StylingDirective);
const bracketing_directives = ['*', '_', '~', '`'];
const styling_directives = [...bracketing_directives, '```', '>'];
const styling_map = {
    '*': {'name': 'strong', 'type': 'span'},
    '_': {'name': 'emphasis', 'type': 'span'},
    '~': {'name': 'strike', 'type': 'span'},
    '`': {'name': 'preformatted', 'type': 'span'},
    '```': {'name': 'preformatted_block', 'type': 'block'},
    '>': {'name': 'quote', 'type': 'block'}
};

const dont_escape = ['_', '>', '`', '~'];

// prettier-ignore
/* eslint-disable max-len */
const styling_templates = {
    // m is the chatbox model
    // i is the offset of this directive relative to the start of the original message
    'emphasis': (txt, i, options) => html`<span class="styling-directive">_</span><i>${renderStylingDirectiveBody(txt, i, options)}</i><span class="styling-directive">_</span>`,
    'preformatted': txt => html`<span class="styling-directive">\`</span><code>${txt}</code><span class="styling-directive">\`</span>`,
    'preformatted_block': txt => html`<div class="styling-directive">\`\`\`</div><code class="block">${txt}</code><div class="styling-directive">\`\`\`</div>`,
    'quote': (txt, i, options) => html`<blockquote>${renderStylingDirectiveBody(txt, i, options)}</blockquote>`,
    'strike': (txt, i, options) => html`<span class="styling-directive">~</span><del>${renderStylingDirectiveBody(txt, i, options)}</del><span class="styling-directive">~</span>`,
    'strong': (txt, i, options) => html`<span class="styling-directive">*</span><b>${renderStylingDirectiveBody(txt, i, options)}</b><span class="styling-directive">*</span>`,
};

/**
 * Checks whether a given character "d" at index "i" of "text" is a valid opening or closing directive.
 * @param { String } d - The potential directive
 * @param { String } text - The text in which  the directive appears
 * @param { Number } i - The directive index
 * @param { Boolean } opening - Check for a valid opening or closing directive
 */
function isValidDirective (d, text, i, opening) {
    // Ignore directives that are parts of words
    // More info on the Regexes used here: https://javascript.info/regexp-unicode#unicode-properties-p
    if (opening) {
        const regex = RegExp(dont_escape.includes(d) ? `^(\\p{L}|\\p{N})${d}` : `^(\\p{L}|\\p{N})\\${d}`, 'u');
        if (i > 1 && regex.test(text.slice(i-1))) {
            return false;
        }
        const is_quote = isQuoteDirective(d);
        if (is_quote && i > 0 && text[i-1] !== '\n') {
            // Quote directives must be on newlines
            return false;
        } else if (bracketing_directives.includes(d) && (text[i+1] === d)) {
            // Don't consider empty bracketing directives as valid (e.g. **, `` etc.)
            return false;
        }
    } else {
        const regex = RegExp(dont_escape.includes(d) ? `^${d}(\\p{L}|\\p{N})` : `^\\${d}(\\p{L}|\\p{N})`, 'u');
        if (i < text.length-1 && regex.test(text.slice(i))) {
            return false;
        }
        if (bracketing_directives.includes(d) && (text[i-1] === d)) {
            // Don't consider empty directives as valid (e.g. **, `` etc.)
            return false;
        }
    }
    return true;
}

/**
 * Given a specific index "i" of "text", return the directive it matches or null otherwise.
 * @param { String } text - The text in which  the directive appears
 * @param { Number } i - The directive index
 * @param { Boolean } opening - Whether we're looking for an opening or closing directive
 */
function getDirective (text, i, opening=true) {
    let d;

    if (
        (/(^```[\s,\u200B]*\n)|(^```[\s,\u200B]*$)/).test(text.slice(i)) &&
        (i === 0 || text[i-1] === '>' || (/\n\u200B{0,2}$/).test(text.slice(0, i)))
    ) {
        d = text.slice(i, i+3);
    } else if (styling_directives.includes(text.slice(i, i+1))) {
        d = text.slice(i, i+1);
        if (!isValidDirective(d, text, i, opening)) return null;
    } else {
        return null;
    }
    return d;
}

/**
 * Given a directive "d", which occurs in "text" at index "i", check that it
 * has a valid closing directive and return the length from start to end of the
 * directive.
 * @param { String } d -The directive
 * @param { Number } i - The directive index
 * @param { String } text -The text in which the directive appears
 */
function getDirectiveLength (d, text, i) {
    if (!d) return 0;

    const begin = i;
    i += d.length;
    if (isQuoteDirective(d)) {
        i += text.slice(i).split(/\n\u200B*[^>\u200B]/).shift().length;
        return i-begin;
    } else if (styling_map[d].type === 'span') {
        const line = text.slice(i).split('\n').shift();
        let j = 0;
        let idx = line.indexOf(d);
        while (idx !== -1) {
            if (getDirective(text, i+idx, false) === d) {
                return idx+2*d.length;
            }
            idx = line.indexOf(d, j++);
        }
        return 0;
    } else {
        // block directives
        const substring = text.slice(i+1);
        let j = 0;
        let idx = substring.indexOf(d);
        while (idx !== -1) {
            if (getDirective(text, i+1+idx, false) === d) {
                return idx+1+2*d.length;
            }
            idx = substring.indexOf(d, j++);
        }
        return 0;
    }
}

function getDirectiveAndLength (text, i) {
    const d = getDirective(text, i);
    const length = d ? getDirectiveLength(d, text, i) : 0;
    return length > 0 ? { d, length } : {};
}

const isQuoteDirective = (d) => ['>', '&gt;'].includes(d);

function getDirectiveTemplate (d, text, offset, options) {
    const template = styling_templates[styling_map[d].name];
    if (isQuoteDirective(d)) {
        const newtext = text
            // Don't show the directive itself
            // This big [] corresponds to \s without newlines, to avoid issues when the > is the last character of the line
            .replace(/\n\u200B*>[ \f\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?/g, m => `\n${'\u200B'.repeat(m.length - 1)}`)
            .replace(/\n$/, ''); // Trim line-break at the end
        return template(newtext, offset, options);
    } else {
        return template(text, offset, options);
    }
}

function containsDirectives (text) {
    for (let i=0; i<styling_directives.length; i++) {
        if (text.includes(styling_directives[i])) {
            return true;
        }
    }
}
