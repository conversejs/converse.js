define("converse-templates", [
    "tpl!src/templates/action",
    "tpl!src/templates/message",
    "tpl!src/templates/new_day",
    "tpl!src/templates/info",
    "tpl!src/templates/controlbox",
    "tpl!src/templates/chatbox",
    "tpl!src/templates/toolbar",
    "tpl!src/templates/contacts_tab",
    "tpl!src/templates/contacts_panel",
    "tpl!src/templates/chatrooms_tab",
    "tpl!src/templates/login_tab",
    "tpl!src/templates/add_contact_dropdown",
    "tpl!src/templates/add_contact_form"
], function () {
    return {
        action: arguments[0],
        message: arguments[1],
        new_day: arguments[2],
        info: arguments[3],
        controlbox: arguments[4],
        chatbox: arguments[5],
        toolbar: arguments[6],
        contacts_tab: arguments[7],
        contacts_panel: arguments[8],
        chatrooms_tab: arguments[9],
        login_tab: arguments[10],
        add_contact_dropdown: arguments[11],
        add_contact_form: arguments[12]
    };
});
