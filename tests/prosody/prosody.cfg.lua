-- Prosody for tests against a real server: in CI and locally, started by
-- tests/prosody/server.js. Not for anything else: there's no TLS, accounts
-- are created by the tests, and nothing persists past the container.
--
-- Clients connect over plain websocket, ws://localhost:<port>/xmpp-websocket,
-- which needs no certificates.

admins = {}
pidfile = "/var/run/prosody/prosody.pid"

log = {
    { levels = { min = "info" }, to = "console" };
}

modules_enabled = {
    "disco";
    "roster";
    "saslauth";
    "blocklist";
    "bookmarks";
    "carbons";
    "mam";
    "pep";
    "ping";
    "private";
    "smacks";
    "time";
    "vcard_legacy";
    "version";
    "websocket";
}

modules_disabled = {
    "s2s"; -- Tests talk to this server only
}

authentication = "internal_hashed"
allow_registration = false

-- No certificates: clients reach the server over plain websocket on localhost,
-- which is treated as secure so that SASL works without TLS.
c2s_require_encryption = false
consider_websocket_secure = true
http_ports = { 5280 }
http_interfaces = { "*" }
https_ports = {}

-- Short, so that tests of stream resumption don't wait long for a session
-- to expire.
smacks_hibernation_time = 10

VirtualHost "localhost"
    default_archive_policy = true

Component "conference.localhost" "muc"
    modules_enabled = { "muc_mam" }
    -- So that a room is listed by the service's disco#items, as a rooms.discover spec needs.
    muc_room_default_public = true
