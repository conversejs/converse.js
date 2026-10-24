import { afterEach, describe, expect, it } from 'vitest';
import { startDaemon } from './harness.js';

describe('The daemon identity', () => {
    let daemon;

    afterEach(async () => {
        await daemon?.stop();
        daemon = undefined;
    });

    it('identifies itself as a bot, and not as a web client', async () => {
        daemon = await startDaemon();
        expect(daemon.api.disco.own.identities.get()).toEqual([
            { category: 'client', type: 'bot', name: 'Converse daemon' },
        ]);
    });
});
