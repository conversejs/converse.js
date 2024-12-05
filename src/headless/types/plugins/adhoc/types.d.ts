import { XForm } from '../../shared/types';
export type AdHocCommand = {
    action: string;
    node: string;
    sessionid: string;
    status: string;
};
type AdHocCommandResultNote = {
    text: string;
    type: 'info' | 'warn' | 'error';
};
export type AdHocCommandAttrs = {
    sessionid: string;
    actions?: string[];
    note?: AdHocCommandResultNote;
};
export type AdHocCommandResult = XForm & AdHocCommandAttrs;
export type AdHocCommandAction = 'execute' | 'cancel' | 'prev' | 'next' | 'complete';
export {};
//# sourceMappingURL=types.d.ts.map