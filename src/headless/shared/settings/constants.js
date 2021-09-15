
// Default configuration values
// ----------------------------
export const DEFAULT_SETTINGS = {
    allow_non_roster_messaging: false,
    allow_url_history_change: true,
    assets_path: '/dist',
    authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
    auto_login: false, // Currently only used in connection with anonymous login
    auto_reconnect: true,
    blacklisted_plugins: [],
    clear_cache_on_logout: false,
    connection_options: {},
    credentials_url: null, // URL from where login credentials can be fetched
    discover_connection_methods: true,
    geouri_regex: /https\:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
    i18n: undefined,
    idle_presence_timeout: 300, // Seconds after which an idle presence is sent
    jid: undefined,
    keepalive: true,
    loglevel: 'info',
    locales: [
        'af', 'ar', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'eo', 'es', 'eu', 'en', 'fa', 'fi', 'fr',
        'gl', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'lt', 'nb', 'nl', 'mr', 'oc',
        'pl', 'pt', 'pt_BR', 'ro', 'ru', 'sv', 'th', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW'
    ],
    nickname: undefined,
    password: undefined,
    persistent_store: 'IndexedDB',
    rid: undefined,
    root: window.document,
    sid: undefined,
    singleton: false,
    strict_plugin_dependencies: false,
    view_mode: 'overlayed', // Choices are 'overlayed', 'fullscreen', 'mobile'
    websocket_url: undefined,
    whitelisted_plugins: []
};
