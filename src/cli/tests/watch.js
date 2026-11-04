import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { converse } from '@converse/headless';
import { ERRORS, PROTOCOL_VERSION } from '@converse/daemon/protocol';
import { JID, startDaemon } from '../../daemon/tests/harness.js';
import { EXIT } from '../exit-codes.js';
import { run, start } from './run.js';

const { stx, u } = converse.env;

const JULIET = 'juliet@capulet.lit';
const MERCUTIO = 'mercutio@montague.lit';
const GARDEN = 'garden@conference.montague.lit';

/** A message line as watch prints it, after the conversation's JID. */
const LINE = /^\S+ {2}\S+ {2}\S+ \((?:just now|\d+s ago)\) {2}\S+ {2}".*"$/;

describe('converse-cli watch', () => {
    let daemon;

    beforeAll(async () => {
        daemon = await startDaemon({
            roster: [
                { jid: JULIET, name: 'Juliet Capulet' },
                { jid: MERCUTIO, name: 'Mercutio' },
            ],
        });
    });

    afterAll(() => daemon?.stop());

    /**
     * Delivers a message, and waits until the daemon has stored it.
     * @param {string} from
     * @param {string} body
     */
    async function receive(from, body) {
        const { promise, resolve } = Promise.withResolvers();
        daemon.api.listen.once('message', resolve);
        daemon.receive(stx`
            <message xmlns="jabber:client" from="${from}/balcony" to="${JID}" type="chat"
                     id="${u.getUniqueId()}">
                <body>${body}</body>
            </message>`);
        await promise;
    }

    /** @param {string} stdout */
    const lines = (stdout) => stdout.split('\n').filter(Boolean);

    it('prints each incoming message as it arrives, after its conversation, until stopped', async () => {
        const watch = start(daemon.env, 'watch');
        await watch.started();
        expect(watch.output.stderr).toBe('Watching for incoming messages. Nothing is marked seen. Stop with Ctrl-C.\n');

        await receive(JULIET, 'Wherefore art thou');
        await watch.until(({ stdout }) => stdout.includes('Wherefore'));
        await receive(MERCUTIO, 'A plague');
        await watch.until(({ stdout }) => stdout.includes('plague'));
        // What we send isn't news.
        const client = await daemon.connect();
        await client.request('messages.send', { to: JULIET, body: 'Here I am' });
        client.close();
        await receive(JULIET, 'Come hither');
        await watch.until(({ stdout }) => stdout.includes('hither'));

        const { code, stdout, stderr } = await watch.stop();
        expect(code).toBe(EXIT.OK);
        expect(stderr).toBe('Watching for incoming messages. Nothing is marked seen. Stop with Ctrl-C.\n');
        const printed = lines(stdout);
        expect(printed).toHaveLength(3);
        printed.forEach((line) => expect(line).toMatch(LINE));
        expect(printed.map((line) => line.split('  ')[0])).toEqual([JULIET, MERCUTIO, JULIET]);
        expect(printed[0]).toMatch(/ {2}juliet@capulet\.lit {2}"Wherefore art thou"$/);
    });

    it('leaves the read cursors alone', async () => {
        await run(daemon.env, 'inbox');
        const watch = start(daemon.env, 'watch');
        await watch.started();
        await receive(JULIET, 'Seen by watch');
        await watch.until(({ stdout }) => stdout.includes('Seen by watch'));
        await watch.stop();

        expect((await run(daemon.env, 'inbox')).stdout).toContain('"Seen by watch"');
    });

    it('stops on SIGTERM too, with exit code 0', async () => {
        const watch = start(daemon.env, 'watch');
        await watch.started();
        expect((await watch.stop('SIGTERM')).code).toBe(EXIT.OK);
    });

    it('only prints what the filters match, saying on stderr what they are', async () => {
        const watch = start(daemon.env, 'watch', '--from', 'Juliet Capulet', '--mention');
        await watch.started();
        expect(watch.output.stderr).toBe(
            'Watching for incoming messages from Juliet Capulet that mention you. Nothing is marked seen. ' +
                'Stop with Ctrl-C.\n',
        );
        // The account's JID is romeo@montague.lit.
        await receive(MERCUTIO, 'Romeo, from Mercutio');
        await receive(JULIET, 'Not naming anyone');
        await receive(JULIET, 'Romeo, from Juliet');
        await watch.until(({ stdout }) => stdout.includes('from Juliet'));

        const { stdout } = await watch.stop();
        expect(lines(stdout)).toHaveLength(1);
        expect(stdout).toMatch(/"Romeo, from Juliet"\n$/);
    });

    it('in a room, prints the messages that mention our nickname there', async () => {
        const client = await daemon.connect();
        const joined = client.request('rooms.join', { room: GARDEN, nick: 'Friar' });
        await daemon.enterRoom(GARDEN, 'Friar');
        await joined;
        client.close();
        const room = await daemon.api.rooms.get(GARDEN);

        const watch = start(daemon.env, 'watch', '--conversation', GARDEN, '--mention');
        await watch.started();
        /** @param {string} body */
        const say = async (body) => {
            daemon.receive(stx`
                <message xmlns="jabber:client" from="${GARDEN}/nurse" to="${JID}" type="groupchat"
                        id="${u.getUniqueId()}">
                    <body>${body}</body>
                </message>`);
            await u.waitUntil(() => room.messages.findWhere({ body }));
        };
        await say('Good morrow, all');
        await say('Friar, a word');
        await receive(JULIET, 'Friar, in a chat');
        await watch.until(({ stdout }) => stdout.includes('a word'));

        const { stdout } = await watch.stop();
        expect(lines(stdout)).toEqual([
            expect.stringMatching(/^garden@conference\.montague\.lit {2}.*"Friar, a word"$/),
        ]);
        expect(stdout).toContain(`${GARDEN}/nurse`);
    });

    it('prints one JSON event per line with --json, without the subscription', async () => {
        const watch = start(daemon.env, 'watch', '--json', '--conversation', MERCUTIO);
        await watch.started();
        await receive(MERCUTIO, 'One');
        await receive(MERCUTIO, 'Two');
        await watch.until(({ stdout }) => lines(stdout).length === 2);

        const { stdout } = await watch.stop();
        const events = lines(stdout).map((line) => JSON.parse(line));
        expect(events).toEqual([
            { type: 'message', message: expect.objectContaining({ conversation: MERCUTIO, body: 'One' }) },
            { type: 'message', message: expect.objectContaining({ conversation: MERCUTIO, body: 'Two' }) },
        ]);
    });

    it('truncates long bodies unless given --full', async () => {
        const body = 'x'.repeat(300);
        const short = start(daemon.env, 'watch', '--conversation', JULIET);
        const full = start(daemon.env, 'watch', '--conversation', JULIET, '--full');
        await Promise.all([short.started(), full.started()]);
        await receive(JULIET, body);
        await Promise.all([short, full].map((w) => w.until(({ stdout }) => stdout.includes('\n'))));

        expect((await short.stop()).stdout).toContain('[+20 chars, --full to show]');
        expect((await full.stop()).stdout).toContain(`"${body}"`);
    });

    it('prints a burst together with --batch, in one write', async () => {
        const watch = start(daemon.env, 'watch', '--conversation', MERCUTIO, '--batch', '1');
        await watch.started();
        await receive(MERCUTIO, 'Burst one');
        await receive(MERCUTIO, 'Burst two');
        await receive(MERCUTIO, 'Burst three');
        expect(watch.output.stdout).toBe('');
        await watch.until(({ stdout }) => stdout.includes('three'));

        const { chunks } = await watch.stop();
        expect(chunks).toHaveLength(1);
        expect(lines(chunks[0])).toHaveLength(3);
    });

    it('prints what it has gathered when stopped', async () => {
        const watch = start(daemon.env, 'watch', '--conversation', MERCUTIO, '--batch', '60');
        await watch.started();
        await receive(MERCUTIO, 'Held');
        expect((await watch.stop()).stdout).toContain('"Held"');
    });

    it('refuses a batch window that is not a positive number of seconds', async () => {
        const { code, stderr } = await run(daemon.env, 'watch', '--batch', 'soon');
        expect(code).toBe(EXIT.ERROR);
        expect(stderr).toMatch(/^converse-cli: --batch "soon" isn't a number of seconds, up to 24 days\. /);
    });

    it('refuses a batch window longer than a timer can wait', async () => {
        for (const batch of ['Infinity', '2147484']) {
            const { code, stderr } = await run(daemon.env, 'watch', '--batch', batch);
            expect(code).toBe(EXIT.ERROR);
            expect(stderr).toContain(`--batch "${batch}" isn't a number of seconds, up to 24 days.`);
        }
    });

    describe('with --inbox', () => {
        it('prints the unseen messages first, then streams, marking each printed seen', async () => {
            await run(daemon.env, 'inbox');
            await receive(JULIET, 'Unseen one');
            await receive(MERCUTIO, 'Unseen two');

            const watch = start(daemon.env, 'watch', '--inbox');
            await watch.until(({ stdout }) => lines(stdout).length === 2);
            expect(watch.output.stderr).toBe(
                'Watching for incoming messages. Each message printed is marked seen. Stop with Ctrl-C.\n',
            );
            // The catch-up is one write.
            expect(watch.output.chunks).toHaveLength(1);
            await receive(JULIET, 'Live one');
            await watch.until(({ stdout }) => stdout.includes('Live one'));

            const { code, stdout } = await watch.stop();
            expect(code).toBe(EXIT.OK);
            const printed = lines(stdout);
            printed.forEach((line) => expect(line).toMatch(LINE));
            expect(printed.map((line) => line.match(/"(.*)"$/)[1]).sort()).toEqual([
                'Live one',
                'Unseen one',
                'Unseen two',
            ]);
            expect(printed[2]).toMatch(/^juliet@capulet\.lit {2}.*"Live one"$/);
            expect((await run(daemon.env, 'inbox')).stderr).toBe('No new messages.\n');
        });

        it('picks up where it stopped when started again, repeating nothing', async () => {
            const first = start(daemon.env, 'watch', '--inbox', '--json');
            await first.started();
            await receive(JULIET, 'Before the stop');
            await first.until(({ stdout }) => stdout.includes('Before the stop'));
            await first.stop();

            await receive(JULIET, 'While stopped');
            const second = start(daemon.env, 'watch', '--inbox', '--json');
            await second.until(({ stdout }) => stdout.includes('While stopped'));
            await receive(JULIET, 'After the start');
            await second.until(({ stdout }) => stdout.includes('After the start'));

            const { stdout } = await second.stop();
            const events = lines(stdout).map((line) => JSON.parse(line));
            expect(events.map((e) => e.message.body)).toEqual(['While stopped', 'After the start']);
            expect(events[0]).toEqual({ type: 'message', message: expect.objectContaining({ conversation: JULIET }) });
        });

        it('follows one conversation, leaving the others unseen', async () => {
            await run(daemon.env, 'inbox');
            const watch = start(daemon.env, 'watch', '--inbox', '--conversation', 'Mercutio');
            await watch.started();
            expect(watch.output.stderr).toMatch(/^Watching for incoming messages in Mercutio\. Each message/);
            await receive(JULIET, 'Not followed');
            await receive(MERCUTIO, 'Followed');
            await watch.until(({ stdout }) => stdout.includes('Followed'));

            const { stdout } = await watch.stop();
            expect(lines(stdout)).toHaveLength(1);
            const inbox = await run(daemon.env, 'inbox');
            expect(inbox.stdout).toContain('"Not followed"');
            expect(inbox.stdout).not.toContain('"Followed"');
        });

        it('refuses --from and --mention, which would mark what they leave out seen', async () => {
            for (const filter of [['--from', JULIET], ['--mention']]) {
                const { code, stderr } = await run(daemon.env, 'watch', '--inbox', ...filter);
                expect(code).toBe(EXIT.ERROR);
                expect(stderr).toMatch(/^converse-cli: --inbox can't be used with --from or --mention: /);
            }
        });

        it('leaves the unseen messages unseen when --drafts is refused', async () => {
            await run(daemon.env, 'inbox');
            await receive(JULIET, 'Not lost');

            const { code, stdout } = await run(daemon.env, 'watch', '--inbox', '--drafts');
            expect(code).toBe(EXIT.ERROR);
            expect(stdout).toBe('');
            expect((await run(daemon.env, 'inbox')).stdout).toContain('"Not lost"');
        });

        it('says to restart a daemon too old for it', async () => {
            const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-old-'));
            const socket_path = path.join(dir, 'socket');
            const server = net.createServer((socket) => {
                readline.createInterface({ input: socket }).on('line', (line) => {
                    const { id, method } = JSON.parse(line);
                    const answer =
                        method === 'hello'
                            ? { result: { protocol: PROTOCOL_VERSION, consumer: 'agent', access: 'restricted' } }
                            : { error: { code: ERRORS.METHOD_NOT_FOUND, message: `Unknown method "${method}".` } };
                    socket.write(JSON.stringify({ jsonrpc: '2.0', id, ...answer }) + '\n');
                });
            });
            await new Promise((resolve) => server.listen(socket_path, () => resolve(undefined)));
            try {
                const { code, stderr } = await run({ ...daemon.env, CONVERSE_SOCKET: socket_path }, 'watch', '--inbox');
                expect(code).toBe(EXIT.ERROR);
                expect(stderr).toBe(
                    "converse-cli: The daemon running is older than this converse-cli, and can't mark what " +
                        'watch prints seen, as --inbox needs. Restart it with "converse-cli daemon stop", and ' +
                        'run watch again.\n',
                );
            } finally {
                server.close();
                await fs.rm(dir, { recursive: true, force: true });
            }
        });
    });

    it('refuses --drafts where drafts list is refused, saying why', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'watch', '--drafts');
        expect(code).toBe(EXIT.ERROR);
        expect(stdout).toBe('');
        expect(stderr).toMatch(/^converse-cli: Draft events are only available where "converse-cli drafts list" is/);
    });

    it('refuses an unknown name in a filter at once, with the lookup exit code', async () => {
        const { code, stdout, stderr } = await run(daemon.env, 'watch', '--from', 'Tybalt');
        expect(code).toBe(EXIT.NOT_FOUND);
        expect(stdout).toBe('');
        expect(stderr).toMatch(/^converse-cli: .*Tybalt/);
    });

    it('ends quietly once its reader goes away', async () => {
        const watch = start(daemon.env, 'watch');
        await watch.started();
        await receive(JULIET, 'First');
        await watch.until(({ stdout }) => stdout.includes('First'));
        watch.child.stdout.destroy();
        await receive(JULIET, 'Second, to nobody');

        const { code, stderr } = await watch.exited();
        expect(code).toBe(EXIT.OK);
        expect(stderr).not.toContain('EPIPE');
    });

    // Last, as it stops the daemon.
    it('exits as "daemon unavailable" when the daemon stops', async () => {
        const watch = start(daemon.env, 'watch');
        await watch.started();
        await daemon.daemon.stop();

        const { code, stderr } = await watch.exited();
        expect(code).toBe(EXIT.DAEMON_UNAVAILABLE);
        expect(stderr).toMatch(/converse-cli: The daemon closed the connection\.\n$/);
    });
});
