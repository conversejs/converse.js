export default class ModeratorTools extends CustomElement {
    static get properties(): {
        affiliation: {
            type: StringConstructor;
        };
        affiliations_filter: {
            type: StringConstructor;
            attribute: boolean;
        };
        alert_message: {
            type: StringConstructor;
            attribute: boolean;
        };
        alert_type: {
            type: StringConstructor;
            attribute: boolean;
        };
        jid: {
            type: StringConstructor;
        };
        muc: {
            type: ObjectConstructor;
            attribute: boolean;
        };
        role: {
            type: StringConstructor;
        };
        roles_filter: {
            type: StringConstructor;
            attribute: boolean;
        };
        tab: {
            type: StringConstructor;
        };
        users_with_affiliation: {
            type: ArrayConstructor;
            attribute: boolean;
        };
        users_with_role: {
            type: ArrayConstructor;
            attribute: boolean;
        };
    };
    jid: any;
    tab: string;
    affiliation: any;
    affiliations_filter: string;
    roles_filter: string;
    /** @type {import('@converse/headless').MUCOccupant[]} */
    users_with_affiliation: import("@converse/headless").MUCOccupant[];
    /** @type {import('@converse/headless').MUCOccupant[]} */
    users_with_role: import("@converse/headless").MUCOccupant[];
    initialize(): Promise<void>;
    initialized: Promise<any> & {
        isResolved: boolean;
        isPending: boolean;
        isRejected: boolean;
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
    };
    muc: any;
    render(): import("lit-html").TemplateResult<1> | "";
    switchTab(ev: Event): void;
    onSearchAffiliationChange(): Promise<void>;
    loading_users_with_affiliation: boolean;
    onSearchRoleChange(): Promise<void>;
    shouldFetchAffiliationsList(): boolean;
    /** @param {Event} ev */
    toggleForm(ev: Event): void;
    /** @param {Event} ev */
    filterRoleResults(ev: Event): void;
    filterAffiliationResults(ev: Event): void;
    queryRole(ev: Event): void;
    queryAffiliation(ev: Event): void;
    alert(message: string, type: string): void;
    alert_message: string;
    alert_type: string;
    clearAlert(): void;
}
export type NonOutcastAffiliation = any;
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=modtools.d.ts.map