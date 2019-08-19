/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "./converse-bookmarks";   // XEP-0199 XMPP Ping
import "./converse-bosh";        // XEP-0206 BOSH
import "./converse-caps";        // XEP-0115 Entity Capabilities
import "./converse-chatboxes";   // Backbone Collection and Models for chat boxes
import "./converse-disco";       // XEP-0030 Service discovery
import "./converse-mam";         // XEP-0313 Message Archive Management
import "./converse-muc";         // XEP-0045 Multi-user chat
import "./converse-ping";        // XEP-0199 XMPP Ping
import "./converse-pubsub";      // XEP-0060 Pubsub
import "./converse-roster";      // Contacts Roster
import "./converse-rsm";         // XEP-0059 Result Set management
import "./converse-smacks";      // XEP-0198 Stream Management
import "./converse-vcard";       // XEP-0054 VCard-temp
/* END: Removable components */

import converse from "./converse-core";

export default converse;
