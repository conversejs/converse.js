(function (root, factory) {
    define([
        "converse"
        ], function (xmppchat) {
            return factory(xmppchat);
        }
    );
} (this, function (xmppchat) {

    return describe("Contacts Roster", function() {

        // Names from http://www.fakenamegenerator.com/
        names = [
            'Louw Spekman', 'Mohamad Stet', 'Dominik Beyer', 'Dirk Eichel', 'Marco Duerr', 'Ute Schiffer',
            'Billie Westerhuis', 'Sarah Kuester', 'Sabrina Loewe', 'Laura Duerr', 'Mathias Meyer',
            'Tijm Keller', 'Lea Gerste', 'Martin Pfeffer', 'Ulrike Abt', 'Zoubida van Rooij',
            'Maylin Hettema', 'Ruwan Bechan', 'Marco Beich', 'Karin Busch', 'Mathias Müller',
            'Suleyman van Beusichem', 'Nicole Diederich', 'Nanja van Yperen', 'Delany Bloemendaal',
            'Jannah Hofmeester', 'Christine Trommler', 'Martin Bumgarner', 'Emil Baeten', 'Farshad Brasser',
            'Gabriele Fisher', 'Sofiane Schopman', 'Sky Wismans', 'Jeffery Stoelwinder', 'Ganesh Waaijenberg',
            'Dani Boldewijn', 'Katrin Propst', 'Martina Kaiser', 'Philipp Kappel', 'Meeke Grootendorst',
            'Max Frankfurter', 'Candice van der Knijff', 'Irini Vlastuin', 'Rinse Sommer', 'Annegreet Gomez',
            'Robin Schook', 'Marcel Eberhardt', 'Simone Brauer', 'Asmaa Haakman', 'Felix Amsel',
            'Lena Grunewald', 'Laura Grunewald', 'Mandy Seiler', 'Sven Bosch', 'Nuriye Cuypers', 'Ben Zomer',
            'Leah Weiss', 'Francesca Disseldorp', 'Sven Bumgarner', 'Benjamin Zweig'
        ];

        mock_connection  = {
            'muc': {
                'listRooms': function () {}
            }
        };

        describe("the contacts roster", $.proxy(function () {
            this.prebind = true;
            this.connection = mock_connection;
            this.chatboxes = new this.ChatBoxes();
            this.chatboxesview = new this.ChatBoxesView({model: this.chatboxes});
            this.roster = new this.RosterItems();
            // Clear localStorage
            var key = hex_sha1('converse.rosteritems-dummy@localhost');
            window.localStorage.removeItem(key);
            this.roster.localStorage = new Backbone.LocalStorage(key);

            this.chatboxes.onConnected();
            this.rosterview = new this.RosterView({'model':this.roster});
            this.rosterview.render();

            // by default the dts are hidden from css class and only later they will be hidden
            // by jQuery therefore for the first check we will see if visible instead of none
            it("should hide the requesting contacts heading if there aren't any", $.proxy(function () {
                expect(this.rosterview.$el.find('dt#xmpp-contact-requests').is(':visible')).toEqual(false);
            }, xmppchat));

            it("should be able to add requesting contacts, and they should be sorted alphabetically", $.proxy(function () {
                var i, t;
                spyOn(this.rosterview, 'render').andCallThrough();
                spyOn(this, 'showControlBox');
                for (i=0; i<10; i++) {
                    this.roster.create({
                        jid: names[i].replace(' ','.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'request',
                        fullname: names[i],
                        is_last: i<9
                    });
                    expect(this.rosterview.render).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt#xmpp-contact-requests').siblings('dd.requesting-xmpp-contact').text().replace(/AcceptDecline/g, '');
                    expect(t).toEqual(names.slice(0,i+1).sort().join(''));
                    // When a requesting contact is added, the controlbox must
                    // be opened.
                    expect(this.showControlBox).toHaveBeenCalled();
                }
            }, xmppchat));

            it("should show the requesting contacts heading after they have been added", $.proxy(function () {
                expect(this.rosterview.$el.find('dt#xmpp-contact-requests').css('display')).toEqual('block');
            }, xmppchat));

            it("should hide the pending contacts heading if there aren't any", $.proxy(function () {
                expect(this.rosterview.$el.find('dt#pending-xmpp-contacts').css('display')).toEqual('none');
            }, xmppchat));

            it("should be able to add pending contacts, and they should be sorted alphabetically", $.proxy(function () {
                var i, t;
                spyOn(this.rosterview, 'render').andCallThrough();
                for (i=10; i<20; i++) {
                    this.roster.create({
                        jid: names[i].replace(' ','.').toLowerCase() + '@localhost',
                        subscription: 'none',
                        ask: 'subscribe',
                        fullname: names[i],
                        is_last: i<20
                    });
                    expect(this.rosterview.render).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt#pending-xmpp-contacts').siblings('dd.pending-xmpp-contact').text();
                    expect(t).toEqual(names.slice(10,i+1).sort().join(''));
                }
            }, xmppchat));

            it("should show the pending contacts heading after they have been added", $.proxy(function () {
                expect(this.rosterview.$el.find('dt#pending-xmpp-contacts').css('display')).toEqual('block');
            }, xmppchat));

            it("should hide the current contacts heading if there aren't any", $.proxy(function () {
                expect(this.rosterview.$el.find('dt#xmpp-contacts').css('display')).toEqual('none');
            }, xmppchat));

            it("should be able to add existing contacts, and they should be sorted alphabetically", $.proxy(function () {
                var i, t;
                spyOn(this.rosterview, 'render').andCallThrough();
                // Add 40 properly regisertered contacts (initially all offline) and check that they are sorted alphabetically
                for (i=20; i<60; i++) {
                    this.roster.create({
                        jid: names[i].replace(' ','.').toLowerCase() + '@localhost',
                        subscription: 'both',
                        ask: null,
                        fullname: names[i],
                        is_last: i<60
                    });
                    expect(this.rosterview.render).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.offline').find('a.open-chat').text();
                    expect(t).toEqual(names.slice(20,i+1).sort().join(''));
                }
            }, xmppchat));

            it("should show the current contacts heading if they have been added", $.proxy(function () {
                expect(this.rosterview.$el.find('dt#xmpp-contacts').css('display')).toEqual('block');
            }, xmppchat));

            describe("roster items", $.proxy(function () {

                it("should be able to change their status to online and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=59; i>54; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'online');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.online').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i)).sort().join(''));
                    }
                }, xmppchat));

                it("should be able to change their status to busy and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=54; i>49; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'dnd');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();
                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.dnd').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i), -5).sort().join(''));
                    }
                }, xmppchat));

                it("should be able to change their status to away and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=49; i>44; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'away');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.away').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i),-10).sort().join(''));
                    }
                }, xmppchat));

                it("should be able to change their status to unavailable and be sorted alphabetically", $.proxy(function () {
                    var item, view, jid;
                    spyOn(this.rosterview, 'render').andCallThrough();
                    for (i=44; i>39; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = this.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('chat_status', 'unavailable');
                        expect(view.render).toHaveBeenCalled();
                        expect(this.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = this.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i), -15).sort().join(''));
                    }
                }, xmppchat));

                it("should be ordered according to status: online, busy, away, unavailable, offline", $.proxy(function () {
                    var contacts = this.rosterview.$el.find('dd.current-xmpp-contact');
                    var i;
                    // The first five contacts are online.
                    for (i=0; i<5; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('online');
                    }
                    // The next five are busy
                    for (i=5; i<10; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('dnd');
                    }
                    // The next five are away
                    for (i=10; i<15; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('away');
                    }
                    // The next five are unavailable
                    for (i=15; i<20; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('unavailable');
                    }
                    // The next 20 are offline
                    for (i=20; i<40; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('offline');
                    }
                }, xmppchat));
            }, xmppchat));

        }, xmppchat));
    });
}));
