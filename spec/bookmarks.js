/*global waitUntilPromise */

(function (root, factory) {
    define([
        "jasmine",
        "jquery",
        "converse-core",
        "utils",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, $, converse, utils, mock, test_utils) {
    "use strict";
    var $iq = converse.env.$iq,
        Strophe = converse.env.Strophe,
        _ = converse.env._;

    describe("A chat room", function () {

        it("can be bookmarked", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'], {}, function (done, _converse) {

            var sent_stanza, IQ_id;
            var sendIQ = _converse.connection.sendIQ;
            spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                sent_stanza = iq;
                IQ_id = sendIQ.bind(this)(iq, callback, errback);
            });
            spyOn(_converse.connection, 'getUniqueId').and.callThrough();

            test_utils.openChatRoom(_converse, 'theplay', 'conference.shakespeare.lit', 'JC');
            var jid = 'theplay@conference.shakespeare.lit';
            var view = _converse.chatboxviews.get(jid);
            spyOn(view, 'renderBookmarkForm').and.callThrough();
            spyOn(view, 'cancelConfiguration').and.callThrough();

            var $bookmark = view.$el.find('.icon-pushpin');
            $bookmark.click();
            expect(view.renderBookmarkForm).toHaveBeenCalled();

            view.$el.find('.button-cancel').click();
            expect(view.cancelConfiguration).toHaveBeenCalled();
            expect($bookmark.hasClass('on-button'), false);

            $bookmark.click();
            expect(view.renderBookmarkForm).toHaveBeenCalled();

            /* Client uploads data:
             * --------------------
             *  <iq from='juliet@capulet.lit/balcony' type='set' id='pip1'>
             *      <pubsub xmlns='http://jabber.org/protocol/pubsub'>
             *          <publish node='storage:bookmarks'>
             *              <item id='current'>
             *                  <storage xmlns='storage:bookmarks'>
             *                      <conference name='The Play&apos;s the Thing'
             *                                  autojoin='true'
             *                                  jid='theplay@conference.shakespeare.lit'>
             *                          <nick>JC</nick>
             *                      </conference>
             *                  </storage>
             *              </item>
             *          </publish>
             *          <publish-options>
             *              <x xmlns='jabber:x:data' type='submit'>
             *                  <field var='FORM_TYPE' type='hidden'>
             *                      <value>http://jabber.org/protocol/pubsub#publish-options</value>
             *                  </field>
             *                  <field var='pubsub#persist_items'>
             *                      <value>true</value>
             *                  </field>
             *                  <field var='pubsub#access_model'>
             *                      <value>whitelist</value>
             *                  </field>
             *              </x>
             *          </publish-options>
             *      </pubsub>
             *  </iq>
             */
            expect(view.model.get('bookmarked')).toBeFalsy();
            var $form = view.$el.find('.chatroom-form');
            $form.find('input[name="name"]').val('Play&apos;s the Thing');
            $form.find('input[name="autojoin"]').prop('checked', true);
            $form.find('input[name="nick"]').val('JC');
            view.$el.find('.button-primary').click();

            expect(view.model.get('bookmarked')).toBeTruthy();
            expect($bookmark.hasClass('on-button'), true);

            expect(sent_stanza.toLocaleString()).toBe(
                "<iq type='set' from='dummy@localhost/resource' xmlns='jabber:client' id='"+IQ_id+"'>"+
                    "<pubsub xmlns='http://jabber.org/protocol/pubsub'>"+
                        "<publish node='storage:bookmarks'>"+
                            "<item id='current'>"+
                                "<storage xmlns='storage:bookmarks'>"+
                                    "<conference name='Play&amp;apos;s the Thing' autojoin='true' jid='theplay@conference.shakespeare.lit'>"+
                                        "<nick>JC</nick>"+
                                    "</conference>"+
                                "</storage>"+
                            "</item>"+
                        "</publish>"+
                        "<publish-options>"+
                            "<x xmlns='jabber:x:data' type='submit'>"+
                                "<field var='FORM_TYPE' type='hidden'>"+
                                    "<value>http://jabber.org/protocol/pubsub#publish-options</value>"+
                                "</field>"+
                                "<field var='pubsub#persist_items'>"+
                                    "<value>true</value>"+
                                "</field>"+
                                "<field var='pubsub#access_model'>"+
                                    "<value>whitelist</value>"+
                                "</field>"+
                            "</x>"+
                        "</publish-options>"+
                    "</pubsub>"+
                "</iq>"
            );

            /* Server acknowledges successful storage
             *
             * <iq to='juliet@capulet.lit/balcony' type='result' id='pip1'/>
             */
            var stanza = $iq({
                'to':_converse.connection.jid,
                'type':'result',
                'id':IQ_id
            });
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            // We ignore this IQ stanza... (unless it's an error stanza), so
            // nothing to test for here.
            done();
        }));

        it("will be automatically opened if 'autojoin' is set on the bookmark", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'], {}, function (done, _converse) {

            var jid = 'lounge@localhost';
            _converse.bookmarks.create({
                'jid': jid,
                'autojoin': false,
                'name':  'The Lounge',
                'nick': ' Othello'
            });
            expect(_.isUndefined(_converse.chatboxviews.get(jid))).toBeTruthy();

            jid = 'theplay@conference.shakespeare.lit';
            _converse.bookmarks.create({
                'jid': jid,
                'autojoin': true,
                'name':  'The Play',
                'nick': ' Othello'
            });
            expect(_.isUndefined(_converse.chatboxviews.get(jid))).toBeFalsy();
            done();
        }));

        describe("when bookmarked", function () {

            it("displays that it's bookmarked through its bookmark icon", mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {}, function (done, _converse) {

                test_utils.openChatRoom(_converse, 'lounge', 'localhost', 'dummy');
                var view = _converse.chatboxviews.get('lounge@localhost');
                var $bookmark_icon = view.$('.icon-pushpin');
                expect($bookmark_icon.hasClass('button-on')).toBeFalsy();
                view.model.set('bookmarked', true);
                expect($bookmark_icon.hasClass('button-on')).toBeTruthy();
                view.model.set('bookmarked', false);
                expect($bookmark_icon.hasClass('button-on')).toBeFalsy();
                done();
            }));

            it("can be unbookmarked", mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {}, function (done, _converse) {

                var sent_stanza, IQ_id;
                var sendIQ = _converse.connection.sendIQ;
                test_utils.openChatRoom(_converse, 'theplay', 'conference.shakespeare.lit', 'JC');
                var jid = 'theplay@conference.shakespeare.lit';
                var view = _converse.chatboxviews.get(jid);
                spyOn(view, 'toggleBookmark').and.callThrough();
                spyOn(_converse.bookmarks, 'sendBookmarkStanza').and.callThrough();
                view.delegateEvents();
                _converse.bookmarks.create({
                    'jid': view.model.get('jid'),
                    'autojoin': false,
                    'name':  'The Play',
                    'nick': ' Othello'
                });
                expect(_converse.bookmarks.length).toBe(1);
                expect(view.model.get('bookmarked')).toBeTruthy();
                var $bookmark_icon = view.$('.icon-pushpin');
                expect($bookmark_icon.hasClass('button-on')).toBeTruthy();

                spyOn(_converse.connection, 'sendIQ').and.callFake(function (iq, callback, errback) {
                    sent_stanza = iq;
                    IQ_id = sendIQ.bind(this)(iq, callback, errback);
                });
                spyOn(_converse.connection, 'getUniqueId').and.callThrough();
                $bookmark_icon.click();
                expect(view.toggleBookmark).toHaveBeenCalled();
                expect($bookmark_icon.hasClass('button-on')).toBeFalsy();
                expect(_converse.bookmarks.length).toBe(0);

                // Check that an IQ stanza is sent out, containing no
                // conferences to bookmark (since we removed the one and
                // only bookmark).
                expect(sent_stanza.toLocaleString()).toBe(
                    "<iq type='set' from='dummy@localhost/resource' xmlns='jabber:client' id='"+IQ_id+"'>"+
                        "<pubsub xmlns='http://jabber.org/protocol/pubsub'>"+
                            "<publish node='storage:bookmarks'>"+
                                "<item id='current'>"+
                                    "<storage xmlns='storage:bookmarks'/>"+
                                "</item>"+
                            "</publish>"+
                            "<publish-options>"+
                                "<x xmlns='jabber:x:data' type='submit'>"+
                                    "<field var='FORM_TYPE' type='hidden'>"+
                                        "<value>http://jabber.org/protocol/pubsub#publish-options</value>"+
                                    "</field>"+
                                    "<field var='pubsub#persist_items'>"+
                                        "<value>true</value>"+
                                    "</field>"+
                                    "<field var='pubsub#access_model'>"+
                                        "<value>whitelist</value>"+
                                    "</field>"+
                                "</x>"+
                            "</publish-options>"+
                        "</pubsub>"+
                    "</iq>"
                );
                done();
            }));
        });

        describe("and when autojoin is set", function () {

            it("will be be opened and joined automatically upon login", mock.initConverse(function (_converse) {
                spyOn(_converse.api.rooms, 'open');
                var jid = 'theplay@conference.shakespeare.lit';
                var model = _converse.bookmarks.create({
                    'jid': jid,
                    'autojoin': false,
                    'name':  'The Play',
                    'nick': ''
                });
                expect(_converse.api.rooms.open).not.toHaveBeenCalled();
                _converse.bookmarks.remove(model);

                _converse.bookmarks.create({
                    'jid': jid,
                    'autojoin': true,
                    'name':  'Hamlet',
                    'nick': ''
                });
                expect(_converse.api.rooms.open).toHaveBeenCalled();
            }));
        });
    });

    describe("Bookmarks", function () {

        xit("can be pushed from the XMPP server", mock.initConverse(function (_converse) {
            // TODO
            /* The stored data is automatically pushed to all of the user's
             * connected resources.
             *
             * Publisher receives event notification
             * -------------------------------------
             * <message from='juliet@capulet.lit'
             *         to='juliet@capulet.lit/balcony'
             *         type='headline'
             *         id='rnfoo1'>
             * <event xmlns='http://jabber.org/protocol/pubsub#event'>
             *     <items node='storage:bookmarks'>
             *     <item id='current'>
             *         <storage xmlns='storage:bookmarks'>
             *         <conference name='The Play&apos;s the Thing'
             *                     autojoin='true'
             *                     jid='theplay@conference.shakespeare.lit'>
             *             <nick>JC</nick>
             *         </conference>
             *         </storage>
             *     </item>
             *     </items>
             * </event>
             * </message>

             * <message from='juliet@capulet.lit'
             *         to='juliet@capulet.lit/chamber'
             *         type='headline'
             *         id='rnfoo2'>
             * <event xmlns='http://jabber.org/protocol/pubsub#event'>
             *     <items node='storage:bookmarks'>
             *     <item id='current'>
             *         <storage xmlns='storage:bookmarks'>
             *         <conference name='The Play&apos;s the Thing'
             *                     autojoin='true'
             *                     jid='theplay@conference.shakespeare.lit'>
             *             <nick>JC</nick>
             *         </conference>
             *         </storage>
             *     </item>
             *     </items>
             * </event>
             * </message>
             */
        }));

        it("can be retrieved from the XMPP server", mock.initConverseWithPromises(
            ['send'], ['rosterGroupsFetched'], {}, function (done, _converse) {

            /* Client requests all items
             * -------------------------
             *
             *  <iq from='juliet@capulet.lit/randomID' type='get' id='retrieve1'>
             *  <pubsub xmlns='http://jabber.org/protocol/pubsub'>
             *      <items node='storage:bookmarks'/>
             *  </pubsub>
             *  </iq>
             */
            var IQ_id;
            expect(_.filter(_converse.connection.send.calls.all(), function (call) {
                var stanza = call.args[0];
                if (!(stanza instanceof Element) || stanza.nodeName !== 'iq') {
                    return;
                }
                // XXX: Wrapping in a div is a workaround for PhantomJS
                var div = document.createElement('div');
                div.appendChild(stanza);
                if (div.innerHTML ===
                    '<iq from="dummy@localhost/resource" type="get" '+
                         'xmlns="jabber:client" id="'+stanza.getAttribute('id')+'">'+
                    '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                        '<items node="storage:bookmarks"></items>'+
                    '</pubsub>'+
                    '</iq>') {
                    IQ_id = stanza.getAttribute('id');
                    return true;
                }
            }).length).toBe(1);

            /*
             * Server returns all items
             * ------------------------
             * <iq type='result'
             *     to='juliet@capulet.lit/randomID'
             *     id='retrieve1'>
             * <pubsub xmlns='http://jabber.org/protocol/pubsub'>
             *     <items node='storage:bookmarks'>
             *     <item id='current'>
             *         <storage xmlns='storage:bookmarks'>
             *         <conference name='The Play&apos;s the Thing'
             *                     autojoin='true'
             *                     jid='theplay@conference.shakespeare.lit'>
             *             <nick>JC</nick>
             *         </conference>
             *         </storage>
             *     </item>
             *     </items>
             * </pubsub>
             * </iq>
             */
            expect(_converse.bookmarks.models.length).toBe(0);
            var stanza = $iq({'to': _converse.connection.jid, 'type':'result', 'id':IQ_id})
                .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                    .c('items', {'node': 'storage:bookmarks'})
                        .c('item', {'id': 'current'})
                            .c('storage', {'xmlns': 'storage:bookmarks'})
                                .c('conference', {
                                    'name': 'The Play&apos;s the Thing',
                                    'autojoin': 'true',
                                    'jid': 'theplay@conference.shakespeare.lit'
                                }).c('nick').t('JC').up().up()
                                .c('conference', {
                                    'name': 'Another room',
                                    'autojoin': 'false',
                                    'jid': 'another@conference.shakespeare.lit'
                                }).c('nick').t('JC').up().up();
            _converse.connection._dataRecv(test_utils.createRequest(stanza));
            expect(_converse.bookmarks.models.length).toBe(2);
            expect(_converse.bookmarks.findWhere({'jid': 'theplay@conference.shakespeare.lit'}).get('autojoin')).toBe(true);
            expect(_converse.bookmarks.findWhere({'jid': 'another@conference.shakespeare.lit'}).get('autojoin')).toBe(false);
            done();
        }));

        describe("The rooms panel", function () {

            it("shows a list of bookmarks", mock.initConverseWithPromises(
                ['send'], ['rosterGroupsFetched'], {}, function (done, _converse) {

                var IQ_id;
                expect(_.filter(_converse.connection.send.calls.all(), function (call) {
                    var stanza = call.args[0];
                    if (!(stanza instanceof Element) || stanza.nodeName !== 'iq') {
                        return;
                    }
                    // XXX: Wrapping in a div is a workaround for PhantomJS
                    var div = document.createElement('div');
                    div.appendChild(stanza);
                    if (div.innerHTML ===
                        '<iq from="dummy@localhost/resource" type="get" '+
                            'xmlns="jabber:client" id="'+stanza.getAttribute('id')+'">'+
                        '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                            '<items node="storage:bookmarks"></items>'+
                        '</pubsub>'+
                        '</iq>') {
                        IQ_id = stanza.getAttribute('id');
                        return true;
                    }
                }).length).toBe(1);

                _converse.chatboxviews.get('controlbox').$('#chatrooms dl.bookmarks').html('');
                var stanza = $iq({'to': _converse.connection.jid, 'type':'result', 'id':IQ_id})
                    .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'})
                            .c('item', {'id': 'current'})
                                .c('storage', {'xmlns': 'storage:bookmarks'})
                                    .c('conference', {
                                        'name': 'The Play&apos;s the Thing',
                                        'autojoin': 'false',
                                        'jid': 'theplay@conference.shakespeare.lit'
                                    }).c('nick').t('JC').up().up()
                                    .c('conference', {
                                        'name': 'Bookmark with a very very long name that will be shortened',
                                        'autojoin': 'false',
                                        'jid': 'longname@conference.shakespeare.lit'
                                    }).c('nick').t('JC').up().up()
                                    .c('conference', {
                                        'name': 'Another room',
                                        'autojoin': 'false',
                                        'jid': 'another@conference.shakespeare.lit'
                                    }).c('nick').t('JC').up().up();
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                test_utils.waitUntil(function () {
                    return $('#chatrooms dl.bookmarks dd').length;
                }, 300).then(function () {
                    expect($('#chatrooms dl.bookmarks dd').length).toBe(3);
                    done();
                });
            }));

            it("remembers the toggle state of the bookmarks list", mock.initConverseWithPromises(
                ['send'], ['rosterGroupsFetched'], {}, function (done, _converse) {

                var IQ_id;
                expect(_.filter(_converse.connection.send.calls.all(), function (call) {
                    var stanza = call.args[0];
                    if (!(stanza instanceof Element) || stanza.nodeName !== 'iq') {
                        return;
                    }
                    // XXX: Wrapping in a div is a workaround for PhantomJS
                    var div = document.createElement('div');
                    div.appendChild(stanza);
                    if (div.innerHTML ===
                        '<iq from="dummy@localhost/resource" type="get" '+
                            'xmlns="jabber:client" id="'+stanza.getAttribute('id')+'">'+
                        '<pubsub xmlns="http://jabber.org/protocol/pubsub">'+
                            '<items node="storage:bookmarks"></items>'+
                        '</pubsub>'+
                        '</iq>') {
                        IQ_id = stanza.getAttribute('id');
                        return true;
                    }
                }).length).toBe(1);
                _converse.chatboxviews.get('controlbox').$('#chatrooms dl.bookmarks').html('');
                var stanza = $iq({'to': _converse.connection.jid, 'type':'result', 'id':IQ_id})
                    .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'})
                            .c('item', {'id': 'current'})
                                .c('storage', {'xmlns': 'storage:bookmarks'});
                _converse.connection._dataRecv(test_utils.createRequest(stanza));

                _converse.bookmarks.create({
                    'jid': 'theplay@conference.shakespeare.lit',
                    'autojoin': false,
                    'name':  'The Play',
                    'nick': ''
                });
                test_utils.openControlBox().openRoomsPanel(_converse);

                test_utils.waitUntil(function () {
                    return $('#chatrooms dl.bookmarks dd:visible').length;
                }, 300).then(function () {
                    expect($('#chatrooms dl.bookmarks dd:visible').length).toBe(1);
                    expect(_converse.bookmarksview.list_model.get('toggle-state')).toBe(_converse.OPENED);
                    $('#chatrooms .bookmarks-toggle').click();
                    expect($('#chatrooms dl.bookmarks dd:visible').length).toBe(0);
                    expect(_converse.bookmarksview.list_model.get('toggle-state')).toBe(_converse.CLOSED);
                    $('#chatrooms .bookmarks-toggle').click();
                    expect($('#chatrooms dl.bookmarks dd:visible').length).toBe(1);
                    expect(_converse.bookmarksview.list_model.get('toggle-state')).toBe(_converse.OPENED);
                    done();
                });
            }));
        });
    });

    describe("When hide_open_bookmarks is true and a bookmarked room is opened", function () {

        it("can be closed", mock.initConverseWithPromises(
            null, ['rosterGroupsFetched'],
            { hide_open_bookmarks: true },
            function (done, _converse) {

            test_utils.openControlBox().openRoomsPanel(_converse);
            // XXX Create bookmarks view here, otherwise we need to mock stanza
            // traffic for it to get created.
            _converse.bookmarksview = new _converse.BookmarksView(
                {'model': _converse.bookmarks}
            );
            _converse.emit('bookmarksInitialized');

            // Check that it's there
            var jid = 'room@conference.example.org';
            _converse.bookmarks.create({
                'jid': jid,
                'autojoin': false,
                'name':  'The Play',
                'nick': ' Othello'
            });

            expect(_converse.bookmarks.length).toBe(1);
            var room_els = _converse.bookmarksview.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);

            // Check that it disappears once the room is opened
            var bookmark = _converse.bookmarksview.el.querySelector(".open-room");
            bookmark.click();
            room_els = _converse.bookmarksview.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(0);

            // Check that it reappears once the room is closed
            var view = _converse.chatboxviews.get(jid);
            view.close();
            room_els = _converse.bookmarksview.el.querySelectorAll(".open-room");
            expect(room_els.length).toBe(1);
            done();
        }));
    });
}));
