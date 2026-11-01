/**
 * Shown above the login and registration forms when the page was opened with
 * an invitation to chat with someone or to join a groupchat (a shareable link
 * or an `xmpp:` link), which is acted on once the visitor has logged in.
 *
 * Someone following a shareable link may not have an account yet, or may
 * rather use the XMPP app they already have, so it says what's waiting for
 * them and offers both. A link handed over by the browser's protocol handler
 * already chose this Converse as the app, so it only says what's waiting.
 */
export default class PendingInvitation extends CustomElement {
    onHashChange: () => void;
    render(): import("lit-html").TemplateResult<1> | "";
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=pending-invitation.d.ts.map