export default class ModeratorTools {
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
    tab: string;
    affiliation: string;
    affiliations_filter: string;
    role: string;
    roles_filter: string;
    updated(changed: any): void;
    initialize(): Promise<void>;
    initialized: any;
    muc: any;
    render(): "" | import("lit-html").TemplateResult<1>;
    switchTab(ev: any): void;
    onSearchAffiliationChange(): Promise<void>;
    loading_users_with_affiliation: boolean;
    users_with_affiliation: any;
    onSearchRoleChange(): Promise<void>;
    users_with_role: any;
    shouldFetchAffiliationsList(): boolean;
    toggleForm(ev: any): void;
    filterRoleResults(ev: any): void;
    filterAffiliationResults(ev: any): void;
    queryRole(ev: any): void;
    queryAffiliation(ev: any): void;
    alert(message: any, type: any): void;
    alert_message: any;
    alert_type: any;
    clearAlert(): void;
    assignAffiliation(ev: any): Promise<void>;
    assignRole(ev: any): void;
}
