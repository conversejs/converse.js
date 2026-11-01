import { TemplateResult } from 'lit';
export type App = {
    name: string;
    title: string;
    icon: string;
    /**
     * The primary app. It's shown outside of the "fullscreen" view mode and
     * used as a fallback when no (valid) app is active. Exactly one app should
     * set this.
     */
    primary?: boolean;
    render: () => TemplateResult;
    renderControlbox?: () => TemplateResult;
};
export type KeyboardShortcut = {
    id: string;
    group: string;
    label: string;
    description: string;
    matches: (_ev: KeyboardEvent) => boolean;
    handler: () => void;
};
export type XMPPApp = {
    name: string;
    url: string;
    platforms?: Platform[];
};
export type Platform = 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux';
export type PendingXMPPURI = {
    uri: string;
    from_handler: boolean;
};
//# sourceMappingURL=types.d.ts.map