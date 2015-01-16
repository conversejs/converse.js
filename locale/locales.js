/*
 * This file specifies the language dependencies.
 *
 * Translations take up a lot of space and you are therefore advised to remove
 * from here any languages that you don't need.
 */

(function (root, factory) {
    define("locales", ['jquery', 'jed', 
        'text!af',
        'text!de',
        'text!en',
        'text!es',
        'text!fr',
        'text!he',
        'text!hu',
        'text!id',
        'text!it',
        'text!ja',
        'text!nb',
        'text!nl',
        'text!pl',
        'text!pt_BR',
        'text!ru',
        'text!zh'
        ], function ($, Jed, af, de, en, es, fr, he, hu, id, it, ja, nb, nl, pl, pt_BR, ru, zh) {
            root.locales = {
                'af':     new Jed($.parseJSON(af)),
                'de':     new Jed($.parseJSON(de)),
                'en':     new Jed($.parseJSON(en)),
                'es':     new Jed($.parseJSON(es)),
                'fr':     new Jed($.parseJSON(fr)),
                'he':     new Jed($.parseJSON(he)),
                'hu':     new Jed($.parseJSON(hu)),
                'id':     new Jed($.parseJSON(id)),
                'it':     new Jed($.parseJSON(it)),
                'ja':     new Jed($.parseJSON(ja)),
                'nb':     new Jed($.parseJSON(nb)),
                'nl':     new Jed($.parseJSON(nl)),
                'pl':     new Jed($.parseJSON(pl)),
                'pt-br':  new Jed($.parseJSON(pt_BR)),
                'ru':     new Jed($.parseJSON(ru)),
                'zh':     new Jed($.parseJSON(zh))
            };
        });
})(this);
