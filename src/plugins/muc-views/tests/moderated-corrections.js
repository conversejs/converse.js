import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { Strophe, u, stx, sizzle } = converse.env;

const muc_jid = 'lounge@montague.lit';

/**
 * Receives a message from `mallory` with the stanza-id `original-id`, followed by one
 * correction per entry in `correction_ids`, each with that entry as its stanza-id.
 * @returns {Promise<import('@converse/headless').MUCMessage>}
 */
async function receiveCorrectedMessage(_converse, model, correction_ids = ['correction-id-1']) {
    const msgid = u.getUniqueId();
    await model.handleMessageStanza(stx`
        <message xmlns="jabber:client"
                from="${muc_jid}/mallory"
                to="${_converse.jid}"
                type="groupchat"
                id="${msgid}">
            <body>Visit this site to get free Bitcoin!</body>
            <stanza-id xmlns="urn:xmpp:sid:0" id="original-id" by="${muc_jid}"/>
        </message>`);

    for (const [i, id] of correction_ids.entries()) {
        await model.handleMessageStanza(stx`
            <message xmlns="jabber:client"
                    from="${muc_jid}/mallory"
                    to="${_converse.jid}"
                    type="groupchat"
                    id="${u.getUniqueId()}">
                <body>Visit this site to get free Bitcoin! (edit ${i + 1})</body>
                <replace id="${msgid}" xmlns="${Strophe.NS.MESSAGE_CORRECT}"/>
                <stanza-id xmlns="urn:xmpp:sid:0" id="${id}" by="${muc_jid}"/>
            </message>`);
    }
    expect(model.messages.length).toBe(1);
    return model.messages.at(0);
}

function receiveModeration(_converse, stanza_id) {
    _converse.api.connection.get()._dataRecv(
        mock.createRequest(
            _converse,
            stx`
            <message xmlns="jabber:client" from="${muc_jid}" type="groupchat" id="${u.getUniqueId()}">
                <retract id="${stanza_id}" xmlns="${Strophe.NS.RETRACT}">
                    <moderated xmlns="${Strophe.NS.MODERATE}" by="${muc_jid}/madison"/>
                    <reason>Spam</reason>
                </retract>
            </message>`,
        ),
    );
}

/**
 * Moderates the message shown in the view through its retract action, and
 * once the first moderation IQ has been sent, returns a function which
 * returns all moderation IQs sent so far.
 * @returns {Promise<() => Element[]>}
 */
async function moderateThroughUI(_converse, view) {
    const sent_IQs = _converse.api.connection.get().IQ_stanzas;
    const retract_button = await u.waitUntil(() => view.querySelector('.chat-msg__content .chat-msg__action-retract'));
    retract_button.click();
    await u.waitUntil(() => u.isVisible(document.querySelector('converse-confirm-modal.modal')));
    document.querySelector('#converse-modals .modal input[name="reason"]').value = 'Spam';
    document.querySelector('#converse-modals .modal button[type="submit"]').click();
    const moderation_iqs = () => sent_IQs.filter((iq) => iq.querySelector('iq > moderate'));
    await u.waitUntil(() => moderation_iqs().length);
    return moderation_iqs;
}

/**
 * Reflects the last message we've sent to the groupchat, with the given stanza-id.
 */
async function reflectSentMessage(_converse, model, stanza_id) {
    const connection = _converse.api.connection.get();
    const sent = connection.sent_stanzas.filter((s) => s.nodeName === 'message').pop();
    const replace_id = sent.querySelector('replace')?.getAttribute('id');
    await model.handleMessageStanza(stx`
        <message xmlns="jabber:client"
                from="${muc_jid}/romeo"
                to="${connection.jid}"
                type="groupchat"
                id="${sent.getAttribute('id')}">
            <body>${sent.querySelector('body').textContent}</body>
            ${replace_id ? stx`<replace id="${replace_id}" xmlns="${Strophe.NS.MESSAGE_CORRECT}"/>` : ''}
            <origin-id xmlns="urn:xmpp:sid:0" id="${sent.querySelector('origin-id').getAttribute('id')}"/>
            <stanza-id xmlns="urn:xmpp:sid:0" id="${stanza_id}" by="${muc_jid}"/>
        </message>`);
}

function respondToIQ(_converse, iq, type = 'result') {
    _converse.api.connection.get()._dataRecv(
        mock.createRequest(
            _converse,
            type === 'result'
                ? stx`<iq xmlns="jabber:client" type="result" from="${muc_jid}" to="${_converse.jid}" id="${iq.getAttribute('id')}"/>`
                : stx`<iq xmlns="jabber:client" type="error" from="${muc_jid}" to="${_converse.jid}" id="${iq.getAttribute('id')}">
                    <error type="auth"><forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/></error>
                </iq>`,
        ),
    );
}

/**
 * Answers the MAM query sent when entering the groupchat with the given
 * messages, in the given order. They're from `mallory` unless another nick is given.
 * @param {{ stanza_id: string, msgid: string, stamp: string, body?: string, replace_id?: string, nick?: string }[]} messages
 * @param {boolean} [as_tombstones] - Whether to send the messages as XEP-0425 tombstones
 *  (which keep their XEP-0308 `<replace/>` element) instead of with their bodies.
 * @param {boolean} [complete] - Whether these are all the messages the query matched.
 */
async function receiveArchivedMessages(_converse, messages, as_tombstones = false, complete = true) {
    const connection = _converse.api.connection.get();
    const iq = await u.waitUntil(() =>
        connection.IQ_stanzas.filter((iq) => sizzle(`query[xmlns="${Strophe.NS.MAM}"]`, iq).length).pop(),
    );
    const queryid = iq.querySelector('query').getAttribute('queryid');
    for (const { stanza_id, msgid, stamp, body, replace_id, nick = 'mallory' } of messages) {
        connection._dataRecv(
            mock.createRequest(
                _converse,
                stx`
                <message xmlns="jabber:client" to="${connection.jid}" from="${muc_jid}" id="${u.getUniqueId()}">
                    <result xmlns="${Strophe.NS.MAM}" queryid="${queryid}" id="${stanza_id}">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <delay xmlns="urn:xmpp:delay" stamp="${stamp}"/>
                            <message xmlns="jabber:client" type="groupchat" from="${muc_jid}/${nick}" id="${msgid}">
                                ${
                                    as_tombstones
                                        ? stx`<retracted stamp="2026-10-20T10:05:00.000Z" xmlns="${Strophe.NS.RETRACT}">
                                            <moderated by="${muc_jid}/romeo" xmlns="${Strophe.NS.MODERATE}"/>
                                        </retracted>`
                                        : stx`<body>${body}</body>`
                                }
                                ${replace_id ? stx`<replace id="${replace_id}" xmlns="${Strophe.NS.MESSAGE_CORRECT}"/>` : ''}
                            </message>
                        </forwarded>
                    </result>
                </message>`,
            ),
        );
    }
    connection._dataRecv(
        mock.createRequest(
            _converse,
            stx`
            <iq xmlns="jabber:client" type="result" id="${iq.getAttribute('id')}">
                <fin xmlns="${Strophe.NS.MAM}" complete="${complete}">
                    <set xmlns="http://jabber.org/protocol/rsm">
                        <first index="0">${messages[0].stanza_id}</first>
                        <last>${messages[messages.length - 1].stanza_id}</last>
                    </set>
                </fin>
            </iq>`,
        ),
    );
}

describe('A corrected groupchat message', function () {
    it(
        'keeps the stanza-id of its original version',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const message = await receiveCorrectedMessage(_converse, model, ['correction-id-1', 'correction-id-2']);
            expect(message.get('body')).toBe('Visit this site to get free Bitcoin! (edit 2)');
            expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1', 'correction-id-2']);
        }),
    );

    it(
        'is removed by a moderation naming its original stanza-id',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model);
            const view = _converse.chatboxviews.get(muc_jid);

            receiveModeration(_converse, 'original-id');

            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(message.get('moderated')).toBe('retracted');
            expect(message.get('moderation_reason')).toBe('Spam');
            expect(model.messages.length).toBe(1);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        }),
    );

    it(
        'is removed by a moderation naming the stanza-id of a correction',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model);
            const view = _converse.chatboxviews.get(muc_jid);

            receiveModeration(_converse, 'correction-id-1');

            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(message.get('moderated')).toBe('retracted');
            expect(model.messages.length).toBe(1);
        }),
    );

    it(
        'is shown as removed once when each of its versions is moderated',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model, ['correction-id-1', 'correction-id-2']);
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(model, 'handleModeration').and.callThrough();

            receiveModeration(_converse, 'original-id');
            receiveModeration(_converse, 'correction-id-1');
            receiveModeration(_converse, 'correction-id-2');

            await u.waitUntil(() => model.handleModeration.calls.count() === 3);
            await model.msg_chain;
            expect(message.get('moderated')).toBe('retracted');
            expect(model.messages.length).toBe(1);
            expect(model.messages.filter((m) => m.get('dangling_moderation')).length).toBe(0);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        }),
    );

    it(
        'is removed by a moderation of a correction which arrives before that correction',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model, []);

            receiveModeration(_converse, 'correction-id-1');
            await u.waitUntil(() => model.messages.length === 2);
            expect(model.messages.at(1).get('dangling_moderation')).toBe(true);

            const stamp = new Date(Date.now() - 1000).toISOString();
            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                        from="${muc_jid}/mallory"
                        to="${_converse.jid}"
                        type="groupchat"
                        id="${u.getUniqueId()}">
                    <body>Visit this site to get free Ethereum!</body>
                    <delay xmlns="urn:xmpp:delay" stamp="${stamp}"/>
                    <replace id="${message.get('msgid')}" xmlns="${Strophe.NS.MESSAGE_CORRECT}"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="correction-id-1" by="${muc_jid}"/>
                </message>`);

            await u.waitUntil(() => model.messages.length === 1);
            expect(model.messages.at(0)).toBe(message);
            expect(message.get('moderated')).toBe('retracted');
            expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);
        }),
    );

    it(
        'is removed by a moderation of its original version which arrives before it but after its correction',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const view = _converse.chatboxviews.get(muc_jid);
            const msgid = u.getUniqueId();

            // E.g. when paging back through the archive
            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                        from="${muc_jid}/mallory"
                        to="${_converse.jid}"
                        type="groupchat"
                        id="${u.getUniqueId()}">
                    <body>Visit this site to get free Ethereum!</body>
                    <delay xmlns="urn:xmpp:delay" stamp="${new Date(Date.now() - 60000).toISOString()}"/>
                    <replace id="${msgid}" xmlns="${Strophe.NS.MESSAGE_CORRECT}"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="correction-id-1" by="${muc_jid}"/>
                </message>`);

            receiveModeration(_converse, 'original-id');
            await u.waitUntil(() => model.messages.length === 2);
            expect(model.messages.at(1).get('dangling_moderation')).toBe(true);

            await model.handleMessageStanza(stx`
                <message xmlns="jabber:client"
                        from="${muc_jid}/mallory"
                        to="${_converse.jid}"
                        type="groupchat"
                        id="${msgid}">
                    <body>Visit this site to get free Bitcoin!</body>
                    <delay xmlns="urn:xmpp:delay" stamp="${new Date(Date.now() - 120000).toISOString()}"/>
                    <stanza-id xmlns="urn:xmpp:sid:0" id="original-id" by="${muc_jid}"/>
                </message>`);

            expect(model.messages.length).toBe(1);
            const message = model.messages.at(0);
            expect(message.get('msgid')).toBe(msgid);
            expect(message.get('moderated')).toBe('retracted');
            expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
            expect(view.querySelectorAll('.chat-msg').length).toBe(1);
        }),
    );

    it(
        'is moderated with a single request if it was never corrected',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            await receiveCorrectedMessage(_converse, model, []);
            const view = _converse.chatboxviews.get(muc_jid);

            const iqs = (await moderateThroughUI(_converse, view))();
            expect(iqs.length).toBe(1);
            expect(iqs[0]).toEqualStanza(stx`
                <iq id="${iqs[0].getAttribute('id')}" to="${muc_jid}" type="set" xmlns="jabber:client">
                    <moderate id="original-id" xmlns="${Strophe.NS.MODERATE}">
                        <retract xmlns="${Strophe.NS.RETRACT}"/>
                        <reason>Spam</reason>
                    </moderate>
                </iq>`);
            respondToIQ(_converse, iqs[0]);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
        }),
    );

    it(
        'is moderated with one request per version',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model, ['correction-id-1', 'correction-id-2']);
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(model, 'retractOtherMessage').and.callThrough();

            const moderation_iqs = await moderateThroughUI(_converse, view);
            // The corrections are only moderated once the original has been
            expect(moderation_iqs().length).toBe(1);
            expect(moderation_iqs()[0].querySelector('moderate').getAttribute('id')).toBe('original-id');
            // Shown as removed while the requests are in flight
            expect(message.get('moderated')).toBe('retracted');
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);

            respondToIQ(_converse, moderation_iqs()[0]);
            await u.waitUntil(() => moderation_iqs().length === 3);
            expect(moderation_iqs().map((iq) => iq.querySelector('moderate').getAttribute('id'))).toEqual([
                'original-id',
                'correction-id-1',
                'correction-id-2',
            ]);
            expect(message.get('moderated')).toBe('retracted');

            moderation_iqs()
                .slice(1)
                .forEach((iq) => respondToIQ(_converse, iq));
            await model.retractOtherMessage.calls.first().returnValue;
            expect(message.get('moderated')).toBe('retracted');
            expect(view.querySelector('.chat-msg--retracted .chat-msg__error')).toBe(null);
        }),
    );

    it(
        'is restored, without moderating its corrections, if the room refuses to moderate its original version',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model);
            const view = _converse.chatboxviews.get(muc_jid);
            spyOn(model, 'retractOtherMessage').and.callThrough();

            const moderation_iqs = await moderateThroughUI(_converse, view);
            expect(moderation_iqs().length).toBe(1);
            respondToIQ(_converse, moderation_iqs()[0], 'error');
            await model.retractOtherMessage.calls.first().returnValue;

            expect(moderation_iqs().length).toBe(1);
            expect(message.get('moderated')).toBe(undefined);
            await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 0);
            expect(view.querySelector('.chat-msg__text').textContent).toBe(
                'Visit this site to get free Bitcoin! (edit 1)',
            );
        }),
    );

    it(
        'stays removed, with an error, if the room refuses to moderate one of its corrections',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
            const message = await receiveCorrectedMessage(_converse, model, ['correction-id-1', 'correction-id-2']);
            const view = _converse.chatboxviews.get(muc_jid);

            const moderation_iqs = await moderateThroughUI(_converse, view);
            respondToIQ(_converse, moderation_iqs()[0]);
            await u.waitUntil(() => moderation_iqs().length === 3);
            respondToIQ(_converse, moderation_iqs()[1], 'error');
            respondToIQ(_converse, moderation_iqs()[2]);

            const error = await u.waitUntil(() => view.querySelector('.chat-msg--retracted .chat-msg__error'));
            expect(error.textContent).toBe('Some versions of this message could not be removed.');
            expect(message.get('moderated')).toBe('retracted');
            // Stored as a flag, so that the error is shown in the current language
            expect(message.get('moderation_incomplete')).toBe(true);
            expect(Object.values(message.attributes)).not.toContain(error.textContent);
        }),
    );

    it(
        'keeps the stanza-id of its original version when it is our own and reflected by the room',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');

            const message = await model.sendMessage({ body: 'Hello world' });
            await reflectSentMessage(_converse, model, 'original-id');
            message.save({ correcting: true });
            await model.sendMessage({ body: 'Hello, world!' });
            await reflectSentMessage(_converse, model, 'correction-id-1');

            expect(model.messages.length).toBe(1);
            expect(message.get('body')).toBe('Hello, world!');
            expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);
        }),
    );

    describe('when archived', function () {
        const original = {
            stanza_id: 'original-id',
            msgid: 'msgid-1',
            stamp: '2026-10-20T10:00:00.000Z',
            body: 'Visit this site to get free Bitcoin!',
        };
        const correction = {
            stanza_id: 'correction-id-1',
            msgid: 'msgid-2',
            stamp: '2026-10-20T10:01:00.000Z',
            body: 'Visit this site to get free Ethereum!',
            replace_id: 'msgid-1',
        };

        it(
            'is not duplicated when fetched again',
            mock.initConverse(converse, ['discoInitialized', 'chatBoxesFetched'], {}, async function (_converse) {
                const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
                const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
                spyOn(model, 'handleUnreadMessage').and.callThrough();

                // Received live first
                for (const { stanza_id, msgid, stamp, body, replace_id } of [original, correction]) {
                    await model.handleMessageStanza(stx`
                        <message xmlns="jabber:client" from="${muc_jid}/mallory" to="${_converse.jid}"
                                type="groupchat" id="${msgid}">
                            <body>${body}</body>
                            <delay xmlns="urn:xmpp:delay" stamp="${stamp}"/>
                            ${replace_id ? stx`<replace id="${replace_id}" xmlns="${Strophe.NS.MESSAGE_CORRECT}"/>` : ''}
                            <stanza-id xmlns="urn:xmpp:sid:0" id="${stanza_id}" by="${muc_jid}"/>
                        </message>`);
                }
                const message = model.messages.at(0);
                const older_versions = { ...message.get('older_versions') };
                expect(Object.keys(older_versions).length).toBe(1);
                const unread_calls = model.handleUnreadMessage.calls.count();

                const queued = spyOn(model, 'onMessage').and.callThrough();
                await receiveArchivedMessages(_converse, [original, correction]);
                await u.waitUntil(() => queued.calls.count() === 2);
                await model.msg_chain;

                expect(model.messages.length).toBe(1);
                expect(message.get('body')).toBe(correction.body);
                expect(message.get('time')).toBe(original.stamp);
                expect(message.get('older_versions')).toEqual(older_versions);
                expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);
                expect(model.handleUnreadMessage).toHaveBeenCalledTimes(unread_calls);
            }),
        );

        it(
            'keeps the text of its correction when it is our own and its original is fetched again',
            mock.initConverse(converse, ['discoInitialized', 'chatBoxesFetched'], {}, async function (_converse) {
                const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');

                const message = await model.sendMessage({ body: 'Hello world' });
                await reflectSentMessage(_converse, model, 'original-id');
                message.save({ correcting: true });
                await model.sendMessage({ body: 'Hello, world!' });
                await reflectSentMessage(_converse, model, 'correction-id-1');
                expect(message.get('body')).toBe('Hello, world!');

                const queued = spyOn(model, 'onMessage').and.callThrough();
                await receiveArchivedMessages(_converse, [
                    {
                        stanza_id: 'original-id',
                        msgid: message.get('msgid'),
                        stamp: message.get('time'),
                        body: 'Hello world',
                        nick: 'romeo',
                    },
                ]);
                await u.waitUntil(() => queued.calls.count() === 1);
                await model.msg_chain;

                expect(model.messages.length).toBe(1);
                expect(message.get('body')).toBe('Hello, world!');
                expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);
            }),
        );

        it(
            'keeps the stanza-id of its original version when its correction is received first',
            mock.initConverse(converse, ['discoInitialized', 'chatBoxesFetched'], {}, async function (_converse) {
                const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
                const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
                const view = _converse.chatboxviews.get(muc_jid);

                await receiveArchivedMessages(_converse, [correction, original]);
                await u.waitUntil(() => model.messages.filter((m) => m.get('body')).length);
                await u.waitUntil(
                    () =>
                        model.messages.findWhere({ body: correction.body })?.get('older_versions') &&
                        Object.keys(model.messages.findWhere({ body: correction.body }).get('older_versions')).length,
                );
                await model.msg_chain;

                const messages = model.messages.filter((m) => m.get('body'));
                expect(messages.length).toBe(1);
                const message = messages[0];
                expect(message.get('body')).toBe(correction.body);
                expect(Object.values(message.get('older_versions'))).toEqual([original.body]);
                expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);

                receiveModeration(_converse, 'original-id');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
                expect(message.get('moderated')).toBe('retracted');
            }),
        );

        it(
            'is the first message of a page of the archive which leaves a gap',
            mock.initConverse(converse, ['discoInitialized', 'chatBoxesFetched'], {}, async function (_converse) {
                const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
                await model.handleMessageStanza(stx`
                    <message xmlns="jabber:client" from="${muc_jid}/mallory" to="${_converse.jid}"
                            type="groupchat" id="${original.msgid}">
                        <body>${original.body}</body>
                        <delay xmlns="urn:xmpp:delay" stamp="${original.stamp}"/>
                        <stanza-id xmlns="urn:xmpp:sid:0" id="${original.stanza_id}" by="${muc_jid}"/>
                    </message>`);

                await receiveArchivedMessages(_converse, [correction], false, false);
                const placeholder = await u.waitUntil(() =>
                    model.messages.find((m) => m instanceof _converse.MAMPlaceholderMessage),
                );
                expect(placeholder.get('before')).toBe(correction.stanza_id);
                expect(model.messages.filter((m) => m.get('body')).length).toBe(1);
                expect(model.messages.findWhere({ msgid: original.msgid }).get('body')).toBe(correction.body);
            }),
        );

        it(
            'is not duplicated when two of its corrections are received before it',
            mock.initConverse(converse, ['discoInitialized', 'chatBoxesFetched'], {}, async function (_converse) {
                const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
                const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
                const view = _converse.chatboxviews.get(muc_jid);
                const correction_2 = {
                    stanza_id: 'correction-id-2',
                    msgid: 'msgid-3',
                    stamp: '2026-10-20T10:02:00.000Z',
                    body: 'Visit this site to get free Dogecoin!',
                    replace_id: 'msgid-1',
                };

                const queued = spyOn(model, 'onMessage').and.callThrough();
                await receiveArchivedMessages(_converse, [correction, correction_2, original]);
                await u.waitUntil(() => queued.calls.count() === 3);
                await model.msg_chain;

                const messages = model.messages.filter((m) => m.get('body'));
                expect(messages.length).toBe(1);
                const message = messages[0];
                expect(message.get('msgid')).toBe(original.msgid);
                expect(message.get('time')).toBe(original.stamp);
                expect(message.get('body')).toBe(correction_2.body);
                expect(Object.values(message.get('older_versions')).sort()).toEqual(
                    [original.body, correction.body].sort(),
                );
                expect(message.getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1', 'correction-id-2']);

                receiveModeration(_converse, 'original-id');
                await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length === 1);
                expect(view.querySelectorAll('.chat-msg').length).toBe(1);
            }),
        );

        for (const [order, messages] of [
            ['original', [original, correction]],
            ['correction', [correction, original]],
        ]) {
            it(
                `is shown as removed once when its tombstones keep <replace/> and the ${order} is received first`,
                mock.initConverse(converse, ['discoInitialized', 'chatBoxesFetched'], {}, async function (_converse) {
                    const features = [...mock.default_muc_features, Strophe.NS.MODERATE];
                    const model = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', features);
                    const view = _converse.chatboxviews.get(muc_jid);

                    const queued = spyOn(model, 'onMessage').and.callThrough();
                    await receiveArchivedMessages(_converse, messages, true);
                    await u.waitUntil(() => queued.calls.count() === 2);
                    await model.msg_chain;
                    await u.waitUntil(() => view.querySelectorAll('.chat-msg--retracted').length);

                    const removed = model.messages.filter((m) => m.get('retracted'));
                    expect(removed.length).toBe(1);
                    expect(removed[0].get('msgid')).toBe(original.msgid);
                    expect(removed[0].get('time')).toBe(original.stamp);
                    expect(removed[0].getStanzaIDs(muc_jid)).toEqual(['original-id', 'correction-id-1']);
                    expect(view.querySelectorAll('.chat-msg--retracted').length).toBe(1);
                    expect(view.querySelector('.chat-msg__edit-modal')).toBe(null);
                }),
            );
        }
    });
});
