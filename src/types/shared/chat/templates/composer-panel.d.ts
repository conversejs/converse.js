declare function _default({ kind, icon, content, actions, close, role, label }: {
    kind: "context" | "warning" | "tool";
    icon?: import("lit").TemplateResult;
    content: import("lit").TemplateResult;
    actions?: import("lit").TemplateResult;
    close?: {
        label: string;
        handler: (ev: Event) => void;
    };
    role?: string;
    label?: string;
}): import("lit-html").TemplateResult<1>;
export default _default;
//# sourceMappingURL=composer-panel.d.ts.map