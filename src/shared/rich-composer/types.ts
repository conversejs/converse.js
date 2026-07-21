export type RichEditor = {
    editor: import('lexical').LexicalEditor;
    getMarkdown: () => string; // Serialize via the consumer's output transformers
    setMarkdown: (text: string) => void; // Replace the document, parsing with the same set
    getHtml: () => string;
    isEmpty: () => boolean;
    insertText: (text: string) => void;
    format: (type: import('lexical').TextFormatType) => boolean;
    getTriggerQuery: (regex: RegExp) => string | null; // See ./triggers.js
    replaceTrigger: (trigger: string, replacement: string) => void;
    replaceTriggerWithLink: (trigger: string, text: string, url: string) => void;
    clear: () => void;
    focus: () => void;
    destroy: () => void;
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
