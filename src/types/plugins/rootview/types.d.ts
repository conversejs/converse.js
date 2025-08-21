import { TemplateResult } from 'lit';
export type App = {
    name: string;
    render: () => TemplateResult;
    renderControlbox?: () => TemplateResult;
    active: boolean;
};
//# sourceMappingURL=types.d.ts.map