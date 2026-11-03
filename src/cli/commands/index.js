/**
 * Every command converse-cli has, each defined once, in the module of its
 * group: what it's for, its arguments and options, its exit codes, examples,
 * and what it does. The help and the parser are derived from these.
 * @module @converse/cli/commands
 */
import { CONTACTS_COMMANDS } from './contacts.js';
import { DAEMON_COMMANDS } from './daemon.js';
import { DRAFTS_COMMANDS } from './drafts.js';
import { OMEMO_COMMANDS } from './omemo.js';
import { PRESENCE_COMMANDS } from './presence.js';
import { READING_COMMANDS } from './reading.js';
import { ROOMS_COMMANDS } from './rooms.js';
import { SCHEDULES_COMMANDS } from './schedules.js';
import { SENDING_COMMANDS } from './sending.js';

/**
 * In the order the overview lists them. A group's subcommands, such as
 * "drafts list", are named with a space.
 * @type {Record<string, import('../types').Command>}
 */
export const COMMANDS = {
    ...READING_COMMANDS,
    ...SENDING_COMMANDS,
    ...DRAFTS_COMMANDS,
    ...SCHEDULES_COMMANDS,
    ...CONTACTS_COMMANDS,
    ...OMEMO_COMMANDS,
    ...PRESENCE_COMMANDS,
    ...ROOMS_COMMANDS,
    ...DAEMON_COMMANDS,
};
