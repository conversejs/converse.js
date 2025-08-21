import { TemplateResult } from 'lit';

export type App = {
    name: string;
    render: TemplateResult;
    active: boolean;
};
