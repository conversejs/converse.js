/**
 * The daemon's end of its unix sockets: listening on them, and reading each
 * client's requests a line at a time, within limits a client can't push past.
 * @module @converse/daemon/transport
 */
import fs from 'node:fs/promises';
import net from 'node:net';
import { ERRORS, MAX_LINE_LENGTH } from './protocol.js';

/**
 * A line counts against {@link MAX_BUFFERED} only past this length, so that
 * ordinary requests are never held up by uploads.
 */
const SMALL_LINE_LENGTH = 1024 * 1024;

/**
 * How many bytes of large lines the daemon holds at once, across every
 * connection, from the first byte read until the request has been handled.
 * Without it, a client could open many connections and send each one a line
 * just under {@link MAX_LINE_LENGTH}.
 */
const MAX_BUFFERED = 2 * MAX_LINE_LENGTH;

/**
 * The budget of large lines' bytes that the connections sharing it may hold
 * at once.
 * @returns {import('./types').LineBudget}
 */
export function createLineBudget() {
    return { held: 0 };
}

/**
 * Listens on a unix socket, readable and writable by its owner only, or also
 * by the group `gid` if one is given.
 * @param {string} socket_path
 * @param {(socket: net.Socket) => void} onConnection
 * @param {number|null} [gid]
 * @returns {Promise<net.Server>}
 */
export async function listen(socket_path, onConnection, gid = null) {
    const server = net.createServer({ allowHalfOpen: true }, onConnection);
    // A socket file left behind by a daemon that died isn't in use: the pidfile
    // we hold says no other daemon is running.
    await fs.rm(socket_path, { force: true });
    await new Promise((resolve, reject) => {
        server.once('error', (e) =>
            reject(
                /** @type {NodeJS.ErrnoException} */ (e).code === 'EINVAL'
                    ? new Error(
                          `Can't listen on ${socket_path}: the path is too long for a unix socket. ` +
                              'Point XDG_RUNTIME_DIR, or "restricted_dir", at a shorter directory.',
                          { cause: e },
                      )
                    : e,
            ),
        );
        server.listen(socket_path, () => resolve(undefined));
    });
    if (gid === null) {
        await fs.chmod(socket_path, 0o600);
    } else {
        await fs.chown(socket_path, -1, gid);
        await fs.chmod(socket_path, 0o660);
    }
    return server;
}

/**
 * Speaks JSON-RPC 2.0 to one client, one message per line: each line it sends
 * goes to the handler `open` returns, and each response goes back.
 * @param {net.Socket} socket
 * @param {import('./types').LineBudget} budget - Shared by every connection
 * @param {(notify: (params: unknown) => void) => import('./types').RequestHandler} open - Makes the
 *     client's handler, given a way to send it events
 */
export function serveClient(socket, budget, open) {
    const send = (message) => socket.writable && socket.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
    const handle = open((params) => send({ method: 'event', params }));

    const onRefused = (code) => {
        const message =
            code === ERRORS.BUSY
                ? 'The daemon is reading other large requests, so this one was refused and the connection ' +
                  'closed. Try again once they are done.'
                : `The request is longer than the ${MAX_LINE_LENGTH} bytes the daemon accepts, so it was ` +
                  'refused and the connection closed.';
        socket.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }) + '\n');
    };

    // The server keeps a connection open after the client ends its side, so
    // that a last request, such as one piped in without a newline, still gets
    // its response. The connection is ended once every response is written.
    let in_flight = 0;
    let client_ended = false;
    const endIfDone = () => client_ended && in_flight === 0 && socket.end();

    readLines(socket, budget, onRefused, async (line) => {
        in_flight++;
        try {
            const { response, close } = await handle(line);
            if (response) send(response);
            if (close) socket.end();
        } finally {
            in_flight--;
            endIfDone();
        }
    });
    // After readLines' own listener, which hands on a last line without a newline.
    socket.on('end', () => {
        client_ended = true;
        endIfDone();
    });
}

/**
 * Calls `onLine` with each line `socket` sends, like `readline` does, but
 * without buffering a line past {@link MAX_LINE_LENGTH} bytes, or past what
 * `budget` has left: a client could otherwise make the daemon hold as much as
 * it cares to send. Then it calls `onRefused` with the error code instead, and
 * drops whatever else comes.
 * @param {net.Socket} socket
 * @param {import('./types').LineBudget} budget
 * @param {(code: number) => void} onRefused
 * @param {(line: string) => Promise<void>} onLine
 */
function readLines(socket, budget, onRefused, onLine) {
    /** @type {Buffer[]} */
    let chunks = [];
    let length = 0;
    // What the line read so far counts against MAX_BUFFERED
    let charged = 0;
    let refused = false;

    const refuse = (code) => {
        refused = true;
        chunks = [];
        budget.held -= charged;
        charged = 0;
        onRefused(code);
    };

    const emit = () => {
        const line = Buffer.concat(chunks).toString('utf8');
        const held = charged;
        chunks = [];
        length = 0;
        charged = 0;
        onLine(line.endsWith('\r') ? line.slice(0, -1) : line).finally(() => (budget.held -= held));
    };

    socket.on('data', (/** @type {Buffer} */ data) => {
        if (refused) return;

        let start = 0;
        for (;;) {
            const end = data.indexOf(0x0a, start);
            const piece = data.subarray(start, end === -1 ? data.length : end);
            length += piece.length;
            if (length > MAX_LINE_LENGTH) return refuse(ERRORS.INVALID_REQUEST);

            const charge = Math.max(0, length - SMALL_LINE_LENGTH) - charged;
            if (charge > 0) {
                if (budget.held + charge > MAX_BUFFERED) return refuse(ERRORS.BUSY);

                budget.held += charge;
                charged += charge;
            }
            if (piece.length) chunks.push(piece);
            if (end === -1) return;

            emit();
            start = end + 1;
        }
    });
    socket.on('end', () => !refused && length && emit());
    // A line cut off by the connection closing
    socket.on('close', () => {
        budget.held -= charged;
        charged = 0;
    });
}
