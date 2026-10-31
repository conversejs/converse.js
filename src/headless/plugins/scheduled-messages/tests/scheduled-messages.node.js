import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeSQLiteStorage, PersistentStorage } from '@converse/skeletor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduledMessages from '../collection.js';

const NOON = new Date('2026-10-26T12:00:00Z');
const LATER = new Date('2026-10-26T12:05:00Z');

describe('ScheduledMessages', () => {
    let dir;
    let storage;

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOON);
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'converse-schedules-'));
        const driver = new NodeSQLiteStorage('converse', dir, false);
        storage = new PersistentStorage('scheduled-messages', driver, false);
    });

    afterEach(async () => {
        vi.useRealTimers();
        await fs.rm(dir, { recursive: true, force: true });
    });

    const attrs = () => ({
        id: 'schedule-1',
        to: 'juliet@capulet.lit',
        body: 'Good afternoon',
        send_at: LATER.toISOString(),
        created: NOON.toISOString(),
    });

    it('dispatches a message at its scheduled time and removes it afterwards', async () => {
        const on_due = vi.fn().mockResolvedValue(undefined);
        const schedules = new ScheduledMessages([], { storage, on_due });
        await schedules.hydrated;
        await schedules.schedule(attrs());

        await schedules.resume();
        await vi.advanceTimersByTimeAsync(LATER.getTime() - NOON.getTime());

        expect(on_due).toHaveBeenCalledOnce();
        expect(on_due.mock.calls[0][0].toJSON()).toEqual(attrs());
        expect(schedules).toHaveLength(0);
    });

    it('does not dispatch a cancelled message', async () => {
        const on_due = vi.fn().mockResolvedValue(undefined);
        const schedules = new ScheduledMessages([], { storage, on_due });
        await schedules.hydrated;
        await schedules.schedule(attrs());

        expect((await schedules.cancel('schedule-1')).toJSON()).toEqual(attrs());
        await schedules.resume();
        await vi.advanceTimersByTimeAsync(LATER.getTime() - NOON.getTime());

        expect(on_due).not.toHaveBeenCalled();
    });

    it('keeps a parked message stored without retrying it, and does not hold back later messages', async () => {
        const on_due = vi.fn((scheduled) =>
            scheduled.id === 'schedule-1' ? { park: { rule: 'allowlist' } } : undefined,
        );
        const schedules = new ScheduledMessages([], { storage, on_due });
        await schedules.hydrated;
        await schedules.schedule(attrs());
        await schedules.schedule({
            ...attrs(),
            id: 'schedule-2',
            send_at: new Date(LATER.getTime() + 60_000).toISOString(),
        });

        await schedules.resume();
        await vi.advanceTimersByTimeAsync(LATER.getTime() - NOON.getTime() + 120_000);

        expect(on_due.mock.calls.map(([scheduled]) => scheduled.id)).toEqual(['schedule-1', 'schedule-2']);
        expect(schedules.models.map((scheduled) => scheduled.id)).toEqual(['schedule-1']);
        expect(schedules.get('schedule-1').get('parked')).toEqual({
            rule: 'allowlist',
            at: new Date(LATER.getTime()).toISOString(),
        });
    });

    it('tries a failing message again, waiting longer each time, without holding back later messages', async () => {
        const on_due = vi.fn((scheduled) => {
            if (scheduled.id === 'schedule-1') throw new Error('Not in the room');
        });
        const schedules = new ScheduledMessages([], { storage, on_due, retry_delay: 1000, max_failures: 3 });
        await schedules.hydrated;
        await schedules.schedule(attrs());
        await schedules.schedule({
            ...attrs(),
            id: 'schedule-2',
            send_at: new Date(LATER.getTime() + 10).toISOString(),
        });

        await schedules.resume();
        await vi.advanceTimersByTimeAsync(LATER.getTime() - NOON.getTime() + 10);
        // The later message went out although the first one failed before it.
        expect(on_due.mock.calls.map(([scheduled]) => scheduled.id)).toEqual(['schedule-1', 'schedule-2']);
        expect(schedules.models.map((scheduled) => scheduled.id)).toEqual(['schedule-1']);

        await vi.advanceTimersByTimeAsync(999);
        expect(on_due).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(2000);
        expect(on_due).toHaveBeenCalledTimes(4);

        expect(schedules.get('schedule-1').get('parked')).toEqual({
            rule: 'failed',
            message: 'Sending it failed 3 times: Not in the room',
            at: expect.any(String),
        });
        await vi.advanceTimersByTimeAsync(60_000);
        expect(on_due).toHaveBeenCalledTimes(4);
    });

    it('tries a message that can only wait again later, however often, and sends it then', async () => {
        let held = 7;
        const on_due = vi.fn(() => (held-- > 0 ? { retry: true } : undefined));
        const schedules = new ScheduledMessages([], { storage, on_due, retry_delay: 1000, max_failures: 3 });
        await schedules.hydrated;
        await schedules.schedule(attrs());

        await schedules.resume();
        await vi.advanceTimersByTimeAsync(LATER.getTime() - NOON.getTime() + 7000);

        expect(on_due).toHaveBeenCalledTimes(8);
        expect(schedules).toHaveLength(0);
    });

    it('rehydrates a message and dispatches it immediately when it became due while stopped', async () => {
        const first = new ScheduledMessages([], { storage, on_due: vi.fn() });
        await first.hydrated;
        await first.schedule(attrs());
        first.pause();

        vi.setSystemTime(new Date('2026-10-26T12:10:00Z'));
        const on_due = vi.fn().mockResolvedValue(undefined);
        const restarted = new ScheduledMessages([], { storage, on_due });
        await restarted.hydrated;
        await restarted.resume();

        expect(restarted).toHaveLength(0);
        expect(on_due).toHaveBeenCalledOnce();
        expect(on_due.mock.calls[0][0].id).toBe('schedule-1');
    });
});
