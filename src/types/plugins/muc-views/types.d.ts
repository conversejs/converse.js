import { ChannelSearchItem } from '@converse/headless/types/plugins/muc/types';
import { AutoCompleteData } from 'shared/autocomplete/types';
export type MUCInvitationObj = {
    contact: any;
    jid: string;
    reason: string;
};
export type Role = 'moderator' | 'participant' | 'visitor';
export type Affiliation = 'owner' | 'admin' | 'outcast';
export type RoomData = AutoCompleteData<ChannelSearchItem>;
//# sourceMappingURL=types.d.ts.map