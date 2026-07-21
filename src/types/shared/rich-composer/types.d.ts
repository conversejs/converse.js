export type RichEditor = {
    editor: import('lexical').LexicalEditor;
    getMarkdown: () => string;
    setMarkdown: (text: string) => void;
    getHtml: () => string;
    isEmpty: () => boolean;
    insertText: (text: string) => void;
    format: (type: import('lexical').TextFormatType) => boolean;
    isCaretAtStart: () => boolean;
    isCaretAtEnd: () => boolean;
    getTriggerQuery: (regex: RegExp) => string | null;
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
    label: string;
    detail?: string;
    glyph?: string;
    url?: string;
    jid?: string;
    name?: string;
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
    nodes?: Array<any>;
    theme?: Record<string, any>;
    transformers: Array<any>;
    input_transformers?: Array<any>;
    html_export?: Map<any, any>;
    onChange?: () => void;
};
//# sourceMappingURL=types.d.ts.map