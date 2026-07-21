export type RichEditor = {
    editor: import('lexical').LexicalEditor;
    getMarkdown: () => string;
    setMarkdown: (text: string) => void;
    getHtml: () => string;
    isEmpty: () => boolean;
    insertText: (text: string) => void;
    format: (type: import('lexical').TextFormatType) => boolean;
    getTriggerQuery: (regex: RegExp) => string | null;
    replaceTrigger: (trigger: string, replacement: string) => void;
    replaceTriggerWithLink: (trigger: string, text: string, url: string) => void;
    clear: () => void;
    focus: () => void;
    destroy: () => void;
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