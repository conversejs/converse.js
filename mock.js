(function (root, factory) {
    define("mock",
        ['converse'],
        function() {
            return factory();
        });
}(this, function (converse) {
    var mock_connection = {
        'muc': {
            'listRooms': function () {},
            'join': function () {},
            'leave': function () {},
            'rooms': {}
        },
        'jid': 'dummy@localhost',
        'addHandler': function (handler, ns, name, type, id, from, options) {
            return function () {};
        },
        'send': function () {},
        'roster': {
            'add': function () {},
            'authorize': function () {},
            'unauthorize': function () {},
            'get': function () {},
            'subscribe': function () {},
            'registerCallback': function () {},
            'remove': function (jid, callback) { callback(); }
        },
        'vcard': {
            'get': function (callback, jid) {
                var fullname;
                if (!jid) {
                    jid = 'dummy@localhost';
                    fullname = 'Max Mustermann' ;
                } else {
                    var name = jid.split('@')[0].replace(/\./g, ' ').split(' ');
                    var last = name.length-1;
                    name[0] =  name[0].charAt(0).toUpperCase()+name[0].slice(1);
                    name[last] = name[last].charAt(0).toUpperCase()+name[last].slice(1);
                    fullname = name.join(' ');
                }
                var vcard = $iq().c('vCard').c('FN').t(fullname);
                callback(vcard.tree());
            }
        },
        'disco': {
            'info': function () {},
            'items': function () {}
        }
    };
    return mock_connection;
}));
