    
    define('awesomplete', [], function () { return Awesomplete; });
    define('lodash', [], function () { return _; });
    define('underscore', [], function () { return _; });
    define('lodash.converter', [], function () { return fp; });
    define('lodash.noconflict', [], function () { return _; });
    define('moment', [], function () { return moment; });
    define('moment/locale/af', [], function () { return moment; });
    define('moment/locale/ca', [], function () { return moment; });
    define('moment/locale/de', [], function () { return moment; });
    define('moment/locale/es', [], function () { return moment; });
    define('moment/locale/fr', [], function () { return moment; });
    define('moment/locale/he', [], function () { return moment; });
    define('moment/locale/hu', [], function () { return moment; });
    define('moment/locale/id', [], function () { return moment; });
    define('moment/locale/it', [], function () { return moment; });
    define('moment/locale/ja', [], function () { return moment; });
    define('moment/locale/nb', [], function () { return moment; });
    define('moment/locale/nl', [], function () { return moment; });
    define('moment/locale/pl', [], function () { return moment; });
    define('moment/locale/pt-br', [], function () { return moment; });
    define('moment/locale/ru', [], function () { return moment; });
    define('moment/locale/uk', [], function () { return moment; });
    define('moment/moment', [], function () { return moment; });
    define('i18n', [], function () { return; });
    define('es6-promise', [], function () { return Promise; });

    define('strophe', [], function () {
        return {
            'Strophe':         Strophe,
            '$build':          $build,
            '$iq':             $iq,
            '$msg':            $msg,
            '$pres':           $pres,
            'SHA1':            SHA1,
            'MD5':             MD5,
            'b64_hmac_sha1':   SHA1.b64_hmac_sha1,
            'b64_sha1':        SHA1.b64_sha1,
            'str_hmac_sha1':   SHA1.str_hmac_sha1,
            'str_sha1':        SHA1.str_sha1
        };
    });
    var strophePlugin = function () { return Strophe; };
    var emptyFunction = function () { };
    define('strophe.disco', ['strophe'], strophePlugin);
    define('strophe.ping', ['strophe'], strophePlugin);
    define('strophe.rsm', ['strophe'], strophePlugin);
    define('strophe.vcard', ['strophe'], strophePlugin);
    define('backbone', [], function () { return Backbone; });
    define('backbone.noconflict', [], function () { return Backbone; });
    define('backbone.browserStorage', ['backbone'], emptyFunction);
    define('backbone.overview', ['backbone'], emptyFunction);
    define('otr', [], function () { return { 'DSA': DSA, 'OTR': OTR };});
    return require('converse');
}));
