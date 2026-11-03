/**
 * Contacts on the roster, and who they are.
 * @module @converse/cli/commands/contacts
 */
import { request, takeOne } from '../context.js';
import { EXIT } from '../exit-codes.js';
import { formatContact, formatContactDetails, formatJSON, quote } from '../format.js';
import { CONTACT, LOOKUP_EXITS } from './shared.js';

/** @type {Record<string, import('../types').Command>} */
export const CONTACTS_COMMANDS = {
    contacts: {
        summary: 'List your roster contacts with their presence',
        description:
            "List your roster contacts: JID, presence, and name. A query matches a contact's name or " +
            'JID, ignoring case.',
        args: [['[query]', 'Only contacts whose name or JID contains this']],
        examples: ['converse-cli contacts juliet'],
        async run(ctx) {
            const { args, options, out, err } = ctx;
            const query = args.length ? args.join(' ') : undefined;
            /** @type {{ contacts: import('@converse/daemon/types').ContactSummary[] }} */
            const { contacts } = await request(ctx, 'contacts.list', { query });
            if (options.json) {
                contacts.forEach((c) => out(formatJSON(c)));
            } else if (contacts.length) {
                contacts.forEach((c) => out(formatContact(c)));
            } else {
                err(query === undefined ? 'No contacts.\n' : `No contacts match ${quote(query)}.\n`);
            }
            return EXIT.OK;
        },
    },
    whois: {
        summary: "Show a contact's vCard and connected clients",
        description:
            "Show a contact's vCard, and each client they are connected with, with the identities " +
            'each client advertises. A client advertising client/bot says so of itself: it is a ' +
            'label, not a proof.',
        args: [CONTACT],
        exits: LOOKUP_EXITS,
        examples: ['converse-cli whois "Juliet Capulet"'],
        async run(ctx) {
            const { options, out } = ctx;
            const jid = takeOne(ctx, 'contact');
            /** @type {import('@converse/daemon/types').ContactDetails} */
            const details = await request(ctx, 'contacts.whois', { jid });
            out(options.json ? formatJSON(details) : formatContactDetails(details));
            return EXIT.OK;
        },
    },
};
