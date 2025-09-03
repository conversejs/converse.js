const { Strophe } = converse.env;

describe('A chat state indication', function () {
    it(
        'are sent out when the client becomes or stops being idle',
        mock.initConverse(['discoInitialized'], {}, (_converse) => {
            let i = 0;
            const domain = _converse.session.get('domain');
            _converse.disco_entities.get(domain).features['urn:xmpp:csi:0'] = true; // Mock that the server supports CSI

            let sent_stanza = null;
            spyOn(_converse.api.connection.get(), 'send').and.callFake((stanza) => {
                sent_stanza = stanza;
            });

            _converse.api.settings.set('csi_waiting_time', 3);
            while (i <= _converse.api.settings.get('csi_waiting_time')) {
                expect(sent_stanza).toBe(null);
                _converse.exports.onEverySecond();
                i++;
            }
            expect(Strophe.serialize(sent_stanza)).toBe('<inactive xmlns="urn:xmpp:csi:0"/>');
            _converse.onUserActivity();
            expect(Strophe.serialize(sent_stanza)).toBe('<active xmlns="urn:xmpp:csi:0"/>');
        })
    );
});

describe('Automatic status change', function () {
    it(
        'happens when the client is idle for long enough',
        mock.initConverse(['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            let i = 0;
            // Usually initialized by registerIntervalHandler
            _converse.api.settings.set('auto_away', 3);
            _converse.api.settings.set('auto_xa', 6);

            expect(await _converse.api.user.status.get()).toBe('online');
            while (i <= _converse.api.settings.get('auto_away')) {
                expect(await _converse.api.user.status.get()).toBe('online');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('away');

            while (i <= api.settings.get('auto_xa')) {
                expect(await _converse.api.user.status.get()).toBe('away');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('xa');

            _converse.onUserActivity();
            expect(_converse.api.user.idle.get()).toEqual({ idle: false, seconds: 0 });
            expect(await _converse.api.user.status.get()).toBe('online');

            // Check that it also works for the chat feature
            await _converse.api.user.status.set('chat');
            i = 0;
            while (i <= _converse.api.settings.get('auto_away')) {
                _converse.onEverySecond();
                i++;
            }
            while (i <= api.settings.get('auto_xa')) {
                expect(await _converse.api.user.status.get()).toBe('away');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('xa');

            _converse.onUserActivity();
            expect(await _converse.api.user.status.get()).toBe('online');

            // Check that it doesn't work for 'dnd'
            await _converse.api.user.status.set('dnd');
            i = 0;
            while (i <= _converse.api.settings.get('auto_away')) {
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('dnd');
            while (i <= api.settings.get('auto_xa')) {
                expect(await _converse.api.user.status.get()).toBe('dnd');
                _converse.onEverySecond();
                i++;
            }
            expect(await _converse.api.user.status.get()).toBe('dnd');

            _converse.onUserActivity();
            expect(await _converse.api.user.status.get()).toBe('dnd');
        })
    );
});
