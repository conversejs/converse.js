export type Field = {
    type: 'text'|'checkbox'
    label: string; // The form label for the input field.
    name: string; // The name for the input field.
    challenge?: string; // A challenge value that must be provided by the user.
    challenge_failed?: boolean;
    placeholder?: string; // The placeholder for the input field.
    required?: boolean; // Whether the field is required or not
    value?: string;
}
