import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '@converse/headless';
import { createCursors } from '../cursors.js';

describe('Read cursors', () => {
    let dir;
    let file;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'converse-cursors-'));
        file = path.join(dir, 'cursors.json');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const saved = () => JSON.parse(fs.readFileSync(file, 'utf8'));

    it('saves a burst of moves in one write, a moment after the first', () => {
        const write = vi.spyOn(fs, 'writeFileSync');
        const cursors = createCursors(file);
        for (let arrived = 1; arrived <= 50; arrived++) cursors.set('agent', 'juliet@capulet.lit', { arrived });
        expect(fs.existsSync(file)).toBe(false);

        vi.advanceTimersByTime(250);
        expect(write).toHaveBeenCalledOnce();
        expect(saved().consumers.agent.conversations['juliet@capulet.lit']).toEqual({ arrived: 50 });
        write.mockRestore();
    });

    it('saves at once what is waiting when flushed, as the daemon stops', () => {
        const cursors = createCursors(file);
        cursors.set('agent', 'juliet@capulet.lit', { arrived: 7 });
        cursors.flush();
        expect(saved().consumers.agent.conversations['juliet@capulet.lit']).toEqual({ arrived: 7 });

        // Nothing waits any more, and a restart reads what was saved.
        vi.advanceTimersByTime(250);
        expect(createCursors(file).get('agent', 'juliet@capulet.lit')).toEqual({ arrived: 7 });
    });

    it('logs a save that fails, rather than throwing from its timer, and tries again with the next change', () => {
        const error = vi.spyOn(log, 'error').mockImplementation(() => {});
        const write = vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => {
            throw new Error('No space left on device');
        });
        const cursors = createCursors(file);
        cursors.set('agent', 'juliet@capulet.lit', { arrived: 1 });
        expect(() => vi.advanceTimersByTime(250)).not.toThrow();
        expect(error).toHaveBeenCalledWith(expect.stringContaining('No space left on device'));

        cursors.set('agent', 'juliet@capulet.lit', { arrived: 2 });
        vi.advanceTimersByTime(250);
        expect(saved().consumers.agent.conversations['juliet@capulet.lit']).toEqual({ arrived: 2 });
        write.mockRestore();
        error.mockRestore();
    });
});
