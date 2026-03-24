/*global converse */
import mock from "../../../tests/mock.js";

const { Strophe, sizzle, u, stx } = converse.env;

/**
 * Helper to find a time IQ stanza in the IQ_stanzas array.
 * @param {Element[]} stanzas - Array of IQ stanzas
 * @returns {Element|undefined} The time IQ stanza if found
 */
function findTimeIQ(stanzas) {
    return stanzas.find(iq => sizzle(`time[xmlns="${Strophe.NS.TIME}"]`, iq).length);
}

describe('XEP-0202 Entity Time', function () {

    describe('Responding to time requests', function () {

        it('responds with current time when queried',
            mock.initConverse(['statusInitialized'], {}, (_converse) => {
                const ping = u.toStanza(`
                    <iq from="romeo@montague.lit/orchard"
                        to="${_converse.jid}" id="time-1" type="get">
                        <time xmlns="urn:xmpp:time"/>
                    </iq>`);
                _converse.api.connection.get()._dataRecv(mock.createRequest(ping));

                const sent_stanza = _converse.api.connection.get().IQ_stanzas.pop();
                expect(sent_stanza.getAttribute('type')).toBe('result');
                expect(sent_stanza.getAttribute('to')).toBe('romeo@montague.lit/orchard');
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
            })
        );

        it('returns service-unavailable when send_entity_time is disabled',
            mock.initConverse(['statusInitialized'], {
                send_entity_time: false
            }, (_converse) => {
                const ping = u.toStanza(`
                    <iq from="romeo@montague.lit/orchard"
                        to="${_converse.jid}" id="time-1" type="get">
                        <time xmlns="urn:xmpp:time"/>
                    </iq>`);
                _converse.api.connection.get()._dataRecv(mock.createRequest(ping));

                const sent_stanza = _converse.api.connection.get().IQ_stanzas.pop();
                expect(sent_stanza.getAttribute('type')).toBe('error');
                expect(sent_stanza.getAttribute('to')).toBe('romeo@montague.lit/orchard');
                expect(sent_stanza.getAttribute('id')).toBe('time-1');

                const error_el = sent_stanza.querySelector('error');
                expect(error_el).not.toBeNull();
                expect(error_el.getAttribute('type')).toBe('cancel');

                const unavailable = error_el.querySelector('service-unavailable');
                expect(unavailable).not.toBeNull();
            })
        );
    });

    describe('Querying entity time', function () {

        it('can query another entity for their time',
            mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';

                // Start the query
                const promise = _converse.api.time.get(jid);

                // Get the sent IQ (filter for time query specifically)
                const sent_iq = await u.waitUntil(() =>
                    findTimeIQ(_converse.api.connection.get().IQ_stanzas)
                );

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
                _converse.api.connection.get()._dataRecv(mock.createRequest(response));

                const result = await promise;
                expect(result).not.toBeNull();
                expect(result.tzo).toBe('-06:00');
                expect(result.utc).toEqual(new Date('2026-03-16T12:00:00Z'));
            })
        );

        it('returns null when entity does not support XEP-0202',
            mock.initConverse(['statusInitialized'], {}, async (_converse) => {
                const jid = 'juliet@capulet.lit/balcony';

                const promise = _converse.api.time.get(jid, 1000);

                // Get the sent IQ (filter for time query specifically)
                const sent_iq = await u.waitUntil(() =>
                    findTimeIQ(_converse.api.connection.get().IQ_stanzas)
                );
                const id = sent_iq.getAttribute('id');

                // Simulate error response (feature not implemented)
                const response = stx`
                    <iq type="error" from="${jid}" to="${_converse.jid}" id="${id}" xmlns="jabber:client">
                        <error type="cancel">
                            <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                        </error>
                    </iq>`;
                _converse.api.connection.get()._dataRecv(mock.createRequest(response));

                const result = await promise;
                expect(result).toBeNull();
            })
        );

        it('returns null when not authenticated',
            mock.initConverse([], { auto_login: false }, async (_converse) => {
                const result = await _converse.api.time.get('someone@example.com');
                expect(result).toBeNull();
            })
        );
    });

    describe('Utility functions', function () {

        it('parseTZO correctly parses timezone offsets', mock.initConverse(['statusInitialized'], {}, () => {
            const { parseTZO } = converse.env.u.time;
            expect(parseTZO('+00:00')).toBe(0);
            expect(parseTZO('+05:30')).toBe(330);
            expect(parseTZO('-08:00')).toBe(-480);
            expect(parseTZO('-05:45')).toBe(-345);
            expect(parseTZO('invalid')).toBe(0);
        }));

        it('isOffHours correctly identifies nighttime hours', mock.initConverse(['statusInitialized'], {}, () => {
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
        }));

        it('getRemoteHour calculates correct remote hour', mock.initConverse(['statusInitialized'], {}, () => {
            const { getRemoteHour } = converse.env.u.time;
            const utc = new Date('2026-03-16T12:00:00Z'); // Noon UTC

            expect(getRemoteHour(utc, '+00:00')).toBe(12); // UTC
            expect(getRemoteHour(utc, '+05:30')).toBe(17); // India (17:30)
            expect(getRemoteHour(utc, '-08:00')).toBe(4);  // Pacific (04:00)
            expect(getRemoteHour(utc, '-05:00')).toBe(7);  // Eastern (07:00)
        }));

        it('formatRemoteTime formats time correctly', mock.initConverse(['statusInitialized'], {}, () => {
            const { formatRemoteTime } = converse.env.u.time;
            const utc = new Date('2026-03-16T12:00:00Z');

            // Note: exact format depends on locale, but should contain hour:minute
            const formatted = formatRemoteTime(utc, '+00:00');
            expect(formatted).toMatch(/12:00/);
        }));
    });
});
