/**
 * The audit log: one JSON line for every send and every refusal, from any
 * connection. Lines are only ever appended, so the file is a record of what
 * happened, and nothing rewrites it.
 * @module @converse/daemon/audit
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} file - In the account's state directory
 */
export function createAudit(file) {
    return {
        /**
         * @param {import('./types').AuditEntry} entry
         */
        record(entry) {
            fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
            const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
            fs.appendFileSync(file, line + '\n', { mode: 0o600 });
        },
    };
}
