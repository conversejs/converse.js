function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
}
if ( typeof window.CustomEvent !== "function" ) {
    CustomEvent.prototype = window.Event.prototype;
    window.CustomEvent = CustomEvent;
}

if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
        'use strict';
        if (typeof start !== 'number') {
            start = 0;
        }
        if (start + search.length > this.length) {
            return false;
        } else {
            return this.indexOf(search, start) !== -1;  // eslint-disable-line lodash/prefer-includes
        }
  };
}

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function (searchString, position) {
      var subjectString = this.toString();
      if (position === undefined || position > subjectString.length) {
          position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

if (!String.prototype.splitOnce) {
    String.prototype.splitOnce = function (delimiter) {
        var components = this.split(delimiter);
        return [components.shift(), components.join(delimiter)];
    };
}

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}
