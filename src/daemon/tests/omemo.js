import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { _converse, api, constants, converse } from '@converse/headless';
import { ERRORS } from '../protocol.js';
import { JID, startDaemon } from './harness.js';
import { start } from '../daemon.js';

const { Strophe, stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const BENVOLIO = 'benvolio@montague.lit';
const ROSTER = [
    { jid: JULIET, name: 'Juliet Capulet' },
    { jid: BENVOLIO, name: 'Benvolio' },
];

/** A legacy identity key: a 0x05 type byte, then 32 bytes of key. Its fingerprint is the 32 bytes. */
const IDENTITY_KEY = Buffer.from([5, ...Array(32).fill(7)]).toString('base64');
const FINGERPRINT = '07'.repeat(32);

/**
 * Answers the PubSub requests the daemon sends on the connection it has now,
 * with empty results: a server holding no PEP data for anyone yet. Without
 * the answers OMEMO never finishes setting up. Returns a function that stops it.
 * @param {import('@converse/headless').ConversePrivateGlobal['api']} api
 */
function answerPubSub(api) {
    const connection = api.connection.get();
    const answered = new Set();
    const timer = setInterval(() => {
        for (const iq of connection.IQ_stanzas) {
            const id = iq.getAttribute('id');
            if (answered.has(id) || !iq.querySelector('pubsub')) continue;
            answered.add(id);
            const wrapper = new Strophe.Builder('wrapper').tree();
            wrapper.appendChild(stx`<iq xmlns="jabber:client" type="result" id="${id}"/>`.tree());
            connection._dataRecv(wrapper);
        }
    }, 10);
    return () => clearInterval(timer);
}

describe('OMEMO', () => {
    let daemon, stopAnswering, restricted, full;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: ROSTER, settings: { omemo_default: false } });
        stopAnswering = answerPubSub(daemon.api);
        await api.waitUntil('OMEMOInitialized');
        full = await daemon.connect();
        restricted = await daemon.connect({ access: 'restricted' });
    });

    afterAll(async () => {
        stopAnswering?.();
        restricted?.close();
        full?.close();
        await daemon?.daemon?.stop();
    });

    /**
     * Gives a contact a device with a bundle, as the server would have listed it.
     * @param {string} jid
     * @param {string} id
     */
    async function addDevice(jid, id) {
        const list = await api.omemo.devicelists.get(jid, true);
        const device = await list.devices.create({ id, jid }, { promise: true });
        device.save({
            bundle: {
                identity_key: IDENTITY_KEY,
                signed_prekey: { id: 1, public_key: '8888', signature: '7777' },
                prekeys: [{ id: 1, key: '6666' }],
            },
        });
        return device;
    }

    /**
     * Delivers an OMEMO message whose key is for some other device, so that this one can't read it.
     * @param {string} from
     */
    function receiveEncryptedForSomeoneElse(from) {
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${from}/balcony" to="${JID}" type="chat" id="${u.getUniqueId()}">
                <encrypted xmlns="${Strophe.NS.OMEMO}">
                    <header sid="555">
                        <key rid="999" prekey="false">AAAA</key>
                        <iv>AAAA</iv>
                    </header>
                    <payload>AAAA</payload>
                </encrypted>
                <body>I couldn't read this on my side</body>
                <encryption xmlns="${Strophe.NS.EME}" namespace="${Strophe.NS.OMEMO}"/>
            </message>`);
    }

    describe('devices', () => {
        it("lists the daemon's own device, and marks it as this one", async () => {
            const { devices, encrypted } = await full.request('omemo.devices.list', { conversation: JID });
            const device_id = String(_converse.state.omemo_store.get('device_id'));

            expect(encrypted).toBe(false);
            expect(devices).toContainEqual(
                expect.objectContaining({ id: device_id, this_device: true, active: true, trust: 'undecided' }),
            );
        });

        it("lists a contact's devices, with their trust and fingerprint", async () => {
            await addDevice(JULIET, '555');
            const { devices } = await full.request('omemo.devices.list', { conversation: JULIET });

            expect(devices).toEqual([
                {
                    id: '555',
                    this_device: false,
                    active: true,
                    trust: 'undecided',
                    fingerprint: FINGERPRINT,
                },
            ]);
        });

        it('resolves a contact by name', async () => {
            const { conversation } = await full.request('omemo.devices.list', { conversation: 'Juliet Capulet' });
            expect(conversation).toBe(JULIET);
        });

        it('says whether encryption is on for the conversation', async () => {
            const chat = await api.chats.get(JULIET, {}, true);
            await chat.initialized;
            chat.save('omemo_active', true);

            const { encrypted } = await full.request('omemo.devices.list', { conversation: JULIET });
            expect(encrypted).toBe(true);
            chat.save('omemo_active', false);
        });

        it('lets a restricted client read the devices, and not change their trust', async () => {
            const { devices } = await restricted.request('omemo.devices.list', { conversation: JULIET });
            expect(devices.map((d) => d.id)).toEqual(['555']);

            await expect(
                restricted.request('omemo.devices.trust', { conversation: JULIET, device: '555', trust: 'trusted' }),
            ).rejects.toMatchObject({ code: ERRORS.ACCESS_DENIED });
            expect(_converse.state.devicelists.get({ jid: JULIET }).devices.get('555').get('trusted')).toBe(
                constants.UNDECIDED,
            );
        });

        it('changes a device trust at full access, and reports it', async () => {
            const dto = await full.request('omemo.devices.trust', {
                conversation: JULIET,
                device: '555',
                trust: 'trusted',
            });
            expect(dto).toMatchObject({ id: '555', trust: 'trusted' });

            const { devices } = await full.request('omemo.devices.list', { conversation: JULIET });
            expect(devices[0].trust).toBe('trusted');
            await full.request('omemo.devices.trust', { conversation: JULIET, device: '555', trust: 'undecided' });
        });

        it('refuses a trust state it does not know, and a device the contact does not have', async () => {
            await expect(
                full.request('omemo.devices.trust', { conversation: JULIET, device: '555', trust: 'maybe' }),
            ).rejects.toMatchObject({ code: ERRORS.INVALID_PARAMS });
            await expect(
                full.request('omemo.devices.trust', { conversation: JULIET, device: '404', trust: 'trusted' }),
            ).rejects.toMatchObject({ code: ERRORS.NOT_FOUND });
        });
    });

    describe('messages', () => {
        it('keeps an encrypted message it cannot read, with the reason, rather than leaving a gap', async () => {
            receiveEncryptedForSomeoneElse(JULIET);
            const { messages } = await u.waitUntil(async () => {
                const result = await full.request('messages.list', { conversation: JULIET });
                return result.messages.some((m) => m.encryption) ? result : null;
            });
            const message = messages.find((m) => m.encryption);

            expect(message).toMatchObject({
                from: JULIET,
                direction: 'incoming',
                body: null,
                encryption: {
                    scheme: 'omemo',
                    status: 'undecryptable',
                    error: expect.stringContaining('not encrypted for this device'),
                },
            });
        });

        it('refuses to send in an encrypted conversation when there is nothing to encrypt for', async () => {
            const chat = await api.chats.get(BENVOLIO, {}, true);
            await chat.initialized;
            chat.save('omemo_active', true);

            const sent_before = api.connection.get().sent_stanzas.length;
            const error = await full
                .request('messages.send', { to: BENVOLIO, body: 'Not in the clear' })
                .catch((e) => e);
            expect(error).toMatchObject({
                code: ERRORS.INTERNAL_ERROR,
                message: 'Nothing was sent: there are no OMEMO devices to encrypt for.',
                data: { code: 'no-omemo-devices' },
            });

            const plaintext = api.connection
                .get()
                .sent_stanzas.slice(sent_before)
                .filter((s) => s.nodeName === 'message' && s.querySelector('body')?.textContent === 'Not in the clear');
            expect(plaintext).toEqual([]);
            chat.save('omemo_active', false);
        });
    });

    describe('after a restart', () => {
        it('is the same device, since its keys are kept', async () => {
            const device_id = String(_converse.state.omemo_store.get('device_id'));
            stopAnswering();
            await daemon.daemon.stop();

            daemon.daemon = await start(daemon.config);
            stopAnswering = answerPubSub(api);
            await api.waitUntil('OMEMOInitialized');

            expect(String(_converse.state.omemo_store.get('device_id'))).toBe(device_id);
        });
    });
});
