/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "./converse-pubsub";      // XEP-0199 XMPP Ping
import "./converse-chatboxes";   // Backbone Collection and Models for chat boxes
import "./converse-disco";       // Service discovery plugin
import "./converse-mam";         // XEP-0313 Message Archive Management
import "./converse-muc";         // XEP-0045 Multi-user chat
import "./converse-ping";        // XEP-0199 XMPP Ping
import "./converse-roster";      // Contacts Roster
import "./converse-vcard";       // XEP-0054 VCard-temp
import "./converse-caps";        // XEP-0115 Entity Capabilities
/* END: Removable components */

import converse from "./converse-core";

export default converse;
