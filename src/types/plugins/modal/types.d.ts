export type Field = {
    type: 'text' | 'checkbox';
    label: string;
    name: string;
    challenge?: string;
    challenge_failed?: boolean;
    placeholder?: string;
    required?: boolean;
    value?: string;
};
export type ToastProperties = {
    title?: string;
    body?: string;
    name: string;
    type: 'info' | 'danger';
};
//# sourceMappingURL=types.d.ts.map