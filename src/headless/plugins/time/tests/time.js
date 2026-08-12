import mock, { pend_names } from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { Stanza, Strophe, sizzle, u, stx } = converse.env;

/**
 * Helper to find a time IQ stanza in the IQ_stanzas array.
 * @param {Element[]} stanzas - Array of IQ stanzas
 * @returns {Element|undefined} The time IQ stanza if found
 */
function findTimeIQ(stanzas) {
    return stanzas.find((iq) => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length);
}

/**
 * Answers the query we most recently sent with the given offset, verbatim.
 * @param {any} _converse
 * @param {string} jid - The JID we asked
 * @param {string} tzo
 */
async function answerTimeQuery(_converse, jid, tzo) {
    const { api } = _converse;
    const sent_iq = await u.waitUntil(() =>
        api.connection
            .get()
            .IQ_stanzas.filter((/** @type {Element} */ iq) => findTimeIQ([iq]))
            .pop(),
    );
    api.connection.get()._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq type="result" from="${jid}" to="${_converse.jid}"
                    id="${sent_iq.getAttribute('id')}" xmlns="jabber:client">
                    <time xmlns="urn:xmpp:time">
                        <tzo>${tzo}</tzo>
                        <utc>2026-03-16T12:00:00Z</utc>
                    </time>
                </iq>`,
        ),
    );
}

/**
 * The own disco features are a collection of models, so normalize to strings.
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 * @returns {Promise<string[]>}
 */
async function getOwnFeatures(_converse) {
    const features = await u.waitUntil(() => _converse.api.disco.own.features.get());
    return features.map((/** @type {any} */ f) => (typeof f === 'string' ? f : f.get('var')));
}

// Nobody we have any subscription relationship with.
const STRANGER = 'juliet@capulet.lit/balcony';

/**
 * The first mock roster contact, which is subscription="both" and so can see
 * our presence.
 * @returns {string}
 */
function subscribedContact() {
    return `${mock.cur_names[0].replace(/ /g, '.').toLowerCase()}@montague.lit/res`;
}

/**
 * Sends us a time query from `from` and returns the stanza we answered with.
 *
 * Answering is asynchronous (deciding whether we may can mean waiting for the
 * roster), so the answer is waited for rather than popped. An IQ reply carries
 * the id of the request it answers, which is what makes it findable.
 * @param {any} _converse
 * @param {string} from
 * @param {string} id
 * @returns {Promise<Element>}
 */
function queryTime(_converse, from, id) {
    sendTimeQuery(_converse, from, id);
    return findAnswer(_converse, id);
}

/**
 * Puts a time query on the wire without waiting for our answer.
 * @param {any} _converse
 * @param {string|null} from - Omitted entirely when null, as our own server would
 * @param {string} id
 */
function sendTimeQuery(_converse, from, id) {
    _converse.api.connection.get()._dataRecv(
        mock.createRequest(
            _converse,
            stx`<iq ${from ? Stanza.unsafeXML(`from="${from}"`) : ''}
                    to="${_converse.jid}" id="${id}" type="get" xmlns="jabber:client">
                    <time xmlns="urn:xmpp:time"/>
                </iq>`,
        ),
    );
}

/**
 * Our answer to the query with the given id.
 * @param {any} _converse
 * @param {string} id
 * @returns {Promise<Element>}
 */
function findAnswer(_converse, id) {
    return u.waitUntil(() =>
        _converse.api.connection.get().IQ_stanzas.find((/** @type {Element} */ iq) => iq.getAttribute('id') === id),
    );
}

describe('XEP-0202 Entity Time', function () {
    describe('Service discovery', function () {
        it(
            'reports the urn:xmpp:time feature in response to a disco#info request (XEP-0202 § 3)',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                expect((await getOwnFeatures(_converse)).includes(Strophe.NS.TIME)).toBe(true);

                // XEP-0202 § 3 phrases the requirement in terms of what we put
                // on the wire, so assert on the response itself.
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`
                            <iq from="juliet@capulet.lit/balcony"
                                to="${_converse.jid}" id="disco1" type="get" xmlns="jabber:client">
                                <query xmlns="http://jabber.org/protocol/disco#info"/>
                            </iq>`,
                    ),
                );
                const sent_stanza = await u.waitUntil(() =>
                    _converse.api.connection
                        .get()
                        .sent_stanzas.filter((s) => s.getAttribute('id') === 'disco1')
                        .pop(),
                );
                expect(sizzle(`feature[var="${Strophe.NS.TIME}"]`, sent_stanza).length).toBe(1);
            }),
        );

        it(
            'advertises the feature under "public" too',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'public' }, async (_converse) => {
                expect((await getOwnFeatures(_converse)).includes(Strophe.NS.TIME)).toBe(true);
            }),
        );

        it(
            "doesn't advertise the urn:xmpp:time feature when sharing is turned off",
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: false }, async (_converse) => {
                const features = await getOwnFeatures(_converse);
                expect(features.includes(Strophe.NS.TIME)).toBe(false);
            }),
        );
    });

    describe('Responding to time requests', function () {
        it(
            'responds with current time when queried',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'public' }, async (_converse) => {
                const sent_stanza = await queryTime(_converse, STRANGER, 'time-1');
                expect(sent_stanza.getAttribute('type')).toBe('result');
                expect(sent_stanza.getAttribute('to')).toBe(STRANGER);
                expect(sent_stanza.getAttribute('id')).toBe('time-1');

                const time_el = sent_stanza.querySelector('time');
                expect(time_el).not.toBeNull();
                expect(time_el.namespaceURI).toBe('urn:xmpp:time');

                const tzo = time_el.querySelector('tzo');
                const utc = time_el.querySelector('utc');
                expect(tzo).not.toBeNull();
                expect(utc).not.toBeNull();

                // Verify TZO format (±HH:MM)
                expect(tzo.textContent).toMatch(/^[+-]\d{2}:\d{2}$/);

                // Verify UTC format (ISO 8601 without milliseconds)
                expect(utc.textContent).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
            }),
        );

        it(
            'answers a stranger when send_entity_time is "public"',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'public' }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);
                expect((await queryTime(_converse, STRANGER, 'time-1')).getAttribute('type')).toBe('result');
            }),
        );

        it(
            'answers nobody when send_entity_time is falsy',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: false }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);

                for (const [i, from] of [STRANGER, subscribedContact(), `${_converse.bare_jid}/phone`].entries()) {
                    expect(await queryTime(_converse, from, `time-${i}`)).toEqualStanza(stx`
                        <iq id="time-${i}" to="${from}" type="error" xmlns="jabber:client">
                            <error type="cancel">
                                <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                            </error>
                        </iq>`);
                }
            }),
        );

        it(
            'answers only entities subscribed to our presence when send_entity_time is "presence"',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'presence' }, async (_converse) => {
                // 'current' contacts are subscription="both", 'pending' ones
                // are subscription="none": they can't see our presence.
                await mock.waitForRoster(_converse, 'all');

                expect((await queryTime(_converse, subscribedContact(), 'time-1')).getAttribute('type')).toBe('result');

                const pending = `${pend_names[0].replace(/ /g, '.').toLowerCase()}@montague.lit/res`;
                expect((await queryTime(_converse, pending, 'time-2')).getAttribute('type')).toBe('error');

                // Someone not in the roster at all.
                expect((await queryTime(_converse, STRANGER, 'time-3')).getAttribute('type')).toBe('error');
            }),
        );

        it(
            'answers our own other resources and our server when send_entity_time is "presence"',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'presence' }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);

                expect((await queryTime(_converse, `${_converse.bare_jid}/phone`, 'time-1')).getAttribute('type')).toBe(
                    'result',
                );

                // An IQ with no 'from' comes from our own server on our behalf,
                // and the answer goes back the same way. An empty 'to' is not a
                // valid JID (RFC 6120 § 8.1.1.1) and would be rejected or
                // dropped, so the attribute has to be absent altogether.
                sendTimeQuery(_converse, null, 'time-2');
                const answer = await findAnswer(_converse, 'time-2');
                expect(answer.getAttribute('type')).toBe('result');
                expect(answer.hasAttribute('to')).toBe(false);
            }),
        );

        it(
            'answers a subscribed contact whose JID reaches us unnormalised',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'presence' }, async (_converse) => {
                await mock.waitForRoster(_converse, 'current', 1);

                // Roster contacts are stored under a lowercased bare JID, but
                // not every server hands us one.
                const shouty = subscribedContact().toUpperCase();
                expect(shouty).not.toBe(subscribedContact());
                expect((await queryTime(_converse, shouty, 'time-1')).getAttribute('type')).toBe('result');
            }),
        );

        it(
            "waits for the roster rather than turning away a contact it hasn't read yet",
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'presence' }, async (_converse) => {
                // Their client can ask as soon as it sees our presence, which is
                // before the roster IQ has come back. Answering "no" then would
                // teach it that we don't support XEP-0202 at all.
                const contact = subscribedContact();
                sendTimeQuery(_converse, contact, 'time-1');

                await mock.waitForRoster(_converse, 'current', 1);
                expect((await findAnswer(_converse, 'time-1')).getAttribute('type')).toBe('result');
            }),
        );

        it(
            'treats an unrecognised truthy setting as "presence" rather than "public"',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: true }, async (_converse) => {
                await mock.waitForRoster(_converse, 'all');

                expect((await queryTime(_converse, subscribedContact(), 'time-1')).getAttribute('type')).toBe('result');
                expect((await queryTime(_converse, STRANGER, 'time-2')).getAttribute('type')).toBe('error');
            }),
        );

        it(
            'stops disclosing the time as soon as send_entity_time is turned off mid-session',
            mock.initConverse(converse, ['statusInitialized'], { send_entity_time: 'public' }, async (_converse) => {
                const { api } = _converse;
                await mock.waitForRoster(_converse, 'current', 1);

                expect((await queryTime(_converse, STRANGER, 'time-1')).getAttribute('type')).toBe('result');

                // No reconnection in between: the setting is read per request.
                api.settings.set('send_entity_time', 'presence');
                expect((await queryTime(_converse, STRANGER, 'time-2')).getAttribute('type')).toBe('error');
                expect((await queryTime(_converse, subscribedContact(), 'time-3')).getAttribute('type')).toBe('result');

                api.settings.set('send_entity_time', false);
                const denied = await queryTime(_converse, subscribedContact(), 'time-4');
                expect(denied.getAttribute('type')).toBe('error');
                expect(sizzle('service-unavailable', denied).length).toBe(1);

                api.settings.set('send_entity_time', 'public');
                expect((await queryTime(_converse, STRANGER, 'time-5')).getAttribute('type')).toBe('result');
            }),
        );
    });

    describe('Querying entity time', function () {
        it(
            'can query another entity for their time',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';

                // Start the query
                const promise = _converse.api.time.get(jid);

                // Get the sent IQ (filter for time query specifically)
                const sent_iq = await u.waitUntil(() => findTimeIQ(_converse.api.connection.get().IQ_stanzas));

                expect(sent_iq.getAttribute('type')).toBe('get');
                expect(sent_iq.getAttribute('to')).toBe(jid);

                const time_el = sent_iq.querySelector('time');
                expect(time_el).not.toBeNull();
                expect(time_el.namespaceURI).toBe('urn:xmpp:time');

                // Simulate response
                const id = sent_iq.getAttribute('id');
                const response = stx`
                    <iq type="result" from="${jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <time xmlns="urn:xmpp:time">
                            <tzo>-06:00</tzo>
                            <utc>2026-03-16T12:00:00Z</utc>
                        </time>
                    </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, response));

                const result = await promise;
                expect(result).not.toBeNull();
                expect(result.tzo).toBe('-06:00');
                expect(result.utc).toEqual(new Date('2026-03-16T12:00:00Z'));
            }),
        );

        it(
            'returns null when entity does not support XEP-0202',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';

                const promise = _converse.api.time.get(jid, 1000);

                // Get the sent IQ (filter for time query specifically)
                const sent_iq = await u.waitUntil(() => findTimeIQ(_converse.api.connection.get().IQ_stanzas));
                const id = sent_iq.getAttribute('id');

                // Simulate error response (feature not implemented)
                const response = stx`
                    <iq type="error" from="${jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <error type="cancel">
                            <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, response));

                const result = await promise;
                expect(result).toBeNull();
            }),
        );

        it(
            'returns null when the response carries an unparseable utc',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';
                const promise = _converse.api.time.get(jid, 1000);

                const sent_iq = await u.waitUntil(() => findTimeIQ(_converse.api.connection.get().IQ_stanzas));
                const id = sent_iq.getAttribute('id');

                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`
                            <iq type="result" from="${jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                                <time xmlns="urn:xmpp:time">
                                    <tzo>-06:00</tzo>
                                    <utc>not a timestamp</utc>
                                </time>
                            </iq>`,
                    ),
                );

                expect(await promise).toBeNull();
            }),
        );

        it(
            'reads "Z" as the UTC offset XEP-0082 says it is',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';
                const promise = _converse.api.time.get(jid, 1000);

                // XEP-0202 § 4 defers to XEP-0082, whose TZD is "Z" or ±HH:MM,
                // so a peer in UTC is entitled to answer this way.
                await answerTimeQuery(_converse, jid, 'Z');

                expect((await promise).tzo).toBe('+00:00');
            }),
        );

        it(
            'returns null when the response carries an unreadable tzo',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';

                // Taking this at face value would be worse than having no
                // offset: parseTZO reads what it can't parse as +00:00, which
                // would put them in our own timezone and warn on our hours.
                for (const tzo of ['+5:30', 'UTC+2', '+99:99', '']) {
                    const promise = _converse.api.time.get(jid, 1000);
                    await answerTimeQuery(_converse, jid, tzo);
                    expect(await promise).toBeNull();
                }
            }),
        );

        it(
            'returns null when the response is missing utc or tzo',
            mock.initConverse(converse, ['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';

                const promise = _converse.api.time.get(jid, 1000);

                const sent_iq = await u.waitUntil(() => findTimeIQ(_converse.api.connection.get().IQ_stanzas));
                const id = sent_iq.getAttribute('id');

                const response = stx`
                    <iq type="result" from="${jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <time xmlns="urn:xmpp:time">
                            <utc>2026-03-16T12:00:00Z</utc>
                        </time>
                    </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, response));

                expect(await promise).toBeNull();
            }),
        );

        it(
            'returns null when not authenticated',
            mock.initConverse(converse, [], { auto_login: false }, async (_converse) => {
                const result = await _converse.api.time.get('someone@example.com');
                expect(result).toBeNull();
            }),
        );
    });

    describe('Utility functions', function () {
        it(
            'parseTZO correctly parses timezone offsets',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { parseTZO } = converse.env.u.time;
                expect(parseTZO('+00:00')).toBe(0);
                expect(parseTZO('+05:30')).toBe(330);
                expect(parseTZO('-08:00')).toBe(-480);
                expect(parseTZO('-05:45')).toBe(-345);
                expect(parseTZO('invalid')).toBe(0);
            }),
        );

        it(
            'normalizeTZO accepts what XEP-0082 allows and nothing else',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { normalizeTZO } = converse.env.u.time;
                expect(normalizeTZO('+00:00')).toBe('+00:00');
                expect(normalizeTZO('-05:45')).toBe('-05:45');
                expect(normalizeTZO('+14:00')).toBe('+14:00'); // Kiritimati, the largest real offset
                expect(normalizeTZO('Z')).toBe('+00:00'); // how XEP-0082 writes UTC

                expect(normalizeTZO('+5:30')).toBeNull(); // unpadded
                expect(normalizeTZO('0530')).toBeNull(); // unsigned, unseparated
                expect(normalizeTZO('+05:60')).toBeNull(); // not a count of minutes
                expect(normalizeTZO('+15:00')).toBeNull(); // no such timezone
                expect(normalizeTZO('')).toBeNull();
                expect(normalizeTZO(undefined)).toBeNull();
            }),
        );

        it(
            'formatTZO is the inverse of parseTZO',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { formatTZO, parseTZO } = converse.env.u.time;
                expect(formatTZO(0)).toBe('+00:00');
                expect(formatTZO(330)).toBe('+05:30');
                expect(formatTZO(-480)).toBe('-08:00');
                expect(formatTZO(-345)).toBe('-05:45');
                expect(formatTZO(840)).toBe('+14:00'); // Kiritimati, the largest real offset

                for (const tzo of ['+00:00', '+05:30', '-08:00', '-05:45', '+14:00', '-12:00']) {
                    expect(formatTZO(parseTZO(tzo))).toBe(tzo);
                }
            }),
        );

        it(
            'getTimezoneDiffMinutes keeps sub-hour timezone differences',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { getTimezoneDiffMinutes } = converse.env.u.time;
                vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-300); // UTC+05:00

                expect(getTimezoneDiffMinutes('+05:00')).toBe(0);
                // Pakistan vs India, and India vs Nepal: real differences that
                // rounding to whole hours would have thrown away.
                expect(getTimezoneDiffMinutes('+05:30')).toBe(30);
                expect(getTimezoneDiffMinutes('+05:45')).toBe(45);
                expect(getTimezoneDiffMinutes('-08:00')).toBe(780);
            }),
        );

        it(
            'isOffHours correctly identifies nighttime hours',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { isOffHours } = converse.env.u.time;
                // Default range: 22:00 - 07:00
                expect(isOffHours(22)).toBe(true);
                expect(isOffHours(23)).toBe(true);
                expect(isOffHours(0)).toBe(true);
                expect(isOffHours(3)).toBe(true);
                expect(isOffHours(6)).toBe(true);
                expect(isOffHours(7)).toBe(false);
                expect(isOffHours(12)).toBe(false);
                expect(isOffHours(21)).toBe(false);
            }),
        );

        it(
            'getRemoteHour calculates correct remote hour',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { getRemoteHour } = converse.env.u.time;
                const utc = new Date('2026-03-16T12:00:00Z'); // Noon UTC

                expect(getRemoteHour(utc, '+00:00')).toBe(12); // UTC
                expect(getRemoteHour(utc, '+05:30')).toBe(17); // India (17:30)
                expect(getRemoteHour(utc, '-08:00')).toBe(4); // Pacific (04:00)
                expect(getRemoteHour(utc, '-05:00')).toBe(7); // Eastern (07:00)
            }),
        );

        it(
            'formatRemoteTime writes the time the way the locale does',
            mock.initConverse(converse, ['statusInitialized'], {}, () => {
                const { formatRemoteTime } = converse.env.u.time;
                const utc = new Date('2026-03-16T12:00:00Z');

                // The locale is passed explicitly here so that the assertions
                // don't depend on where the suite is run.
                expect(formatRemoteTime(utc, '+00:00', 'en-GB')).toBe('12:00');
                expect(formatRemoteTime(utc, '+05:30', 'en-GB')).toBe('17:30');
                expect(formatRemoteTime(utc, '-08:00', 'en-GB')).toBe('04:00');

                // A 12-hour locale gets a 12-hour clock. The separator before
                // the meridiem is a narrow no-break space in newer ICU builds.
                expect(formatRemoteTime(utc, '+05:30', 'en-US')).toMatch(/^5:30\s?PM$/);
                expect(formatRemoteTime(utc, '-08:00', 'en-US')).toMatch(/^4:00\s?AM$/);

                // An unusable tag falls back rather than throwing.
                expect(formatRemoteTime(utc, '+00:00', 'not a locale')).toBeTruthy();
            }),
        );
    });
});
