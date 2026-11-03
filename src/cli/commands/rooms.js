/**
 * Rooms: joining, leaving, who is in them, and finding them.
 * @module @converse/cli/commands/rooms
 */
import { request, takeOne } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatJSON, formatOccupant, formatRoomListing, quote } from '../format.js';
import { option } from '../options.js';
import { ROOM } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const ROOMS_COMMANDS = {
    'rooms join': {
        summary: 'Join a room, and rejoin it after every restart',
        description:
            'Join a room, and rejoin it after every restart until you leave it. Restricted access ' +
            'may join only the rooms listed in "policy.rooms".',
        args: [ROOM],
        options: [
            option('nick', '<name>', 'The nickname to use there (default: the consumer name, agent unless configured)'),
        ],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli rooms join lobby@conference.example.org --nick romeo'],
        async run(ctx) {
            const { options, out } = ctx;
            const room = takeOne(ctx, 'room JID');
            /** @type {{ conversation: import('@converse/daemon/types').ConversationDTO, nick: string }} */
            const joined = await request(ctx, 'rooms.join', { room, nick: options.nick });
            if (options.json) {
                out(formatJSON(joined));
            } else {
                out(`Joined ${joined.conversation.jid} as ${quote(joined.nick)}.\n`);
            }
            return EXIT.OK;
        },
    },
    'rooms leave': {
        summary: 'Leave a room, and forget it',
        description: "Leave a room, and forget it, so a restart won't rejoin it. Restricted access, as for rooms join.",
        args: [ROOM],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli rooms leave lobby@conference.example.org'],
        async run(ctx) {
            const { options, out } = ctx;
            const room = takeOne(ctx, 'room');
            /** @type {{ conversation: import('@converse/daemon/types').ConversationDTO, was_in: boolean }} */
            const left = await request(ctx, 'rooms.leave', { room });
            if (options.json) {
                out(formatJSON(left));
            } else if (left.was_in) {
                out(`Left ${left.conversation.jid}.\n`);
            } else {
                out(`Forgot ${left.conversation.jid}, which we weren't in, so a restart won't rejoin it.\n`);
            }
            return EXIT.OK;
        },
    },
    'rooms occupants': {
        summary: 'List who is in a room you are in',
        description:
            'List who is in a room you are in: nickname (quoted, as they chose it), role, ' +
            'affiliation and, where the room shows it, their JID, else "-".',
        args: [ROOM],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli rooms occupants lobby@conference.example.org'],
        async run(ctx) {
            const { options, out, err } = ctx;
            const room = takeOne(ctx, 'room');
            /** @type {{ occupants: import('@converse/daemon/types').OccupantDTO[] }} */
            const { occupants } = await request(ctx, 'rooms.occupants', { room });
            if (options.json) {
                occupants.forEach((o) => out(formatJSON(o)));
            } else if (occupants.length) {
                occupants.forEach((o) => out(formatOccupant(o)));
            } else {
                err('Nobody is listed in that room.\n');
            }
            return EXIT.OK;
        },
    },
    'rooms discover': {
        summary: 'List the rooms a MUC service hosts',
        description: 'List the rooms a MUC service hosts, with their names. Nothing is joined.',
        args: [['<service>', 'The MUC service, such as conference.example.org']],
        examples: ['converse-cli rooms discover conference.example.org'],
        async run(ctx) {
            const { options, out, err } = ctx;
            const service = takeOne(ctx, 'service');
            /** @type {{ rooms: import('@converse/daemon/types').RoomListing[] }} */
            const { rooms } = await request(ctx, 'rooms.discover', { service });
            if (options.json) {
                rooms.forEach((r) => out(formatJSON(r)));
            } else if (rooms.length) {
                rooms.forEach((r) => out(formatRoomListing(r)));
            } else {
                err(`${service} lists no rooms.\n`);
            }
            return EXIT.OK;
        },
    },
};
