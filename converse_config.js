var ua = window.navigator.userAgent;
if (ua.indexOf('MSIE') >= 0 ||  ua.indexOf('Trident') >= 0) {
    alert('MOKA ist mit dem Internet Explorer nicht mehr lauffähig. Bitte starten Sie Google Chrome (Icon "Google Chrome Cx").');
} else {
  var root_path = '/';
  var xmpp_domain = 'moka.bundespolizei.de';
  var userlist_api_key = 'c9b8508a12892f47782f0c6bddb1b49586d4ebb2cbcd6bbfc5b452020466345b';

  var converse_config = {
    authentication: 'login',
    auto_reconnect: true,
    bosh_service_url: 'https://xmpp.'+xmpp_domain+'/bosh/',
    muc_domain: 'conference.'+xmpp_domain,
    xhr_user_search: true,
    xhr_user_search_url: 'https://'+xmpp_domain+'/userlist/converse?api_key='+userlist_api_key+'&',
    locked_domain: xmpp_domain,
    message_archiving: 'always',
    use_system_emojis: false,
    i18n: 'de',
    emoji_image_path: root_path+'twemoji/',
    allow_otr: false,
    allow_registration: false,
    message_carbons: true,
    muc_nickname_from_jid: true,
    show_desktop_notifications: 'all',
    notify_all_room_messages: true,
    notification_delay: 0,
    notification_icon: root_path+'logo/new_launcher-web.png',
    play_sounds: true,
    sounds_path: root_path+'sounds/',
    allow_chat_pending_contacts: true,
    allow_non_roster_messaging: true,
    auto_join_on_invite: true,
    geouri_regex: /http:\/\/mapproxy.polizei.bund.de\/#map=[0-9]+\/([\-0-9.]+)\/([\-0-9.]+)\S*/g,
    geouri_replacement: 'http://mapproxy.polizei.bund.de/#map=16/$1/$2&m=300',
    roster_groups: false,
    show_controlbox_by_default: true,
    trusted: 'off',
    roomconfig_whitelist: ['muc#roomconfig_roomname'],
    muc_disable_slash_commands: ['mute', 'voice', 'ban', 'kick', 'register', 'topic', 'op', 'deop'],
    muc_respect_autojoin: false,
    manual_url: root_path+'upload/benutzerhandbuch.pdf',
    muc_roomid_policy: /^[a-z0-9._-]{5,40}$/,
    muc_roomid_policy_hint: '<br><b>Namenskonvention für Gruppenchatnamen:</b><br>- mindestens 5 Zeichen, aber maximal 40 Zeichen,<br>- Kleinbuchstaben von a bis z (aber keine Umlaute) oder<br>- Zahlen oder<br>- Punkt (.) oder<br>- Unterstrich (_) oder<br>- Bindestrich (-),<br>- keine Leerzeichen<br>',
    allow_message_corrections: 'last',
    discover_connection_methods: false,
    whitelisted_plugins: ['download-dialog']
  };
}
