/**
 * The arguments, options and exit codes that several commands share, so that
 * each is described the same way everywhere.
 * @module @converse/cli/commands/shared
 */
import { UsageError } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { MAX_BODY_LENGTH } from '../format.js';
import { flag, option } from '../options.js';

/** The exit codes of a command that names a contact, room or message. */
export const LOOKUP_EXITS = [EXIT.NOT_FOUND, EXIT.AMBIGUOUS];

/** The exit codes of a command whose send policy decides. */
export const SEND_EXITS = [...LOOKUP_EXITS, EXIT.REFUSED, EXIT.DRAFT, EXIT.PENDING, EXIT.NOT_JOINED];

/** @type {[string, string]} */
export const CONTACT = ['<contact>', 'A JID, or the name of a contact on your roster'];
/** @type {[string, string]} */
export const TARGET = ['<contact|room>', 'A JID or roster name, or the JID of a room you have joined'];
/** @type {[string, string]} */
export const ROOM = ['<room>', "The room's JID, such as lobby@conference.example.org"];
/** @type {[string, string]} */
export const MESSAGE_ID = ['<id>', 'A message id, as read, inbox, search, wait or watch printed it'];
/** @type {[string, string]} */
export const DRAFT_ID = ['<id>', 'The draft id, as drafts list or the send that made it printed it'];

/** Say whether a send is for a MUC or one person, so that the daemon doesn't take one for the other. */
export const SEND_TYPE_OPTIONS = [
    flag(
        'muc',
        "Send it to a MUC (groupchat). If the daemon isn't in that MUC, nothing is sent and the exit code is 9. Use it for every send to a MUC: without it, a JID the daemon doesn't know as a MUC gets a direct message",
    ),
    flag('chat', 'Send it to one person as a direct message, never to a MUC'),
];

/**
 * The send type that --muc or --chat asked for, if either.
 * @param {import('../types').Context} ctx
 * @returns {import('@converse/daemon/types').SendType|undefined}
 */
export function sendType({ options }) {
    if (options.muc && options.chat) throw new UsageError('Use --muc or --chat, not both.');
    if (options.muc) return 'groupchat';
    if (options.chat) return 'chat';
    return undefined;
}

export const FULL = flag('full', `Don't truncate bodies longer than ${MAX_BODY_LENGTH} characters`);
export const IN_CONVERSATION = option(
    'conversation',
    '<contact|room>',
    'Look for the message only in this conversation',
);
