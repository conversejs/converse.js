export type EntityTime = {
    utc: Date; // The entity's understanding of the current UTC time
    tzo: string; // The entity's numeric offset from UTC, e.g. "+05:30"
};

export type ContactTime = {
    tzo: string; // Their numeric offset from UTC, e.g. "+05:30"
    time: string; // Their local time right now, written the way the UI locale writes times
    hour: number; // Their local hour right now, 0-23
    differs_by_minutes: number; // How far their offset is from ours, absolute
    differs_enough: boolean; // Whether diff clears entity_time_min_diff_hours, and so if contact can be warned
    is_off_hours: boolean; // Whether their local hour falls in the warning window
    should_warn: boolean; // Whether a UI should warn about messaging them now
};
