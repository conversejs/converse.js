#!/usr/bin/env node
// Regenerates the table of supported XEPs and RFCs in README.md from
// conversejs.doap, so the two can't drift apart.
//
//   node scripts/readme-xeps.mjs           rewrite README.md
//   node scripts/readme-xeps.mjs --check   exit 1 if README.md is out of date
//
// The table lives between the <!-- xeps:start --> and <!-- xeps:end -->
// markers in README.md. DOAP doesn't record a XEP's title, so titles come from
// NAMES below. When the DOAP file gains a new XEP or RFC, add its title there.
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const DOAP = 'conversejs.doap';
const README = 'README.md';
const START = '<!-- xeps:start -->';
const END = '<!-- xeps:end -->';

// XEP titles are exactly as given in each spec. RFC titles drop their
// "Extensible Messaging and Presence Protocol" prefix to fit the table.
const NAMES = {
    'rfc6120': 'XMPP: Core',
    'rfc6121': 'XMPP: Instant Messaging and Presence',
    'rfc6122': 'XMPP: Address Format',
    'rfc7395': 'XMPP Subprotocol for WebSocket',
    'rfc7590': 'Use of Transport Layer Security (TLS) in XMPP',
    'xep-0004': 'Data Forms',
    'xep-0030': 'Service Discovery',
    'xep-0045': 'Multi-User Chat',
    'xep-0048': 'Bookmarks',
    'xep-0050': 'Ad-Hoc Commands',
    'xep-0054': 'vcard-temp',
    'xep-0059': 'Result Set Management',
    'xep-0060': 'Publish-Subscribe',
    'xep-0066': 'Out of Band Data',
    'xep-0077': 'In-Band Registration',
    'xep-0085': 'Chat State Notifications',
    'xep-0092': 'Software Version',
    'xep-0115': 'Entity Capabilities',
    'xep-0122': 'Data Forms Validation',
    'xep-0124': 'Bidirectional-streams Over Synchronous HTTP (BOSH)',
    'xep-0144': 'Roster Item Exchange',
    'xep-0147': 'XMPP URI Scheme Query Components',
    'xep-0153': 'vCard-Based Avatars',
    'xep-0156': 'Discovering Alternative XMPP Connection Methods',
    'xep-0163': 'Personal Eventing Protocol',
    'xep-0166': 'Jingle',
    'xep-0167': 'Jingle RTP Sessions',
    'xep-0172': 'User Nickname',
    'xep-0176': 'Jingle ICE-UDP Transport Method',
    'xep-0184': 'Message Delivery Receipts',
    'xep-0191': 'Blocking Command',
    'xep-0198': 'Stream Management',
    'xep-0199': 'XMPP Ping',
    'xep-0202': 'Entity Time',
    'xep-0203': 'Delayed Delivery',
    'xep-0206': 'XMPP Over BOSH',
    'xep-0215': 'External Service Discovery',
    'xep-0223': 'Persistent Storage of Private Data via PubSub',
    'xep-0245': 'The /me Command',
    'xep-0249': 'Direct MUC Invitations',
    'xep-0277': 'Microblogging over XMPP',
    'xep-0280': 'Message Carbons',
    'xep-0293': 'Jingle RTP Feedback Negotiation',
    'xep-0294': 'Jingle RTP Header Extensions Negotiation',
    'xep-0297': 'Stanza Forwarding',
    'xep-0308': 'Last Message Correction',
    'xep-0313': 'Message Archive Management',
    'xep-0317': 'Hats',
    'xep-0319': 'Last User Interaction in Presence',
    'xep-0320': 'Use of DTLS-SRTP in Jingle Sessions',
    'xep-0330': 'Pubsub Subscription',
    'xep-0333': 'Displayed Markers',
    'xep-0338': 'Jingle Grouping Framework',
    'xep-0339': 'Source-Specific Media Attributes in Jingle',
    'xep-0352': 'Client State Indication',
    'xep-0353': 'Jingle Message Initiation',
    'xep-0357': 'Push Notifications',
    'xep-0359': 'Unique and Stable Stanza IDs',
    'xep-0363': 'HTTP File Upload',
    'xep-0371': 'Jingle ICE Transport Method',
    'xep-0372': 'References',
    'xep-0382': 'Spoiler messages',
    'xep-0384': 'OMEMO Encryption',
    'xep-0392': 'Consistent Color Generation',
    'xep-0393': 'Message Styling',
    'xep-0402': 'PEP Native Bookmarks',
    'xep-0410': "MUC Self-Ping (Schrödinger's Chat)",
    'xep-0420': 'Stanza Content Encryption',
    'xep-0421': 'Occupant identifiers for semi-anonymous MUCs',
    'xep-0422': 'Message Fastening',
    'xep-0424': 'Message Retraction',
    'xep-0425': 'Moderated Message Retraction',
    'xep-0431': 'Full Text Search in MAM',
    'xep-0433': 'Extended Channel Search',
    'xep-0437': 'Room Activity Indicators',
    'xep-0444': 'Message Reactions',
    'xep-0454': 'OMEMO Media sharing',
    'xep-0461': 'Message Replies',
    'xep-0469': 'Bookmark Pinning',
    'xep-0472': 'Pubsub Social Feed',
};

const unescapeXml = (s) =>
    s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');

// DOAP text is plain text, but a table cell is markdown: collapse line breaks,
// escape backslashes before pipes (or `\|` would become an escaped backslash
// followed by a column break), and keep `<` from opening an HTML tag.
const cell = (s) => s.replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/</g, '&lt;');

const field = (block, name) => {
    const m = block.match(new RegExp(`<xmpp:${name}>([\\s\\S]*?)</xmpp:${name}>`));
    return m ? unescapeXml(m[1]) : '';
};

function parseDoap(xml) {
    const rfcPattern = /<implements\s+rdf:resource="(https:\/\/www\.rfc-editor\.org\/info\/(rfc\d+))"\s*\/>/g;
    const rfcs = [...xml.matchAll(rfcPattern)].map(([, url, id]) => ({
        id,
        url,
        label: id.replace('rfc', 'RFC '),
        status: '',
        since: '',
        note: '',
    }));
    const xeps = [...xml.matchAll(/<xmpp:SupportedXep>([\s\S]*?)<\/xmpp:SupportedXep>/g)].map(([, block]) => {
        const url = block.match(/<xmpp:xep\s+rdf:resource="([^"]+)"/)?.[1];
        const id = url?.match(/(xep-\d{4})\.html$/)?.[1];
        if (!id) throw new Error(`Can't read the XEP URL in this DOAP entry:\n${block.trim()}`);
        return {
            id,
            url,
            label: id.toUpperCase(),
            status: field(block, 'status'),
            since: field(block, 'since'),
            note: field(block, 'note'),
        };
    });
    xeps.sort((a, b) => a.id.localeCompare(b.id));
    return [...rfcs, ...xeps];
}

function render(specs) {
    const missing = specs.filter((s) => !NAMES[s.id]).map((s) => s.id);
    if (missing.length) {
        const them = missing.length > 1 ? 'them' : 'it';
        throw new Error(`No title for ${missing.join(', ')}. Add ${them} to NAMES in scripts/readme-xeps.mjs.`);
    }
    const status = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
    const rows = specs.map((s) =>
        [`[${s.label}](${s.url})`, NAMES[s.id], status(s.status), s.since, s.note].map(cell).join(' | '),
    );
    const xepCount = specs.filter((s) => s.id.startsWith('xep-')).length;
    const rfcCount = specs.length - xepCount;
    return [
        START,
        `<summary><strong>View all ${xepCount} supported XEPs and ${rfcCount} RFCs</strong></summary>`,
        '',
        '| Spec | Name | Status | Since | Notes |',
        '| --- | --- | --- | --- | --- |',
        ...rows.map((r) => `| ${r} |`),
        END,
    ].join('\n');
}

function main() {
    const readme = readFileSync(README, 'utf8');
    const start = readme.indexOf(START);
    const end = readme.indexOf(END);
    if (start === -1 || end === -1 || end < start) {
        throw new Error(`${README} needs the ${START} and ${END} markers around the XEP table.`);
    }
    const table = render(parseDoap(readFileSync(DOAP, 'utf8')));
    const updated = readme.slice(0, start) + table + readme.slice(end + END.length);
    if (updated === readme) return;

    if (process.argv.includes('--check')) {
        throw new Error(
            `The XEP table in ${README} doesn't match ${DOAP}. Run \`make readme-xeps\` and commit the result.`,
        );
    }
    writeFileSync(README, updated);
    console.log(`Updated the XEP table in ${README}.`);
}

try {
    main();
} catch (e) {
    console.error(e.message);
    process.exitCode = 1;
}
