import RosterContact from "@converse/headless/types/plugins/roster/contact"
import Profile from "@converse/headless/types/plugins/status/profile"

export type ContactsMap = {
    [Key: string]: (Profile|RosterContact)[]
}
