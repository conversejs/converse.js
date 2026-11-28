/**
 * Rooms: creating and setting them up, joining, leaving, who is in them, and
 * finding them.
 *
 * A room can have a spec: a JSON file of its settings and affiliations, at
 * `<config dir>/rooms/<room JID>.json`, which `rooms create` and
 * `rooms config set` read when they're given no other file.
 * @module @converse/cli/commands/rooms
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { getConfigDir } from '@converse/daemon/client';
import { ERRORS } from '@converse/daemon/protocol';
import { request, takeOne, UsageError } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatJSON, formatOccupant, formatRoomListing, quote, token } from '../format.js';
import { flag, option, repeatable } from '../options.js';
import { ROOM } from './shared.js';

const NICK = option('nick', '<name>', 'The nickname to use there (default: the consumer name, agent unless configured)');

/** The options that say how a room is to be set up, which `rooms create` and `rooms config set` share. */
const SETUP_OPTIONS = [
    option(
        'file',
        '<path>',
        'Read the settings and affiliations from this JSON file instead of the room\'s spec, or from stdin if it is "-": ' +
            '{"settings": {"membersonly": true, ...}, "affiliations": {"member": ["jid", ...]}}. ' +
            'What "rooms config show --json" prints can be read back as it is',
    ),
    repeatable(
        'set',
        '<name=value>',
        'Set one setting, overriding the file. Give it once for each setting. A setting that takes several values takes them comma-separated',
    ),
    repeatable('member', '<jid>', 'Make this JID a member. Give it once for each JID'),
];

/** The top-level keys a setup file may have. "room" and "fields" come from "rooms config show --json", and are ignored. */
const SETUP_KEYS = ['settings', 'affiliations', 'room', 'fields'];

/**
 * Where a room's spec is kept.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} room - The room's JID
 */
export function specPath(env, room) {
    const jid = room.trim().toLowerCase();
    // It names a file, so it can't be allowed to climb out of the directory.
    if (!/^[^\s/\\@]+@[^\s/\\@]+$/.test(jid) || jid.startsWith('.')) {
        throw new UsageError(`Expected a room JID such as lobby@conference.example.org, not "${room}".`);
    }
    return path.join(getConfigDir(env), 'rooms', `${jid}.json`);
}

/**
 * Reads and checks a setup file.
 * @param {import('../types').Context} ctx
 * @param {string} file - A path, or "-" for stdin
 * @returns {Promise<Record<string, any>>}
 */
async function readSpec(ctx, file) {
    const source = file === '-' ? 'stdin' : file;
    let text;
    try {
        text = file === '-' ? await readAll(ctx.stdin) : await fs.readFile(file, 'utf8');
    } catch (e) {
        throw new UsageError(`Couldn't read ${source}: ${/** @type {Error} */ (e).message}`);
    }
    let spec;
    try {
        spec = JSON.parse(text);
    } catch (e) {
        throw new UsageError(`${source} isn't JSON: ${/** @type {Error} */ (e).message}`);
    }
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new UsageError(`${source} must hold a JSON object, with "settings" and "affiliations".`);
    }
    const unknown = Object.keys(spec).filter((key) => !SETUP_KEYS.includes(key));
    if (unknown.length) {
        throw new UsageError(`${source} may have "settings" and "affiliations", not "${unknown.join('", "')}".`);
    }
    for (const key of ['settings', 'affiliations']) {
        if (spec[key] !== undefined && (spec[key] === null || typeof spec[key] !== 'object' || Array.isArray(spec[key]))) {
            throw new UsageError(`"${key}" in ${source} must be an object.`);
        }
    }
    return spec;
}

/**
 * The settings and affiliations to set a room up with: from --file, else from
 * the room's spec if it has one, and then --set and --member, each overriding
 * or adding to what came before.
 * @param {import('../types').Context} ctx
 * @param {string} room - The room's JID
 * @returns {Promise<{
 *   settings: Record<string, unknown>,
 *   affiliations: Record<string, unknown[]>,
 *   source: string|null,
 *   spec_path: string,
 * }>} With the file they came from, if any, and where the room's spec is or would be
 */
export async function readSetup(ctx, room) {
    const { options } = ctx;
    const spec_path = specPath(ctx.env, room);
    let source = null;
    /** @type {Record<string, any>} */
    let spec = {};
    if (options.file !== undefined) {
        source = options.file === '-' ? 'stdin' : options.file;
        spec = await readSpec(ctx, options.file);
    } else if (await exists(spec_path)) {
        source = spec_path;
        spec = await readSpec(ctx, spec_path);
    }
    const settings = { ...spec.settings };
    for (const pair of options.set ?? []) {
        const at = pair.indexOf('=');
        if (at < 1) throw new UsageError(`--set takes <name=value>, such as --set membersonly=true, not "${pair}".`);
        settings[pair.slice(0, at).trim()] = pair.slice(at + 1);
    }
    const affiliations = { ...spec.affiliations };
    if (options.member?.length) {
        affiliations.member = [...(Array.isArray(affiliations.member) ? affiliations.member : []), ...options.member];
    }
    return { settings, affiliations, source, spec_path };
}

/** @param {string} file */
const exists = (file) =>
    fs.access(file).then(
        () => true,
        () => false,
    );

/**
 * @param {NodeJS.ReadStream|undefined} stdin
 * @returns {Promise<string>}
 */
async function readAll(stdin) {
    if (!stdin || stdin.isTTY) throw new Error('nothing was piped in');
    let text = '';
    for await (const chunk of stdin) text += chunk;
    return text;
}

/**
 * Asks a yes or no question, if someone is at a terminal to answer it. Without
 * one, as for an agent or a script, the answer is no.
 * @param {import('../types').Context} ctx
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function confirm(ctx, question) {
    if (!ctx.stdin?.isTTY || !process.stderr.isTTY) return false;
    ctx.err(question);
    const lines = readline.createInterface({ input: ctx.stdin });
    try {
        for await (const line of lines) return /^\s*y(es)?\s*$/i.test(line);
        return false;
    } finally {
        lines.close();
    }
}

/**
 * A setting's value, for a line of text.
 * @param {import('@converse/daemon/types').RoomSetting} value
 */
const showSetting = (value) => (typeof value === 'string' ? quote(value) : JSON.stringify(value));

/**
 * The affiliations given, one line each.
 * @param {import('@converse/daemon/types').AffiliationGrant[]} grants
 * @param {boolean} [would]
 */
const showGrants = (grants, would = false) =>
    grants.map((g) => `${would ? 'Would make' : 'Made'} ${token(g.jid)} ${g.affiliation}.\n`).join('');

/**
 * Creates a room, and says how that went.
 * @param {import('../types').Context} ctx
 * @param {string} room
 * @param {Awaited<ReturnType<typeof readSetup>>} setup
 */
async function create(ctx, room, { settings, affiliations }) {
    const { options, out } = ctx;
    /** @type {import('@converse/daemon/types').RoomCreated} */
    const result = await request(ctx, 'rooms.create', { room, nick: options.nick, settings, affiliations });
    if (options.json) {
        out(formatJSON(result));
    } else if (result.created) {
        out(`Created ${result.conversation.jid}, and joined it as ${quote(result.nick)}.\n`);
        out(showGrants(result.affiliations));
    } else {
        out(
            `${result.conversation.jid} exists already, so it was left as it is. ` +
                'Change it with "converse rooms config set".\n',
        );
    }
    return EXIT.OK;
}

/** @type {Record<string, import('../types').Command>} */
export const ROOMS_COMMANDS = {
    'rooms join': {
        summary: 'Join a room, and rejoin it after every restart',
        description:
            'Join a room, and rejoin it after every restart until you leave it. Restricted access ' +
            'may join only the rooms listed in "policy.rooms". A room that doesn\'t exist is not ' +
            'created, and the exit code is 3, unless you pass --create, or answer yes when asked at a ' +
            'terminal: it is then created as rooms create does, from its spec if it has one.',
        args: [ROOM],
        options: [NICK, flag('create', "Create the room if it doesn't exist, without asking")],
        exits: [EXIT.NOT_FOUND, EXIT.FORBIDDEN],
        examples: [
            'converse rooms join lobby@conference.example.org --nick romeo',
            'converse rooms join agents@conference.example.org --create',
        ],
        async run(ctx) {
            const { options, out } = ctx;
            const room = takeOne(ctx, 'room JID');
            /** @type {{ conversation: import('@converse/daemon/types').ConversationDTO, nick: string }} */
            let joined;
            try {
                joined = await request(ctx, 'rooms.join', { room, nick: options.nick });
            } catch (e) {
                const error = /** @type {import('@converse/daemon/protocol').RPCError} */ (e);
                if (error.code !== ERRORS.NOT_FOUND || !(/** @type {any} */ (error.data)?.missing)) throw e;

                const setup = await readSetup(ctx, room);
                const what = setup.source ? `the settings in ${setup.source}` : "the server's default settings";
                if (!options.create && !(await confirm(ctx, `${room} doesn't exist. Create it, with ${what}? [y/N] `))) {
                    throw e;
                }
                return create(ctx, room, setup);
            }
            if (options.json) {
                out(formatJSON(joined));
            } else {
                out(`Joined ${joined.conversation.jid} as ${quote(joined.nick)}.\n`);
            }
            return EXIT.OK;
        },
    },
    'rooms create': {
        summary: 'Create a room, set up as its spec says, unless it exists',
        description:
            'Create a room, with the settings and affiliations given, and join it, as rooms join does. ' +
            "Without --file, they come from the room's spec, <config dir>/rooms/<room>.json, if it has one, " +
            "else the server's defaults are kept; --set and --member add to either. " +
            'A room that exists already is left as it is, whatever its settings, and the exit code is ' +
            'still 0, so a setup script can run it every time: change an existing room with rooms config set. ' +
            'Settings are named as the server\'s form names them, without "muc#roomconfig_", such as ' +
            'membersonly, whois, persistentroom and publicroom; a setting the server lacks, or a value it ' +
            "doesn't take, is refused, and the new room destroyed again. A password-protected room with no " +
            'roomsecret gets the password under "rooms" in the config. Needs full access.',
        args: [ROOM],
        options: [...SETUP_OPTIONS, NICK],
        exits: [EXIT.FORBIDDEN],
        examples: [
            'converse rooms create agents@conference.example.org',
            'converse rooms create agents@conference.example.org --set membersonly=true --set whois=anyone',
            'converse rooms create agents@conference.example.org --file room.json --member tab-1@example.org',
        ],
        async run(ctx) {
            const room = takeOne(ctx, 'room JID');
            return create(ctx, room, await readSetup(ctx, room));
        },
    },
    'rooms config show': {
        summary: "Show a room's settings and affiliations",
        description:
            "Show a room's settings, one per line (name, value, and the server's label for it, quoted), and " +
            'then its affiliation lists. With --json, what it prints can be saved as the room\'s spec, or ' +
            "given to rooms create or rooms config set with --file. The room shows its settings only to its " +
            "owners; you needn't be in it. Needs full access.",
        args: [ROOM],
        exits: [EXIT.NOT_FOUND, EXIT.FORBIDDEN],
        examples: [
            'converse rooms config show agents@conference.example.org',
            'converse rooms config show agents@conference.example.org --json > ~/.config/converse/rooms/agents@conference.example.org.json',
        ],
        async run(ctx) {
            const { options, out } = ctx;
            const room = takeOne(ctx, 'room');
            /** @type {import('@converse/daemon/types').RoomConfig} */
            const config = await request(ctx, 'rooms.config', { room });
            if (options.json) {
                out(formatJSON(config));
                return EXIT.OK;
            }
            const width = Math.max(0, ...config.fields.map((f) => f.name.length));
            config.fields.forEach((f) =>
                out(`${token(f.name).padEnd(width)}  ${showSetting(f.value)}${f.label ? `  ${quote(f.label)}` : ''}\n`),
            );
            for (const [affiliation, jids] of Object.entries(config.affiliations)) {
                jids.forEach((jid) => out(`${affiliation}  ${token(jid)}\n`));
            }
            return EXIT.OK;
        },
    },
    'rooms config set': {
        summary: "Change a room's settings and affiliations, to match its spec",
        description:
            "Change a room's settings, and give JIDs affiliations there, as rooms create takes them: from " +
            "--file, else from the room's spec, <config dir>/rooms/<room>.json, and then --set and --member. " +
            "Run with none of them, it makes the room match its spec. Only what's given changes: the other " +
            "settings stay as they are, and nobody loses an affiliation. If any setting won't do, nothing is " +
            'changed. Needs full access, and owner of the room.',
        args: [ROOM],
        options: [...SETUP_OPTIONS, flag('dry-run', 'Say what would change, and change nothing')],
        exits: [EXIT.NOT_FOUND, EXIT.FORBIDDEN],
        examples: [
            'converse rooms config set agents@conference.example.org --dry-run',
            'converse rooms config set agents@conference.example.org --set persistentroom=true --member tab-3@example.org',
        ],
        async run(ctx) {
            const { options, out } = ctx;
            const room = takeOne(ctx, 'room');
            const { settings, affiliations, source, spec_path } = await readSetup(ctx, room);
            if (!source && !options.set?.length && !options.member?.length) {
                throw new UsageError(`Nothing to set: ${room} has no spec at ${spec_path}, and no --file, --set or --member was given.`);
            }
            /** @type {import('@converse/daemon/types').RoomConfigured} */
            const result = await request(ctx, 'rooms.configure', {
                room,
                settings,
                affiliations,
                dry_run: !!options['dry-run'],
            });
            if (options.json) {
                out(formatJSON(result));
                return EXIT.OK;
            }
            const would = result.dry_run;
            result.changes.forEach((c) =>
                out(`${would ? 'Would change' : 'Changed'} ${token(c.name)}: ${showSetting(c.from)} to ${showSetting(c.to)}.\n`),
            );
            out(showGrants(result.affiliations, would));
            if (!result.changes.length && !result.affiliations.length) out(`Nothing to change in ${result.room}.\n`);
            return EXIT.OK;
        },
    },
    'rooms leave': {
        summary: 'Leave a room, and forget it',
        description: "Leave a room, and forget it, so a restart won't rejoin it. Restricted access, as for rooms join.",
        args: [ROOM],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse rooms leave lobby@conference.example.org'],
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
            'List who is in a room you are in: nickname (quoted, as they chose it), presence ' +
            '(online, chat, away, xa or dnd), role, affiliation, their JID where the room shows it, ' +
            'else "-", and their status message (quoted) if they set one.',
        args: [ROOM],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse rooms occupants lobby@conference.example.org'],
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
        examples: ['converse rooms discover conference.example.org'],
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
