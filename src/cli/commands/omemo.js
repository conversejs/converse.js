/**
 * OMEMO devices and their trust.
 * @module @converse/cli/commands/omemo
 */
import { request, takeOne, UsageError } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatDevice, formatDeviceList, formatJSON } from '../format.js';
import { CONTACT, LOOKUP_EXITS } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const OMEMO_COMMANDS = {
    'omemo devices': {
        summary: "List a contact's OMEMO devices and their trust",
        description:
            "List the OMEMO devices of a contact, or yours with your own JID: each one's trust, " +
            'whether it is active, its fingerprint, and which one is this daemon. The first line ' +
            'says whether encryption is on for the conversation. Use it to explain why a send to ' +
            'an encrypted conversation failed.',
        args: [CONTACT],
        exits: LOOKUP_EXITS,
        examples: ['converse-cli omemo devices juliet@capulet.lit'],
        async run(ctx) {
            const { options, out } = ctx;
            const conversation = takeOne(ctx, 'contact');
            /** @type {import('@converse/daemon/types').DeviceList} */
            const list = await request(ctx, 'omemo.devices.list', { conversation });
            if (options.json) {
                out(formatJSON(list));
            } else {
                out(formatDeviceList(list));
            }
            return EXIT.OK;
        },
    },
    'omemo trust': {
        summary: 'Set how far a device is trusted (full access)',
        description:
            'Set how far an OMEMO device is trusted. Full access only: a restricted client can read ' +
            'trust but never change it.',
        args: [
            CONTACT,
            ['<device>', 'The device id, as omemo devices printed it'],
            ['<trust>', 'trusted, untrusted or undecided'],
        ],
        exits: LOOKUP_EXITS,
        examples: ['converse-cli omemo trust juliet@capulet.lit 1234567 trusted'],
        async run(ctx) {
            const { args, options, out } = ctx;
            if (args.length !== 3) throw new UsageError('Expected a contact, a device id and a trust state.');
            const [conversation, device, trust] = args;
            /** @type {import('@converse/daemon/types').DeviceDTO} */
            const dto = await request(ctx, 'omemo.devices.trust', { conversation, device, trust });
            out(options.json ? formatJSON(dto) : formatDevice(dto));
            return EXIT.OK;
        },
    },
};
