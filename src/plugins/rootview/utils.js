import { api } from '@converse/headless/core';


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
