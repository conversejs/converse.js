/**
 * OMEMO from the command line: how devices and their trust are shown, and that
 * changing trust is refused at restricted access. What the daemon answers is
 * covered at the protocol seam, in daemon/tests/omemo.js.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { formatDevice, formatDeviceList, formatMessage } from '../format.js';
import { run } from './run.js';

const JULIET = 'juliet@capulet.lit';

describe('converse-cli omemo output', () => {
    it('shows a device on one line: its id, its trust, then its fingerprint', () => {
        expect(
            formatDevice({ id: '555', this_device: false, active: true, trust: 'undecided', fingerprint: 'ab12' }),
        ).toBe('555  undecided ab12\n');
    });

    it('brackets what is notable about a device', () => {
        expect(formatDevice({ id: '9', this_device: true, active: false, trust: 'trusted', fingerprint: null })).toBe(
            '9  trusted  (this daemon, inactive, no fingerprint yet)\n',
        );
    });

    it('says whether encryption is on for the conversation, above its devices', () => {
        expect(formatDeviceList({ conversation: JULIET, encrypted: true, devices: [] })).toBe(
            `${JULIET}  encryption on\n  no OMEMO devices\n`,
        );
    });

    it('says why a message could not be decrypted, rather than showing it as a gap', () => {
        const message = {
            id: 'm1',
            conversation: JULIET,
            from: JULIET,
            time: '2026-10-20T10:00:00.000Z',
            body: null,
            encryption: { scheme: 'omemo', status: 'undecryptable', error: 'not encrypted for this device' },
            reply_to: null,
            edited: null,
            retracted: null,
            reactions: {},
        };
        const line = formatMessage(message, { now: new Date('2026-10-20T10:01:00.000Z') });
        expect(line).toContain('[could not be decrypted: not encrypted for this device]');
    });
});

describe('converse-cli omemo commands', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({ roster: [{ jid: JULIET, name: 'Juliet Capulet' }] });
    });

    afterAll(() => daemon?.stop());

    it('refuses to change trust at restricted access, which is what the CLI uses by default', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'omemo', 'trust', JULIET, '555', 'trusted');
        expect(code).toBe(EXIT.ERROR);
        expect(stdout).toBe('');
        expect(stderr).toContain('only available at full access');
    });

    it('expects a contact, a device and a trust state', async () => {
        const { code, stderr } = await run(daemon.env, 'omemo', 'trust', JULIET, '555');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toContain('Expected a contact, a device id and a trust state.');
    });
});
