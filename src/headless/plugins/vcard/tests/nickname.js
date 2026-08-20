import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Strophe, stx, u, sizzle } = converse.env;
const NICK_NS = 'http://jabber.org/protocol/nick';

/**
 * Build an inbound XEP-0172 nickname PEP event message (see XEP-0172 examples).
 * A null `name` omits the `<nick/>` element; an empty string sends `<nick/>`.
 */
function pepNickEvent(_converse, from, name) {
    const nick = name === null ? '' : stx`<nick xmlns="${NICK_NS}">${name}</nick>`;
    return mock.createRequest(
        _converse,
        stx`<message xmlns="jabber:client" from="${from}" to="${_converse.session.get('jid')}">
                <event xmlns="http://jabber.org/protocol/pubsub#event">
                    <items node="http://jabber.org/protocol/nick">
                        <item id="current">${nick}</item>
                    </items>
                </event>
            </message>`
    );
}

// Dispatch a nick event and resolve with the (get-or-created) VCard once it reflects `name`.
async function applyNick(_converse, jid, name) {
    _converse.api.connection.get()._dataRecv(pepNickEvent(_converse, jid, name));
    const vcard = await u.waitUntil(() => _converse.state.vcards.get(jid));
    await u.waitUntil(() => (vcard.get('pep_nickname') ?? '') === (name ?? ''));
    return vcard;
}

describe('An XEP-0172 User Nickname received over PEP', function () {
    it(
        'creates a VCard and sets the nickname when none is cached yet, without a vcard-temp IQ',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid = 'npub1abc@renostr.chat';
            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            while (IQ_stanzas.length) IQ_stanzas.pop();

            expect(_converse.state.vcards.get(jid)).toBeUndefined();

            const vcard = await applyNick(_converse, jid, 'Alice Nostrova');
            expect(vcard.getDisplayName()).toBe('Alice Nostrova');

            // The name is carried by the event itself; no vcard-temp refetch is needed to render it.
            expect(IQ_stanzas.filter((s) => sizzle('vCard', s).length).length).toBe(0);
        })
    );

    it(
        'fires a change event on the VCard so bound views re-render',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid = 'npub1jkl@renostr.chat';
            const vcard = await applyNick(_converse, jid, 'Alice');

            // getVCardForModel re-emits this 'change' as 'vcard:change' on every bound model (existing plumbing).
            let changed = false;
            vcard.on('change:pep_nickname', () => (changed = true));

            _converse.api.connection.get()._dataRecv(pepNickEvent(_converse, jid, 'Alice Nostrova'));
            await u.waitUntil(() => changed);
            expect(vcard.get('pep_nickname')).toBe('Alice Nostrova');
        })
    );

    it(
        'takes precedence over the vCard fullname (FN)',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid = 'npub1def@renostr.chat';
            const vcard = await applyNick(_converse, jid, 'Alice Nostrova');

            // A later vcard-temp result arrives with a different FN; the nick must still win.
            vcard.save({ fullname: 'Alice FN' });
            expect(vcard.getDisplayName()).toBe('Alice Nostrova');
        })
    );

    it(
        'reverts to the fullname when an empty <nick/> clears it',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid = 'npub1ghi@renostr.chat';
            const vcard = await applyNick(_converse, jid, 'Alice Nostrova');
            vcard.save({ fullname: 'Alice FN' });
            expect(vcard.getDisplayName()).toBe('Alice Nostrova');

            _converse.api.connection.get()._dataRecv(pepNickEvent(_converse, jid, ''));
            await u.waitUntil(() => !vcard.get('pep_nickname'));
            expect(vcard.getDisplayName()).toBe('Alice FN');
        })
    );

    it(
        'only applies the nickname to the sender JID',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid_a = 'npub1aaa@renostr.chat';
            const jid_b = 'npub1bbb@renostr.chat';

            const vcard_b = await applyNick(_converse, jid_b, 'Bob');
            await applyNick(_converse, jid_a, 'Alice Nostrova');

            // jid_a's event must not touch jid_b's identity.
            expect(vcard_b.get('pep_nickname')).toBe('Bob');
        })
    );

    it(
        'is idempotent: re-sending the same nick fires no further change',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid = 'npub1mno@renostr.chat';
            const vcard = await applyNick(_converse, jid, 'Alice Nostrova');

            let changed = false;
            vcard.on('change:pep_nickname', () => (changed = true));
            _converse.api.connection.get()._dataRecv(pepNickEvent(_converse, jid, 'Alice Nostrova'));
            await new Promise((resolve) => setTimeout(resolve, 250));
            expect(changed).toBe(false);
        })
    );

    it(
        'advertises the nick+notify feature for XEP-0163 auto-subscription',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async function (_converse) {
            const features = await u.waitUntil(() => _converse.api.disco.own.features.get());
            const values = features.map((f) => (typeof f === 'string' ? f : f.get('var')));
            expect(values.includes(`${Strophe.NS.NICK}+notify`)).toBe(true);
        })
    );
});

describe('Our own XEP-0172 User Nickname', function () {
    it(
        'is published to our PEP node on login (XEP-0172 §3)',
        mock.initConverse(converse, ['statusInitialized'], { nickname: 'Romey' }, async function (_converse) {
            const bare_jid = _converse.session.get('bare_jid');
            // publishOwnNickname first confirms PEP support via disco.
            await mock.waitUntilDiscoConfirmed(_converse, bare_jid, [{ category: 'pubsub', type: 'pep' }], [
                'http://jabber.org/protocol/pubsub#publish-options',
            ]);
            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const publish = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq publish[node="${NICK_NS}"]`, s).length).pop()
            );
            expect(sizzle(`item nick[xmlns="${NICK_NS}"]`, publish).pop()?.textContent).toBe('Romey');
        })
    );

    it(
        'is attached to outgoing subscription requests, but not to available presence (XEP-0172 §4)',
        mock.initConverse(converse, ['statusInitialized'], { nickname: 'Romey' }, async function (_converse) {
            const { profile } = _converse.state;

            const subscribe = (await profile.constructPresence({ type: 'subscribe', to: 'x@example.org' })).tree();
            expect(sizzle(`nick[xmlns="${NICK_NS}"]`, subscribe).pop()?.textContent).toBe('Romey');

            const available = (await profile.constructPresence({})).tree();
            expect(sizzle(`nick[xmlns="${NICK_NS}"]`, available).length).toBe(0);
        })
    );

    it(
        'is reflected by Profile.getNickname (e.g. when set on another client)',
        mock.initConverse(converse, ['statusInitialized'], { no_vcard_mocks: true }, async function (_converse) {
            const { profile } = _converse.state;
            const vcard = await u.waitUntil(() => profile.vcard);
            vcard.save({ pep_nickname: 'Cross Device' });
            expect(profile.getNickname()).toBe('Cross Device');
        })
    );
});

describe('An XEP-0172 nickname carried in another way', function () {
    it(
        'is applied when it arrives directly in a presence (XEP-0172 §4)',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const jid = 'presencepat@example.org';
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence xmlns="jabber:client" from="${jid}/res" to="${_converse.session.get('jid')}">
                            <nick xmlns="${NICK_NS}">Presence Pat</nick>
                        </presence>`
                )
            );
            const vcard = await u.waitUntil(() => _converse.state.vcards.get(jid));
            await u.waitUntil(() => vcard.get('pep_nickname') === 'Presence Pat');
            expect(vcard.getDisplayName()).toBe('Presence Pat');
        })
    );

    it(
        'is ignored when it comes from MUC occupant presence',
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const room = 'lounge@muc.example.org';
            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<presence xmlns="jabber:client" from="${room}/thirdwitch" to="${_converse.session.get('jid')}">
                            <x xmlns="http://jabber.org/protocol/muc#user">
                                <item affiliation="member" role="participant"/>
                            </x>
                            <nick xmlns="${NICK_NS}">Should Be Ignored</nick>
                        </presence>`
                )
            );
            await new Promise((resolve) => setTimeout(resolve, 250));
            expect(_converse.state.vcards.get(room)?.get('pep_nickname')).toBeUndefined();
        })
    );

    it(
        "is actively retrieved from a roster contact's PEP node (XEP-0060 § 6.5)",
        mock.initConverse(converse, ['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current', 1);
            const contact_jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';

            // Fetching the contact's identity also retrieves their published nick.
            api.vcard.update(contact_jid, true);
            const IQ_stanzas = _converse.api.connection.get().IQ_stanzas;
            const nick_iq = await u.waitUntil(() =>
                IQ_stanzas.filter((s) => sizzle(`iq items[node="${NICK_NS}"]`, s).length).pop()
            );

            _converse.api.connection.get()._dataRecv(
                mock.createRequest(
                    _converse,
                    stx`<iq type="result" from="${contact_jid}" to="${_converse.session.get('jid')}"
                            id="${nick_iq.getAttribute('id')}" xmlns="jabber:client">
                        <pubsub xmlns="http://jabber.org/protocol/pubsub">
                            <items node="${NICK_NS}">
                                <item id="current"><nick xmlns="${NICK_NS}">Retrieved Rita</nick></item>
                            </items>
                        </pubsub>
                    </iq>`
                )
            );

            const vcard = await u.waitUntil(() => _converse.state.vcards.get(contact_jid));
            await u.waitUntil(() => vcard.get('pep_nickname') === 'Retrieved Rita');
        })
    );
});
