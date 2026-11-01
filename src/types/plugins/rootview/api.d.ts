export default apps_api;
declare namespace apps_api {
    namespace shortcuts {
        /**
         * Registers a keyboard shortcut. It's handled anywhere in Converse
         * (unless `enable_keyboard_shortcuts` is false) and listed in the
         * keyboard shortcuts help modal, under its group.
         *
         * A shortcut with the same `id` as an existing one replaces it.
         *
         * @param {import('./types').KeyboardShortcut} shortcut
         * @example
         * api.shortcuts.add({
         *     id: 'myplugin-hello',
         *     group: __('My plugin'),
         *     label: 'Alt+Shift+Y',
         *     description: __('Say hello'),
         *     matches: (ev) => ev.altKey && ev.shiftKey && ev.code === 'KeyY',
         *     handler: () => alert('Hello'),
         * });
         */
        function add(shortcut: import("./types").KeyboardShortcut): void;
        /**
         * Returns the registered keyboard shortcuts, in the order they were added.
         * @returns {import('./types').KeyboardShortcut[]}
         */
        function get(): import("./types").KeyboardShortcut[];
    }
    namespace protocolHandler {
        /**
         * Ask the browser to route `xmpp:` links (XEP-0147) to this Converse
         * instance.
         *
         * Setting `register_protocol_handler` does this on login, but Firefox
         * only honours the request during a user gesture, so call this from a
         * click handler if you want it to work there.
         *
         * @returns {boolean} Whether the browser accepted the call.
         * @example _converse.api.protocolHandler.register();
         */
        function register(): boolean;
    }
    namespace theme {
        /**
         * The theme currently in force, which is the `dark_theme` setting when
         * the user's system asks for a dark colour scheme, and the `theme`
         * setting otherwise.
         * @returns {string}
         */
        function get(): string;
        /**
         * Whether the theme currently in force is a dark one.
         *
         * Answered from the theme's own `color-scheme` declaration, so a
         * third-party theme is treated the same as a bundled one and Converse
         * never has to keep a list of theme names.
         *
         * @param {Element} [el] - The element to resolve the theme against.
         *  Defaults to `converse-root`.
         * @returns {boolean}
         */
        function isDark(el?: Element): boolean;
    }
    namespace apps {
        /**
         * @param {import('./types').App} app
         */
        export function add(app: import("./types").App): void;
        /**
         * Returns all registered apps, or a single app by name.
         * @param {string} [name]
         * @returns {import('./types').App[]|import('./types').App|null}
         */
        export function get(name?: string): import("./types").App[] | import("./types").App | null;
        /**
         * @returns {import('./types').App}
         */
        export function getActive(): import("./types").App;
        /**
         * @param {string} name
         */
        function _switch(name: string): any;
        export { _switch as switch };
    }
}
//# sourceMappingURL=api.d.ts.map