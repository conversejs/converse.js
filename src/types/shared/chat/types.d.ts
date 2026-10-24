import type { TemplateResult } from 'lit';
export type EmojiMarkupOptions = {
    unicode_only?: boolean;
    add_title_wrapper?: boolean;
};
/**
 * A panel shown above the message form.
 */
export type ComposerPanelEntry = {
    name: string;
    order: number;
    template: TemplateResult;
};
export type MessageActionButton = {
    i18n_text: string;
    handler: (ev: Event) => void;
    button_class: string;
    icon_class: string;
    name: string;
};
//# sourceMappingURL=types.d.ts.map