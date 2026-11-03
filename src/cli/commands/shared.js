/**
 * The arguments, options and exit codes that several commands share, so that
 * each is described the same way everywhere.
 * @module @converse/cli/commands/shared
 */
import { EXIT } from '../exit-codes.js';
import { MAX_BODY_LENGTH } from '../format.js';
import { flag, option } from '../options.js';

/** The exit codes of a command that names a contact, room or message. */
export const LOOKUP_EXITS = [EXIT.NOT_FOUND, EXIT.AMBIGUOUS];

/** The exit codes of a command whose send policy decides. */
export const SEND_EXITS = [...LOOKUP_EXITS, EXIT.REFUSED, EXIT.DRAFT];

/** @type {[string, string]} */
export const CONTACT = ['<contact>', 'A JID, or the name of a contact on your roster'];
/** @type {[string, string]} */
export const TARGET = ['<contact|room>', 'A JID or roster name, or the JID of a room you have joined'];
/** @type {[string, string]} */
export const ROOM = ['<room>', "The room's JID, such as lobby@conference.example.org"];
/** @type {[string, string]} */
export const MESSAGE_ID = ['<id>', 'A message id, as read, inbox, search or wait printed it'];
/** @type {[string, string]} */
export const DRAFT_ID = ['<id>', 'The draft id, as drafts list or the send that made it printed it'];

export const FULL = flag('full', `Don't truncate bodies longer than ${MAX_BODY_LENGTH} characters`);
export const IN_CONVERSATION = option(
    'conversation',
    '<contact|room>',
    'Look for the message only in this conversation',
);
