/**
 * @typedef { Object } ConfigurationSettings
 * Converse's core configuration values
 * @property { Boolean } [allow_non_roster_messaging=false]
 * @property { Boolean } [allow_url_history_change=true]
 * @property { String } [assets_path='/dist']
 * @property { ('login'|'prebind'|'anonymous'|'external') } [authentication='login']
 * @property { Boolean } [auto_login=false] - Currently only used in connection with anonymous login
 * @property { Boolean } [reuse_scram_keys=false] - Save SCRAM keys after login to allow for future auto login
 * @property { Boolean } [auto_reconnect=true]
 * @property { Array<String>} [blacklisted_plugins]
 * @property { Boolean } [clear_cache_on_logout=false]
 * @property { Object } [connection_options]
 * @property { String } [credentials_url] - URL from where login credentials can be fetched
 * @property { Boolean } [discover_connection_methods=true]
 * @property { RegExp } [geouri_regex]
 * @property { RegExp } [geouri_replacement='https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2']
 * @property { String } [i18n]
 * @property { String } [jid]
 * @property { Boolean } [keepalive=true]
 * @property { ('debug'|'info'|'eror') } [loglevel='info']
 * @property { Array<String> } [locales]
 * @property { String } [nickname]
 * @property { String } [password]
 * @property { ('IndexedDB'|'localStorage') } [persistent_store='IndexedDB']
 * @property { String } [rid]
 * @property { Element } [root=window.document]
 * @property { String } [sid]
 * @property { Boolean } [singleton=false]
 * @property { Boolean } [strict_plugin_dependencies=false]
 * @property { ('overlayed'|'fullscreen'|'mobile') } [view_mode='overlayed']
 * @property { String } [websocket_url]
 * @property { Array<String>} [whitelisted_plugins]
 */
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
    disable_effects: false, // Disabled UI transition effects. Mainly used for tests.
    discover_connection_methods: true,
    geouri_regex: /https\:\/\/www.openstreetmap.org\/.*#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'https://www.openstreetmap.org/?mlat=$1&mlon=$2#map=18/$1/$2',
    i18n: undefined,
    jid: undefined,
    reuse_scram_keys: false,
    keepalive: true,
    loglevel: 'info',
    locales: [
        'af',
        'ar',
        'bg',
        'ca',
        'cs',
        'da',
        'de',
        'el',
        'en',
        'eo',
        'es',
        'eu',
        'fa',
        'fi',
        'fr',
        'gl',
        'he',
        'hi',
        'hu',
        'id',
        'it',
        'ja',
        'lt',
        'mr',
        'nb',
        'nl',
        'oc',
        'pl',
        'pt',
        'pt_BR',
        'ro',
        'ru',
        'sv',
        'th',
        'tr',
        'ug',
        'uk',
        'vi',
        'zh_CN',
        'zh_TW',
    ],
    nickname: undefined,
    password: undefined,
    persistent_store: 'IndexedDB',
    rid: undefined,
    root: window.document,
    sid: undefined,
    singleton: false,
    strict_plugin_dependencies: false,
    stanza_timeout: 20000,
    view_mode: 'overlayed', // Choices are 'overlayed', 'fullscreen', 'mobile'
    websocket_url: undefined,
    whitelisted_plugins: [],
};
