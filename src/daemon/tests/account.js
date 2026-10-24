/**
 * A throwaway account for daemon and CLI specs. Free of any
 * `@converse/headless` import, so that a CLI spec using it doesn't load one.
 */
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const JID = 'romeo@montague.lit/orchard';

/** The user's own account, which drafts are delivered to. */
export const BENVOLIO = 'benvolio@montague.lit';

// Headless opens its database once per process and keeps it, whatever
// `storage_path` a later `converse.initialize` names. So the daemons a spec
// file starts share one storage directory, removed when the file is done.
const STORAGE_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), 'converse-daemon-storage-'));
process.once('exit', () => fsSync.rmSync(STORAGE_DIR, { recursive: true, force: true }));

/**
 * Creates a throwaway home for one account: XDG config, runtime and state
 * directories under a temporary directory, with a config file that puts the
 * daemon on the MockConnection.
 * @param {Record<string, unknown>} [settings] - More headless settings for the daemon
 * @param {Record<string, unknown>} [config] - More of the account configuration, such as a send policy
 * @returns {Promise<{ env: NodeJS.ProcessEnv, remove: () => Promise<void> }>}
 */
export async function createAccount(settings = {}, config = {}) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-daemon-test-'));
    const env = {
        ...process.env,
        XDG_CONFIG_HOME: path.join(dir, 'config'),
        XDG_RUNTIME_DIR: path.join(dir, 'run'),
        XDG_STATE_HOME: path.join(dir, 'state'),
    };
    await fs.mkdir(path.join(env.XDG_CONFIG_HOME, 'converse'), { recursive: true });
    await fs.writeFile(
        path.join(env.XDG_CONFIG_HOME, 'converse', 'daemon.json'),
        JSON.stringify({
            jid: 'romeo@montague.lit',
            owner: BENVOLIO,
            password: 'secret',
            websocket_url: 'ws://montague.lit/xmpp-websocket',
            resource: 'orchard',
            ...config,
            settings: {
                // This BOSH URL is what makes headless pick its MockConnection
                // (see `isTestEnv`). BOSH itself is disabled under Node, so the
                // transport the mock stands in for is the websocket above.
                bosh_service_url: 'montague.lit/http-bind',
                discover_connection_methods: false,
                enable_smacks: false,
                loglevel: 'error',
                storage_path: STORAGE_DIR,
                ...settings,
            },
        }),
    );
    return { env, remove: () => fs.rm(dir, { recursive: true, force: true }) };
}
