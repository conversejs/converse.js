export type EntityTime = {
    utc: Date;
    tzo: string;
};
export type ContactTime = {
    tzo: string;
    time: string;
    hour: number;
    differs_by_minutes: number;
    differs_enough: boolean;
    is_off_hours: boolean;
    should_warn: boolean;
};
//# sourceMappingURL=types.d.ts.map