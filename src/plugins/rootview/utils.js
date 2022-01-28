import { api } from '@converse/headless/core';

export function getTheme() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return api.settings.get('dark_theme');
    } else {
        return api.settings.get('theme');
    }
}

export function ensureElement () {
    if (!api.settings.get('auto_insert')) {
        return;
    }
    const root = api.settings.get('root');
    if (!root.querySelector('converse-root')) {
        const el = document.createElement('converse-root');
        const body = root.querySelector('body');
        if (body) {
            body.appendChild(el);
        } else {
            root.appendChild(el); // Perhaps inside a web component?
        }
    }
}
