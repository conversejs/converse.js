/**
 * Our own presence.
 * @module @converse/cli/commands/presence
 */
import { request, UsageError } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatJSON, quote } from '../format.js';

/** @type {Record<string, import('../types').Command>} */
export const PRESENCE_COMMANDS = {
    'presence set': {
        summary: 'Set your availability and status message',
        description:
            'Set your availability, with an optional status message. Restricted access needs ' +
            '"policy.presence" set to true in the config file.',
        args: [
            ['<show>', 'online, chat, away, xa or dnd'],
            ['[message]', 'The status message'],
        ],
        examples: ['converse-cli presence set away "Back at three"'],
        async run(ctx) {
            const { args, options, out } = ctx;
            if (args.length === 0) throw new UsageError('Expected a presence: online, chat, away, xa or dnd.');
            const [show, ...words] = args;
            /** @type {import('@converse/daemon/types').PresenceDTO} */
            const presence = await request(ctx, 'presence.set', {
                show,
                message: words.length ? words.join(' ') : undefined,
            });
            if (options.json) {
                out(formatJSON(presence));
            } else {
                const status = presence.status_message === null ? '' : ` with status ${quote(presence.status_message)}`;
                out(`Your presence is now ${presence.show}${status}.\n`);
            }
            return EXIT.OK;
        },
    },
};
