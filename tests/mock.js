(function (root, factory) {
    define("mock",
        ['converse'],
        function() {
            return factory();
        });
}(this, function (converse) {
    var mock = {};
    // Names from http://www.fakenamegenerator.com/
    mock.req_names = [
        'Louw Spekman', 'Mohamad Stet', 'Dominik Beyer'
    ];
    mock.pend_names = [
        'Suleyman van Beusichem', 'Nanja van Yperen', 'Nicole Diederich'
    ];
    mock.cur_names = [
        'Max Frankfurter', 'Candice van der Knijff', 'Irini Vlastuin', 'Rinse Sommer', 'Annegreet Gomez',
        'Robin Schook', 'Marcel Eberhardt', 'Simone Brauer', 'Asmaa Haakman', 'Felix Amsel',
        'Lena Grunewald', 'Laura Grunewald', 'Mandy Seiler', 'Sven Bosch', 'Nuriye Cuypers'
    ];
    mock.num_contacts = mock.req_names.length + mock.pend_names.length + mock.cur_names.length;

    mock.groups = {
        'colleagues': 3,
        'friends & acquaintences': 3,
        'Family': 4,
        'ænemies': 3,
        'Ungrouped': 2
    };

    mock.chatroom_names = [
        'Dyon van de Wege', 'Thomas Kalb', 'Dirk Theissen', 'Felix Hofmann', 'Ka Lek', 'Anne Ebersbacher'
    ];

    mock.event = {
        'preventDefault': function () {}
    };

    mock.mock_connection = {
        '_proto': {},
        'connected': true,
        'authenticated': true,
        'mock': true,
        'muc': {
            'listRooms': function () {},
            'join': function () {},
            'leave': function () {},
            'rooms': {},
            'groupchat': function () {}
        },
        'service': 'jasmine tests',
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
            'addFeature': function () {},
            'addIdentity': function () {},
            'info': function () {},
            'items': function () {}
        }
    };
    return mock;
}));
