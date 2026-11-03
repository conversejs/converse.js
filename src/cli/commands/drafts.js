/**
 * Drafts, which the owner decides on.
 * @module @converse/cli/commands/drafts
 */
import { reportSend, request, requestDrafts, takeOne } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatDraft, formatDraftDetails, formatJSON } from '../format.js';
import { DRAFT_ID, FULL } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const DRAFTS_COMMANDS = {
    'drafts list': {
        summary: 'List the drafts not yet sent or withdrawn',
        description:
            'List the drafts not yet sent or withdrawn: id, when it was made, who it is for, what ' +
            "it acts on, and its text. Drafts are the owner's to decide on, so this connects at " +
            'full access, and fails for a client that only has restricted access. In as_user, ' +
            'where drafts wait in the daemon, it connects at the configured access, so that an ' +
            'agent can say which of its drafts are still waiting.',
        options: [FULL],
        examples: ['converse-cli drafts list'],
        // Drafts are the user's to decide on, so these ask for full access, except
        // that in "as_user" mode an agent may see which drafts are still waiting.
        async run(ctx) {
            const { options, out, err } = ctx;
            /** @type {{ drafts: import('@converse/daemon/types').Draft[] }} */
            const { drafts } = await requestDrafts(ctx, 'drafts.list', {});
            if (options.json) {
                drafts.forEach((d) => out(formatJSON(d)));
            } else if (drafts.length) {
                const now = new Date();
                drafts.forEach((d) => out(formatDraft(d, { full: options.full, now })));
            } else {
                err('No drafts.\n');
            }
            return EXIT.OK;
        },
    },
    'drafts show': {
        summary: 'Show one draft in full, to review it',
        description:
            'Show one draft in full: who it is for, who made it and when, the message it replies ' +
            'to, corrects, retracts or reacts to, and its text as written, over as many lines as ' +
            'it has. The text is last, and was written by the agent that made the draft. Available ' +
            'wherever drafts list is.',
        args: [DRAFT_ID],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli drafts show d17'],
        async run(ctx) {
            const { options, out } = ctx;
            const id = takeOne(ctx, 'draft id');
            /** @type {{ draft: import('@converse/daemon/types').Draft, target: import('@converse/daemon/types').MessageDTO|null }} */
            const { draft, target } = await requestDrafts(ctx, 'drafts.get', { id });
            out(options.json ? formatJSON(draft) : formatDraftDetails(draft, target));
            return EXIT.OK;
        },
    },
    'drafts send': {
        summary: 'Send a draft as the user (as_user, full access)',
        description:
            'Send a draft as the user, as it was asked for: a message, a reply, a correction, a ' +
            'retraction or a reaction. The draft is then gone. The outcome is reported as send ' +
            'reports it. If it could not be sent, the draft is kept. Only in as_user mode, and ' +
            'only at full access: this is how the user approves a draft, so an agent never can. ' +
            'In the other modes the text of a draft went to the owner, who sends it from their ' +
            'own client, so this fails.',
        args: [DRAFT_ID],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli drafts send d17'],
        async run(ctx) {
            const id = takeOne(ctx, 'draft id');
            /** @type {import('@converse/daemon/types').SendResult} */
            const result = await request(ctx, 'drafts.send', { id }, { access: 'full' });
            return reportSend(result, ctx);
        },
    },
    'drafts reject': {
        summary: 'Withdraw a draft (full access)',
        description:
            'Withdraw a draft. Nothing is sent. Where drafts are delivered to the owner, the owner ' +
            'is told. Full access only.',
        args: [DRAFT_ID],
        exits: [EXIT.NOT_FOUND],
        examples: ['converse-cli drafts reject d17'],
        async run(ctx) {
            const { options, out } = ctx;
            const id = takeOne(ctx, 'draft id');
            /** @type {{ draft: import('@converse/daemon/types').Draft }} */
            const { draft } = await request(ctx, 'drafts.reject', { id }, { access: 'full' });
            if (options.json) {
                out(formatJSON(draft));
            } else {
                out(`Withdrew draft ${draft.id}. Nothing was sent.\n`);
            }
            return EXIT.OK;
        },
    },
};
