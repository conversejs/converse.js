import type { Profile, RosterContact } from '@converse/headless';

export type ContactsMap = {
    [Key: string]: (Profile | RosterContact)[];
};
