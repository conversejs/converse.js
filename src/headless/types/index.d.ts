export { XMPPStatus } from "./plugins/status/index.js";
export default converse;
import api from "./shared/api/index.js";
import converse from "./shared/api/public.js";
import _converse from "./shared/_converse";
import i18n from "./shared/i18n";
import log from "./log.js";
import u from "./utils/index.js";
export { api, converse, _converse, i18n, log, u };
export { ChatBox, Message, Messages } from "./plugins/chat/index.js";
export { MUCMessage, MUCMessages, MUC, MUCOccupant, MUCOccupants } from "./plugins/muc/index.js";
export { RosterContact, RosterContacts, Presence, Presences } from "./plugins/roster/index.js";
export { VCard, VCards } from "./plugins/vcard/index.js";
//# sourceMappingURL=index.d.ts.map