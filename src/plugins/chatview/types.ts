export type HeadingButtonAttributes = {
    standalone: boolean; // True if shown on its own, false if it must be in the dropdown menu.
    handler: () => void; // A handler function to be called when the button is clicked.
    a_class: string; // HTML classes to show on the button
    i18n_text: string; // The user-visible name of the button
    i18n_title: string; // The tooltip text for this button
    icon_class: string; // What kind of CSS class to use for the icon
    name: string; // The internal name of the button
};
