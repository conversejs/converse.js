/*global mock, converse */

const { $iq, Strophe, Promise, sizzle, u } = converse.env;

describe('The "Groupchats" List modal', function () {

    it('can be opened from a link in the "Groupchats" section of the controlbox',
        mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {
            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-list-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('converse-muc-list-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

            // See: https://xmpp.org/extensions/xep-0045.html#disco-rooms
            expect(modal.querySelectorAll('.available-chatrooms li').length).toBe(0);

            const server_input = modal.querySelector('input[name="server"]');
            expect(server_input.placeholder).toBe('conference.example.org');
            server_input.value = 'chat.shakespeare.lit';
            modal.querySelector('input[type="submit"]').click();
            await u.waitUntil(() => _converse.chatboxes.length);

            const IQ_stanzas = _converse.connection.IQ_stanzas;
            const sent_stanza = await u.waitUntil(() =>
                IQ_stanzas.filter(s => sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"]`, s).length).pop()
            );
            const id = sent_stanza.getAttribute('id');
            expect(Strophe.serialize(sent_stanza)).toBe(
                `<iq from="romeo@montague.lit/orchard" id="${id}" ` +
                    `to="chat.shakespeare.lit" ` +
                    `type="get" ` +
                    `xmlns="jabber:client">` +
                        `<query xmlns="http://jabber.org/protocol/disco#items"/>` +
                    `</iq>`
            );
            const iq = $iq({
                'from': 'muc.montague.lit',
                'to': 'romeo@montague.lit/pda',
                'id': id,
                'type': 'result',
            })
                .c('query')
                .c('item', { jid: 'heath@chat.shakespeare.lit', name: 'A Lonely Heath' }).up()
                .c('item', { jid: 'coven@chat.shakespeare.lit', name: 'A Dark Cave' }).up()
                .c('item', { jid: 'forres@chat.shakespeare.lit', name: 'The Palace' }).up()
                .c('item', { jid: 'inverness@chat.shakespeare.lit', name: 'Macbeth&apos;s Castle' }).up()
                .c('item', { jid: 'orchard@chat.shakespeare.lit', name: "Capulet's Orchard" }).up()
                .c('item', { jid: 'friar@chat.shakespeare.lit', name: "Friar Laurence's cell" }).up()
                .c('item', { jid: 'hall@chat.shakespeare.lit', name: "Hall in Capulet's house" }).up()
                .c('item', { jid: 'chamber@chat.shakespeare.lit', name: "Juliet's chamber" }).up()
                .c('item', { jid: 'public@chat.shakespeare.lit', name: 'A public place' }).up()
                .c('item', { jid: 'street@chat.shakespeare.lit', name: 'A street' }).nodeTree;
            _converse.connection._dataRecv(mock.createRequest(iq));

            await u.waitUntil(() => modal.querySelectorAll('.available-chatrooms li').length === 11);
            const rooms = modal.querySelectorAll('.available-chatrooms li');
            expect(rooms[0].textContent.trim()).toBe('Groupchats found');
            expect(rooms[1].textContent.trim()).toBe('A Lonely Heath');
            expect(rooms[2].textContent.trim()).toBe('A Dark Cave');
            expect(rooms[3].textContent.trim()).toBe('The Palace');
            expect(rooms[4].textContent.trim()).toBe("Macbeth's Castle");
            expect(rooms[5].textContent.trim()).toBe("Capulet's Orchard");
            expect(rooms[6].textContent.trim()).toBe("Friar Laurence's cell");
            expect(rooms[7].textContent.trim()).toBe("Hall in Capulet's house");
            expect(rooms[8].textContent.trim()).toBe("Juliet's chamber");
            expect(rooms[9].textContent.trim()).toBe('A public place');
            expect(rooms[10].textContent.trim()).toBe('A street');

            rooms[4].querySelector('.open-room').click();
            await u.waitUntil(() => _converse.chatboxes.length > 1);
            expect(sizzle('.chatroom', _converse.el).filter(u.isVisible).length).toBe(1); // There should now be an open chatroom
            const view = _converse.chatboxviews.get('inverness@chat.shakespeare.lit');
            expect(view.querySelector('.chatbox-title__text').textContent.trim()).toBe("Macbeth's Castle");
        })
    );

    it('is pre-filled with the muc_domain',
        mock.initConverse(['chatBoxesFetched'], { 'muc_domain': 'muc.example.org' }, async function (_converse) {
            await mock.openControlBox(_converse);
            const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
            roomspanel.querySelector('.show-list-muc-modal').click();
            mock.closeControlBox(_converse);
            const modal = _converse.api.modal.get('converse-muc-list-modal');
            await u.waitUntil(() => u.isVisible(modal), 1000);
            const server_input = modal.querySelector('input[name="server"]');
            expect(server_input.value).toBe('muc.example.org');
        })
    );

    it("doesn't let you set the MUC domain if it's locked",
        mock.initConverse(
            ['chatBoxesFetched'],
            { 'muc_domain': 'chat.shakespeare.lit', 'locked_muc_domain': true },
            async function (_converse) {
                await mock.openControlBox(_converse);
                const roomspanel = _converse.chatboxviews.get('controlbox').querySelector('converse-rooms-list');
                roomspanel.querySelector('.show-list-muc-modal').click();
                mock.closeControlBox(_converse);
                const modal = _converse.api.modal.get('converse-muc-list-modal');
                await u.waitUntil(() => u.isVisible(modal), 1000);
                spyOn(_converse.ChatRoom.prototype, 'getDiscoInfo').and.callFake(() => Promise.resolve());

                expect(modal.querySelector('input[name="server"]')).toBe(null);
                expect(modal.querySelector('input[type="submit"]')).toBe(null);
                await u.waitUntil(() => _converse.chatboxes.length);
                const sent_stanza = await u.waitUntil(() =>
                    _converse.connection.sent_stanzas
                        .filter(s => sizzle(`query[xmlns="http://jabber.org/protocol/disco#items"]`, s).length)
                        .pop()
                );
                expect(Strophe.serialize(sent_stanza)).toBe(
                    `<iq from="romeo@montague.lit/orchard" id="${sent_stanza.getAttribute('id')}" ` +
                        `to="chat.shakespeare.lit" type="get" xmlns="jabber:client">` +
                            `<query xmlns="http://jabber.org/protocol/disco#items"/>` +
                        `</iq>`
                );
                const iq = $iq({
                    from: 'muc.montague.lit',
                    to: 'romeo@montague.lit/pda',
                    id: sent_stanza.getAttribute('id'),
                    type: 'result',
                })
                    .c('query')
                    .c('item', { jid: 'heath@chat.shakespeare.lit', name: 'A Lonely Heath' }).up()
                    .c('item', { jid: 'coven@chat.shakespeare.lit', name: 'A Dark Cave' }).up()
                    .c('item', { jid: 'forres@chat.shakespeare.lit', name: 'The Palace' }).up();
                _converse.connection._dataRecv(mock.createRequest(iq));

                await u.waitUntil(() => modal.querySelectorAll('.available-chatrooms li').length === 4);
                const rooms = modal.querySelectorAll('.available-chatrooms li');
                expect(rooms[0].textContent.trim()).toBe('Groupchats found');
                expect(rooms[1].textContent.trim()).toBe('A Lonely Heath');
                expect(rooms[2].textContent.trim()).toBe('A Dark Cave');
                expect(rooms[3].textContent.trim()).toBe('The Palace');
            }
        )
    );
});
