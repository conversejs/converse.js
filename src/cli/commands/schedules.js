/**
 * Messages waiting for their delivery time.
 * @module @converse/cli/commands/schedules
 */
import { request, takeOne } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatJSON, formatSchedule } from '../format.js';
import { FULL } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const SCHEDULES_COMMANDS = {
    'schedules list': {
        summary: 'List messages waiting for their delivery time',
        description:
            'List the messages scheduled with send --at that are still waiting: id, delivery time, ' +
            'recipient and text. One that policy refused when it became due, or that kept failing ' +
            'to send, is marked NOT SENT, with the reason. One a rate limit held back is tried again later.',
        options: [FULL],
        examples: ['converse-cli schedules list'],
        async run(ctx) {
            const { options, out, err } = ctx;
            /** @type {{ schedules: import('@converse/daemon/types').ScheduleDTO[] }} */
            const { schedules } = await request(ctx, 'schedules.list');
            if (options.json) {
                schedules.forEach((schedule) => out(formatJSON(schedule)));
            } else if (schedules.length) {
                schedules.forEach((schedule) => out(formatSchedule(schedule, { full: options.full })));
            } else {
                err('No scheduled messages.\n');
            }
            return EXIT.OK;
        },
    },
    'schedules cancel': {
        summary: 'Cancel a scheduled message',
        description: 'Cancel a scheduled message. Nothing is sent.',
        args: [['<id>', 'The scheduled message id, as schedules list printed it']],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli schedules cancel s3'],
        async run(ctx) {
            const { options, out } = ctx;
            const id = takeOne(ctx, 'scheduled message id');
            /** @type {{ schedule: import('@converse/daemon/types').ScheduleDTO }} */
            const { schedule } = await request(ctx, 'schedules.cancel', { id });
            if (options.json) {
                out(formatJSON(schedule));
            } else {
                out(`Cancelled scheduled message ${schedule.id}. Nothing was sent.\n`);
            }
            return EXIT.OK;
        },
    },
};
