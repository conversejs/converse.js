(function (root, factory) {
    var translations = {
        "domain": "converse",
        "locale_data":

{
   "converse": {
      "": {
         "Project-Id-Version": "Converse.js 0.4",
         "Report-Msgid-Bugs-To": "",
         "POT-Creation-Date": "2013-09-15 22:06+0200",
         "PO-Revision-Date": "2013-09-25 11:33+0300",
         "Last-Translator": "Boris Kocherov <bk@raskon.org>",
         "Language-Team": "<bk@raskon.ru>",
         "Language": "ru",
         "MIME-Version": "1.0",
         "Content-Type": "text/plain; charset=UTF-8",
         "Content-Transfer-Encoding": "8bit",
         "X-Generator": "Poedit 1.5.5"
      },
      "unencrypted": [
         null,
         "не зашифровано"
      ],
      "Disconnected": [
         null,
         "Отключено"
      ],
      "Error": [
         null,
         "Ошибка"
      ],
      "Connecting": [
         null,
         "Соединение"
      ],
      "Connection Failed": [
         null,
         "Не удалось соединится"
      ],
      "Authentication Failed": [
         null,
         "Не удалось соединится"
      ],
      "Disconnecting": [
         null,
         "Отключаемся"
      ],
      "Personal message": [
         null,
         "Введите сообщение"
      ],
      "me": [
         null,
         "Я"
      ],
      "Remove messages": [
         null,
         "Введите сообщение"
      ],
      "Contacts": [
         null,
         "Контакты"
      ],
      "Online": [
         null,
         "В сети"
      ],
      "Busy": [
         null,
         "Занят"
      ],
      "Away": [
         null,
         "Отошёл"
      ],
      "Offline": [
         null,
         "Не в сети"
      ],
      "Click to add new chat contacts": [
         null,
         "Добавить новую конференцию"
      ],
      "Add a contact": [
         null,
         "."
      ],
      "Contact username": [
         null,
         "Контакты"
      ],
      "Contact name": [
         null,
         "Контакты"
      ],
      "Click to add as a chat contact": [
         null,
         "Добавить новую конференцию"
      ],
      "Moderated": [
         null,
         "Модерируемая"
      ],
      "Unmoderated": [
         null,
         "Модерируемая"
      ],
      "Rooms": [
         null,
         "Конфер."
      ],
      "Room name": [
         null,
         "Имя конференции"
      ],
      "Nickname": [
         null,
         "Имя"
      ],
      "Join": [
         null,
         "Подключиться"
      ],
      "Show rooms": [
         null,
         "Обновить"
      ],
      "No rooms on %1$s": [
         null,
         "Нет доступных конференций %1$s"
      ],
      "Rooms on %1$s": [
         null,
         "Конференции %1$s:"
      ],
      "Message": [
         null,
         "Сообщение"
      ],
      "Save": [
         null,
         "Сохранить"
      ],
      "Cancel": [
         null,
         "Отменить"
      ],
      "Password: ": [
         null,
         "Пароль: "
      ],
      "Submit": [
         null,
         "Отправить"
      ],
      "This room is not anonymous": [
         null,
         "Эта комната не анонимная"
      ],
      "This room is now non-anonymous": [
         null,
         "Эта комната не анонимная"
      ],
      "This room is now semi-anonymous": [
         null,
         "Эта комната не анонимная"
      ],
      "This room is now fully-anonymous": [
         null,
         "Эта комната стала полностью анонимной"
      ],
      "A new room has been created": [
         null,
         "Новая комната была создана"
      ],
      "Your nickname has been changed": [
         null,
         "Ваш ник уже используется другим пользователем"
      ],
      "You have been banned from this room": [
         null,
         "Вам запрещено подключатся к этой конференции"
      ],
      "You have been kicked from this room": [
         null,
         "Вам запрещено подключатся к этой конференции"
      ],
      "You are not on the member list of this room": [
         null,
         "Вам запрещено подключатся к этой конференции"
      ],
      "Your nickname is already taken": [
         null,
         "Ваш ник уже используется другим пользователем"
      ],
      "This room does not (yet) exist": [
         null,
         "Эта комната не анонимная"
      ],
      "Topic set by %1$s to: %2$s": [
         null,
         "%2$s"
      ],
      "This user is a moderator": [
         null,
         "Модератор"
      ],
      "This user can send messages in this room": [
         null,
         "Собеседник"
      ],
      "This user can NOT send messages in this room": [
         null,
         "Собеседник"
      ],
      "Click to chat with this contact": [
         null,
         "Начать общение"
      ],
      "Click to remove this contact": [
         null,
         "Начать общение"
      ],
      "Contact requests": [
         null,
         "Контакты"
      ],
      "My contacts": [
         null,
         "."
      ],
      "Pending contacts": [
         null,
         "Cписок собеседников"
      ],
      "Click to change your chat status": [
         null,
         "Изменить ваш статус"
      ],
      "online": [
         null,
         "на связи"
      ],
      "busy": [
         null,
         "занят"
      ],
      "away": [
         null,
         "отошёл"
      ],
      "I am %1$s": [
         null,
         "%1$s"
      ],
      "Sign in": [
         null,
         "Подписать"
      ],
      "XMPP/Jabber Username:": [
         null,
         "JID:"
      ],
      "Password:": [
         null,
         "Пароль:"
      ],
      "Log In": [
         null,
         "Войти"
      ],
      "Online Contacts": [
         null,
         "Cписок собеседников"
      ]
   }
}




    };
    if (typeof define === 'function' && define.amd) {
        define("ru", ['jed'], function () {
            return factory(new Jed(translations));
        });
    } else {
        if (!window.locales) {
            window.locales = {};
        }
        window.locales.ru = factory(new Jed(translations));
    }
}(this, function (ru) {
    return ru;
}));
