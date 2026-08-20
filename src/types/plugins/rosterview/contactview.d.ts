export default class RosterContactView extends ObservableElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
    /** Whether this contact advertises a XEP-0472 social feed (resolved async). */
    can_follow: boolean;
    /**
     * Resolve (asynchronously, via cached disco/caps) whether this contact has a
     * social feed that can be followed, then re-render so the Follow toggle
     * appears once known.
     */
    updateFollowable(): Promise<void>;
    /**
     * Follow or unfollow this contact's social feed (XEP-0277/0472 over
     * XEP-0330), toggling on the current follow state.
     * @param {MouseEvent} ev
     */
    toggleFollow(ev: MouseEvent): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    openChat(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    addContact(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    removeContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    showUserDetailsModal(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    blockContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    acceptRequest(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    declineRequest(ev: MouseEvent): Promise<void>;
}
import { ObservableElement } from 'shared/components/observable.js';
//# sourceMappingURL=contactview.d.ts.map