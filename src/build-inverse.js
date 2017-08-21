({
    baseUrl: "../",
    name: "almond",
    mainConfigFile: 'config.js',
    paths: {
        "converse-bookmarks":       "builds/converse-bookmarks",
        "converse-chatboxes":       "builds/converse-chatboxes",
        "converse-chatview":        "builds/converse-chatview",
        "converse-controlbox":      "builds/converse-controlbox",
        "converse-core":            "builds/converse-core",
        "converse-disco":           "builds/converse-disco",
        "converse-dragresize":      "builds/converse-dragresize",
        "converse-headline":        "builds/converse-headline",
        "converse-inverse":         "builds/converse-inverse",
        "converse-mam":             "builds/converse-mam",
        "converse-minimize":        "builds/converse-minimize",
        "converse-muc":             "builds/converse-muc",
        "converse-muc-embedded":    "builds/converse-muc-embedded",
        "converse-notification":    "builds/converse-notification",
        "converse-otr":             "builds/converse-otr",
        "converse-ping":            "builds/converse-ping",
        "converse-register":        "builds/converse-register",
        "converse-roomslist":       "builds/converse-roomslist",
        "converse-rosterview":      "builds/converse-rosterview",
        "converse-singleton":       "builds/converse-singleton",
        "converse-vcard":           "builds/converse-vcard",
        "utils":                    "builds/utils"
    },
    wrap: {
        startFile: "start.frag",
        endFile: "inverse-end.frag"
    }
})
