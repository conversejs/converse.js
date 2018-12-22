import "converse-autocomplete";
import "converse-bookmarks";       // XEP-0048 Bookmarks
import "converse-caps";            // XEP-0115 Entity Capabilities
import "converse-chatview";        // Renders standalone chat boxes for single user chat
import "converse-controlbox";      // The control box
import "converse-dragresize";      // Allows chat boxes to be resized by dragging them
import "converse-embedded";
import "converse-fullscreen";
import "converse-push";            // XEP-0357 Push Notifications
import "converse-headline";        // Support for headline messages
import "@converse/headless/converse-mam";             // XEP-0313 Message Archive Management
import "converse-minimize";        // Allows chat boxes to be minimized
import "converse-muc-views";       // Views related to MUC
import "converse-notification";    // HTML5 Notifications
import "converse-omemo";
import "@converse/headless/converse-ping";            // XEP-0199 XMPP Ping
import "converse-register";        // XEP-0077 In-band registration
import "converse-roomslist";       // Show currently open chat rooms
import "converse-rosterview";
import "@converse/headless/converse-vcard";           // XEP-0054 VCard-temp

import ConsoleReporter from './console-reporter';
import mock from "./mock";
import sinon from "sinon";
import waitUntilPromise from "wait-until-promise";
import pluggable from "pluggable";
import jasmine from "jasmine";

if (window.view_mode) {
    mock.view_mode = window.view_mode;
}
window.sinon = sinon;
window.waitUntilPromise = waitUntilPromise;
window.localStorage.clear();
window.sessionStorage.clear();

var jasmineEnv = jasmine.getEnv();
jasmineEnv.addReporter(new ConsoleReporter());
const initialize = converse.initialize;

beforeEach(function () {
  const testContext = this;
  this.whitelisted_plugins = [
      'converse-autocomplete',
      'converse-bookmarks',
      'converse-caps',
      'converse-chatboxviews',
      'converse-chatview',
      'converse-controlbox',
      'converse-dragresize',
      'converse-embedded',
      'converse-fullscreen',
      'converse-headline',
      'converse-message-view',
      'converse-minimize',
      'converse-modal',
      'converse-muc-views',
      'converse-notification',
      'converse-oauth',
      'converse-omemo',
      'converse-profile',
      'converse-push',
      'converse-register',
      'converse-roomslist',
      'converse-rosterview',
      'converse-singleton'
  ];

  converse.initialize = function (settings, callback) {
      if (converse.env._.isArray(settings.whitelisted_plugins)) {
          settings.whitelisted_plugins = settings.whitelisted_plugins.concat(testContext.whitelisted_plugins);
      } else {
          settings.whitelisted_plugins = testContext.whitelisted_plugins;
      }
      return initialize(settings, callback);
  }
});

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
