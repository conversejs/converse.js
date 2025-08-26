import { TemplateResult } from 'lit';

export type App = {
    name: string;
    render: () => TemplateResult;
    renderControlbox?: () => TemplateResult;
};
