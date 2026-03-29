export type EmojiMarkupOptions = {
    // Whether emojis are rendered as
    // unicode codepoints. If so, the returned result will be an array
    // with containing one string, because the emojis themselves will
    // also be strings. If set to false, emojis will be represented by
    // lit TemplateResult objects.
    unicode_only?: boolean;
    // Whether unicode codepoints should be wrapped with a `<span>`
    // element with a title, so that the shortname is shown upon
    // hovering with the mouse.
    add_title_wrapper?: boolean;
};
