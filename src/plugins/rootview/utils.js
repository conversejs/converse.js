import { api } from '@converse/headless';

export function getTheme() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return api.settings.get('dark_theme');
    } else {
        return api.settings.get('theme');
    }
}

/**
 * Whether the theme currently in force is a dark one.
 *
 * A theme answers this for itself, by declaring the standard `color-scheme`
 * property in the same CSS rule that carries its colors.
 *
 * A theme that declares nothing is taken to be light, which is what the
 * `color-scheme` initial value of `normal` means in practice.
 *
 * @param {Element} [el] - The element to resolve the theme against. Any
 *  element inside `converse-root` will do, since `color-scheme` inherits;
 *  defaults to `converse-root` itself.
 * @returns {boolean}
 */
export function isDarkTheme(el) {
    const root = api.settings.get('root');
    const target = el ?? (root.matches?.('converse-root') ? root : root.querySelector('converse-root'));
    if (!target) return false;

    const scheme = getComputedStyle(target).colorScheme;
    const dark = /\bdark\b/.test(scheme);
    // A theme may accept either, in which case the system preference decides.
    if (dark && /\blight\b/.test(scheme)) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return dark;
}

export function ensureElement() {
    if (!api.settings.get('auto_insert')) {
        return;
    }
    const root = api.settings.get('root');
    if (!root.querySelector('converse-root') && !root.matches?.('converse-root')) {
        const el = document.createElement('converse-root');
        const body = root.querySelector('body');
        if (body) {
            body.appendChild(el);
        } else {
            root.appendChild(el); // Perhaps inside a web component?
        }
    }
}
