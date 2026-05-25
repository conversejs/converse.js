import { TemplateResult } from 'lit';
import Suggestion from './suggestion';
export type closeParam = {
    reason: string;
};
export type AutoCompleteData = {
    label: string;
    value: string;
};
export type AutoCompleteConfig = {
    ac_triggers?: string[];
    auto_evaluate?: boolean;
    auto_first?: boolean;
    data?: (a: Suggestion, value: string) => AutoCompleteData;
    filter?: (text: string, input: string) => boolean;
    include_triggers?: string[];
    item?: (text: Suggestion | string, input: string) => TemplateResult;
    list?: () => Array<AutoCompleteData>;
    match_current_word?: boolean;
    max_items?: number;
    min_chars?: number;
    sort?: (a: Suggestion, b: Suggestion) => number | false;
    suffix?: string;
};
//# sourceMappingURL=types.d.ts.map