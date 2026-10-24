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
 */
export function formatMessage(message, { full = false, now = new Date() } = {}) {
    const time = new Date(message.time);
    const chars = [...(message.body ?? '')];
    const truncated = !full && chars.length > MAX_BODY_LENGTH;
    const body = JSON.stringify(truncated ? chars.slice(0, MAX_BODY_LENGTH).join('') : chars.join(''));
    const more = truncated ? ` [+${chars.length - MAX_BODY_LENGTH} chars, --full to show]` : '';
    return (
        `${message.id.slice(0, SHORT_ID_LENGTH)}  ${formatTime(time)} (${formatAgo(time, now)})  ` +
        `${message.from}  ${body}${more}\n`
    );
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
