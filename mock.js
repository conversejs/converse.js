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
            'removeRoom': function () {},
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
            'registerCallback': function () {}
        },
        'vcard': {
            'get': function (callback, jid) {
                var firstname, lastname;
                if (!jid) {
                    jid = 'dummy@localhost';
                    firstname = 'Max';
                    lastname = 'Mustermann';
                } else {
                    var name = jid.split('@')[0].replace('.', ' ').split(' ');
                    firstname = name[0].charAt(0).toUpperCase()+name[0].slice(1);
                    lastname = name[1].charAt(0).toUpperCase()+name[1].slice(1);
                }
                var fullname = firstname+' '+lastname;
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
