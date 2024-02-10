import './shared/constants.js';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import api from './shared/api/index.js';
import u from './utils/index.js';
import _converse from './shared/_converse';
_converse.api = api;

import dayjs from 'dayjs';
import i18n from './shared/i18n';
import { converse } from './shared/api/public.js';

dayjs.extend(advancedFormat);

/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */

import "./plugins/bookmarks/index.js";  // XEP-0199 XMPP Ping
import "./plugins/bosh/index.js";       // XEP-0206 BOSH
import "./plugins/caps/index.js";       // XEP-0115 Entity Capabilities
import "./plugins/chat/index.js";       // RFC-6121 Instant messaging
import "./plugins/chatboxes/index.js";
import "./plugins/disco/index.js";      // XEP-0030 Service discovery
import "./plugins/adhoc/index.js";      // XEP-0050 Ad Hoc Commands
import "./plugins/headlines/index.js";  // Support for headline messages
import "./plugins/mam/index.js";        // XEP-0313 Message Archive Management
import "./plugins/muc/index.js";        // XEP-0045 Multi-user chat
import "./plugins/ping/index.js";       // XEP-0199 XMPP Ping
import "./plugins/pubsub.js";           // XEP-0060 Pubsub
import "./plugins/roster/index.js";     // RFC-6121 Contacts Roster
import "./plugins/smacks/index.js";     // XEP-0198 Stream Management
import "./plugins/status/index.js";
import "./plugins/vcard/index.js";      // XEP-0054 VCard-temp
/* END: Removable components */

import log from './log.js';

export { api, converse, _converse, i18n, log, u };

export default converse;
