import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(advancedFormat);

import { _converse, api, constants as shared_constants, i18n, parsers } from './shared/index.js';
import u from './utils/index.js';
import converse from './shared/api/public.js';
import log from './log.js';


// START: Removable components
// ---------------------------
// The following components may be removed if they're not needed.

export { EmojiPicker } from './plugins/emoji/index.js';
export { Bookmark, Bookmarks } from './plugins/bookmarks/index.js'; // XEP-0199 XMPP Ping
import './plugins/bosh/index.js'; // XEP-0206 BOSH
import './plugins/caps/index.js'; // XEP-0115 Entity Capabilities
export { ChatBox, Message, Messages } from './plugins/chat/index.js'; // RFC-6121 Instant messaging
import './plugins/chatboxes/index.js';
import './plugins/disco/index.js'; // XEP-0030 Service discovery
import './plugins/adhoc/index.js'; // XEP-0050 Ad Hoc Commands
import './plugins/headlines/index.js'; // Support for headline messages

import ModelWithMessages from './shared/model-with-messages.js';
export { ModelWithMessages };

// XEP-0313 Message Archive Management
export { MAMPlaceholderMessage } from './plugins/mam/index.js';

// XEP-0045 Multi-user chat
export { MUCMessage, MUCMessages, MUC, MUCOccupant, MUCOccupants } from './plugins/muc/index.js';


import './plugins/ping/index.js'; // XEP-0199 XMPP Ping
import './plugins/pubsub.js'; // XEP-0060 Pubsub

// RFC-6121 Contacts Roster
export { RosterContact, RosterContacts, RosterFilter, Presence, Presences } from './plugins/roster/index.js';

import './plugins/smacks/index.js'; // XEP-0198 Stream Management
export { XMPPStatus } from './plugins/status/index.js';
export { VCard, VCards } from './plugins/vcard/index.js'; // XEP-0054 VCard-temp
// ---------------------------
// END: Removable components

import * as muc_constants from './plugins/muc/constants.js';
const constants = Object.assign({}, shared_constants, muc_constants);

Object.assign(_converse.constants, constants);

export { api, converse, _converse, i18n, log, u, constants, parsers };

export default converse;
