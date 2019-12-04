// Converse.js (A browser based XMPP chat client)
// https://conversejs.org
//
// Copyright (c) 2012-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//

import "converse-chatview";
import "converse-controlbox";
import converse from "@converse/headless/converse-core";

const { _ } = converse.env;


converse.plugins.add('converse-mouse-events', {

    dependencies: ["converse-chatview", "converse-headline", "converse-muc-views"],

    enabled (_converse) {
        return _converse.view_mode == 'overlayed' ||
               _converse.allow_occupants_view_resizing;
    },

    initialize () {
        const { _converse } = this;

        _converse.applyDragResistance = function (value, default_value) {
            if (_.isUndefined(value)) {
                return undefined;
            } else if (_.isUndefined(default_value)) {
                return value;
            }
            const resistance = 10;
            if ((value !== default_value) &&
                (Math.abs(value - default_value) < resistance)) {
                return default_value;
            }
            return value;
        };

        function registerGlobalEventHandlers () {
            document.addEventListener('mousemove', function (ev) {
                if (!_converse.resizing || 
                    (!_converse.allow_dragresize && !_converse.allow_occupants_view_resizing)) { 
                       return true; 
                }
                ev.preventDefault();
                _converse.resizing.chatbox.resize(ev);
            });

            document.addEventListener('mouseup', function (ev) {
                if (!_converse.resizing || 
                    (!_converse.allow_dragresize && !_converse.allow_occupants_view_resizing)) { 
                        return true; 
                }
                ev.preventDefault();
                const height = _converse.applyDragResistance(
                        _converse.resizing.chatbox.height,
                        _converse.resizing.chatbox.model.get('default_height')
                );
                const width = _converse.applyDragResistance(
                        _converse.resizing.chatbox.width,
                        _converse.resizing.chatbox.model.get('default_width')
                );
                if (_converse.resizing.width_occupants) {
                    if (_converse.connection.connected) {
                        _converse.resizing.chatbox.chatroomview.model.save({'width_occupants': _converse.resizing.width_occupants});
                    } else {
                        _converse.resizing.chatbox.chatroomview.model.set({'width_occupants': _converse.resizing.width_occupants});
                    }
                } else {
                    if (_converse.api.connection.connected()) {
                        _converse.resizing.chatbox.model.save({'height': height});
                        _converse.resizing.chatbox.model.save({'width': width});
                    } else {
                        if (_converse.connection.connected) {
                            _converse.resizing.chatbox.model.save({'height': height});
                            _converse.resizing.chatbox.model.save({'width': width});
                        } else {
                            _converse.resizing.chatbox.model.set({'height': height});
                            _converse.resizing.chatbox.model.set({'width': width});
                        }
                    }
                }
                _converse.resizing = null;
            });
        }
        _converse.api.listen.on('registeredGlobalEventHandlers', registerGlobalEventHandlers);
    }
});

