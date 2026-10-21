import { XForm } from '../../shared/types';
export type AdHocCommand = {
    action: string;
    node: string;
    sessionid: string;
    status: string;
};
export type AdHocCommandNoteType = 'info' | 'warn' | 'error';
export type AdHocCommandResultNote = {
    text: string;
    type: AdHocCommandNoteType;
};
export type AdHocCommandAttrs = {
    sessionid: string;
    actions?: string[];
    note?: AdHocCommandResultNote;
};
export type AdHocCommandResult = XForm & AdHocCommandAttrs;
export type AdHocCommandAction = 'execute' | 'cancel' | 'prev' | 'next' | 'complete';
//# sourceMappingURL=types.d.ts.map