import { html } from "lit";
import { until } from "lit/directives/until.js";
import { Directive, directive } from "lit/directive.js";
import { api, u } from "@converse/headless";
import tplAudio from "./templates/audio.js";
import tplGif from "./templates/gif.js";
import tplImage from "./templates/image.js";
import tplVideo from "./templates/video.js";
import tplSpotify from "./templates/spotify.js";
import { getEmojiMarkup } from "../chat/utils.js";
import { getHyperlinkTemplate } from "../../utils/html.js";
import { shouldRenderMediaFromURL, filterQueryParamsFromURL } from "utils/url.js";
import {
    collapseLineBreaks,
    containsDirectives,
    getDirectiveAndLength,
    getHeaders,
    isQuoteDirective,
    isSpotifyTrack,
    isString,
    tplMention,
    tplMentionWithNick,
} from "./utils.js";
import { styling_map } from "./constants.js";

const {
    addMediaURLsOffset,
    convertASCII2Emoji,
    getCodePointReferences,
    getMediaURLsMetadata,
    getShortnameReferences,
    isAudioURL,
    isGIFURL,
    isImageURL,
    isVideoURL,
} = u;

/**
 * @class Texture
 * A String subclass that is used to render rich text (i.e. text that contains
 * hyperlinks, images, mentions, styling etc.).
 *
 * The "rich" parts of the text is represented by lit TemplateResult
 * objects which are added via the {@link Texture.addTemplateResult}
 * method and saved as metadata.
 *
 * By default Converse adds TemplateResults to support emojis, hyperlinks,
 * images, map URIs and mentions.
 *
 * 3rd party plugins can listen for the `beforeMessageBodyTransformed`
 * and/or `afterMessageBodyTransformed` events and then call
 * `addTemplateResult` on the Texture instance in order to add their own
 * rich features.
 */
export class Texture extends String {
    /**
     * Create a new {@link Texture} instance.
     * @param {string} text - The text to be annotated
     * @param {number} offset - The offset of this particular piece of text
     *  from the start of the original message text. This is necessary because
     *  Texture instances can be nested when templates call directives
     *  which create new Texture instances (as happens with XEP-393 styling directives).
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
     * @param {MediaURLMetadata[]} [options.media_urls] - An array of {@link MediaURLMetadata} objects,
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
     *
     * @typedef {module:headless-shared-parsers.MediaURLMetadata} MediaURLMetadata
     */
    constructor(text, offset = 0, options = {}) {
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

    /**
     * @param {string} url - The URL to be checked
     * @param {'audio'|'image'|'video'} type - The type of media
     */
    shouldRenderMedia(url, type) {
        let override;
        if (type === "image") {
            override = this.show_images;
        } else if (type === "audio") {
            override = this.embed_audio;
        } else if (type === "video") {
            override = this.embed_videos;
        }
        if (typeof override === "boolean") {
            return override;
        }
        return shouldRenderMediaFromURL(url, type);
    }

    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param {import('utils/url').MediaURLData} url_obj
     * @returns {Promise<string|import('lit').TemplateResult>}
     */
    async addHyperlinkTemplate(url_obj) {
        const { url_text } = url_obj;
        const filtered_url = filterQueryParamsFromURL(url_text);
        let template;
        if (isGIFURL(url_text) && this.shouldRenderMedia(url_text, "image")) {
            template = tplGif(filtered_url, this.hide_media_urls);
        } else if (isImageURL(url_text) && this.shouldRenderMedia(url_text, "image")) {
            template = tplImage({
                src: filtered_url,
                // XXX: bit of an abuse of `hide_media_urls`, might want a dedicated option here
                href: this.hide_media_urls ? null : filtered_url,
                onClick: this.onImgClick,
                onLoad: this.onImgLoad,
            });
        } else if (isVideoURL(url_text) && this.shouldRenderMedia(url_text, "video")) {
            template = tplVideo(filtered_url, this.hide_media_urls);
        } else if (isAudioURL(url_text) && this.shouldRenderMedia(url_text, "audio")) {
            template = tplAudio(filtered_url, this.hide_media_urls);
        } else if (api.settings.get("embed_3rd_party_media_players") && isSpotifyTrack(url_text)) {
            const song_id = url_text.split("/track/")[1];
            template = tplSpotify(song_id, url_text, this.hide_media_urls);
        } else {
            if (this.shouldRenderMedia(url_text, "audio") && api.settings.get("fetch_url_headers")) {
                const headers = await getHeaders(url_text);
                if (headers?.get("content-type")?.startsWith("audio")) {
                    template = tplAudio(filtered_url, this.hide_media_urls, headers.get("Icy-Name"));
                }
            }
        }
        return template || getHyperlinkTemplate(filtered_url);
    }

    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param {string} text
     * @param {number} local_offset - The index of the passed in text relative to
     *  the start of this Texture instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    async addHyperlinks(text, local_offset) {
        const media_urls = addMediaURLsOffset(
            getMediaURLsMetadata(text, local_offset).media_urls || [],
            text,
            local_offset
        );
        await Promise.all(
            media_urls
                .filter((o) => !o.is_encrypted)
                .map(async (o) => {
                    const template = await this.addHyperlinkTemplate(o);
                    this.addTemplateResult(o.start + local_offset, o.end + local_offset, template);
                })
        );
    }

    /**
     * Look for `geo` URIs and return templates that render them as URL links
     * @param {String} text
     * @param {number} offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addMapURLs(text, offset) {
        const regex = /geo:([\-0-9.]+),([\-0-9.]+)(?:,([\-0-9.]+))?(?:\?(.*))?/g;
        const matches = text.matchAll(regex);
        for (const m of matches) {
            this.addTemplateResult(
                m.index + offset,
                m.index + m[0].length + offset,
                getHyperlinkTemplate(m[0].replace(regex, api.settings.get("geouri_replacement")))
            );
        }
    }

    /**
     * Look for emojis (shortnames or unicode) and add templates for rendering them.
     * @param {String} text
     * @param {number} offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addEmojis(text, offset) {
        const references = [...getShortnameReferences(text.toString()), ...getCodePointReferences(text.toString())];
        references.forEach((e) => {
            this.addTemplateResult(e.begin + offset, e.end + offset, getEmojiMarkup(e, { add_title_wrapper: true }));
        });
    }

    /**
     * Look for mentions included as XEP-0372 references and add templates for
     * rendering them.
     * @param {String} text
     * @param {number} local_offset - The index of the passed in text relative to
     *  the start of this Texture instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    addMentions(text, local_offset) {
        const full_offset = local_offset + this.offset;
        this.mentions?.forEach((ref) => {
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
                    tplMentionWithNick({ ...ref, mention })
                );
            } else {
                this.addTemplateResult(begin + local_offset, end + local_offset, tplMention({ ...ref, mention }));
            }
        });
    }

    /**
     * Look for XEP-0393 styling directives and add templates for rendering them.
     */
    addStyling() {
        if (!containsDirectives(this)) {
            return;
        }

        const references = [];
        const mention_ranges = this.mentions.map((m) =>
            Array.from({ "length": Number(m.end) }, (_, i) => Number(m.begin) + i)
        );
        let i = 0;
        while (i < this.length) {
            if (mention_ranges.filter((r) => r.includes(i)).length) {
                // eslint-disable-line no-loop-func
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
                let slice_begin = d === "```" ? i + d.length + 1 : i + d.length;
                if (is_quote && this[slice_begin] === " ") {
                    // Trim leading space inside codeblock
                    slice_begin += 1;
                }
                const offset = slice_begin;
                const text = this.slice(slice_begin, slice_end);
                references.push({
                    begin: i,
                    template: getDirectiveTemplate(d, text, offset, this.options),
                    end,
                });
                i = end;
            }
            i++;
        }
        references.forEach((ref) => this.addTemplateResult(ref.begin, ref.end, ref.template));
    }

    trimMeMessage() {
        if (this.offset === 0) {
            // Subtract `/me ` from 3rd person messages
            if (this.isMeCommand()) {
                this.payload[0] = this.payload[0].substring(4);
            }
        }
    }

    /**
     * Look for plaintext (i.e. non-templated) sections of this Texture
     * instance and add references via the passed in function.
     * @param {Function} func
     */
    async addAnnotations(func) {
        const payload = this.marshall();
        let idx = 0; // The text index of the element in the payload
        for (const text of payload) {
            if (!text) {
                continue;
            } else if (isString(text)) {
                await func.call(this, text, idx);
                idx += text.length;
            } else {
                idx = text.end;
            }
        }
    }

    /**
     * Parse the text and add template references for rendering the "rich" parts.
     **/
    async addTemplates() {
        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * before the default transformations have been applied.
         * @event _converse#beforeMessageBodyTransformed
         * @param {Texture} text - A {@link Texture } instance. You
         *  can call {@link Texture#addTemplateResult } on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('beforeMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger("beforeMessageBodyTransformed", this, { synchronous: true });

        this.render_styling && this.addStyling();

        await this.addAnnotations(this.addMentions);
        await this.addAnnotations(this.addHyperlinks);
        await this.addAnnotations(this.addMapURLs);

        await api.emojis.initialize();
        await this.addAnnotations(this.addEmojis);

        /**
         * Synchronous event which provides a hook for transforming a chat message's body text
         * after the default transformations have been applied.
         * @event _converse#afterMessageBodyTransformed
         * @param { Texture } text - A {@link Texture } instance. You
         *  can call {@link Texture#addTemplateResult} on it in order to
         *  add TemplateResult objects meant to render rich parts of the message.
         * @example _converse.api.listen.on('afterMessageBodyTransformed', (view, text) => { ... });
         */
        await api.trigger("afterMessageBodyTransformed", this, { synchronous: true });

        this.payload = this.marshall();
        this.options.show_me_message && this.trimMeMessage();
        this.payload = this.payload.map((item) => (isString(item) ? item : item.template));
    }

    /**
     * The "rich" markup parts of a chat message are represented by lit
     * TemplateResult objects.
     *
     * This method can be used to add new template results to this message's
     * text.
     *
     * @method Texture.addTemplateResult
     * @param {Number} begin - The starting index of the plain message text
     * which is being replaced with markup.
     * @param {Number} end - The ending index of the plain message text
     * which is being replaced with markup.
     * @param {Object} template - The lit TemplateResult instance
     */
    addTemplateResult(begin, end, template) {
        this.references.push({ begin, end, template });
    }

    isMeCommand() {
        const text = this.toString();
        if (!text) {
            return false;
        }
        return text.startsWith("/me ");
    }

    /**
     * Take the annotations and return an array of text and TemplateResult
     * instances to be rendered to the DOM.
     * @method Texture#marshall
     */
    marshall() {
        let list = [this.toString()];
        this.references
            .sort((a, b) => b.begin - a.begin)
            .forEach((ref) => {
                const text = list.shift();
                list = [text.slice(0, ref.begin), ref, text.slice(ref.end), ...list];
            });
        return list.reduce(
            (acc, i) => (isString(i) ? [...acc, convertASCII2Emoji(collapseLineBreaks(i))] : [...acc, i]),
            []
        );
    }
}

// Kept here to avoid circular dependencies
class StylingDirective extends Directive {
    /**
     * @param {Texture} t
     */
    static async transform(t) {
        try {
            await t.addTemplates();
        } catch (e) {
            console.error(e);
        }
        return t.payload;
    }

    /**
     * @param {string} txt
     * @param {number} offset
     * @param {object} options
     */
    render(txt, offset, options) {
        const t = new Texture(
            txt,
            offset,
            Object.assign(options, { "show_images": false, "embed_videos": false, "embed_audio": false })
        );
        return html`${until(StylingDirective.transform(t), html`${t}`)}`;
    }
}

const renderStyling = directive(StylingDirective);

// prettier-ignore
/* eslint-disable max-len */
const styling_templates = {
    // m is the chatbox model
    // i is the offset of this directive relative to the start of the original message
    emphasis: (txt, i, options) => html`<span class="styling-directive">_</span><i>${renderStyling(txt, i, options)}</i><span class="styling-directive">_</span>`,
    preformatted: (txt) => html`<span class="styling-directive">\`</span><code>${txt}</code><span class="styling-directive">\`</span>`,
    preformatted_block: (txt) => html`<div class="styling-directive">\`\`\`</div><pre><code class="block">${txt}</code></pre><div class="styling-directive">\`\`\`</div>`,
    quote: (txt, i, options) => html`<blockquote>${renderStyling(txt, i, options)}</blockquote>`,
    strike: (txt, i, options) => html`<span class="styling-directive">~</span><del>${renderStyling(txt, i, options)}</del><span class="styling-directive">~</span>`,
    strong: (txt, i, options) => html`<span class="styling-directive">*</span><b>${renderStyling(txt, i, options)}</b><span class="styling-directive">*</span>`,
};

/**
 * @param {string} d
 * @param {string} text
 * @param {number} offset
 * @param {object} options
 */
export function getDirectiveTemplate(d, text, offset, options) {
    const template = styling_templates[styling_map[d].name];
    if (isQuoteDirective(d)) {
        const newtext = text
            // Don't show the directive itself
            // This big [] corresponds to \s without newlines, to avoid issues when the > is the last character of the line
            .replace(
                /\n\u200B*>[ \f\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]?/g,
                (m) => `\n${"\u200B".repeat(m.length - 1)}`
            )
            .replace(/\n$/, ""); // Trim line-break at the end
        return template(newtext, offset, options);
    } else {
        return template(text, offset, options);
    }
}
