export default apps_api;
declare namespace apps_api {
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