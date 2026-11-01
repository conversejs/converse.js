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
    id: string; // Unique, e.g. `chat-next-unread`
    group: string; // The heading it's listed under in the help modal, translated
    label: string; // The key combination as shown to the user, e.g. `Alt+Shift+↓`
    description: string; // What the shortcut does, translated
    matches: (_ev: KeyboardEvent) => boolean; // Whether the pressed keys are this shortcut
    handler: () => void; // Called when the shortcut is pressed
};
