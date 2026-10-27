/**
 * converse-cli's text output, made for an LLM to read: one line per message,
 * cheap in tokens, and unambiguous about where untrusted content starts and
 * ends.
 */

/**
 * How many characters of a body are shown before it's truncated.
 */
export const MAX_BODY_LENGTH = 280;

/**
 * How many characters of a message id are shown. Commands accept a unique
 * prefix, so this is enough to address a message.
 */
export const SHORT_ID_LENGTH = 8;

/**
 * One message, on one line: short id, time (ISO and relative), sender, body.
 *
 * The body is printed as a JSON string. Its quotes mark exactly where text
 * someone else wrote begins and ends, and escaping its newlines means a
 * message can't print lines that pass as more messages or as CLI output.
 * @param {import('@converse/daemon/types').MessageDTO} message
 * @param {Object} options
 * @param {boolean} [options.full] - Don't truncate the body.
 * @param {Date} [options.now]
 * @param {boolean} [options.conversation] - Name the conversation the message is in, as a search does.
 */
export function formatMessage(message, { full = false, now = new Date(), conversation = false } = {}) {
    const time = new Date(message.time);
    const notes = [
        message.encryption?.status === 'decrypted' && 'encrypted',
        message.encryption?.status === 'undecryptable' &&
            `could not be decrypted: ${message.encryption.error ?? 'no reason given'}`,
        message.reply_to && `reply to ${message.reply_to.slice(0, SHORT_ID_LENGTH)}`,
        message.edited && 'edited',
        message.retracted && 'retracted',
        Object.keys(message.reactions ?? {}).length &&
            'reactions: ' +
                Object.entries(message.reactions)
                    .map(([emoji, reactors]) => `${emoji} ${reactors.length}`)
                    .join(', '),
    ]
        .filter(Boolean)
        .map((note) => `[${note}]  `)
        .join('');
    const place = conversation ? `in ${message.conversation}  ` : '';
    return (
        `${message.id.slice(0, SHORT_ID_LENGTH)}  ${formatTime(time)} (${formatAgo(time, now)})  ${place}` +
        `${message.from}  ${notes}${formatBody(message.body, { full })}\n`
    );
}

/**
 * One draft, on one line: its id, when it was queued, who it's for, and its body.
 * @param {import('@converse/daemon/types').Draft} draft
 * @param {Object} options
 * @param {boolean} [options.full] - Don't truncate the body.
 * @param {Date} [options.now]
 */
export function formatDraft(draft, { full = false, now = new Date() } = {}) {
    const time = new Date(draft.created);
    return (
        `${draft.id}  ${formatTime(time)} (${formatAgo(time, now)})  to ${draft.to}  ` +
        `${formatBody(draft.body, { full })}\n`
    );
}

/** One scheduled message, on one line: id, delivery time, recipient and body. */
export function formatSchedule(schedule, { full = false } = {}) {
    const parked = schedule.parked ? `  NOT SENT: ${schedule.parked.message}` : '';
    return `${schedule.id}  ${schedule.send_at}  to ${schedule.to}  ${formatBody(schedule.body, { full })}${parked}\n`;
}

/**
 * @param {string|null} text
 * @param {Object} options
 * @param {boolean} options.full
 */
function formatBody(text, { full }) {
    const chars = [...(text ?? '')];
    const truncated = !full && chars.length > MAX_BODY_LENGTH;
    const body = JSON.stringify(truncated ? chars.slice(0, MAX_BODY_LENGTH).join('') : chars.join(''));
    const more = truncated ? ` [+${chars.length - MAX_BODY_LENGTH} chars, --full to show]` : '';
    return body + more;
}

/**
 * One conversation, on one line: its JID, the roster name (quoted, as it's
 * text someone else chose), how many messages are unread, and when it was last active.
 * @param {import('@converse/daemon/types').ConversationSummary} conversation
 * @param {Object} [options]
 * @param {Date} [options.now]
 */
export function formatConversation(conversation, { now = new Date() } = {}) {
    const name = conversation.name ? `  ${JSON.stringify(conversation.name)}` : '';
    const last = conversation.last_activity ? formatAgo(new Date(conversation.last_activity), now) : 'never';
    return `${conversation.jid}${name}  unread ${conversation.unread}  last active ${last}\n`;
}

/**
 * @param {Date} time
 */
function formatTime(time) {
    return time.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * @param {Date} time
 * @param {Date} now
 */
function formatAgo(time, now) {
    const seconds = Math.round((now.getTime() - time.getTime()) / 1000);
    if (seconds < 0) return 'in the future';
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * @param {number} seconds
 */
export function formatDuration(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, (s || seconds === 0) && `${s}s`].filter(Boolean);
    return parts.slice(0, 2).join(' ');
}

/**
 * Turns a `--since` value into an ISO 8601 time: either one already, or a
 * duration back from now such as `30m`, `2h` or `7d`.
 * @param {string} value
 * @param {Date} [now]
 * @returns {string}
 */
export function parseSince(value, now = new Date()) {
    const duration = value.match(/^(\d+)([smhd])$/);
    if (duration) {
        const unit = { s: 1, m: 60, h: 3600, d: 86400 }[duration[2]];
        return new Date(now.getTime() - Number(duration[1]) * unit * 1000).toISOString();
    }
    const time = Date.parse(value);
    if (Number.isNaN(time)) {
        throw new Error(
            `--since "${value}" is neither an ISO 8601 time (2026-10-23T09:00:00Z) nor a duration (30m, 2h, 7d).`,
        );
    }
    return new Date(time).toISOString();
}

/**
 * Text that came from someone else, as a JSON string, or `-` when there's none.
 * @param {string|null} text
 */
function quoted(text) {
    return text === null ? '-' : JSON.stringify(text);
}

/**
 * One occupant of a room, on one line: nickname, role, affiliation, then
 * their JID if the room shows it. The nickname is chosen by the occupant, so it's quoted.
 * @param {import('@converse/daemon/types').OccupantDTO} occupant
 */
export function formatOccupant(occupant) {
    return `${JSON.stringify(occupant.nick)}  ${occupant.role}  ${occupant.affiliation}  ${occupant.jid ?? '-'}\n`;
}

/**
 * One room a service lists, on one line: its JID, then its name.
 * @param {import('@converse/daemon/types').RoomListing} room
 */
export function formatRoomListing(room) {
    return `${room.jid}  ${quoted(room.name)}\n`;
}

/**
 * One contact, on one line: JID, presence, then the name.
 * @param {import('@converse/daemon/types').ContactSummary} contact
 */
export function formatContact(contact) {
    return `${contact.jid}  ${contact.presence}  ${quoted(contact.name)}\n`;
}

/**
 * A contact in full: what the roster says, their vCard, and each client they
 * are connected with. Every field that came from the contact is quoted.
 * @param {import('@converse/daemon/types').ContactDetails} details
 */
export function formatContactDetails(details) {
    const lines = [`${details.jid}  ${details.presence}  ${details.on_roster ? 'on roster' : 'not on roster'}`];
    lines.push(`  name: ${quoted(details.name)}`);
    if (details.vcard) {
        for (const [field, value] of Object.entries(details.vcard)) {
            if (value !== null) lines.push(`  ${field}: ${quoted(value)}`);
        }
    } else {
        lines.push('  vcard: could not be fetched');
    }
    if (!details.resources.length) lines.push('  no connected clients');
    for (const resource of details.resources) {
        const identities = resource.identities.map(
            ({ category, type, name }) => `${category}/${type}${name ? ` ${JSON.stringify(name)}` : ''}`,
        );
        const status = resource.status === null ? '' : `, status ${JSON.stringify(resource.status)}`;
        lines.push(
            `  client ${JSON.stringify(resource.name)}: ${resource.presence}, priority ${resource.priority}${status}` +
                `; identities: ${identities.join(', ') || 'none known'}`,
        );
    }
    return lines.join('\n') + '\n';
}

/**
 * The devices of a conversation, one per line under a line saying whether encryption is on.
 * @param {import('@converse/daemon/types').DeviceList} list
 */
export function formatDeviceList(list) {
    const lines = [`${list.conversation}  encryption ${list.encrypted ? 'on' : 'off'}`];
    if (!list.devices.length) lines.push('  no OMEMO devices');
    for (const device of list.devices) lines.push('  ' + formatDevice(device).trimEnd());
    return lines.join('\n') + '\n';
}

/**
 * One device, on one line: its id, its trust, whether it's active, its fingerprint.
 * @param {import('@converse/daemon/types').DeviceDTO} device
 */
export function formatDevice(device) {
    const notes = [
        device.this_device && 'this daemon',
        !device.active && 'inactive',
        device.fingerprint === null && 'no fingerprint yet',
    ].filter(Boolean);
    const fingerprint = device.fingerprint ? ` ${device.fingerprint}` : '';
    return `${device.id}  ${device.trust}${fingerprint}${notes.length ? `  (${notes.join(', ')})` : ''}\n`;
}
