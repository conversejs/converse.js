export namespace DEFAULT_SETTINGS {
    const allow_non_roster_messaging: boolean;
    const allow_url_history_change: boolean;
    const assets_path: string;
    const authentication: string;
    const auto_login: boolean;
    const auto_reconnect: boolean;
    const blacklisted_plugins: any[];
    const clear_cache_on_logout: boolean;
    const connection_options: {};
    const credentials_url: any;
    const disable_effects: boolean;
    const discover_connection_methods: boolean;
    const geouri_regex: RegExp;
    const geouri_replacement: string;
    const i18n: any;
    const jid: any;
    const reuse_scram_keys: boolean;
    const keepalive: boolean;
    const loglevel: string;
    const locales: string[];
    const nickname: any;
    const password: any;
    const persistent_store: string;
    const rid: any;
    const root: Document;
    const sid: any;
    const singleton: boolean;
    const strict_plugin_dependencies: boolean;
    const stanza_timeout: number;
    const view_mode: string;
    const websocket_url: any;
    const whitelisted_plugins: any[];
}
/**
 * Converse's core configuration values
 */
export type ConfigurationSettings = {
    allow_non_roster_messaging?: boolean;
    allow_url_history_change?: boolean;
    assets_path?: string;
    authentication?: ('login' | 'prebind' | 'anonymous' | 'external');
    /**
     * - Currently only used in connection with anonymous login
     */
    auto_login?: boolean;
    /**
     * - Save SCRAM keys after login to allow for future auto login
     */
    reuse_scram_keys?: boolean;
    auto_reconnect?: boolean;
    blacklisted_plugins?: Array<string>;
    clear_cache_on_logout?: boolean;
    connection_options?: any;
    /**
     * - URL from where login credentials can be fetched
     */
    credentials_url?: string;
    discover_connection_methods?: boolean;
    geouri_regex?: RegExp;
    geouri_replacement?: RegExp;
    i18n?: string;
    jid?: string;
    keepalive?: boolean;
    loglevel?: ('debug' | 'info' | 'eror');
    locales?: Array<string>;
    nickname?: string;
    password?: string;
    persistent_store?: ('IndexedDB' | 'localStorage');
    rid?: string;
    root?: Element;
    sid?: string;
    singleton?: boolean;
    strict_plugin_dependencies?: boolean;
    view_mode?: ('overlayed' | 'fullscreen' | 'mobile');
    websocket_url?: string;
    whitelisted_plugins?: Array<string>;
};
//# sourceMappingURL=constants.d.ts.map