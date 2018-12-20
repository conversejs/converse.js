import ConsoleReporter from './console-reporter'
import mock from "./mock"
import sinon from "sinon"
import waitUntilPromise from "wait-until-promise"
import pluggable from "pluggable"
import jasmine from "jasmine"

if (window.view_mode) {
    mock.view_mode = window.view_mode;
}
window.sinon = sinon;
window.waitUntilPromise = waitUntilPromise;
window.localStorage.clear();
window.sessionStorage.clear();

var jasmineEnv = jasmine.getEnv();
jasmineEnv.addReporter(new ConsoleReporter());

// Load the specs
require([
    //"spec/transcripts",
    "../spec/spoilers",
    "../spec/profiling",
    "../spec/utils",
    "../spec/converse",
    "../spec/bookmarks",
    "../spec/roomslist",
    "../spec/headline",
    "../spec/disco",
    "../spec/protocol",
    "../spec/presence",
    "../spec/eventemitter",
    "../spec/ping",
    "../spec/push",
    "../spec/xmppstatus",
    "../spec/mam",
    "../spec/omemo",
    "../spec/controlbox",
    "../spec/roster",
    "../spec/chatbox",
    "../spec/user-details-modal",
    "../spec/messages",
    "../spec/chatroom",
    "../spec/room_registration",
    "../spec/autocomplete",
    "../spec/minchats",
    "../spec/notification",
    "../spec/login",
    "../spec/register",
    "../spec/http-file-upload"
]);
