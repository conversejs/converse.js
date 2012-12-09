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

        describe("contacts roster", function () {

            xmppchat.roster = new xmppchat.RosterItems();
            xmppchat.rosterview = new xmppchat.RosterView({'model':xmppchat.roster});
            // stub
            xmppchat.chatboxesview = {openChat: function () {} };
            // Hack to make sure there is an element.
            xmppchat.rosterview.$el = $('<dl id="xmppchat-roster"></dl>');
            xmppchat.rosterview.render();

            it("should hide the requesting contacts heading if there aren't any", function () {
                expect(xmppchat.rosterview.$el.find('dt#xmpp-contact-requests').css('display')).toEqual('none');
            });

            it("should be able to add requesting contacts, and they should be sorted alphabetically", function () {
                var jid, i, t;
                spyOn(xmppchat.rosterview, 'render').andCallThrough();
                spyOn(xmppchat.chatboxesview, 'openChat');
                for (i=0; i<10; i++) {
                    jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                    xmppchat.roster.addRosterItem(jid, 'none', 'request', names[i]);
                    expect(xmppchat.rosterview.render).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = xmppchat.rosterview.$el.find('dt#xmpp-contact-requests').siblings('dd.requesting-xmpp-contact').text().replace(/AcceptDecline/g, '');
                    expect(t).toEqual(names.slice(0,i+1).sort().join(''));
                    // When a requesting contact is added, the controlbox must
                    // be opened.
                    expect(xmppchat.chatboxesview.openChat).toHaveBeenCalledWith('controlbox');
                }
            });

            it("should show the requesting contacts heading after they have been added", function () {
                expect(xmppchat.rosterview.$el.find('dt#xmpp-contact-requests').css('display')).toEqual('block');
            });

            it("should hide the pending contacts heading if there aren't any", function () {
                expect(xmppchat.rosterview.$el.find('dt#pending-xmpp-contacts').css('display')).toEqual('none');
            });

            it("should be able to add pending contacts, and they should be sorted alphabetically", function () {
                var jid, i, t;
                spyOn(xmppchat.rosterview, 'render').andCallThrough();
                for (i=10; i<20; i++) {
                    jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                    xmppchat.roster.addRosterItem(jid, 'none', 'subscribe', names[i]);
                    expect(xmppchat.rosterview.render).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = xmppchat.rosterview.$el.find('dt#pending-xmpp-contacts').siblings('dd.pending-xmpp-contact').text();
                    expect(t).toEqual(names.slice(10,i+1).sort().join(''));
                }
            });

            it("should show the pending contacts heading after they have been added", function () {
                expect(xmppchat.rosterview.$el.find('dt#pending-xmpp-contacts').css('display')).toEqual('block');
            });

            it("should hide the current contacts heading if there aren't any", function () {
                expect(xmppchat.rosterview.$el.find('dt#xmpp-contacts').css('display')).toEqual('none');
            });

            it("should be able to add existing contacts, and they should be sorted alphabetically", function () {
                var jid, i, t;
                spyOn(xmppchat.rosterview, 'render').andCallThrough();
                // Add 40 properly regisertered contacts (initially all offline) and check that they are sorted alphabetically
                for (i=20; i<60; i++) {
                    jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                    xmppchat.roster.addRosterItem(jid, 'both', null, names[i]);
                    expect(xmppchat.rosterview.render).toHaveBeenCalled();
                    // Check that they are sorted alphabetically
                    t = xmppchat.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.offline').find('a.open-chat').text();
                    expect(t).toEqual(names.slice(20,i+1).sort().join(''));
                }
            });

            it("should show the current contacts heading if they have been added", function () {
                expect(xmppchat.rosterview.$el.find('dt#xmpp-contacts').css('display')).toEqual('block');
            });

            describe("roster items", function () {

                it("should be able to change their status to online and be sorted alphabetically", function () {
                    var item, view, jid;
                    spyOn(xmppchat.rosterview, 'render').andCallThrough();
                    for (i=59; i>54; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = xmppchat.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('presence_type', 'online');
                        expect(view.render).toHaveBeenCalled();
                        expect(xmppchat.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = xmppchat.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.online').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i)).sort().join(''));
                    }
                });

                it("should be able to change their status to busy and be sorted alphabetically", function () {
                    var item, view, jid;
                    spyOn(xmppchat.rosterview, 'render').andCallThrough();
                    for (i=54; i>49; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = xmppchat.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('presence_type', 'busy');
                        expect(view.render).toHaveBeenCalled();
                        expect(xmppchat.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = xmppchat.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.busy').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i), -5).sort().join(''));
                    }
                });

                it("should be able to change their status to away and be sorted alphabetically", function () {
                    var item, view, jid;
                    spyOn(xmppchat.rosterview, 'render').andCallThrough();
                    for (i=49; i>44; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = xmppchat.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('presence_type', 'away');
                        expect(view.render).toHaveBeenCalled();
                        expect(xmppchat.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = xmppchat.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.away').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i),-10).sort().join(''));
                    }
                });

                it("should be able to change their status to unavailable and be sorted alphabetically", function () {
                    var item, view, jid;
                    spyOn(xmppchat.rosterview, 'render').andCallThrough();
                    for (i=44; i>39; i--) {
                        jid = names[i].replace(' ','.').toLowerCase() + '@localhost';
                        view = xmppchat.rosterview.rosteritemviews[jid];
                        spyOn(view, 'render').andCallThrough();
                        item = view.model;
                        item.set('presence_type', 'unavailable');
                        expect(view.render).toHaveBeenCalled();
                        expect(xmppchat.rosterview.render).toHaveBeenCalled();

                        // Check that they are sorted alphabetically
                        t = xmppchat.rosterview.$el.find('dt#xmpp-contacts').siblings('dd.current-xmpp-contact.unavailable').find('a.open-chat').text();
                        expect(t).toEqual(names.slice(-(60-i), -15).sort().join(''));
                    }
                });

                it("should be ordered according to status: online, busy, away, unavailable, offline", function () {
                    var contacts = xmppchat.rosterview.$el.find('dd.current-xmpp-contact');
                    var i;
                    // The first five contacts are online.
                    for (i=0; i<5; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('online');
                    }
                    // The next five are busy
                    for (i=5; i<10; i++) {
                        expect($(contacts[i]).attr('class').split(' ',1)[0]).toEqual('busy');
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
                });
            });

        });
    });
}));
