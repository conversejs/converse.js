import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

describe('A chat state indication', function () {
    it(
        'is sent out when the client becomes or stops being idle',
        mock.initConverse(converse, ['discoInitialized'], {}, (_converse) => {
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
            expect(sent_stanza).toEqualStanza(stx`<inactive xmlns="urn:xmpp:csi:0"/>`);
            _converse.onUserActivity();
            expect(sent_stanza).toEqualStanza(stx`<active xmlns="urn:xmpp:csi:0"/>`);
        }),
    );
});

describe('Automatic status change', function () {
    it(
        'happens when the client is idle for long enough',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
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
        }),
    );

    it(
        'broadcasts an online presence to contacts when the user returns from auto-away',
        mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
            const { api } = _converse;
            api.settings.set('auto_away', 3);

            let i = 0;
            while (i <= api.settings.get('auto_away')) {
                _converse.onEverySecond();
                i++;
            }
            expect(await api.user.status.get()).toBe('away');

            const sent_stanzas = api.connection.get().sent_stanzas;

            _converse.onUserActivity();
            expect(await api.user.status.get()).toBe('online');

            // Returning from auto-away must reach the network: the latest presence
            // broadcast has no <show> (i.e. online), so contacts stop seeing the
            // stale 'away'. Before clearing `show` actually notified, the last
            // presence on the wire stayed the away one and this would time out.
            const presence = await u.waitUntil(() => {
                const presences = sent_stanzas.filter((s) => s.nodeName === 'presence');
                const last = presences[presences.length - 1];
                return last && !last.querySelector('show') ? last : null;
            });
            expect(presence.querySelector('show')).toBe(null);
        }),
    );
});
