import type { TemplateResult } from 'lit';

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

/**
 * A panel shown above the message form.
 */
export type ComposerPanelEntry = {
    name: string;
    // Sorts the panel against the others, smallest at the top. Panels with the
    // same order keep the order their handlers ran in, and a panel without a
    // numeric order goes below the built-in ones. The built-in values are listed
    // under "Composer panels" in the plugin development docs.
    order: number;
    template: TemplateResult;
};

/**
 * A row in the attachment menu, which the paperclip in a chat's toolbar opens.
 */
export type AttachmentMenuItem = {
    // A stable identifier, such as `file`, `image`, `location` or `voice-message`.
    name: string;
    // Sorts the item against the others, smallest first. The built-in values are
    // listed under "Attachment menu" in the plugin development docs. An item
    // without a numeric order goes last.
    order?: number;
    // The icon class to draw, such as `fa-paperclip`.
    icon: string;
    // The translated text shown next to the icon.
    label: string;
    // Called when the item is activated. The menu closes before it runs.
    handler: () => void;
};

export type MessageActionButton = {
    i18n_text: string;
    handler: (ev: Event) => void;
    button_class: string;
    icon_class: string;
    name: string;
};
