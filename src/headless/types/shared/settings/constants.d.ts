export namespace DEFAULT_SETTINGS {
    let allow_non_roster_messaging: boolean;
    let allow_url_history_change: boolean;
    let assets_path: string;
    let authentication: string;
    let auto_login: boolean;
    let auto_reconnect: boolean;
    let blacklisted_plugins: any[];
    let clear_cache_on_logout: boolean;
    let connection_options: {};
    let credentials_url: any;
    let disable_effects: boolean;
    let discover_connection_methods: boolean;
    let geouri_regex: RegExp;
    let geouri_replacement: string;
    let i18n: any;
    let jid: any;
    let reuse_scram_keys: boolean;
    let keepalive: boolean;
    let loglevel: string;
    let locales: string[];
    let nickname: any;
    let password: any;
    let persistent_store: string;
    let rid: any;
    let root: Document;
    let sid: any;
    let singleton: boolean;
    let strict_plugin_dependencies: boolean;
    let stanza_timeout: number;
    let view_mode: string;
    let websocket_url: any;
    let whitelisted_plugins: any[];
}
/**
 * Converse's core configuration values
 */
export type ConfigurationSettings = {
    allow_non_roster_messaging?: boolean;
    allow_url_history_change?: boolean;
    assets_path?: string;
    authentication?: ("login" | "prebind" | "anonymous" | "external");
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
    loglevel?: ("debug" | "info" | "eror");
    locales?: Array<string>;
    nickname?: string;
    password?: string;
    persistent_store?: ("IndexedDB" | "localStorage");
    rid?: string;
    root?: Element;
    sid?: string;
    singleton?: boolean;
    strict_plugin_dependencies?: boolean;
    view_mode?: ("fullscreen" | "embedded" | "overlayed");
    websocket_url?: string;
    whitelisted_plugins?: Array<string>;
};
//# sourceMappingURL=constants.d.ts.map