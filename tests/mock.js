(function (root, factory) {
    define("mock",
        ['converse'],
        function(converse) {
            return factory(converse);
        });
}(this, function (converse) {
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
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
    // TODO: need to also test other roles and affiliations
    mock.chatroom_roles = {
        'Anne Ebersbacher': { affiliation: "owner", role: "moderator" },
        'Dirk Theissen': { affiliation: "admin", role: "moderator" },
        'Dyon van de Wege': { affiliation: "member", role: "occupant" },
        'Felix Hofmann': { affiliation: "member", role: "occupant" },
        'Ka Lek': { affiliation: "member", role: "occupant" },
        'Thomas Kalb': { affiliation: "member", role: "occupant" }
    };

    mock.event = {
        'preventDefault': function () {}
    };

    mock.mock_connection = function ()  {
        Strophe.Bosh.prototype._processRequest = function () {}; // Don't attempt to send out stanzas
        var c = new Strophe.Connection('jasmine tests');
        c.vcard = {
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
        };
        c._proto._connect = function () {
            c.authenticated = true;
            c.connected = true;
            c.mock = true;
            c.jid = 'dummy@localhost/resource';
            c._changeConnectStatus(Strophe.Status.CONNECTED);
        };
        return c;
    }();
    return mock;
}));
