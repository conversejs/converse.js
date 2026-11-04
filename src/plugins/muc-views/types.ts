import type { ChannelSearchItem } from '@converse/headless';
import { AutoCompleteData } from 'shared/autocomplete/types';

export type MUCInvitationObj = { contact: any; jid: string; reason: string };

export type Role = 'moderator' | 'participant' | 'visitor';

export type Affiliation = 'owner' | 'admin' | 'outcast';

// A groupchat found by searching, as an autocomplete suggestion
export type RoomData = AutoCompleteData<ChannelSearchItem>;
