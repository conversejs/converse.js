/*global jQuery, _, moment */

define('jquery', [], function () { return jQuery; });
define('jquery.browser', [], function () { return jQuery; });
define('typeahead', [], function () { return jQuery; });
define('underscore', [], function () { return _; });
define('moment_with_locales', [], function () { return moment; });
define('strophe', [], function () {
    return {
        'Strophe':         Strophe,
        '$build':          $build,
        '$iq':             $iq,
        '$msg':            $msg,
        '$pres':           $pres,
        'SHA1':            SHA1,
        'Base64':          Base64,
        'MD5':             MD5,
        'b64_hmac_sha1':   SHA1.b64_hmac_sha1,
        'b64_sha1':        SHA1.b64_sha1,
        'str_hmac_sha1':   SHA1.str_hmac_sha1,
        'str_sha1':        SHA1.str_sha1
    };
});
define('strophe.disco', [], function () { return Strophe; });
define('strophe.rsm', [], function () { return Strophe; });
define('strophe.vcard', [], function () { return Strophe; });
define('otr', [], function () { return { 'DSA': DSA, 'OTR': OTR };});
define('backbone', [], function () { return; });
define('backbone.browserStorage', [], function () { return; });
define('backbone.overview', [], function () { return; });
