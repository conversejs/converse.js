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
    constructor(text: string, offset?: number, options?: {
        nick?: string;
        render_styling?: boolean;
        embed_audio?: boolean;
        embed_videos?: boolean;
        mentions?: any[];
        media_urls?: any[];
        show_images?: boolean;
        show_me_message?: boolean;
        onImgClick?: Function;
        onImgLoad?: Function;
        hide_media_urls?: boolean;
    });
    embed_audio: boolean;
    embed_videos: boolean;
    mentions: any[];
    media_urls: any[];
    nick: string;
    offset: number;
    onImgClick: Function;
    onImgLoad: Function;
    options: {
        nick?: string;
        render_styling?: boolean;
        embed_audio?: boolean;
        embed_videos?: boolean;
        mentions?: any[];
        media_urls?: any[];
        show_images?: boolean;
        show_me_message?: boolean;
        onImgClick?: Function;
        onImgLoad?: Function;
        hide_media_urls?: boolean;
    };
    payload: any[];
    references: any[];
    render_styling: boolean;
    show_images: boolean;
    hide_media_urls: boolean;
    shouldRenderMedia(url_text: any, type: any): any;
    /**
     * Look for `http` URIs and return templates that render them as URL links
     * @param { String } text
     * @param { number } local_offset - The index of the passed in text relative to
     *  the start of this RichText instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    addHyperlinks(text: string, local_offset: number): void;
    /**
     * Look for `geo` URIs and return templates that render them as URL links
     * @param { String } text
     * @param { number } offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addMapURLs(text: string, offset: number): void;
    /**
     * Look for emojis (shortnames or unicode) and add templates for rendering them.
     * @param {String} text
     * @param {number} offset - The index of the passed in text relative to
     *  the start of the message body text.
     */
    addEmojis(text: string, offset: number): void;
    /**
     * Look for mentions included as XEP-0372 references and add templates for
     * rendering them.
     * @param { String } text
     * @param { number } local_offset - The index of the passed in text relative to
     *  the start of this RichText instance (which is not necessarily the same as the
     *  offset from the start of the original message stanza's body text).
     */
    addMentions(text: string, local_offset: number): void;
    /**
     * Look for XEP-0393 styling directives and add templates for rendering them.
     */
    addStyling(): void;
    trimMeMessage(): void;
    /**
     * Look for plaintext (i.e. non-templated) sections of this RichText
     * instance and add references via the passed in function.
     * @param { Function } func
     */
    addAnnotations(func: Function): void;
    /**
     * Parse the text and add template references for rendering the "rich" parts.
     **/
    addTemplates(): Promise<void>;
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
    addTemplateResult(begin: number, end: number, template: any): void;
    isMeCommand(): boolean;
    /**
     * Take the annotations and return an array of text and TemplateResult
     * instances to be rendered to the DOM.
     * @method RichText#marshall
     */
    marshall(): any[];
}
//# sourceMappingURL=rich-text.d.ts.map