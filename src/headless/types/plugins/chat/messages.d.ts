export default Messages;
declare class Messages extends Collection {
    constructor();
    comparator: string;
    model: typeof Message;
    fetched: any;
    chatbox: any;
}
import { Collection } from "@converse/skeletor";
import Message from "./message.js";
//# sourceMappingURL=messages.d.ts.map