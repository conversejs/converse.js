import { _converse } from "@converse/headless/core";
import { JINGLE_CALL_STATUS } from "./constants.js";

export function startJingleCall(jid) {
    const model = _converse.chatboxes.get(jid);
    model.save('jingle_status', JINGLE_CALL_STATUS.PENDING);
}
