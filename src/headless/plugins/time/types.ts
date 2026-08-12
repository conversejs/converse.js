export type EntityTime = {
    utc: Date; // The entity's understanding of the current UTC time
    tzo: string; // The entity's numeric offset from UTC, e.g. "+05:30"
};
