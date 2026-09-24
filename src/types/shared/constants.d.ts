export const VIEW_PLUGINS: string[];
export namespace PRETTY_CHAT_STATUS {
    let offline: any;
    let unavailable: any;
    let xa: any;
    let away: any;
    let dnd: any;
    let chat: any;
    let online: any;
}
export const MOBILE_CUTOFF: 576;
export const MOBILE_LANDSCAPE_CUTOFF: 450;
export const CONTROLBOX_FULLPAGE_CUTOFF: 768;
export const OCCUPANTS_SIDEBAR_CUTOFF: 768;
export const MOBILE_MEDIA_QUERY: "(max-width: 575.98px), (max-height: 450px)";
export const CONTROLBOX_FULLPAGE_MEDIA_QUERY: "(max-width: 767.98px)";
export const OCCUPANTS_SIDEBAR_MEDIA_QUERY: "(max-width: 767.98px)";
export type PrettyChatStatus = {
    offline: string;
    unavailable: string;
    xa: string;
    away: string;
    dnd: string;
    chatty: string;
    online: string;
};
//# sourceMappingURL=constants.d.ts.map