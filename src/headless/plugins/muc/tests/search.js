import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Stanza, sizzle, stx, u } = converse.env;

const SERVICE = 'api@search.jabber.network';
const ECS = 'urn:xmpp:channel-search:0:search';
const ECS_ERROR = 'urn:xmpp:channel-search:0:error';
const MUCLUMBUS = 'https://xmlns.zombofant.net/muclumbus/search/1.0';

/**
 * Waits for the next search IQ in the given namespace that hasn't been seen yet.
 * @param {any} _converse
 * @param {string} xmlns
 * @param {Set<Element>} seen
 * @returns {Promise<Element>}
 */
function waitForSearchIQ(_converse, xmlns, seen) {
    const { IQ_stanzas } = _converse.api.connection.get();
    return u.waitUntil(() => {
        const iq = IQ_stanzas.find((iq) => !seen.has(iq) && sizzle(`search[xmlns="${xmlns}"]`, iq).length);
        if (iq) seen.add(iq);
        return iq;
    });
}

/**
 * @param {any} _converse
 * @param {Element} stanza
 */
function receive(_converse, stanza) {
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
}

/**
 * Makes the search IQs that match the selector time out straight away,
 * instead of waiting for the `stanza_timeout`.
 * @param {any} api
 * @param {string} selector
 */
function timeOutSearches(api, selector) {
    const sendIQ = api.sendIQ.bind(api);
    vi.spyOn(api, 'sendIQ').mockImplementation((stanza, timeout, reject) => {
        const promise = sendIQ(stanza, timeout, reject);
        const el = stanza instanceof Element ? stanza : stanza.tree();
        return sizzle(selector, el).length ? Promise.resolve(null) : promise;
    });
}

/**
 * @param {Element} iq
 * @param {string} condition
 * @param {string} [app_condition]
 */
function errorFor(iq, condition, app_condition = '') {
    return stx`
        <iq type="error" from="${SERVICE}" id="${iq.getAttribute('id')}" xmlns="jabber:client">
            <error type="cancel">
                ${Stanza.unsafeXML(`<${condition} xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>`)}
                ${Stanza.unsafeXML(app_condition)}
            </error>
        </iq>`;
}

describe('XEP-0433 Extended Channel Search', function () {
    it(
        'searches with XEP-0433 and parses the results',
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            const promise = api.rooms.search('xmpp');

            const iq = await waitForSearchIQ(_converse, ECS, seen);
            expect(iq).toEqualStanza(stx`
                <iq type="get" to="${SERVICE}" id="${iq.getAttribute('id')}" xmlns="jabber:client">
                    <search xmlns="${ECS}">
                        <set xmlns="http://jabber.org/protocol/rsm"><max>10</max></set>
                        <x xmlns="jabber:x:data" type="submit">
                            <field var="FORM_TYPE" type="hidden">
                                <value>urn:xmpp:channel-search:0:search-params</value>
                            </field>
                            <field var="q" type="text-single"><value>xmpp</value></field>
                            <field var="sinname" type="boolean"><value>true</value></field>
                            <field var="sindescription" type="boolean"><value>true</value></field>
                            <field var="sinaddr" type="boolean"><value>true</value></field>
                            <field var="types" type="list-multi"><value>xep-0045</value></field>
                            <field var="key" type="list-single">
                                <value>{urn:xmpp:channel-search:0:order}nusers</value>
                            </field>
                        </x>
                    </search>
                </iq>`);

            receive(
                _converse,
                stx`
                <iq type="result" from="${SERVICE}" id="${iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${ECS}">
                        <item address="operators@muc.xmpp.org">
                            <name>XMPP Service Operators</name>
                            <description>Discussion venue for operators of federated XMPP services</description>
                            <language>en</language>
                            <nusers>43</nusers>
                            <service-type>xep-0045</service-type>
                            <is-open/>
                            <anonymity-mode>semi</anonymity-mode>
                        </item>
                        <item address="commteam@muc.xmpp.org"/>
                        <set xmlns="http://jabber.org/protocol/rsm"><last>operators@muc.xmpp.org</last></set>
                    </result>
                </iq>`,
            );

            const { items, last } = await promise;
            expect(last).toBe('operators@muc.xmpp.org');
            expect(items).toEqual([
                {
                    jid: 'operators@muc.xmpp.org',
                    name: 'XMPP Service Operators',
                    description: 'Discussion venue for operators of federated XMPP services',
                    language: 'en',
                    nusers: 43,
                    is_open: true,
                    anonymity_mode: 'semi',
                    service_type: 'xep-0045',
                },
                {
                    jid: 'commteam@muc.xmpp.org',
                    name: undefined,
                    description: undefined,
                    language: undefined,
                    nusers: undefined,
                    is_open: undefined,
                    anonymity_mode: undefined,
                    service_type: undefined,
                },
            ]);

            // The next page
            const next = api.rooms.search('xmpp', { after: last, max: 5, sort: 'address' });
            const next_iq = await waitForSearchIQ(_converse, ECS, seen);
            expect(sizzle('set max', next_iq).pop().textContent).toBe('5');
            expect(sizzle('set after', next_iq).pop().textContent).toBe('operators@muc.xmpp.org');
            expect(sizzle('field[var="key"] value', next_iq).pop().textContent).toBe(
                '{urn:xmpp:channel-search:0:order}address',
            );
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${next_iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${ECS}"/>
                </iq>`,
            );
            expect(await next).toEqual({ items: [], last: undefined });
        }),
    );

    it(
        'uses the defaults for options that are passed as undefined',
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const promise = api.rooms.search('xmpp', { max: undefined, sort: undefined });

            const iq = await waitForSearchIQ(_converse, ECS, new Set());
            expect(sizzle('set max', iq).pop().textContent).toBe('10');
            expect(sizzle('field[var="key"] value', iq).pop().textContent).toBe(
                '{urn:xmpp:channel-search:0:order}nusers',
            );
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${ECS}"/>
                </iq>`,
            );
            await promise;
        }),
    );

    it(
        "doesn't return an empty <last/> as a paging cursor",
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const promise = api.rooms.search('xmpp');

            const iq = await waitForSearchIQ(_converse, ECS, new Set());
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${ECS}">
                        <item address="jdev@muc.xmpp.org"/>
                        <set xmlns="http://jabber.org/protocol/rsm"><last/></set>
                    </result>
                </iq>`,
            );
            const { items, last } = await promise;
            expect(items.length).toBe(1);
            expect(last).toBeUndefined();
        }),
    );

    it(
        'falls back to the muclumbus protocol and remembers doing so',
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            const promise = api.rooms.search('xmpp');

            const iq = await waitForSearchIQ(_converse, ECS, seen);
            receive(_converse, errorFor(iq, 'service-unavailable'));

            const legacy_iq = await waitForSearchIQ(_converse, MUCLUMBUS, seen);
            const fields = sizzle('field', legacy_iq).map((f) => [f.getAttribute('var'), f.textContent.trim()]);
            expect(fields).toEqual([
                ['FORM_TYPE', `${MUCLUMBUS}#params`],
                ['q', 'xmpp'],
                ['sinname', 'true'],
                ['sindescription', 'true'],
                ['sinaddress', 'true'],
                ['min_users', '1'],
                ['key', 'nusers'],
            ]);
            receive(
                _converse,
                stx`
                <iq type="result" from="${SERVICE}" id="${legacy_iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${MUCLUMBUS}">
                        <item address="jdev@muc.xmpp.org"><name>jdev</name><nusers>12</nusers></item>
                        <set xmlns="http://jabber.org/protocol/rsm"><last>jdev@muc.xmpp.org</last></set>
                    </result>
                </iq>`,
            );
            const { items } = await promise;
            expect(items.map((i) => [i.jid, i.nusers])).toEqual([['jdev@muc.xmpp.org', 12]]);

            // The second search goes straight to the protocol that worked
            const second = api.rooms.search('jabber');
            const second_iq = await waitForSearchIQ(_converse, MUCLUMBUS, seen);
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${second_iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${MUCLUMBUS}"/>
                </iq>`,
            );
            await second;
            const { IQ_stanzas } = api.connection.get();
            expect(IQ_stanzas.filter((iq) => sizzle(`search[xmlns="${ECS}"]`, iq).length).length).toBe(1);
        }),
    );

    it(
        'stops querying a service that supports neither protocol',
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            const promise = api.rooms.search('xmpp');

            const iq = await waitForSearchIQ(_converse, ECS, seen);
            receive(_converse, errorFor(iq, 'service-unavailable'));
            const legacy_iq = await waitForSearchIQ(_converse, MUCLUMBUS, seen);
            receive(_converse, errorFor(legacy_iq, 'service-unavailable'));
            const err = await promise.catch((e) => e);
            expect(err.name).toBe('service-unavailable');

            const { IQ_stanzas } = api.connection.get();
            const countSearches = () => IQ_stanzas.filter((iq) => sizzle('search', iq).length).length;
            const count = countSearches();
            const second_err = await api.rooms.search('jabber').catch((e) => e);
            expect(second_err).toBeInstanceOf(_converse.exports.ChannelSearchRefusedError);
            expect(second_err.code).toBe('unsupported');
            expect(second_err.retry_after).toBeUndefined();
            expect(countSearches()).toBe(count);
        }),
    );

    it(
        "falls back to the muclumbus protocol when XEP-0433 isn't answered",
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            timeOutSearches(api, `search[xmlns="${ECS}"]`);
            const promise = api.rooms.search('xmpp');

            await waitForSearchIQ(_converse, ECS, seen);
            const legacy_iq = await waitForSearchIQ(_converse, MUCLUMBUS, seen);
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${legacy_iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${MUCLUMBUS}"><item address="jdev@muc.xmpp.org"/></result>
                </iq>`,
            );
            const { items } = await promise;
            expect(items.map((i) => i.jid)).toEqual(['jdev@muc.xmpp.org']);

            // The second search goes straight to the protocol that worked
            const second = api.rooms.search('jabber');
            const second_iq = await waitForSearchIQ(_converse, MUCLUMBUS, seen);
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${second_iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${MUCLUMBUS}"/>
                </iq>`,
            );
            await second;
            const { IQ_stanzas } = api.connection.get();
            expect(IQ_stanzas.filter((iq) => sizzle(`search[xmlns="${ECS}"]`, iq).length).length).toBe(1);
        }),
    );

    it(
        "backs off from a service that doesn't respond",
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            timeOutSearches(api, 'search');
            // Unanswered searches fail right away, so catch before anything else is awaited
            const promise = api.rooms.search('xmpp').catch((e) => e);

            await waitForSearchIQ(_converse, ECS, seen);
            await waitForSearchIQ(_converse, MUCLUMBUS, seen);
            const err = await promise;
            expect(err.message).toContain('Timeout while searching');

            const { IQ_stanzas } = api.connection.get();
            const countSearches = () => IQ_stanzas.filter((iq) => sizzle('search', iq).length).length;
            const count = countSearches();
            const second_err = await api.rooms.search('jabber').catch((e) => e);
            expect(second_err).toBeInstanceOf(_converse.exports.ChannelSearchRefusedError);
            expect(second_err.code).toBe('unresponsive');
            expect(countSearches()).toBe(count);
        }),
    );

    it(
        "doesn't fall back when the service rejects the search terms",
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            const promise = api.rooms.search('x');

            const iq = await waitForSearchIQ(_converse, ECS, seen);
            receive(_converse, errorFor(iq, 'bad-request', `<invalid-search-terms xmlns="${ECS_ERROR}"/>`));

            const err = await promise.catch((e) => e);
            expect(err.name).toBe('bad-request');
            expect(err.extra[ECS_ERROR]).toBe('invalid-search-terms');

            const { IQ_stanzas } = api.connection.get();
            expect(IQ_stanzas.filter((iq) => sizzle(`search[xmlns="${MUCLUMBUS}"]`, iq).length).length).toBe(0);
        }),
    );

    it(
        "doesn't query a service again before its rate limit expires",
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            const now = Date.now();
            vi.spyOn(Date, 'now').mockReturnValue(now);
            const promise = api.rooms.search('xmpp');

            const iq = await waitForSearchIQ(_converse, ECS, seen);
            receive(
                _converse,
                errorFor(iq, 'resource-constraint', `<rate-limit xmlns="${ECS_ERROR}" retry-after="60"/>`),
            );
            const err = await promise.catch((e) => e);
            expect(err.extra[ECS_ERROR]).toBe('rate-limit');

            const { IQ_stanzas } = api.connection.get();
            const countSearches = () => IQ_stanzas.filter((iq) => sizzle('search', iq).length).length;
            const count = countSearches();
            const second_err = await api.rooms.search('xmpp').catch((e) => e);
            expect(second_err).toBeInstanceOf(_converse.exports.ChannelSearchRefusedError);
            expect(second_err.code).toBe('rate-limited');
            expect(second_err.retry_after.getTime()).toBe(now + 60 * 1000);
            expect(countSearches()).toBe(count);
        }),
    );

    it(
        'backs off for twice as long each time it is rate-limited without being told for how long',
        mock.initConverse(converse, ['statusInitialized'], {}, async function (_converse) {
            const { api } = _converse;
            const seen = new Set();
            let now = Date.now();
            vi.spyOn(Date, 'now').mockImplementation(() => now);

            /** Searches once, and returns when the service may be queried again */
            async function getRateLimited() {
                const promise = api.rooms.search('xmpp').catch((e) => e);
                const iq = await waitForSearchIQ(_converse, ECS, seen);
                receive(_converse, errorFor(iq, 'resource-constraint', `<rate-limit xmlns="${ECS_ERROR}"/>`));
                expect((await promise).extra[ECS_ERROR]).toBe('rate-limit');
                const refusal = await api.rooms.search('xmpp').catch((e) => e);
                expect(refusal.code).toBe('rate-limited');
                return refusal.retry_after.getTime();
            }

            let until = await getRateLimited();
            expect(until).toBe(now + 30 * 1000);

            now = until;
            until = await getRateLimited();
            expect(until).toBe(now + 60 * 1000);

            // A successful search starts the count again
            now = until;
            const promise = api.rooms.search('xmpp');
            const iq = await waitForSearchIQ(_converse, ECS, seen);
            receive(
                _converse,
                stx`<iq type="result" from="${SERVICE}" id="${iq.getAttribute('id')}" xmlns="jabber:client">
                    <result xmlns="${ECS}"/>
                </iq>`,
            );
            await promise;
            until = await getRateLimited();
            expect(until).toBe(now + 30 * 1000);
        }),
    );
});
