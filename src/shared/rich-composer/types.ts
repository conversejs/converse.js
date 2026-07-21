export type RichEditor = {
    editor: import('lexical').LexicalEditor;
    getMarkdown: () => string; // Serialize via the consumer's output transformers
    setMarkdown: (text: string) => void; // Replace the document, parsing with the same set
    getHtml: () => string;
    isEmpty: () => boolean;
    insertText: (text: string) => void;
    format: (type: import('lexical').TextFormatType) => boolean;
    isCaretAtStart: () => boolean; // Stands in for a textarea's selectionEnd === 0
    isCaretAtEnd: () => boolean;
    getTriggerQuery: (regex: RegExp) => string | null; // See ./triggers.js
    replaceTrigger: (trigger: string, replacement: string) => void;
    replaceTriggerWithLink: (trigger: string, text: string, url: string) => void;
    selectStart: () => void;
    clear: () => void;
    focus: () => void;
    destroy: () => void;
};

/**
 * One row of a composer's caret-typeahead menu. `label`/`detail`/`glyph`/`url` drive the
 * shared row template; the remaining fields are set by the source that built the item, for
 * its own `choose` action.
 */
export type TypeaheadItem = {
    label: string; // The row's primary text (a shortname or display name)
    detail?: string; // Secondary muted text (e.g. a mentioned JID)
    glyph?: string; // A unicode emoji glyph rendered before the label
    url?: string; // A custom emoji's image, rendered instead of `glyph`
    avatar?: any; // A model to render an avatar from, for occupant mentions
    jid?: string; // A mention's bare JID
    name?: string; // A mention's display name (the link text, sans `@`)
};

/**
 * A typeahead source owns one trigger character. `getQuery` reads its query from the caret
 * (null when the caret isn't on this source's trigger), `getItems` builds the ranked menu,
 * and `choose` replaces the trigger with the picked item.
 */
export type TypeaheadSource = {
    kind: string;
    getQuery: (handle: RichEditor | null) => string | null;
    getItems: (query: string) => TypeaheadItem[] | Promise<TypeaheadItem[]>;
    choose: (handle: RichEditor | null, query: string, item: TypeaheadItem) => void;
};

export type RichEditorOptions = {
    namespace?: string;
    nodes?: Array<any>; // Lexical node classes the transformers need
    theme?: Record<string, any>; // Class names Lexical stamps on its DOM
    transformers: Array<any>; // Output: how the document is serialized
    input_transformers?: Array<any>; // Input: typing shortcuts (defaults to `transformers`)
    html_export?: Map<any, any>; // DOM-export overrides, e.g. for non-http link schemes
    onChange?: () => void;
};
