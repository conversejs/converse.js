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
