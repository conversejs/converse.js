/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("components/almond/almond.js", function(){});

/**
 * @license RequireJS text 2.0.14 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */

define('text',['module'], function (module) {
    'use strict';

    var text, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.14',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.lastIndexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config && config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config && config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            // Do not load if it is an empty: url
            if (url.indexOf('empty:') === 0) {
                onLoad();
                return;
            }

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node &&
            !process.versions['node-webkit'] &&
            !process.versions['atom-shell'])) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback, errback) {
            try {
                var file = fs.readFileSync(url, 'utf8');
                //Remove BOM (Byte Mark Order) from utf8 files if it is there.
                if (file[0] === '\uFEFF') {
                    file = file.substring(1);
                }
                callback(file);
            } catch (e) {
                if (errback) {
                    errback(e);
                }
            }
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status || 0;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        if (errback) {
                            errback(err);
                        }
                    } else {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                if (line !== null) {
                    stringBuffer.append(line);
                }

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
            typeof Components !== 'undefined' && Components.classes &&
            Components.interfaces)) {
        //Avert your gaze!
        Cc = Components.classes;
        Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');
        xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

        text.get = function (url, callback) {
            var inStream, convertStream, fileObj,
                readData = {};

            if (xpcIsWindows) {
                url = url.replace(/\//g, '\\');
            }

            fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                           .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                                .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});

// RequireJS UnderscoreJS template plugin
// http://github.com/jfparadis/requirejs-tpl
//
// An alternative to http://github.com/ZeeAgency/requirejs-tpl
//
// Using UnderscoreJS micro-templates at http://underscorejs.org/#template
// Using and RequireJS text.js at http://requirejs.org/docs/api.html#text
// @author JF Paradis
// @version 0.0.2
//
// Released under the MIT license
//
// Usage:
//   require(['backbone', 'tpl!mytemplate'], function (Backbone, mytemplate) {
//     return Backbone.View.extend({
//       initialize: function(){
//         this.render();
//       },
//       render: function(){
//         this.$el.html(mytemplate({message: 'hello'}));
//     });
//   });
//
// Configuration: (optional)
//   require.config({
//     tpl: {
//       extension: '.tpl' // default = '.html'
//     }
//   });

/*jslint nomen: true */
/*global define: false */

define('tpl',['text', 'underscore'], function (text, _) {
    'use strict';

    var buildMap = {},
        buildTemplateSource = "define('{pluginName}!{moduleName}', function () { return {source}; });\n";

    return {
        version: '0.0.2',

        load: function (moduleName, parentRequire, onload, config) {

            if (config.tpl && config.tpl.templateSettings) {
                _.templateSettings = config.tpl.templateSettings;
            }

            if (buildMap[moduleName]) {
                onload(buildMap[moduleName]);

            } else {
                var ext = (config.tpl && config.tpl.extension) || '.html';
                var path = (config.tpl && config.tpl.path) || '';
                text.load(path + moduleName + ext, parentRequire, function (source) {
                    buildMap[moduleName] = _.template(source);
                    onload(buildMap[moduleName]);
                }, config);
            }
        },

        write: function (pluginName, moduleName, write) {
            var build = buildMap[moduleName],
                source = build && build.source;
            if (source) {
                write.asModule(pluginName + '!' + moduleName,
                    buildTemplateSource
                    .replace('{pluginName}', pluginName)
                    .replace('{moduleName}', moduleName)
                    .replace('{source}', source));
            }
        }
    };
});


define('tpl!action', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chat-message '+
((__t=(extra_classes))==null?'':__t)+
'" data-isodate="'+
((__t=(isodate))==null?'':__t)+
'">\n    <span class="chat-msg-author chat-msg-'+
((__t=(sender))==null?'':__t)+
'">'+
((__t=(time))==null?'':__t)+
' **'+
((__t=(username))==null?'':__t)+
' </span>\n    <span class="chat-msg-content">'+
((__t=(message))==null?'':__t)+
'</span>\n</div>\n';
}
return __p;
}; });


define('tpl!add_contact_dropdown', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dl class="add-converse-contact dropdown">\n    <dt id="xmpp-contact-search" class="fancy-dropdown">\n        <a class="toggle-xmpp-contact-form icon-plus" href="#" title="'+
((__t=(label_click_to_chat))==null?'':__t)+
'"> '+
((__t=(label_add_contact))==null?'':__t)+
'</a>\n    </dt>\n    <dd class="search-xmpp" style="display:none"><ul></ul></dd>\n</dl>\n';
}
return __p;
}; });


define('tpl!add_contact_form', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li>\n    <form class="pure-form add-xmpp-contact">\n        <input type="text"\n            name="identifier"\n            class="username"\n            placeholder="'+
((__t=(label_contact_username))==null?'':__t)+
'"/>\n        <button class="pure-button button-primary" type="submit">'+
((__t=(label_add))==null?'':__t)+
'</button>\n    </form>\n</li>\n';
}
return __p;
}; });


define('tpl!change_status_message', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form id="set-custom-xmpp-status" class="pure-form">\n<fieldset>\n    <span class="input-button-group">\n        <input type="text" class="custom-xmpp-status" '+
((__t=(status_message))==null?'':__t)+
' placeholder="'+
((__t=(label_custom_status))==null?'':__t)+
'"/>\n        <input type="submit" class="pure-button button-primary" value="'+
((__t=(label_save))==null?'':__t)+
'"/>\n    </span>\n</fieldset>\n</form>\n';
}
return __p;
}; });


define('tpl!chat_status', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="xmpp-status">\n    <a class="choose-xmpp-status '+
((__t=(chat_status))==null?'':__t)+
' icon-'+
((__t=(chat_status))==null?'':__t)+
'" data-value="'+
((__t=(status_message))==null?'':__t)+
'" href="#" title="'+
((__t=(desc_change_status))==null?'':__t)+
'">\n        '+
((__t=(status_message))==null?'':__t)+
'\n    </a>\n    <a class="change-xmpp-status-message icon-pencil" href="#" title="'+
((__t=(desc_custom_status))==null?'':__t)+
'"></a>\n</div>\n';
}
return __p;
}; });


define('tpl!chatarea', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chat-area">\n    <div class="chat-content"></div>\n    <form class="sendXMPPMessage" action="" method="post">\n        ';
 if (show_toolbar) { 
__p+='\n            <ul class="chat-toolbar no-text-select"></ul>\n        ';
 } 
__p+='\n        <textarea type="text" class="chat-textarea" \n            placeholder="'+
((__t=(label_message))==null?'':__t)+
'"/>\n    </form>\n</div>\n';
}
return __p;
}; });


define('tpl!chatbox', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head chat-head-chatbox">\n        <a class="chatbox-btn close-chatbox-button icon-close" title="'+
((__t=(info_close))==null?'':__t)+
'"></a>\n        <a class="chatbox-btn toggle-chatbox-button icon-minus" title="'+
((__t=(info_minimize))==null?'':__t)+
'"></a>\n        <div class="chat-title">\n            ';
 if (url) { 
__p+='\n                <a href="'+
((__t=(url))==null?'':__t)+
'" target="_blank" class="user">\n            ';
 } 
__p+='\n                    '+
((__t=( fullname ))==null?'':__t)+
'\n            ';
 if (url) { 
__p+='\n                </a>\n            ';
 } 
__p+='\n        </div>\n        <p class="user-custom-message"><p/>\n    </div>\n    <div class="chat-body">\n        <div class="chat-content"></div>\n        <form class="sendXMPPMessage" action="" method="post">\n            ';
 if (show_toolbar) { 
__p+='\n                <ul class="chat-toolbar no-text-select"></ul>\n            ';
 } 
__p+='\n        <textarea\n            type="text"\n            class="chat-textarea"\n            placeholder="'+
((__t=(label_personal_message))==null?'':__t)+
'"/>\n        </form>\n    </div>\n</div>\n';
}
return __p;
}; });


define('tpl!chatroom', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head chat-head-chatroom">\n        <a class="chatbox-btn close-chatbox-button icon-close"></a>\n        <a class="chatbox-btn toggle-chatbox-button icon-minus"></a>\n        <a class="chatbox-btn configure-chatroom-button icon-wrench" style="display:none"></a>\n        <div class="chat-title"> '+
((__t=( _.escape(name) ))==null?'':__t)+
' </div>\n        <p class="chatroom-topic"><p/>\n    </div>\n    <div class="chat-body chatroom-body"><span class="spinner centered"/></div>\n</div>\n';
}
return __p;
}; });


define('tpl!chatroom_form', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chatroom-form-container">\n    <form class="pure-form pure-form-stacked converse-form chatroom-form">\n        <fieldset>\n            <span class="spinner centered"/>\n        </fieldset>\n    </form>\n</div>\n';
}
return __p;
}; });


define('tpl!chatroom_password_form', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chatroom-form-container">\n    <form class="pure-form converse-form chatroom-form">\n        <fieldset>\n            <legend>'+
((__t=(heading))==null?'':__t)+
'</legend>\n            <label>'+
((__t=(label_password))==null?'':__t)+
'</label>\n            <input type="password" name="password"/>\n        </fieldset>\n        <fieldset>\n            <input class="pure-button button-primary" type="submit" value="'+
((__t=(label_submit))==null?'':__t)+
'"/>\n        </fieldset>\n    </form>\n</div>\n';
}
return __p;
}; });


define('tpl!chatroom_sidebar', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<!-- <div class="occupants"> -->\n<form class="pure-form room-invite">\n    <input class="invited-contact" placeholder="'+
((__t=(label_invitation))==null?'':__t)+
'" type="text"/>\n</form>\n<p class="occupants-heading">'+
((__t=(label_occupants))==null?'':__t)+
':</p>\n<ul class="occupant-list"></ul>\n<!-- </div> -->\n';
}
return __p;
}; });


define('tpl!chatrooms_tab', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li><a class="s" href="#chatrooms">'+
((__t=(label_rooms))==null?'':__t)+
'</a></li>\n';
}
return __p;
}; });


define('tpl!chats_panel', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div id="minimized-chats">\n    <a id="toggle-minimized-chats" href="#"></a>\n    <div class="flyout minimized-chats-flyout"></div>\n</div>\n';
}
return __p;
}; });


define('tpl!choose_status', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dl id="target" class="dropdown">\n    <dt id="fancy-xmpp-status-select" class="fancy-dropdown"></dt>\n    <dd><ul class="xmpp-status-menu"></ul></dd>\n</dl>\n';
}
return __p;
}; });


define('tpl!contacts_panel', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form class="pure-form set-xmpp-status" action="" method="post">\n    <span id="xmpp-status-holder">\n        <select id="select-xmpp-status" style="display:none">\n            <option value="online">'+
((__t=(label_online))==null?'':__t)+
'</option>\n            <option value="dnd">'+
((__t=(label_busy))==null?'':__t)+
'</option>\n            <option value="away">'+
((__t=(label_away))==null?'':__t)+
'</option>\n            ';
 if (include_offline_state)  { 
__p+='\n            <option value="offline">'+
((__t=(label_offline))==null?'':__t)+
'</option>\n            ';
 } 
__p+='\n            ';
 if (allow_logout)  { 
__p+='\n            <option value="logout">'+
((__t=(label_logout))==null?'':__t)+
'</option>\n            ';
 } 
__p+='\n        </select>\n    </span>\n</form>\n';
}
return __p;
}; });


define('tpl!contacts_tab', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li><a class="s current" href="#users">'+
((__t=(label_contacts))==null?'':__t)+
'</a></li>\n';
}
return __p;
}; });


define('tpl!controlbox', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head controlbox-head">\n        <ul id="controlbox-tabs"></ul>\n        <a class="chatbox-btn close-chatbox-button icon-close"></a>\n    </div>\n    <div class="controlbox-panes"></div>\n</div>\n';
}
return __p;
}; });


define('tpl!controlbox_toggle', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<span class="conn-feedback">'+
((__t=(label_toggle))==null?'':__t)+
'</span>\n<span style="display: none" id="online-count">(0)</span>\n';
}
return __p;
}; });


define('tpl!field', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<field var="'+
((__t=(name))==null?'':__t)+
'">';
 if (_.isArray(value)) { 
__p+='\n    ';
 _.each(value,function(arrayValue) { 
__p+='<value>'+
((__t=(arrayValue))==null?'':__t)+
'</value>';
 }); 
__p+='\n';
 } else { 
__p+='\n    <value>'+
((__t=(value))==null?'':__t)+
'</value>\n';
 } 
__p+='</field>\n';
}
return __p;
}; });


define('tpl!form_captcha', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (label) { 
__p+='\n<label>\n    '+
((__t=(label))==null?'':__t)+
'\n</label>\n';
 } 
__p+='\n<img src="data:'+
((__t=(type))==null?'':__t)+
';base64,'+
((__t=(data))==null?'':__t)+
'">\n<input name="'+
((__t=(name))==null?'':__t)+
'" type="text" ';
 if (required) { 
__p+=' class="required" ';
 } 
__p+=' >\n\n\n';
}
return __p;
}; });


define('tpl!form_checkbox', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<label>'+
((__t=(label))==null?'':__t)+
'</label>\n<input name="'+
((__t=(name))==null?'':__t)+
'" type="'+
((__t=(type))==null?'':__t)+
'" '+
((__t=(checked))==null?'':__t)+
'>\n';
}
return __p;
}; });


define('tpl!form_input', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (label) { 
__p+='\n<label>\n    '+
((__t=(label))==null?'':__t)+
'\n</label>\n';
 } 
__p+='\n<input name="'+
((__t=(name))==null?'':__t)+
'" type="'+
((__t=(type))==null?'':__t)+
'" \n    ';
 if (value) { 
__p+=' value="'+
((__t=(value))==null?'':__t)+
'" ';
 } 
__p+='\n    ';
 if (required) { 
__p+=' class="required" ';
 } 
__p+=' >\n';
}
return __p;
}; });


define('tpl!form_select', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<label>'+
((__t=(label))==null?'':__t)+
'</label>\n<select name="'+
((__t=(name))==null?'':__t)+
'"  ';
 if (multiple) { 
__p+=' multiple="multiple" ';
 } 
__p+='>'+
((__t=(options))==null?'':__t)+
'</select>\n';
}
return __p;
}; });


define('tpl!form_textarea', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<label class="label-ta">'+
((__t=(label))==null?'':__t)+
'</label>\n<textarea name="'+
((__t=(name))==null?'':__t)+
'">'+
((__t=(value))==null?'':__t)+
'</textarea>\n';
}
return __p;
}; });


define('tpl!form_username', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (label) { 
__p+='\n<label>\n    '+
((__t=(label))==null?'':__t)+
'\n</label>\n';
 } 
__p+='\n<div class="input-group">\n    <input name="'+
((__t=(name))==null?'':__t)+
'" type="'+
((__t=(type))==null?'':__t)+
'"\n        ';
 if (value) { 
__p+=' value="'+
((__t=(value))==null?'':__t)+
'" ';
 } 
__p+='\n        ';
 if (required) { 
__p+=' class="required" ';
 } 
__p+=' />\n    <span title="'+
((__t=(domain))==null?'':__t)+
'">'+
((__t=(domain))==null?'':__t)+
'</span>\n</div>\n';
}
return __p;
}; });


define('tpl!group_header', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a href="#" class="group-toggle icon-'+
((__t=(toggle_state))==null?'':__t)+
'" title="'+
((__t=(desc_group_toggle))==null?'':__t)+
'">'+
((__t=(label_group))==null?'':__t)+
'</a>\n';
}
return __p;
}; });


define('tpl!info', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chat-info">'+
((__t=(message))==null?'':__t)+
'</div>\n';
}
return __p;
}; });


define('tpl!login_panel', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form class="pure-form pure-form-stacked converse-form" id="converse-login" method="post">\n    ';
 if (auto_login) { 
__p+='\n        <span class="spinner login-submit"/>\n    ';
 } 
__p+='\n    ';
 if (!auto_login) { 
__p+='\n        ';
 if (authentication == LOGIN) { 
__p+='\n            <label>'+
((__t=(label_username))==null?'':__t)+
'</label>\n            <input type="text" name="jid" placeholder="'+
((__t=(placeholder_username))==null?'':__t)+
'">\n            <label>'+
((__t=(label_password))==null?'':__t)+
'</label>\n            <input type="password" name="password" placeholder="'+
((__t=(placeholder_password))==null?'':__t)+
'">\n            <input class="pure-button button-primary" type="submit" value="'+
((__t=(label_login))==null?'':__t)+
'">\n            <span class="conn-feedback"></span>\n        ';
 } 
__p+='\n        ';
 if (authentication == ANONYMOUS) { 
__p+='\n            <input type="pure-button button-primary" class="submit login-anon" value="'+
((__t=(label_anon_login))==null?'':__t)+
'"/>\n        ';
 } 
__p+='\n        ';
 if (authentication == PREBIND) { 
__p+='\n            <p>Disconnected.</p>\n        ';
 } 
__p+='\n    ';
 } 
__p+='\n</form>\n';
}
return __p;
}; });


define('tpl!login_tab', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li><a class="current" href="#login-dialog">'+
((__t=(label_sign_in))==null?'':__t)+
'</a></li>\n';
}
return __p;
}; });


define('tpl!message', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chat-message '+
((__t=(extra_classes))==null?'':__t)+
'" data-isodate="'+
((__t=(isodate))==null?'':__t)+
'" data-msgid="'+
((__t=(msgid))==null?'':__t)+
'">\n    <span class="chat-msg-author chat-msg-'+
((__t=(sender))==null?'':__t)+
'">'+
((__t=(time))==null?'':__t)+
' '+
((__t=(username))==null?'':__t)+
':&nbsp;</span>\n    <span class="chat-msg-content">'+
((__t=(message))==null?'':__t)+
'</span>\n</div>\n';
}
return __p;
}; });


define('tpl!new_day', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<time class="chat-info chat-date" data-isodate="'+
((__t=(isodate))==null?'':__t)+
'">'+
((__t=(datestring))==null?'':__t)+
'</time>\n';
}
return __p;
}; });


define('tpl!occupant', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li class="'+
((__t=(role))==null?'':__t)+
'"\n    ';
 if (role === "moderator") { 
__p+='\n       title="'+
((__t=(desc_moderator))==null?'':__t)+
'"\n    ';
 } 
__p+='\n    ';
 if (role === "occupant") { 
__p+='\n       title="'+
((__t=(desc_occupant))==null?'':__t)+
'"\n    ';
 } 
__p+='\n    ';
 if (role === "visitor") { 
__p+='\n       title="'+
((__t=(desc_visitor))==null?'':__t)+
'"\n    ';
 } 
__p+='\n>'+
((__t=(nick))==null?'':__t)+
'</li>\n';
}
return __p;
}; });


define('tpl!pending_contact', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (allow_chat_pending_contacts)  { 
__p+='\n<a class="open-chat"href="#">\n';
 } 
__p+='\n<span class="pending-contact-name" title="Name: '+
((__t=(fullname))==null?'':__t)+
'\nJID: '+
((__t=(jid))==null?'':__t)+
'">'+
((__t=(fullname))==null?'':__t)+
'</span> \n';
 if (allow_chat_pending_contacts)  { 
__p+='\n</a>\n';
 } 
__p+='\n<a class="remove-xmpp-contact icon-remove" title="'+
((__t=(desc_remove))==null?'':__t)+
'" href="#"></a>\n';
}
return __p;
}; });


define('tpl!pending_contacts', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dt class="roster-group" id="pending-xmpp-contacts"><a href="#" class="group-toggle icon-'+
((__t=(toggle_state))==null?'':__t)+
'" title="'+
((__t=(desc_group_toggle))==null?'':__t)+
'">'+
((__t=(label_pending_contacts))==null?'':__t)+
'</a></dt>\n';
}
return __p;
}; });


define('tpl!register_panel', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form id="converse-register" class="pure-form converse-form">\n    <span class="reg-feedback"></span>\n    <label>'+
((__t=(label_domain))==null?'':__t)+
'</label>\n    <input type="text" name="domain" placeholder="'+
((__t=(domain_placeholder))==null?'':__t)+
'">\n    <p class="form-help">'+
((__t=(help_providers))==null?'':__t)+
' <a href="'+
((__t=(href_providers))==null?'':__t)+
'" class="url" target="_blank">'+
((__t=(help_providers_link))==null?'':__t)+
'</a>.</p>\n    <input class="pure-button button-primary" type="submit" value="'+
((__t=(label_register))==null?'':__t)+
'">\n</form>\n';
}
return __p;
}; });


define('tpl!register_tab', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li><a class="s" href="#register">'+
((__t=(label_register))==null?'':__t)+
'</a></li>\n';
}
return __p;
}; });


define('tpl!registration_form', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<p class="provider-title">'+
((__t=(domain))==null?'':__t)+
'</p>\n<a href=\'https://xmpp.net/result.php?domain='+
((__t=(domain))==null?'':__t)+
'&amp;type=client\'>\n    <img class="provider-score" src=\'https://xmpp.net/badge.php?domain='+
((__t=(domain))==null?'':__t)+
'\' alt=\'xmpp.net score\' />\n</a>\n<p class="title">'+
((__t=(title))==null?'':__t)+
'</p>\n<p class="instructions">'+
((__t=(instructions))==null?'':__t)+
'</p>\n';
}
return __p;
}; });


define('tpl!registration_request', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<span class="spinner login-submit"/>\n<p class="info">'+
((__t=(info_message))==null?'':__t)+
'</p>\n<button class="pure-button button-cancel hor_centered">'+
((__t=(cancel))==null?'':__t)+
'</button>\n';
}
return __p;
}; });


define('tpl!requesting_contact', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (allow_chat_pending_contacts)  { 
__p+='\n<a class="open-chat"href="#">\n';
 } 
__p+='\n<span class="req-contact-name" title="Name: '+
((__t=(fullname))==null?'':__t)+
'\nJID: '+
((__t=(jid))==null?'':__t)+
'">'+
((__t=(fullname))==null?'':__t)+
'</span>\n';
 if (allow_chat_pending_contacts)  { 
__p+='\n</a>\n';
 } 
__p+='\n<span class="request-actions">\n    <a class="accept-xmpp-request icon-checkmark" title="'+
((__t=(desc_accept))==null?'':__t)+
'" href="#"></a>\n    <a class="decline-xmpp-request icon-close" title="'+
((__t=(desc_decline))==null?'':__t)+
'" href="#"></a>\n</span>\n';
}
return __p;
}; });


define('tpl!requesting_contacts', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dt class="roster-group" id="xmpp-contact-requests"><a href="#" class="group-toggle icon-'+
((__t=(toggle_state))==null?'':__t)+
'" title="'+
((__t=(desc_group_toggle))==null?'':__t)+
'">'+
((__t=(label_contact_requests))==null?'':__t)+
'</a></dt>\n';
}
return __p;
}; });


define('tpl!room_description', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<!-- FIXME: check markup in mockup -->\n<div class="room-info">\n<p class="room-info"><strong>'+
((__t=(label_desc))==null?'':__t)+
'</strong> '+
((__t=(desc))==null?'':__t)+
'</p>\n<p class="room-info"><strong>'+
((__t=(label_occ))==null?'':__t)+
'</strong> '+
((__t=(occ))==null?'':__t)+
'</p>\n<p class="room-info"><strong>'+
((__t=(label_features))==null?'':__t)+
'</strong>\n    <ul>\n        ';
 if (passwordprotected) { 
__p+='\n        <li class="room-info locked">'+
((__t=(label_requires_auth))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (hidden) { 
__p+='\n        <li class="room-info">'+
((__t=(label_hidden))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (membersonly) { 
__p+='\n        <li class="room-info">'+
((__t=(label_requires_invite))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (moderated) { 
__p+='\n        <li class="room-info">'+
((__t=(label_moderated))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (nonanonymous) { 
__p+='\n        <li class="room-info">'+
((__t=(label_non_anon))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (open) { 
__p+='\n        <li class="room-info">'+
((__t=(label_open_room))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (persistent) { 
__p+='\n        <li class="room-info">'+
((__t=(label_permanent_room))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (publicroom) { 
__p+='\n        <li class="room-info">'+
((__t=(label_public))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (semianonymous) { 
__p+='\n        <li class="room-info">'+
((__t=(label_semi_anon))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (temporary) { 
__p+='\n        <li class="room-info">'+
((__t=(label_temp_room))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n        ';
 if (unmoderated) { 
__p+='\n        <li class="room-info">'+
((__t=(label_unmoderated))==null?'':__t)+
'</li>\n        ';
 } 
__p+='\n    </ul>\n</p>\n</div>\n';
}
return __p;
}; });


define('tpl!room_item', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dd class="available-chatroom">\n<a class="open-room" data-room-jid="'+
((__t=(jid))==null?'':__t)+
'"\n   title="'+
((__t=(open_title))==null?'':__t)+
'" href="#">'+
((__t=(_.escape(name)))==null?'':__t)+
'</a>\n<a class="room-info icon-room-info" data-room-jid="'+
((__t=(jid))==null?'':__t)+
'"\n   title="'+
((__t=(info_title))==null?'':__t)+
'" href="#">&nbsp;</a>\n</dd>\n';
}
return __p;
}; });


define('tpl!room_panel', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form class="pure-form pure-form-stacked converse-form add-chatroom" action="" method="post">\n    <fieldset>\n        <label>'+
((__t=(label_room_name))==null?'':__t)+
'</label>\n        <input type="text" name="chatroom" class="new-chatroom-name" placeholder="'+
((__t=(label_room_name))==null?'':__t)+
'"/>\n        <label>'+
((__t=(label_nickname))==null?'':__t)+
'</label> <input type="text" name="nick" class="new-chatroom-nick" placeholder="'+
((__t=(label_nickname))==null?'':__t)+
'"/>\n        <input type="submit" class="pure-button button-primary" name="join" value="'+
((__t=(label_join))==null?'':__t)+
'"/>\n    </fieldset>\n    <fieldset>\n        ';
 if (server_input_type != 'hidden') { 
__p+='\n            <label'+
((__t=(server_label_global_attr))==null?'':__t)+
'>'+
((__t=(label_server))==null?'':__t)+
'</label>\n        ';
 } 
__p+='\n        <input type="'+
((__t=(server_input_type))==null?'':__t)+
'" name="server" class="new-chatroom-server" placeholder="'+
((__t=(label_server))==null?'':__t)+
'"/>\n        <input type="button" class="pure-button button-secondary" name="show" id="show-rooms" value="'+
((__t=(label_show_rooms))==null?'':__t)+
'"/>\n    </fieldset>\n</form>\n<dl id="available-chatrooms"></dl>\n';
}
return __p;
}; });


define('tpl!roster', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form class="pure-form roster-filter-group input-button-group">\n    <input style="display: none;" class="roster-filter" placeholder="'+
((__t=(placeholder))==null?'':__t)+
'">\n    <select style="display: none;" class="filter-type">\n        <option value="contacts">'+
((__t=(label_contacts))==null?'':__t)+
'</option>\n        <option value="groups">'+
((__t=(label_groups))==null?'':__t)+
'</option>\n    </select>\n</form>\n';
}
return __p;
}; });


define('tpl!roster_item', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a class="open-chat" title="'+
((__t=(title_fullname))==null?'':__t)+
': '+
((__t=(fullname))==null?'':__t)+
'\nJID: '+
((__t=(jid))==null?'':__t)+
'\n'+
((__t=(desc_chat))==null?'':__t)+
'" href="#"><span class="icon-'+
((__t=(chat_status))==null?'':__t)+
'" title="'+
((__t=(desc_status))==null?'':__t)+
'"></span>'+
((__t=(fullname))==null?'':__t)+
'</a>\n';
 if (allow_contact_removal) { 
__p+='\n<a class="remove-xmpp-contact icon-remove" title="'+
((__t=(desc_remove))==null?'':__t)+
'" href="#"></a>\n';
 } 
__p+='\n';
}
return __p;
}; });


define('tpl!search_contact', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li>\n    <form class="search-xmpp-contact">\n        <input type="text"\n            name="identifier"\n            class="username"\n            placeholder="'+
((__t=(label_contact_name))==null?'':__t)+
'"/>\n        <button type="submit">'+
((__t=(label_search))==null?'':__t)+
'</button>\n    </form>\n</li>\n';
}
return __p;
}; });


define('tpl!select_option', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<option value="'+
((__t=(value))==null?'':__t)+
'" ';
 if (selected) { 
__p+=' selected="selected" ';
 } 
__p+=' >'+
((__t=(label))==null?'':__t)+
'</option>\n';
}
return __p;
}; });


define('tpl!status_option', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li>\n    <a href="#" class="'+
((__t=( value ))==null?'':__t)+
'" data-value="'+
((__t=( value ))==null?'':__t)+
'">\n        <span class="icon-'+
((__t=( value ))==null?'':__t)+
'"></span>\n        '+
((__t=( text ))==null?'':__t)+
'\n    </a>\n</li>\n';
}
return __p;
}; });


define('tpl!toggle_chats', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+=''+
((__t=(Minimized))==null?'':__t)+
' <span id="minimized-count">('+
((__t=(num_minimized))==null?'':__t)+
')</span>\n<span class="unread-message-count"\n    ';
 if (!num_unread) { 
__p+=' style="display: none" ';
 } 
__p+='\n    href="#">'+
((__t=(num_unread))==null?'':__t)+
'</span>\n';
}
return __p;
}; });


define('tpl!toolbar', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (show_emoticons)  { 
__p+='\n    <li class="toggle-smiley icon-happy" title="'+
((__t=(label_insert_smiley))==null?'':__t)+
'">\n        <ul>\n            <li><a class="icon-smiley" href="#" data-emoticon=":)"></a></li>\n            <li><a class="icon-wink" href="#" data-emoticon=";)"></a></li>\n            <li><a class="icon-grin" href="#" data-emoticon=":D"></a></li>\n            <li><a class="icon-tongue" href="#" data-emoticon=":P"></a></li>\n            <li><a class="icon-cool" href="#" data-emoticon="8)"></a></li>\n            <li><a class="icon-evil" href="#" data-emoticon=">:)"></a></li>\n            <li><a class="icon-confused" href="#" data-emoticon=":S"></a></li>\n            <li><a class="icon-wondering" href="#" data-emoticon=":\\"></a></li>\n            <li><a class="icon-angry" href="#" data-emoticon=">:("></a></li>\n            <li><a class="icon-sad" href="#" data-emoticon=":("></a></li>\n            <li><a class="icon-shocked" href="#" data-emoticon=":O"></a></li>\n            <li><a class="icon-thumbs-up" href="#" data-emoticon="(^.^)b"></a></li>\n            <li><a class="icon-heart" href="#" data-emoticon="<3"></a></li>\n        </ul>\n    </li>\n';
 } 
__p+='\n';
 if (show_call_button)  { 
__p+='\n<li class="toggle-call"><a class="icon-phone" title="'+
((__t=(label_start_call))==null?'':__t)+
'"></a></li>\n';
 } 
__p+='\n';
 if (show_occupants_toggle)  { 
__p+='\n<li class="toggle-occupants"><a class="icon-hide-users" title="'+
((__t=(label_hide_occupants))==null?'':__t)+
'"></a></li>\n';
 } 
__p+='\n';
 if (show_clear_button)  { 
__p+='\n<li class="toggle-clear"><a class="icon-remove" title="'+
((__t=(label_clear))==null?'':__t)+
'"></a></li>\n';
 } 
__p+='\n';
}
return __p;
}; });


define('tpl!toolbar_otr', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='';
 if (allow_otr)  { 
__p+='\n    <li class="toggle-otr '+
((__t=(otr_status_class))==null?'':__t)+
'" title="'+
((__t=(otr_tooltip))==null?'':__t)+
'">\n        <span class="chat-toolbar-text">'+
((__t=(otr_translated_status))==null?'':__t)+
'</span>\n        ';
 if (otr_status == UNENCRYPTED) { 
__p+='\n            <span class="icon-unlocked"></span>\n        ';
 } 
__p+='\n        ';
 if (otr_status == UNVERIFIED) { 
__p+='\n            <span class="icon-lock"></span>\n        ';
 } 
__p+='\n        ';
 if (otr_status == VERIFIED) { 
__p+='\n            <span class="icon-lock"></span>\n        ';
 } 
__p+='\n        ';
 if (otr_status == FINISHED) { 
__p+='\n            <span class="icon-unlocked"></span>\n        ';
 } 
__p+='\n        <ul>\n            ';
 if (otr_status == UNENCRYPTED) { 
__p+='\n               <li><a class="start-otr" href="#">'+
((__t=(label_start_encrypted_conversation))==null?'':__t)+
'</a></li>\n            ';
 } 
__p+='\n            ';
 if (otr_status != UNENCRYPTED) { 
__p+='\n               <li><a class="start-otr" href="#">'+
((__t=(label_refresh_encrypted_conversation))==null?'':__t)+
'</a></li>\n               <li><a class="end-otr" href="#">'+
((__t=(label_end_encrypted_conversation))==null?'':__t)+
'</a></li>\n               <li><a class="auth-otr" data-scheme="smp" href="#">'+
((__t=(label_verify_with_smp))==null?'':__t)+
'</a></li>\n            ';
 } 
__p+='\n            ';
 if (otr_status == UNVERIFIED) { 
__p+='\n               <li><a class="auth-otr" data-scheme="fingerprint" href="#">'+
((__t=(label_verify_with_fingerprints))==null?'':__t)+
'</a></li>\n            ';
 } 
__p+='\n            <li><a href="http://www.cypherpunks.ca/otr/help/3.2.0/levels.php" target="_blank">'+
((__t=(label_whats_this))==null?'':__t)+
'</a></li>\n        </ul>\n    </li>\n';
 } 
__p+='\n';
}
return __p;
}; });


define('tpl!trimmed_chat', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a class="chatbox-btn close-chatbox-button icon-close"></a>\n<a class="chat-head-message-count" \n    ';
 if (!num_unread) { 
__p+=' style="display: none" ';
 } 
__p+='\n    href="#">'+
((__t=(num_unread))==null?'':__t)+
'</a>\n<a href="#" class="restore-chat" title="'+
((__t=(tooltip))==null?'':__t)+
'">\n    '+
((__t=( title ))==null?'':__t)+
'\n</a>\n';
}
return __p;
}; });


define('tpl!vcard', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form class="pure-form converse-form vcard-info">\n    <fieldset>\n        <legend>The VCard info gets rendered here</legend>\n        <label>Full name:</label>\n        '+
((__t=(fullname))==null?'':__t)+
'\n        <label>URL:</label>\n        '+
((__t=(url))==null?'':__t)+
'\n    </fieldset>\n    <fieldset>\n        <input type="button" class="pure-button button-cancel" value="'+
((__t=(label_return))==null?'':__t)+
'"/>\n    </fieldset>\n</form>\n';
}
return __p;
}; });

define("converse-templates", [
    "tpl!action",
    "tpl!add_contact_dropdown",
    "tpl!add_contact_form",
    "tpl!change_status_message",
    "tpl!chat_status",
    "tpl!chatarea",
    "tpl!chatbox",
    "tpl!chatroom",
    "tpl!chatroom_form",
    "tpl!chatroom_password_form",
    "tpl!chatroom_sidebar",
    "tpl!chatrooms_tab",
    "tpl!chats_panel",
    "tpl!choose_status",
    "tpl!contacts_panel",
    "tpl!contacts_tab",
    "tpl!controlbox",
    "tpl!controlbox_toggle",
    "tpl!field",
    "tpl!form_captcha",
    "tpl!form_checkbox",
    "tpl!form_input",
    "tpl!form_select",
    "tpl!form_textarea",
    "tpl!form_username",
    "tpl!group_header",
    "tpl!info",
    "tpl!login_panel",
    "tpl!login_tab",
    "tpl!message",
    "tpl!new_day",
    "tpl!occupant",
    "tpl!pending_contact",
    "tpl!pending_contacts",
    "tpl!register_panel",
    "tpl!register_tab",
    "tpl!registration_form",
    "tpl!registration_request",
    "tpl!requesting_contact",
    "tpl!requesting_contacts",
    "tpl!room_description",
    "tpl!room_item",
    "tpl!room_panel",
    "tpl!roster",
    "tpl!roster_item",
    "tpl!search_contact",
    "tpl!select_option",
    "tpl!status_option",
    "tpl!toggle_chats",
    "tpl!toolbar",
    "tpl!toolbar_otr",
    "tpl!trimmed_chat",
    "tpl!vcard",
], function () {
    return {
        action:                 arguments[0],
        add_contact_dropdown:   arguments[1],
        add_contact_form:       arguments[2],
        change_status_message:  arguments[3],
        chat_status:            arguments[4],
        chatarea:               arguments[5],
        chatbox:                arguments[6],
        chatroom:               arguments[7],
        chatroom_form:          arguments[8],
        chatroom_password_form: arguments[9],
        chatroom_sidebar:       arguments[10],
        chatrooms_tab:          arguments[11],
        chats_panel:            arguments[12],
        choose_status:          arguments[13],
        contacts_panel:         arguments[14],
        contacts_tab:           arguments[15],
        controlbox:             arguments[16],
        controlbox_toggle:      arguments[17],
        field:                  arguments[18],
        form_captcha:           arguments[19],
        form_checkbox:          arguments[20],
        form_input:             arguments[21],
        form_select:            arguments[22],
        form_textarea:          arguments[23],
        form_username:          arguments[24],
        group_header:           arguments[25],
        info:                   arguments[26],
        login_panel:            arguments[27],
        login_tab:              arguments[28],
        message:                arguments[29],
        new_day:                arguments[30],
        occupant:               arguments[31],
        pending_contact:        arguments[32],
        pending_contacts:       arguments[33],
        register_panel:         arguments[34],
        register_tab:           arguments[35],
        registration_form:      arguments[36],
        registration_request:   arguments[37],
        requesting_contact:     arguments[38],
        requesting_contacts:    arguments[39],
        room_description:       arguments[40],
        room_item:              arguments[41],
        room_panel:             arguments[42],
        roster:                 arguments[43],
        roster_item:            arguments[44],
        search_contact:         arguments[45],
        select_option:          arguments[46],
        status_option:          arguments[47],
        toggle_chats:           arguments[48],
        toolbar:                arguments[49],
        toolbar_otr:            arguments[50],
        trimmed_chat:           arguments[51],
        vcard:                  arguments[52]
    };
});

/*global escape, locales, Jed */
(function (root, factory) {
    define('utils',[
        "jquery",
        "jquery.browser",
        "underscore",
        "converse-templates"
    ], factory);
}(this, function ($, dummy, _, templates) {
    "use strict";

    var XFORM_TYPE_MAP = {
        'text-private': 'password',
        'text-single': 'text',
        'fixed': 'label',
        'boolean': 'checkbox',
        'hidden': 'hidden',
        'jid-multi': 'textarea',
        'list-single': 'dropdown',
        'list-multi': 'dropdown'
    };

    $.expr[':'].emptyVal = function(obj){
        return obj.value === '';
    };

    $.fn.hasScrollBar = function() {
        if (!$.contains(document, this.get(0))) {
            return false;
        }
        if(this.parent().height() < this.get(0).scrollHeight) {
            return true;
        }
        return false;
    };

    $.fn.addHyperlinks = function () {
        if (this.length > 0) {
            this.each(function (i, obj) {
                var x = $(obj).html();
                var list = x.match(/\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g );
                if (list) {
                    for (i=0; i<list.length; i++) {
                        var prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                        var escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        x = x.replace(list[i], "<a target='_blank' href='" + prot + escaped_url + "'>"+ list[i] + "</a>" );
                    }
                }
                $(obj).html(x);
            });
        }
        return this;
    };

    $.fn.addEmoticons = function (allowed) {
        if (allowed) {
            if (this.length > 0) {
                this.each(function (i, obj) {
                    var text = $(obj).html();
                    text = text.replace(/&gt;:\)/g, '<span class="emoticon icon-evil"></span>');
                    text = text.replace(/:\)/g, '<span class="emoticon icon-smiley"></span>');
                    text = text.replace(/:\-\)/g, '<span class="emoticon icon-smiley"></span>');
                    text = text.replace(/;\)/g, '<span class="emoticon icon-wink"></span>');
                    text = text.replace(/;\-\)/g, '<span class="emoticon icon-wink"></span>');
                    text = text.replace(/:D/g, '<span class="emoticon icon-grin"></span>');
                    text = text.replace(/:\-D/g, '<span class="emoticon icon-grin"></span>');
                    text = text.replace(/:P/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:\-P/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:p/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/:\-p/g, '<span class="emoticon icon-tongue"></span>');
                    text = text.replace(/8\)/g, '<span class="emoticon icon-cool"></span>');
                    text = text.replace(/:S/g, '<span class="emoticon icon-confused"></span>');
                    text = text.replace(/:\\/g, '<span class="emoticon icon-wondering"></span>');
                    text = text.replace(/:\/ /g, '<span class="emoticon icon-wondering"></span>');
                    text = text.replace(/&gt;:\(/g, '<span class="emoticon icon-angry"></span>');
                    text = text.replace(/:\(/g, '<span class="emoticon icon-sad"></span>');
                    text = text.replace(/:\-\(/g, '<span class="emoticon icon-sad"></span>');
                    text = text.replace(/:O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/:\-O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/\=\-O/g, '<span class="emoticon icon-shocked"></span>');
                    text = text.replace(/\(\^.\^\)b/g, '<span class="emoticon icon-thumbs-up"></span>');
                    text = text.replace(/&lt;3/g, '<span class="emoticon icon-heart"></span>');
                    $(obj).html(text);
                });
            }
        }
        return this;
    };

    var utils = {
        // Translation machinery
        // ---------------------
        __: function (str) {
            if (typeof Jed === "undefined") {
                return str;
            }
            // FIXME: this can be refactored to take the i18n obj as a
            // parameter.
            // Translation factory
            if (typeof this.i18n === "undefined") {
                this.i18n = locales.en;
            }
            if (typeof this.i18n === "string") {
                this.i18n = $.parseJSON(this.i18n);
            }
            if (typeof this.jed === "undefined") {
                this.jed = new Jed(this.i18n);
            }
            var t = this.jed.translate(str);
            if (arguments.length>1) {
                return t.fetch.apply(t, [].slice.call(arguments,1));
            } else {
                return t.fetch();
            }
        },

        ___: function (str) {
            /* XXX: This is part of a hack to get gettext to scan strings to be
             * translated. Strings we cannot send to the function above because
             * they require variable interpolation and we don't yet have the
             * variables at scan time.
             *
             * See actionInfoMessages in src/converse-muc.js
             */
            return str;
        },

        refreshWebkit: function () {
            /* This works around a webkit bug. Refreshes the browser's viewport,
             * otherwise chatboxes are not moved along when one is closed.
             */
            if ($.browser.webkit) {
                var conversejs = document.getElementById('conversejs');
                conversejs.style.display = 'none';
                var tmp = conversejs.offsetHeight; // jshint ignore:line
                conversejs.style.display = 'block';
            }
        },

        webForm2xForm: function (field) {
            /* Takes an HTML DOM and turns it into an XForm field.
            *
            * Parameters:
            *      (DOMElement) field - the field to convert
            */
            var $input = $(field), value;
            if ($input.is('[type=checkbox]')) {
                value = $input.is(':checked') && 1 || 0;
            } else if ($input.is('textarea')) {
                value = [];
                var lines = $input.val().split('\n');
                for( var vk=0; vk<lines.length; vk++) {
                    var val = $.trim(lines[vk]);
                    if (val === '')
                        continue;
                    value.push(val);
                }
            } else {
                value = $input.val();
            }
            return $(templates.field({
                name: $input.attr('name'),
                value: value
            }))[0];
        },

        contains: function (attr, query) {
            return function (item) {
                if (typeof attr === 'object') {
                    var value = false;
                    _.each(attr, function (a) {
                        value = value || item.get(a).toLowerCase().indexOf(query.toLowerCase()) !== -1;
                    });
                    return value;
                } else if (typeof attr === 'string') {
                    return item.get(attr).toLowerCase().indexOf(query.toLowerCase()) !== -1;
                } else {
                    throw new TypeError('contains: wrong attribute type. Must be string or array.');
                }
            };
        },

        xForm2webForm: function ($field, $stanza) {
            /* Takes a field in XMPP XForm (XEP-004: Data Forms) format
            * and turns it into a HTML DOM field.
            *
            *  Parameters:
            *      (XMLElement) field - the field to convert
            */

            // FIXME: take <required> into consideration
            var options = [], j, $options, $values, value, values;

            if ($field.attr('type') === 'list-single' || $field.attr('type') === 'list-multi') {
                values = [];
                $values = $field.children('value');
                for (j=0; j<$values.length; j++) {
                    values.push($($values[j]).text());
                }
                $options = $field.children('option');
                for (j=0; j<$options.length; j++) {
                    value = $($options[j]).find('value').text();
                    options.push(templates.select_option({
                        value: value,
                        label: $($options[j]).attr('label'),
                        selected: (values.indexOf(value) >= 0),
                        required: $field.find('required').length
                    }));
                }
                return templates.form_select({
                    name: $field.attr('var'),
                    label: $field.attr('label'),
                    options: options.join(''),
                    multiple: ($field.attr('type') === 'list-multi'),
                    required: $field.find('required').length
                });
            } else if ($field.attr('type') === 'fixed') {
                return $('<p class="form-help">').text($field.find('value').text());
            } else if ($field.attr('type') === 'jid-multi') {
                return templates.form_textarea({
                    name: $field.attr('var'),
                    label: $field.attr('label') || '',
                    value: $field.find('value').text(),
                    required: $field.find('required').length
                });
            } else if ($field.attr('type') === 'boolean') {
                return templates.form_checkbox({
                    name: $field.attr('var'),
                    type: XFORM_TYPE_MAP[$field.attr('type')],
                    label: $field.attr('label') || '',
                    checked: $field.find('value').text() === "1" && 'checked="1"' || '',
                    required: $field.find('required').length
                });
            } else if ($field.attr('type') && $field.attr('var') === 'username') {
                return templates.form_username({
                    domain: ' @'+this.domain,
                    name: $field.attr('var'),
                    type: XFORM_TYPE_MAP[$field.attr('type')],
                    label: $field.attr('label') || '',
                    value: $field.find('value').text(),
                    required: $field.find('required').length
                });
            } else if ($field.attr('type')) {
                return templates.form_input({
                    name: $field.attr('var'),
                    type: XFORM_TYPE_MAP[$field.attr('type')],
                    label: $field.attr('label') || '',
                    value: $field.find('value').text(),
                    required: $field.find('required').length
                });
            } else {
                if ($field.attr('var') === 'ocr') { // Captcha
                    return _.reduce(_.map($field.find('uri'),
                            $.proxy(function (uri) {
                                return templates.form_captcha({
                                    label: this.$field.attr('label'),
                                    name: this.$field.attr('var'),
                                    data: this.$stanza.find('data[cid="'+uri.textContent.replace(/^cid:/, '')+'"]').text(),
                                    type: uri.getAttribute('type'),
                                    required: this.$field.find('required').length
                                });
                            }, {'$stanza': $stanza, '$field': $field})
                        ),
                        function (memo, num) { return memo + num; }, ''
                    );
                }
            }
        }
    };

    utils.contains.not = function (attr, query) {
        return function (item) {
            return !(utils.contains(attr, query)(item));
        };
    };
    return utils;
}));

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (position === undefined || position > subjectString.length) {
          position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}

String.prototype.splitOnce = function (delimiter) {
    var components = this.split(delimiter);
    return [components.shift(), components.join(delimiter)];
};

if (!String.prototype.trim) {
    String.prototype.trim = function () {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}
;
define("polyfill", function(){});

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, document, locales */

(function (root, factory) {
    // Two modules are loaded as dependencies.
    //
    // * **converse-dependencies**: A list of dependencies converse.js depends on.
    //   The path to this module is in main.js and the module itself can be overridden.
    // * **converse-templates**: The HTML templates used by converse.js.
    //
    // The dependencies are then split up and passed into the factory function,
    // which contains and instantiates converse.js.
    define("converse-core", [
        "jquery",
        "underscore",
        "polyfill",
        "utils",
        "moment_with_locales",
        "strophe",
        "converse-templates",
        "strophe.disco",
        "strophe.rsm",
        "strophe.vcard",
        "backbone.browserStorage",
        "backbone.overview",
        "typeahead",
    ], factory);
}(this, function ($, _, dummy, utils, moment, Strophe, templates) {
    /* 
     * Cannot use this due to Safari bug.
     * See https://github.com/jcbrand/converse.js/issues/196
     */
    // "use strict";

    // Strophe globals
    var $build = Strophe.$build;
    var $iq = Strophe.$iq;
    var $msg = Strophe.$msg;
    var $pres = Strophe.$pres;
    var b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    // Use Mustache style syntax for variable interpolation
    /* Configuration of underscore templates (this config is distinct to the
     * config of requirejs-tpl in main.js). This one is for normal inline templates.
     */
    _.templateSettings = {
        evaluate : /\{\[([\s\S]+?)\]\}/g,
        interpolate : /\{\{([\s\S]+?)\}\}/g
    };

    // We create an object to act as the "this" context for event handlers (as
    // defined below and accessible via converse_api.listen).
    // We don't want the inner converse object to be the context, since it
    // contains sensitive information, and we don't want it to be something in
    // the DOM or window, because then anyone can trigger converse events.
    var event_context = {};

    var converse = {
        plugins: {},
        initialized_plugins: [],
        templates: templates,
        emit: function (evt, data) {
            $(event_context).trigger(evt, data);
        },
        once: function (evt, handler) {
            $(event_context).one(evt, handler);
        },
        on: function (evt, handler) {
            $(event_context).bind(evt, handler);
        },
        off: function (evt, handler) {
            $(event_context).unbind(evt, handler);
        }
    };

    // Module-level constants
    converse.STATUS_WEIGHTS = {
        'offline':      6,
        'unavailable':  5,
        'xa':           4,
        'away':         3,
        'dnd':          2,
        'chat':         1, // We currently don't differentiate between "chat" and "online"
        'online':       1
    };
    converse.LOGIN = "login";
    converse.ANONYMOUS  = "anonymous";
    converse.PREBIND = "prebind";
    converse.OPENED = 'opened';
    converse.CLOSED = 'closed';

    var KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };

    var PRETTY_CONNECTION_STATUS = {
        0: 'ERROR',
        1: 'CONNECTING',
        2: 'CONNFAIL',
        3: 'AUTHENTICATING',
        4: 'AUTHFAIL',
        5: 'CONNECTED',
        6: 'DISCONNECTED',
        7: 'DISCONNECTING',
        8: 'ATTACHED',
        9: 'REDIRECT'
    };

    // TODO Refactor into external MAM plugin
    // XEP-0059 Result Set Management
    var RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
    // XEP-0313 Message Archive Management
    var MAM_ATTRIBUTES = ['with', 'start', 'end'];
    converse.queryForArchivedMessages = function (options, callback, errback) {
        /* Do a MAM (XEP-0313) query for archived messages.
            *
            * Parameters:
            *    (Object) options - Query parameters, either MAM-specific or also for Result Set Management.
            *    (Function) callback - A function to call whenever we receive query-relevant stanza.
            *    (Function) errback - A function to call when an error stanza is received.
            *
            * The options parameter can also be an instance of
            * Strophe.RSM to enable easy querying between results pages.
            *
            * The callback function may be called multiple times, first
            * for the initial IQ result and then for each message
            * returned. The last time the callback is called, a
            * Strophe.RSM object is returned on which "next" or "previous"
            * can be called before passing it in again to this method, to
            * get the next or previous page in the result set.
            */
        var date, messages = [];
        if (typeof options === "function") {
            callback = options;
            errback = callback;
        }
        if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
            converse.log('This server does not support XEP-0313, Message Archive Management');
            errback(null);
            return;
        }
        var queryid = converse.connection.getUniqueId();
        var attrs = {'type':'set'};
        if (typeof options !== "undefined" && options.groupchat) {
            if (!options['with']) {
                throw new Error('You need to specify a "with" value containing the chat room JID, when querying groupchat messages.');
            }
            attrs.to = options['with'];
        }
        var stanza = $iq(attrs).c('query', {'xmlns':Strophe.NS.MAM, 'queryid':queryid});
        if (typeof options !== "undefined") {
            stanza.c('x', {'xmlns':Strophe.NS.XFORM, 'type': 'submit'})
                    .c('field', {'var':'FORM_TYPE', 'type': 'hidden'})
                    .c('value').t(Strophe.NS.MAM).up().up();

            if (options['with'] && !options.groupchat) {
                stanza.c('field', {'var':'with'}).c('value').t(options['with']).up().up();
            }
            _.each(['start', 'end'], function (t) {
                if (options[t]) {
                    date = moment(options[t]);
                    if (date.isValid()) {
                        stanza.c('field', {'var':t}).c('value').t(date.format()).up().up();
                    } else {
                        throw new TypeError('archive.query: invalid date provided for: '+t);
                    }
                }
            });
            stanza.up();
            if (options instanceof Strophe.RSM) {
                stanza.cnode(options.toXML());
            } else if (_.intersection(RSM_ATTRIBUTES, _.keys(options)).length) {
                stanza.cnode(new Strophe.RSM(options).toXML());
            }
        }
        converse.connection.addHandler(function (message) {
            var $msg = $(message), $fin, rsm;
            if (typeof callback === "function") {
                $fin = $msg.find('fin[xmlns="'+Strophe.NS.MAM+'"]');
                if ($fin.length) {
                    rsm = new Strophe.RSM({xml: $fin.find('set')[0]});
                    _.extend(rsm, _.pick(options, ['max']));
                    _.extend(rsm, _.pick(options, MAM_ATTRIBUTES));
                    callback(messages, rsm);
                    return false; // We've received all messages, decommission this handler
                } else if (queryid === $msg.find('result').attr('queryid')) {
                    messages.push(message);
                }
                return true;
            } else {
                return false; // There's no callback, so no use in continuing this handler.
            }
        }, Strophe.NS.MAM);
        converse.connection.sendIQ(stanza, null, errback, converse.message_archiving_timeout);
    };


    converse.log = function (txt, level) {
        var logger;
        if (typeof console === "undefined" || typeof console.log === "undefined") {
            logger = { log: function () {}, error: function () {} };
        } else {
            logger = console;
        }
        if (converse.debug) {
            if (level === 'error') {
                logger.log('ERROR: '+txt);
            } else {
                logger.log(txt);
            }
        }
    };


    converse.initialize = function (settings, callback) {
        "use strict";
        var converse = this;
        var unloadevent;
        if ('onpagehide' in window) {
            // Pagehide gets thrown in more cases than unload. Specifically it
            // gets thrown when the page is cached and not just
            // closed/destroyed. It's the only viable event on mobile Safari.
            // https://www.webkit.org/blog/516/webkit-page-cache-ii-the-unload-event/
            unloadevent = 'pagehide';
        } else if ('onbeforeunload' in window) {
            unloadevent = 'beforeunload';
        } else if ('onunload' in window) {
            unloadevent = 'unload';
        }

        // Logging
        Strophe.log = function (level, msg) { converse.log(level+' '+msg, level); };
        Strophe.error = function (msg) { converse.log(msg, 'error'); };

        // Add Strophe Namespaces
        Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
        Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
        Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
        Strophe.addNamespace('MAM', 'urn:xmpp:mam:0');
        Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
        Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
        Strophe.addNamespace('XFORM', 'jabber:x:data');

        // Instance level constants
        this.TIMEOUTS = { // Set as module attr so that we can override in tests.
            'PAUSED':     20000,
            'INACTIVE':   90000
        };

        // XEP-0085 Chat states
        // http://xmpp.org/extensions/xep-0085.html
        this.INACTIVE = 'inactive';
        this.ACTIVE = 'active';
        this.COMPOSING = 'composing';
        this.PAUSED = 'paused';
        this.GONE = 'gone';


        // Detect support for the user's locale
        // ------------------------------------
        this.isConverseLocale = function (locale) { return typeof locales[locale] !== "undefined"; };
        this.isMomentLocale = function (locale) { return moment.locale() !== moment.locale(locale); };

        this.user_settings = settings; // Save the user settings so that they can be used by plugins

        this.wrappedChatBox = function (chatbox) {
            /* Wrap a chatbox for outside consumption (i.e. so that it can be
             * returned via the API.
             */
            if (!chatbox) { return; }
            var view = converse.chatboxviews.get(chatbox.get('jid'));
            return {
                'close': view.close.bind(view),
                'focus': view.focus.bind(view),
                'get': chatbox.get.bind(chatbox),
                // FIXME: leaky abstraction from MUC
                'is_chatroom': view.is_chatroom,
                'maximize': chatbox.maximize.bind(chatbox),
                'minimize': chatbox.minimize.bind(chatbox),
                'open': view.show.bind(view),
                'set': chatbox.set.bind(chatbox)
            };
        };

        this.isLocaleAvailable = function (locale, available) {
            /* Check whether the locale or sub locale (e.g. en-US, en) is supported.
             *
             * Parameters:
             *      (Function) available - returns a boolean indicating whether the locale is supported
             */
            if (available(locale)) {
                return locale;
            } else {
                var sublocale = locale.split("-")[0];
                if (sublocale !== locale && available(sublocale)) {
                    return sublocale;
                }
            }
        };
		
        this.detectLocale = function (library_check) {
            /* Determine which locale is supported by the user's system as well
             * as by the relevant library (e.g. converse.js or moment.js).
             *
             * Parameters:
             *      (Function) library_check - returns a boolean indicating whether the locale is supported
             */
            var locale, i;
            if (window.navigator.userLanguage) {
                locale = this.isLocaleAvailable(window.navigator.userLanguage, library_check);
            }
            if (window.navigator.languages && !locale) {
                for (i=0; i<window.navigator.languages.length && !locale; i++) {
                    locale = this.isLocaleAvailable(window.navigator.languages[i], library_check);
                }
            }
            if (window.navigator.browserLanguage && !locale) {
                locale = this.isLocaleAvailable(window.navigator.browserLanguage, library_check);
            }
            if (window.navigator.language && !locale) {
                locale = this.isLocaleAvailable(window.navigator.language, library_check);
            }
            if (window.navigator.systemLanguage && !locale) {
                locale = this.isLocaleAvailable(window.navigator.systemLanguage, library_check);
            }
            return locale || 'en';
        };
		
        if (!moment.locale) { //moment.lang is deprecated after 2.8.1, use moment.locale instead
            moment.locale = moment.lang;
        }
        moment.locale(this.detectLocale(this.isMomentLocale));
        this.i18n = settings.i18n ? settings.i18n : locales[this.detectLocale(this.isConverseLocale)];

        // Translation machinery
        // ---------------------
        var __ = utils.__.bind(this);

        // Default configuration values
        // ----------------------------
        this.default_settings = {
            allow_chat_pending_contacts: false,
            allow_contact_removal: true,
            allow_contact_requests: true,
            allow_dragresize: true,
            allow_logout: true,
            animate: true,
            archived_messages_page_size: '20',
            authentication: 'login', // Available values are "login", "prebind", "anonymous".
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_list_rooms: false,
            auto_login: false, // Currently only used in connection with anonymous login
            auto_reconnect: false,
            auto_subscribe: false,
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            bosh_service_url: undefined, // The BOSH connection manager URL.
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            debug: false,
            default_domain: undefined,
            expose_rid_and_sid: false,
            forward_messages: false,
            hide_offline_users: false,
            include_offline_state: false,
            jid: undefined,
            keepalive: false,
            locked_domain: undefined,
            message_archiving: 'never', // Supported values are 'always', 'never', 'roster' (See https://xmpp.org/extensions/xep-0313.html#prefs )
            message_archiving_timeout: 8000, // The amount of time (in milliseconds) to wait before aborting a MAM (XEP-0313) request
            message_carbons: false, // Support for XEP-280
            no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
            password: undefined,
            prebind: false, // XXX: Deprecated, use "authentication" instead.
            prebind_url: null,
            rid: undefined,
            roster_groups: false,
            show_only_online_users: false,
            show_toolbar: true,
            sid: undefined,
            storage: 'session',
            synchronize_availability: true, // Set to false to not sync with other clients or with resource name of the particular client that it should synchronize with
            use_vcards: true,
            visible_toolbar_buttons: {
                'emoticons': true,
                'call': false,
                'clear': true,
                'toggle_occupants': true
            },
            websocket_url: undefined,
            xhr_custom_status: false,
            xhr_custom_status_url: '',
            xhr_user_search: false,
            xhr_user_search_url: ''
        };

        _.extend(this, this.default_settings);
        // Allow only whitelisted configuration attributes to be overwritten
        _.extend(this, _.pick(settings, Object.keys(this.default_settings)));

        // BBB
        if (this.prebind === true) { this.authentication = converse.PREBIND; }

        if (this.authentication === converse.ANONYMOUS) {
            if (!this.jid) {
                throw("Config Error: you need to provide the server's domain via the " +
                        "'jid' option when using anonymous authentication.");
            }
        }

        if (settings.visible_toolbar_buttons) {
            _.extend(
                this.visible_toolbar_buttons,
                _.pick(settings.visible_toolbar_buttons, [
                    'emoticons', 'call', 'clear', 'toggle_occupants'
                ]
            ));
        }
        $.fx.off = !this.animate;

        // Module-level variables
        // ----------------------
        this.callback = callback || function () {};
        /* When reloading the page:
         * For new sessions, we need to send out a presence stanza to notify
         * the server/network that we're online.
         * When re-attaching to an existing session (e.g. via the keepalive
         * option), we don't need to again send out a presence stanza, because
         * it's as if "we never left" (see onConnectStatusChanged).
         * https://github.com/jcbrand/converse.js/issues/521
         */
        this.send_initial_presence = true;
        this.msg_counter = 0;
        this.reconnectTimeout = undefined;

        // Module-level functions
        // ----------------------

        this.generateResource = function () {
            return '/converse.js-' + Math.floor(Math.random()*139749825).toString();
        };

        this.sendCSI = function (stat) {
            /* Send out a Chat Status Notification (XEP-0352) */
            if (converse.features[Strophe.NS.CSI] || true) {
                converse.connection.send($build(stat, {xmlns: Strophe.NS.CSI}));
                this.inactive = (stat === converse.INACTIVE) ? true : false;
            }
        };

        this.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (this.idle_seconds > 0) {
                this.idle_seconds = 0;
            }
            if (!converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            if (this.inactive) {
                this.sendCSI(converse.ACTIVE);
            }
            if (this.auto_changed_status === true) {
                this.auto_changed_status = false;
                this.xmppstatus.setStatus('online');
            }
        };

        this.onEverySecond = function () {
            /* An interval handler running every second.
             * Used for CSI and the auto_away and auto_xa
             * features.
             */
            if (!converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            var stat = this.xmppstatus.getStatus();
            this.idle_seconds++;
            if (this.csi_waiting_time > 0 && this.idle_seconds > this.csi_waiting_time && !this.inactive) {
                this.sendCSI(converse.INACTIVE);
            }
            if (this.auto_away > 0 && this.idle_seconds > this.auto_away && stat !== 'away' && stat !== 'xa') {
                this.auto_changed_status = true;
                this.xmppstatus.setStatus('away');
            } else if (this.auto_xa > 0 && this.idle_seconds > this.auto_xa && stat !== 'xa') {
                this.auto_changed_status = true;
                this.xmppstatus.setStatus('xa');
            }
        };

        this.registerIntervalHandler = function () {
            /* Set an interval of one second and register a handler for it.
             * Required for the auto_away, auto_xa and csi_waiting_time features.
             */
            if (this.auto_away < 1 && this.auto_xa < 1 && this.csi_waiting_time < 1) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            this.idle_seconds = 0;
            this.auto_changed_status = false; // Was the user's status changed by converse.js?
            $(window).on('click mousemove keypress focus'+unloadevent , this.onUserActivity.bind(this));
            window.setInterval(this.onEverySecond.bind(this), 1000);
        };

        this.giveFeedback = function (message, klass) {
            $('.conn-feedback').each(function (idx, el) {
                var $el = $(el);
                $el.addClass('conn-feedback').text(message);
                if (klass) {
                    $el.addClass(klass);
                } else {
                    $el.removeClass('error');
                }
            });
        };

        this.rejectPresenceSubscription = function (jid, message) {
            /* Reject or cancel another user's subscription to our presence updates.
             *  Parameters:
             *    (String) jid - The Jabber ID of the user whose subscription
             *      is being canceled.
             *    (String) message - An optional message to the user
             */
            var pres = $pres({to: jid, type: "unsubscribed"});
            if (message && message !== "") { pres.c("status").t(message); }
            converse.connection.send(pres);
        };

        this.getVCard = function (jid, callback, errback) {
            /* Request the VCard of another user.
             *
             * Parameters:
             *    (String) jid - The Jabber ID of the user whose VCard is being requested.
             *    (Function) callback - A function to call once the VCard is returned
             *    (Function) errback - A function to call if an error occured
             *      while trying to fetch the VCard.
             */
            if (!this.use_vcards) {
                if (callback) { callback(jid, jid); }
                return;
            }
            converse.connection.vcard.get(
                function (iq) { // Successful callback
                    var $vcard = $(iq).find('vCard');
                    var fullname = $vcard.find('FN').text(),
                        img = $vcard.find('BINVAL').text(),
                        img_type = $vcard.find('TYPE').text(),
                        url = $vcard.find('URL').text();
                    if (jid) {
                        var contact = converse.roster.get(jid);
                        if (contact) {
                            fullname = _.isEmpty(fullname)? contact.get('fullname') || jid: fullname;
                            contact.save({
                                'fullname': fullname,
                                'image_type': img_type,
                                'image': img,
                                'url': url,
                                'vcard_updated': moment().format()
                            });
                        }
                    }
                    if (callback) { callback(iq, jid, fullname, img, img_type, url); }
                }.bind(this),
                jid,
                function (iq) { // Error callback
                    var contact = converse.roster.get(jid);
                    if (contact) {
                        contact.save({ 'vcard_updated': moment().format() });
                    }
                    if (errback) { errback(iq, jid); }
                }
            );
        };

        this.reconnect = function (condition) {
            converse.log('Attempting to reconnect in 5 seconds');
            converse.giveFeedback(__('Attempting to reconnect in 5 seconds'), 'error');
            window.clearTimeout(converse.reconnectTimeout);
            converse.reconnectTimeout = window.setTimeout(function () {
                if (converse.authentication !== "prebind") {
                    this.connection.connect(
                        this.connection.jid,
                        this.connection.pass,
                        function (status, condition) {
                            this.onConnectStatusChanged(status, condition, true);
                        }.bind(this),
                        this.connection.wait,
                        this.connection.hold,
                        this.connection.route
                    );
                } else if (converse.prebind_url) {
                    this.clearSession();
                    this._tearDown();
                    this.startNewBOSHSession();
                }
            }.bind(this), 5000);
        };

        this.onConnectStatusChanged = function (status, condition, reconnect) {
            converse.log("Status changed to: "+PRETTY_CONNECTION_STATUS[status]);
            if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
                // By default we always want to send out an initial presence stanza.
                converse.send_initial_presence = true;
                delete converse.disconnection_cause;
                if (!!converse.reconnectTimeout) {
                    window.clearTimeout(converse.reconnectTimeout);
                    delete converse.reconnectTimeout;
                }
                if ((typeof reconnect !== 'undefined') && (reconnect)) {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                    converse.onReconnected();
                } else {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                    if (converse.connection.restored) {
                        converse.send_initial_presence = false; // No need to send an initial presence stanza when
                                                                // we're restoring an existing session.
                    }
                    converse.onConnected();
                }
            } else if (status === Strophe.Status.DISCONNECTED) {
                if (converse.disconnection_cause === Strophe.Status.CONNFAIL && converse.auto_reconnect) {
                    converse.reconnect(condition);
                } else {
                    converse.renderLoginPanel();
                }
            } else if (status === Strophe.Status.ERROR) {
                converse.giveFeedback(__('Error'), 'error');
            } else if (status === Strophe.Status.CONNECTING) {
                converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.AUTHENTICATING) {
                converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                converse.giveFeedback(__('Authentication Failed'), 'error');
                converse.connection.disconnect(__('Authentication Failed'));
                converse.disconnection_cause = Strophe.Status.AUTHFAIL;
            } else if (status === Strophe.Status.CONNFAIL) {
                converse.disconnection_cause = Strophe.Status.CONNFAIL;
            } else if (status === Strophe.Status.DISCONNECTING) {
                // FIXME: what about prebind?
                if (!converse.connection.connected) {
                    converse.renderLoginPanel();
                }
                if (condition) {
                    converse.giveFeedback(condition, 'error');
                }
            }
        };

        this.applyDragResistance = function (value, default_value) {
            /* This method applies some resistance around the
             * default_value. If value is close enough to
             * default_value, then default_value is returned instead.
             */
            if (typeof value === 'undefined') {
                return undefined;
            } else if (typeof default_value === 'undefined') {
                return value;
            }
            var resistance = 10;
            if ((value !== default_value) &&
                (Math.abs(value- default_value) < resistance)) {
                return default_value;
            }
            return value;
        };

        this.updateMsgCounter = function () {
            if (this.msg_counter > 0) {
                if (document.title.search(/^Messages \(\d+\) /) === -1) {
                    document.title = "Messages (" + this.msg_counter + ") " + document.title;
                } else {
                    document.title = document.title.replace(/^Messages \(\d+\) /, "Messages (" + this.msg_counter + ") ");
                }
                window.blur();
                window.focus();
            } else if (document.title.search(/^Messages \(\d+\) /) !== -1) {
                document.title = document.title.replace(/^Messages \(\d+\) /, "");
            }
        };

        this.incrementMsgCounter = function () {
            this.msg_counter += 1;
            this.updateMsgCounter();
        };

        this.clearMsgCounter = function () {
            this.msg_counter = 0;
            this.updateMsgCounter();
        };

        this.initStatus = function (callback) {
            this.xmppstatus = new this.XMPPStatus();
            var id = b64_sha1('converse.xmppstatus-'+converse.bare_jid);
            this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
            this.xmppstatus.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.xmppstatus.fetch({success: callback, error: callback});
        };

        this.initSession = function () {
            this.session = new this.Session();
            var id = b64_sha1('converse.bosh-session');
            this.session.id = id; // Appears to be necessary for backbone.browserStorage
            this.session.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.session.fetch();
        };

        this.clearSession = function () {
            if (this.roster) {
                this.roster.browserStorage._clear();
            }
            this.session.browserStorage._clear();
        };

        this.logOut = function () {
            converse.auto_login = false;
            converse.chatboxviews.closeAllChatBoxes();
            converse.clearSession();
            converse.connection.disconnect();
        };

        this.registerGlobalEventHandlers = function () {
            $(document).on('mousemove', function (ev) {
                if (!this.resizing || !this.allow_dragresize) { return true; }
                ev.preventDefault();
                this.resizing.chatbox.resizeChatBox(ev);
            }.bind(this));

            $(document).on('mouseup', function (ev) {
                if (!this.resizing || !this.allow_dragresize) { return true; }
                ev.preventDefault();
                var height = this.applyDragResistance(
                        this.resizing.chatbox.height,
                        this.resizing.chatbox.model.get('default_height')
                );
                var width = this.applyDragResistance(
                        this.resizing.chatbox.width,
                        this.resizing.chatbox.model.get('default_width')
                );
                if (this.connection.connected) {
                    this.resizing.chatbox.model.save({'height': height});
                    this.resizing.chatbox.model.save({'width': width});
                } else {
                    this.resizing.chatbox.model.set({'height': height});
                    this.resizing.chatbox.model.set({'width': width});
                }
                this.resizing = null;
            }.bind(this));

            $(window).on("blur focus", function (ev) {
                if ((converse.windowState !== ev.type) && (ev.type === 'focus')) {
                    converse.clearMsgCounter();
                }
                converse.windowState = ev.type;
            });

            $(window).on("resize", _.debounce(function (ev) {
                this.chatboxviews.trimChats();
            }.bind(this), 200));
        };

        this.onReconnected = function () {
            // We need to re-register all the event handlers on the newly
            // created connection.
            var deferred = new $.Deferred();
            this.initStatus(function () {
                // FIXME: leaky abstraction from RosterView
                this.rosterview.registerRosterXHandler();
                this.rosterview.registerPresenceHandler();
                this.chatboxes.registerMessageHandler();
                this.xmppstatus.sendPresence();
                this.giveFeedback(__('Contacts'));
                deferred.resolve();
            }.bind(this));
            return deferred.promise();
        };

        this.enableCarbons = function () {
            /* Ask the XMPP server to enable Message Carbons
             * See XEP-0280 https://xmpp.org/extensions/xep-0280.html#enabling
             */
            if (!this.message_carbons || this.session.get('carbons_enabled')) {
                return;
            }
            var carbons_iq = new Strophe.Builder('iq', {
                from: this.connection.jid,
                id: 'enablecarbons',
                type: 'set'
              })
              .c('enable', {xmlns: Strophe.NS.CARBONS});
            this.connection.addHandler(function (iq) {
                if ($(iq).find('error').length > 0) {
                    converse.log('ERROR: An error occured while trying to enable message carbons.');
                } else {
                    this.session.save({carbons_enabled: true});
                    converse.log('Message carbons have been enabled.');
                }
            }.bind(this), null, "iq", null, "enablecarbons");
            this.connection.send(carbons_iq);
        };

        this.onConnected = function (callback) {
            // When reconnecting, there might be some open chat boxes. We don't
            // know whether these boxes are of the same account or not, so we
            // close them now.
            var deferred = new $.Deferred();
            this.chatboxviews.closeAllChatBoxes();
            this.jid = this.connection.jid;
            this.bare_jid = Strophe.getBareJidFromJid(this.connection.jid);
            this.resource = Strophe.getResourceFromJid(this.connection.jid);
            this.domain = Strophe.getDomainFromJid(this.connection.jid);
            this.minimized_chats = new converse.MinimizedChats({model: this.chatboxes});
            this.features = new this.Features();
            this.enableCarbons();
            this.initStatus(function () {
                this.registerIntervalHandler();				
                this.roster = new this.RosterContacts();
                this.roster.browserStorage = new Backbone.BrowserStorage[this.storage](
                    b64_sha1('converse.contacts-'+this.bare_jid));
                this.chatboxes.onConnected();
                this.giveFeedback(__('Contacts'));
                if (typeof this.callback === 'function') {
                    // A callback method may be passed in via the
                    // converse.initialize method.
                    // XXX: Can we use $.Deferred instead of this callback?
                    if (this.connection.service === 'jasmine tests') {
                        // XXX: Call back with the internal converse object. This
                        // object should never be exposed to production systems.
                        // 'jasmine tests' is an invalid http bind service value,
                        // so we're sure that this is just for tests.
                        this.callback(this);
                    } else  {
                        this.callback();
                    }
                }
                deferred.resolve();
            }.bind(this));
            converse.emit('ready');
            return deferred.promise();
        };


        this.RosterContact = Backbone.Model.extend({

            initialize: function (attributes, options) {
                var jid = attributes.jid;
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var resource = Strophe.getResourceFromJid(jid);
                attributes.jid = bare_jid;
                this.set(_.extend({
                    'id': bare_jid,
                    'jid': bare_jid,
                    'fullname': bare_jid,
                    'chat_status': 'offline',
                    'user_id': Strophe.getNodeFromJid(jid),
                    'resources': resource ? [resource] : [],
                    'groups': [],
                    'image_type': 'image/png',
                    'image': "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3gwHCy455JBsggAABkJJREFUeNrtnM1PE1sUwHvvTD8otWLHST/Gimi1CEgr6M6FEWuIBo2pujDVsNDEP8GN/4MbN7oxrlipG2OCgZgYlxAbkRYw1KqkIDRCSkM7nXvvW8x7vjyNeQ9m7p1p3z1LQk/v/Dhz7vkEXL161cHl9wI5Ag6IA+KAOCAOiAPigDggLhwQB2S+iNZ+PcYY/SWEEP2HAAAIoSAIoihCCP+ngDDGtVotGAz29/cfOXJEUZSOjg6n06lp2sbGRqlUWlhYyGazS0tLbrdbEASrzgksyeYJId3d3el0uqenRxRFAAAA4KdfIIRgjD9+/Pj8+fOpqSndslofEIQwHA6Pjo4mEon//qmFhYXHjx8vLi4ihBgDEnp7e9l8E0Jo165dQ0NDd+/eDYVC2/qsJElDQ0OEkKWlpa2tLZamxAhQo9EIBoOjo6MXL17csZLe3l5FUT59+lQul5l5JRaAVFWNRqN37tw5ceKEQVWRSOTw4cOFQuHbt2+iKLYCIISQLMu3b99OJpOmKAwEAgcPHszn8+vr6wzsiG6UQQhxuVyXLl0aGBgwUW0sFstkMl6v90fo1KyAMMYDAwPnzp0zXfPg4GAqlWo0Gk0MiBAiy/L58+edTqf5Aa4onj59OhaLYYybFRCEMBaL0fNxBw4cSCQStN0QRUBut3t4eJjq6U+dOiVJElVPRBFQIBDo6+ujCqirqyscDlONGykC2lYyYSR6pBoQQapHZwAoHo/TuARYAOrs7GQASFEUqn6aIiBJkhgA6ujooFpUo6iaTa7koFwnaoWadLNe81tbWwzoaJrWrICWl5cZAFpbW6OabVAEtLi4yABQsVjUNK0pAWWzWQaAcrlcswKanZ1VVZUqHYRQEwOq1Wpv3ryhCmh6erpcLjdrNl+v1ycnJ+l5UELI27dvv3//3qxxEADgy5cvExMT9Mznw4cPtFtAdAPFarU6Pj5eKpVM17yxsfHy5cvV1VXazXu62gVBKBQKT58+rdVqJqrFGL948eLdu3dU8/g/H4FBUaJYLAqC0NPTY9brMD4+PjY25mDSracOCABACJmZmXE6nUePHjWu8NWrV48ePSKEsGlAs7Agfd5nenq6Wq0mk0kjDzY2NvbkyRMIIbP2PLvhBUEQ8vl8NpuNx+M+n29bzhVjvLKycv/+/YmJCcazQuwA6YzW1tYmJyf1SY+2trZ/rRk1Go1SqfT69esHDx4UCgVmNaa/zZ/9ABUhRFXVYDB48uTJeDweiUQkSfL7/T9MA2NcqVTK5fLy8vL8/PzU1FSxWHS5XJaM4wGr9sUwxqqqer3eUCgkSZJuUBBCfTRvc3OzXC6vrKxUKhWn02nhCJ5lM4oQQo/HgxD6+vXr58+fHf8sDOp+HQDg8XgclorFU676dKLlo6yWRdItIBwQB8QBcUCtfosRQjRNQwhhjPUC4w46WXryBSHU1zgEQWBz99EFhDGu1+t+v//48ePxeFxRlD179ng8nh0Efgiher2+vr6ur3HMzMysrq7uTJVdACGEurq6Ll++nEgkPB7Pj9jPoDHqOxyqqubz+WfPnuVyuV9XPeyeagAAAoHArVu3BgcHab8CuVzu4cOHpVKJUnfA5GweY+xyuc6cOXPv3r1IJMLAR8iyPDw8XK/Xi8Wiqqqmm5KZgBBC7e3tN27cuHbtGuPVpf7+/lAoNDs7W61WzfVKpgHSSzw3b95MpVKW3MfRaDQSiczNzVUqFRMZmQOIEOL1eq9fv3727FlL1t50URRFluX5+flqtWpWEGAOIFEUU6nUlStXLKSjy759+xwOx9zcnKZpphzGHMzhcDiTydgk9r1w4YIp7RPTAAmCkMlk2FeLf/tIEKbTab/fbwtAhJBoNGrutpNx6e7uPnTokC1eMU3T0um0DZPMkZER6wERQnw+n/FFSxpy7Nix3bt3WwwIIcRgIWnHkkwmjecfRgGx7DtuV/r6+iwGhDHev3+/bQF1dnYaH6E2CkiWZdsC2rt3r8WAHA5HW1ubbQGZcjajgOwTH/4qNko1Wlg4IA6IA+KAOKBWBUQIsfNojyliKIoRRfH9+/dut9umf3wzpoUNNQ4BAJubmwz+ic+OxefzWWlBhJD29nbug7iT5sIBcUAcEAfEAXFAHBAHxOVn+QMrmWpuPZx12gAAAABJRU5ErkJggg==",
                    'status': ''
                }, attributes));

                this.on('destroy', function () { this.removeFromRoster(); }.bind(this));
            },

            subscribe: function (message) {
                /* Send a presence subscription request to this roster contact
                *
                * Parameters:
                *    (String) message - An optional message to explain the
                *      reason for the subscription request.
                */
                this.save('ask', "subscribe"); // ask === 'subscribe' Means we have ask to subscribe to them.
                var pres = $pres({to: this.get('jid'), type: "subscribe"});
                if (message && message !== "") {
                    pres.c("status").t(message).up();
                }
                var nick = converse.xmppstatus.get('fullname');
                if (nick && nick !== "") {
                    pres.c('nick', {'xmlns': Strophe.NS.NICK}).t(nick).up();
                }
                converse.connection.send(pres);
                return this;
            },

            ackSubscribe: function () {
                /* Upon receiving the presence stanza of type "subscribed",
                * the user SHOULD acknowledge receipt of that subscription
                * state notification by sending a presence stanza of type
                * "subscribe" to the contact
                */
                converse.connection.send($pres({
                    'type': 'subscribe',
                    'to': this.get('jid')
                }));
            },

            ackUnsubscribe: function (jid) {
                /* Upon receiving the presence stanza of type "unsubscribed",
                * the user SHOULD acknowledge receipt of that subscription state
                * notification by sending a presence stanza of type "unsubscribe"
                * this step lets the user's server know that it MUST no longer
                * send notification of the subscription state change to the user.
                *  Parameters:
                *    (String) jid - The Jabber ID of the user who is unsubscribing
                */
                converse.connection.send($pres({'type': 'unsubscribe', 'to': this.get('jid')}));
                this.destroy(); // Will cause removeFromRoster to be called.
            },

            unauthorize: function (message) {
                /* Unauthorize this contact's presence subscription
                * Parameters:
                *   (String) message - Optional message to send to the person being unauthorized
                */
                converse.rejectPresenceSubscription(this.get('jid'), message);
                return this;
            },

            authorize: function (message) {
                /* Authorize presence subscription
                * Parameters:
                *   (String) message - Optional message to send to the person being authorized
                */
                var pres = $pres({to: this.get('jid'), type: "subscribed"});
                if (message && message !== "") {
                    pres.c("status").t(message);
                }
                converse.connection.send(pres);
                return this;
            },

            removeResource: function (resource) {
                var resources = this.get('resources'), idx;
                if (resource) {
                    idx = _.indexOf(resources, resource);
                    if (idx !== -1) {
                        resources.splice(idx, 1);
                        this.save({'resources': resources});
                    }
                }
                else {
                    // if there is no resource (resource is null), it probably
                    // means that the user is now completely offline. To make sure
                    // that there isn't any "ghost" resources left, we empty the array
                    this.save({'resources': []});
                    return 0;
                }
                return resources.length;
            },

            removeFromRoster: function (callback) {
                /* Instruct the XMPP server to remove this contact from our roster
                * Parameters:
                *   (Function) callback
                */
                var iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', {jid: this.get('jid'), subscription: "remove"});
                converse.connection.sendIQ(iq, callback, callback);
                return this;
            },

            showInRoster: function () {
                var chatStatus = this.get('chat_status');
                if ((converse.show_only_online_users && chatStatus !== 'online') || (converse.hide_offline_users && chatStatus === 'offline')) {
                    // If pending or requesting, show
                    if ((this.get('ask') === 'subscribe') ||
                            (this.get('subscription') === 'from') ||
                            (this.get('requesting') === true)) {
                        return true;
                    }
                    return false;
                }
                return true;
            }
        });


        this.RosterContacts = Backbone.Collection.extend({
            model: converse.RosterContact,

            comparator: function (contact1, contact2) {
                var name1, name2;
                var status1 = contact1.get('chat_status') || 'offline';
                var status2 = contact2.get('chat_status') || 'offline';
                if (converse.STATUS_WEIGHTS[status1] === converse.STATUS_WEIGHTS[status2]) {
                    name1 = contact1.get('fullname').toLowerCase();
                    name2 = contact2.get('fullname').toLowerCase();
                    return name1 < name2 ? -1 : (name1 > name2? 1 : 0);
                } else  {
                    return converse.STATUS_WEIGHTS[status1] < converse.STATUS_WEIGHTS[status2] ? -1 : 1;
                }
            },

            subscribeToSuggestedItems: function (msg) {
                $(msg).find('item').each(function (i, items) {
                    if (this.getAttribute('action') === 'add') {
                        converse.roster.addAndSubscribe(
                                this.getAttribute('jid'), null, converse.xmppstatus.get('fullname'));
                    }
                });
                return true;
            },

            isSelf: function (jid) {
                return (Strophe.getBareJidFromJid(jid) === Strophe.getBareJidFromJid(converse.connection.jid));
            },

            addAndSubscribe: function (jid, name, groups, message, attributes) {
                /* Add a roster contact and then once we have confirmation from
                * the XMPP server we subscribe to that contact's presence updates.
                *  Parameters:
                *    (String) jid - The Jabber ID of the user being added and subscribed to.
                *    (String) name - The name of that user
                *    (Array of Strings) groups - Any roster groups the user might belong to
                *    (String) message - An optional message to explain the
                *      reason for the subscription request.
                *    (Object) attributes - Any additional attributes to be stored on the user's model.
                */
                this.addContact(jid, name, groups, attributes).done(function (contact) {
                    if (contact instanceof converse.RosterContact) {
                        contact.subscribe(message);
                    }
                });
            },

            sendContactAddIQ: function (jid, name, groups, callback, errback) {
                /*  Send an IQ stanza to the XMPP server to add a new roster contact.
                 *
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (Function) callback - A function to call once the VCard is returned
                 *    (Function) errback - A function to call if an error occured
                 */
                name = _.isEmpty(name)? jid: name;
                var iq = $iq({type: 'set'})
                    .c('query', {xmlns: Strophe.NS.ROSTER})
                    .c('item', { jid: jid, name: name });
                _.map(groups, function (group) { iq.c('group').t(group).up(); });
                converse.connection.sendIQ(iq, callback, errback);
            },

            addContact: function (jid, name, groups, attributes) {
                /* Adds a RosterContact instance to converse.roster and
                 * registers the contact on the XMPP server.
                 * Returns a promise which is resolved once the XMPP server has
                 * responded.
                 *
                 *  Parameters:
                 *    (String) jid - The Jabber ID of the user being added and subscribed to.
                 *    (String) name - The name of that user
                 *    (Array of Strings) groups - Any roster groups the user might belong to
                 *    (Object) attributes - Any additional attributes to be stored on the user's model.
                 */
                var deferred = new $.Deferred();
                groups = groups || [];
                name = _.isEmpty(name)? jid: name;
                this.sendContactAddIQ(jid, name, groups,
                    function (iq) {
                        var contact = this.create(_.extend({
                            ask: undefined,
                            fullname: name,
                            groups: groups,
                            jid: jid,
                            requesting: false,
                            subscription: 'none'
                        }, attributes), {sort: false});
                        deferred.resolve(contact);
                    }.bind(this),
                    function (err) {
                        alert(__("Sorry, there was an error while trying to add "+name+" as a contact."));
                        converse.log(err);
                        deferred.resolve(err);
                    }
                );
                return deferred.promise();
            },

            addResource: function (bare_jid, resource) {
                var item = this.get(bare_jid),
                    resources;
                if (item) {
                    resources = item.get('resources');
                    if (resources) {
                        if (_.indexOf(resources, resource) === -1) {
                            resources.push(resource);
                            item.set({'resources': resources});
                        }
                    } else  {
                        item.set({'resources': [resource]});
                    }
                }
            },

            subscribeBack: function (bare_jid) {
                var contact = this.get(bare_jid);
                if (contact instanceof converse.RosterContact) {
                    contact.authorize().subscribe();
                } else {
                    // Can happen when a subscription is retried or roster was deleted
                    this.addContact(bare_jid, '', [], { 'subscription': 'from' }).done(function (contact) {
                        if (contact instanceof converse.RosterContact) {
                            contact.authorize().subscribe();
                        }
                    });
                }
            },

            getNumOnlineContacts: function () {
                var count = 0,
                    ignored = ['offline', 'unavailable'],
                    models = this.models,
                    models_length = models.length,
                    i;
                if (converse.show_only_online_users) {
                    ignored = _.union(ignored, ['dnd', 'xa', 'away']);
                }
                for (i=0; i<models_length; i++) {
                    if (_.indexOf(ignored, models[i].get('chat_status')) === -1) {
                        count++;
                    }
                }
                return count;
            },

            onRosterPush: function (iq) {
                /* Handle roster updates from the XMPP server.
                * See: https://xmpp.org/rfcs/rfc6121.html#roster-syntax-actions-push
                *
                * Parameters:
                *    (XMLElement) IQ - The IQ stanza received from the XMPP server.
                */
                var id = iq.getAttribute('id');
                var from = iq.getAttribute('from');
                if (from && from !== "" && Strophe.getBareJidFromJid(from) !== converse.bare_jid) {
                    // Receiving client MUST ignore stanza unless it has no from or from = user's bare JID.
                    // XXX: Some naughty servers apparently send from a full
                    // JID so we need to explicitly compare bare jids here.
                    // https://github.com/jcbrand/converse.js/issues/493
                    converse.connection.send(
                        $iq({type: 'error', id: id, from: converse.connection.jid})
                            .c('error', {'type': 'cancel'})
                            .c('service-unavailable', {'xmlns': Strophe.NS.ROSTER })
                    );
                    return true;
                }
                converse.connection.send($iq({type: 'result', id: id, from: converse.connection.jid}));
                $(iq).children('query').find('item').each(function (idx, item) {
                    this.updateContact(item);
                }.bind(this));

                converse.emit('rosterPush', iq);
                return true;
            },

            fetchFromServer: function (callback) {
                /* Get the roster from the XMPP server */
                var iq = $iq({type: 'get', 'id': converse.connection.getUniqueId('roster')})
                        .c('query', {xmlns: Strophe.NS.ROSTER});
                return converse.connection.sendIQ(iq, function () {
                        this.onReceivedFromServer.apply(this, arguments);
                        callback.apply(this, arguments);
                    }.bind(this));
            },

            onReceivedFromServer: function (iq) {
                /* An IQ stanza containing the roster has been received from
                * the XMPP server.
                */
                converse.emit('roster', iq);
                $(iq).children('query').find('item').each(function (idx, item) {
                    this.updateContact(item);
                }.bind(this));
            },

            updateContact: function (item) {
                /* Update or create RosterContact models based on items
                * received in the IQ from the server.
                */
                var jid = item.getAttribute('jid');
                if (this.isSelf(jid)) { return; }
                var groups = [],
                    contact = this.get(jid),
                    ask = item.getAttribute("ask"),
                    subscription = item.getAttribute("subscription");
                $.map(item.getElementsByTagName('group'), function (group) {
                    groups.push(Strophe.getText(group));
                });
                if (!contact) {
                    if ((subscription === "none" && ask === null) || (subscription === "remove")) {
                        return; // We're lazy when adding contacts.
                    }
                    this.create({
                        ask: ask,
                        fullname: item.getAttribute("name") || jid,
                        groups: groups,
                        jid: jid,
                        subscription: subscription
                    }, {sort: false});
                } else {
                    if (subscription === "remove") {
                        return contact.destroy(); // will trigger removeFromRoster
                    }
                    // We only find out about requesting contacts via the
                    // presence handler, so if we receive a contact
                    // here, we know they aren't requesting anymore.
                    // see docs/DEVELOPER.rst
                    contact.save({
                        subscription: subscription,
                        ask: ask,
                        requesting: null,
                        groups: groups
                    });
                }
            },

            createRequestingContactFromVCard: function (iq, jid, fullname, img, img_type, url) {
                /* A contact request was recieved, and we then asked for the
                 * VCard of that user.
                 */
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: fullname || bare_jid,
                    image: img,
                    image_type: img_type,
                    url: url,
                    vcard_updated: moment().format()
                };
                this.create(user_data);
                converse.emit('contactRequest', user_data);
            },

            handleIncomingSubscription: function (jid) {
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var contact = this.get(bare_jid);
                if (!converse.allow_contact_requests) {
                    converse.rejectPresenceSubscription(jid, __("This client does not allow presence subscriptions"));
                }
                if (converse.auto_subscribe) {
                    if ((!contact) || (contact.get('subscription') !== 'to')) {
                        this.subscribeBack(bare_jid);
                    } else {
                        contact.authorize();
                    }
                } else {
                    if (contact) {
                        if (contact.get('subscription') !== 'none')  {
                            contact.authorize();
                        } else if (contact.get('ask') === "subscribe") {
                            contact.authorize();
                        }
                    } else if (!contact) {
                        converse.getVCard(
                            bare_jid, this.createRequestingContactFromVCard.bind(this),
                            function (iq, jid) {
                                converse.log("Error while retrieving vcard for "+jid);
                                this.createRequestingContactFromVCard.call(this, iq, jid);
                            }.bind(this)
                        );
                    }
                }
            },

            presenceHandler: function (presence) {
                var $presence = $(presence),
                    presence_type = presence.getAttribute('type');
                if (presence_type === 'error') { return true; }
                var jid = presence.getAttribute('from'),
                    bare_jid = Strophe.getBareJidFromJid(jid),
                    resource = Strophe.getResourceFromJid(jid),
                    chat_status = $presence.find('show').text() || 'online',
                    status_message = $presence.find('status'),
                    contact = this.get(bare_jid);
                if (this.isSelf(bare_jid)) {
                    if ((converse.connection.jid !== jid)&&(presence_type !== 'unavailable')&&(converse.synchronize_availability === true || converse.synchronize_availability === resource)) {
                        // Another resource has changed its status and synchronize_availability option let to update, we'll update ours as well.
                        converse.xmppstatus.save({'status': chat_status});
                        if (status_message.length) { converse.xmppstatus.save({'status_message': status_message.text()}); }
                    }
                    return;
                } else if (($presence.find('x').attr('xmlns') || '').indexOf(Strophe.NS.MUC) === 0) {
                    return; // Ignore MUC
                }
                if (contact && (status_message.text() !== contact.get('status'))) {
                    contact.save({'status': status_message.text()});
                }
                if (presence_type === 'subscribed' && contact) {
                    contact.ackSubscribe();
                } else if (presence_type === 'unsubscribed' && contact) {
                    contact.ackUnsubscribe();
                } else if (presence_type === 'unsubscribe') {
                    return;
                } else if (presence_type === 'subscribe') {
                    this.handleIncomingSubscription(jid);
                } else if (presence_type === 'unavailable' && contact) {
                    // Only set the user to offline if there aren't any
                    // other resources still available.
                    if (contact.removeResource(resource) === 0) {
                        contact.save({'chat_status': "offline"});
                    }
                } else if (contact) { // presence_type is undefined
                    this.addResource(bare_jid, resource);
                    contact.save({'chat_status': chat_status});
                }
            }
        });


        this.Message = Backbone.Model.extend({
            idAttribute: 'msgid',
            defaults: function(){
                return {
                    msgid: converse.connection.getUniqueId()
                };
            }
        });


        this.Messages = Backbone.Collection.extend({
            model: converse.Message,
            comparator: 'time'
        });


        this.ChatBox = Backbone.Model.extend({

            initialize: function () {
                this.messages = new converse.Messages();
                this.messages.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.messages'+this.get('jid')+converse.bare_jid));
                this.save(_.extend(this.getDefaultSettings(), {
                    // The chat_state will be set to ACTIVE once the chat box is opened
                    // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                    'chat_state': undefined,
                    'box_id' : b64_sha1(this.get('jid')),
                    'minimized': this.get('minimized') || false,
                    'time_minimized': this.get('time_minimized') || moment(),
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'url': '',
                    'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                }));
            },

            getDefaultSettings: function () {
                var height = this.get('height'),
                    width = this.get('width');
                return {
                    'height': converse.applyDragResistance(height, this.get('default_height')),
                    'width': converse.applyDragResistance(width, this.get('default_width')),
                    'num_unread': this.get('num_unread') || 0
                };
            },

            maximize: function () {
                this.save({
                    'minimized': false,
                    'time_opened': moment().valueOf()
                });
            },

            minimize: function () {
                this.save({
                    'minimized': true,
                    'time_minimized': moment().format()
                });
            },

            createMessage: function ($message, $delay, archive_id) {
                $delay = $delay || $message.find('delay');
                var body = $message.children('body').text(),
                    delayed = $delay.length > 0,
                    fullname = this.get('fullname'),
                    is_groupchat = $message.attr('type') === 'groupchat',
                    msgid = $message.attr('id'),
                    chat_state = $message.find(converse.COMPOSING).length && converse.COMPOSING ||
                        $message.find(converse.PAUSED).length && converse.PAUSED ||
                        $message.find(converse.INACTIVE).length && converse.INACTIVE ||
                        $message.find(converse.ACTIVE).length && converse.ACTIVE ||
                        $message.find(converse.GONE).length && converse.GONE,
                    stamp, time, sender, from;

                if (is_groupchat) {
                    from = Strophe.unescapeNode(Strophe.getResourceFromJid($message.attr('from')));
                } else {
                    from = Strophe.getBareJidFromJid($message.attr('from'));
                }
                fullname = (_.isEmpty(fullname) ? from: fullname).split(' ')[0];
                if (delayed) {
                    stamp = $delay.attr('stamp');
                    time = stamp;
                } else {
                    time = moment().format();
                }
                if ((is_groupchat && from === this.get('nick')) || (!is_groupchat && from === converse.bare_jid)) {
                    sender = 'me';
                } else {
                    sender = 'them';
                }
                this.messages.create({
                    chat_state: chat_state,
                    delayed: delayed,
                    fullname: fullname,
                    message: body || undefined,
                    msgid: msgid,
                    sender: sender,
                    time: time,
                    archive_id: archive_id
                });
            }
        });

        this.ChatBoxView = Backbone.View.extend({
            length: 200,
            tagName: 'div',
            className: 'chatbox',
            is_chatroom: false,  // This is not a multi-user chatroom

            events: {
                'click .close-chatbox-button': 'close',
                'click .toggle-chatbox-button': 'minimize',
                'keypress textarea.chat-textarea': 'keyPressed',
                'click .toggle-smiley': 'toggleEmoticonMenu',
                'click .toggle-smiley ul li': 'insertEmoticon',
                'click .toggle-clear': 'clearMessages',
                'click .toggle-call': 'toggleCall',
                'mousedown .dragresize-top': 'onStartVerticalResize',
                'mousedown .dragresize-left': 'onStartHorizontalResize',
                'mousedown .dragresize-topleft': 'onStartDiagonalResize'
            },

            initialize: function () {
                $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                this.model.messages.on('add', this.onMessageAdded, this);
                this.model.on('show', this.show, this);
                this.model.on('destroy', this.hide, this);
                // TODO check for changed fullname as well
                this.model.on('change:chat_state', this.sendChatState, this);
                this.model.on('change:chat_status', this.onChatStatusChanged, this);
                this.model.on('change:image', this.renderAvatar, this);
                this.model.on('change:minimized', this.onMinimizedChanged, this);
                this.model.on('change:status', this.onStatusChanged, this);
                this.model.on('showHelpMessages', this.showHelpMessages, this);
                this.model.on('sendMessage', this.sendMessage, this);
                this.updateVCard().render().fetchMessages().insertIntoPage().hide();
            },

            render: function () {
                this.$el.attr('id', this.model.get('box_id'))
                    .html(converse.templates.chatbox(
                            _.extend(this.model.toJSON(), {
                                    show_toolbar: converse.show_toolbar,
                                    info_close: __('Close this chat box'),
                                    info_minimize: __('Minimize this chat box'),
                                    info_view: __('View more information on this person'),
                                    label_personal_message: __('Personal message')
                                }
                            )
                        )
                    );
                this.setWidth();
                this.$content = this.$el.find('.chat-content');
                this.renderToolbar().renderAvatar();
                this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                converse.emit('chatBoxOpened', this);
                window.setTimeout(utils.refreshWebkit, 50);
                return this.showStatusMessage();
            },

            setWidth: function () {
                // If a custom width is applied (due to drag-resizing),
                // then we need to set the width of the .chatbox element as well.
                if (this.model.get('width')) {
                    this.$el.css('width', this.model.get('width'));
                }
            },

            onScroll: function (ev) {
                if ($(ev.target).scrollTop() === 0 && this.model.messages.length) {
                    this.fetchArchivedMessages({
                        'before': this.model.messages.at(0).get('archive_id'),
                        'with': this.model.get('jid'),
                        'max': converse.archived_messages_page_size
                    });
                }
            },

            fetchMessages: function () {
                /* Responsible for fetching previously sent messages, first
                 * from session storage, and then once that's done by calling
                 * fetchArchivedMessages, which fetches from the XMPP server if
                 * applicable.
                 */
                this.model.messages.fetch({
                    'add': true,
                    'success': function () {
                            if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                                return;
                            }
                            if (this.model.messages.length < converse.archived_messages_page_size) {
                                this.fetchArchivedMessages({
                                    'before': '', // Page backwards from the most recent message
                                    'with': this.model.get('jid'),
                                    'max': converse.archived_messages_page_size
                                });
                            }
                        }.bind(this)
                });
                return this;
            },

            fetchArchivedMessages: function (options) {
                /* Fetch archived chat messages from the XMPP server.
                 *
                 * Then, upon receiving them, call onMessage on the chat box,
                 * so that they are displayed inside it.
                 */
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                    return;
                }
                this.addSpinner();
                converse.queryForArchivedMessages(options, function (messages) {
                        this.clearSpinner();
                        if (messages.length) {
                            _.map(messages, converse.chatboxes.onMessage.bind(converse.chatboxes));
                        }
                    }.bind(this),
                    function () {
                        this.clearSpinner();
                        converse.log("Error while trying to fetch archived messages", "error");
                    }.bind(this)
                );
            },

            insertIntoPage: function () {
                /* This method gets overridden in src/converse-controlbox.js if
                 * the controlbox plugin is active.
                 */
                $('#conversejs').prepend(this.$el);
                return this;
            },

            adjustToViewport: function () {
                /* Event handler called when viewport gets resized. We remove
                 * custom width/height from chat boxes.
                 */
                var viewport_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
                var viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
                if (viewport_width <= 480) {
                    this.model.set('height', undefined);
                    this.model.set('width', undefined);
                } else if (viewport_width <= this.model.get('width')) {
                    this.model.set('width', undefined);
                } else if (viewport_height <= this.model.get('height')) {
                    this.model.set('height', undefined);
                }
            },

            initDragResize: function () {
                /* Determine and store the default box size.
                 * We need this information for the drag-resizing feature.
                 */
                var $flyout = this.$el.find('.box-flyout');
                if (typeof this.model.get('height') === 'undefined') {
                    var height = $flyout.height();
                    var width = $flyout.width();
                    this.model.set('height', height);
                    this.model.set('default_height', height);
                    this.model.set('width', width);
                    this.model.set('default_width', width);
                }
                var min_width = $flyout.css('min-width');
                var min_height = $flyout.css('min-height');
                this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) :0);
                this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) :0);
                // Initialize last known mouse position
                this.prev_pageY = 0;
                this.prev_pageX = 0;
                if (converse.connection.connected) {
                    this.height = this.model.get('height');
                    this.width = this.model.get('width');
                }
                return this;
            },

            setDimensions: function () {
                // Make sure the chat box has the right height and width.
                this.adjustToViewport();
                this.setChatBoxHeight(this.model.get('height'));
                this.setChatBoxWidth(this.model.get('width'));
            },

            clearStatusNotification: function () {
                this.$content.find('div.chat-event').remove();
            },

            showStatusNotification: function (message, keep_old) {
                if (!keep_old) {
                    this.clearStatusNotification();
                }
                var was_at_bottom = this.$content.scrollTop() + this.$content.innerHeight() >= this.$content[0].scrollHeight;
                this.$content.append($('<div class="chat-info chat-event"></div>').text(message));
                if (was_at_bottom) {
                    this.scrollDown();
                }
            },

            addSpinner: function () {
                if (!this.$content.first().hasClass('spinner')) {
                    this.$content.prepend('<span class="spinner"/>');
                }
            },

            clearSpinner: function () {
                if (this.$content.children(':first').is('span.spinner')) {
                    this.$content.children(':first').remove();
                }
            },

            prependDayIndicator: function (date) {
                /* Prepends an indicator into the chat area, showing the day as
                 * given by the passed in date.
                 *
                 * Parameters:
                 *  (String) date - An ISO8601 date string.
                 */
                var day_date = moment(date).startOf('day');
                this.$content.prepend(converse.templates.new_day({
                    isodate: day_date.format(),
                    datestring: day_date.format("dddd MMM Do YYYY")
                }));
            },

            appendMessage: function (attrs) {
                /* Helper method which appends a message to the end of the chat
                 * box's content area.
                 *
                 * Parameters:
                 *  (Object) attrs: An object containing the message attributes.
                 */
                _.compose(
                    _.debounce(this.scrollDown.bind(this), 50),
                    this.$content.append.bind(this.$content)
                )(this.renderMessage(attrs));
            },

            showMessage: function (attrs) {
                /* Inserts a chat message into the content area of the chat box.
                 * Will also insert a new day indicator if the message is on a
                 * different day.
                 *
                 * The message to show may either be newer than the newest
                 * message, or older than the oldest message.
                 *
                 * Parameters:
                 *  (Object) attrs: An object containing the message attributes.
                 */
                var $first_msg = this.$content.children('.chat-message:first'),
                    first_msg_date = $first_msg.data('isodate'),
                    last_msg_date, current_msg_date, day_date, $msgs, msg_dates, idx;
                if (!first_msg_date) {
                    this.appendMessage(attrs);
                    return;
                }
                current_msg_date = moment(attrs.time) || moment;
                last_msg_date = this.$content.children('.chat-message:last').data('isodate');

                if (typeof last_msg_date !== "undefined" && (current_msg_date.isAfter(last_msg_date) || current_msg_date.isSame(last_msg_date))) {
                    // The new message is after the last message
                    if (current_msg_date.isAfter(last_msg_date, 'day')) {
                        // Append a new day indicator
                        day_date = moment(current_msg_date).startOf('day');
                        this.$content.append(converse.templates.new_day({
                            isodate: current_msg_date.format(),
                            datestring: current_msg_date.format("dddd MMM Do YYYY")
                        }));
                    }
                    this.appendMessage(attrs);
                    return;
                }

                if (typeof first_msg_date !== "undefined" &&
                        (current_msg_date.isBefore(first_msg_date) ||
                            (current_msg_date.isSame(first_msg_date) && !current_msg_date.isSame(last_msg_date)))) {
                    // The new message is before the first message

                    if ($first_msg.prev().length === 0) {
                        // There's no day indicator before the first message, so we prepend one.
                        this.prependDayIndicator(first_msg_date);
                    }
                    if (current_msg_date.isBefore(first_msg_date, 'day')) {
                        _.compose(
                                this.scrollDownMessageHeight.bind(this),
                                function ($el) {
                                    this.$content.prepend($el);
                                    return $el;
                                }.bind(this)
                            )(this.renderMessage(attrs));
                        // This message is on a different day, so we add a day indicator.
                        this.prependDayIndicator(current_msg_date);
                    } else {
                        // The message is before the first, but on the same day.
                        // We need to prepend the message immediately before the
                        // first message (so that it'll still be after the day indicator).
                        _.compose(
                                this.scrollDownMessageHeight.bind(this),
                                function ($el) {
                                    $el.insertBefore($first_msg);
                                    return $el;
                                }
                            )(this.renderMessage(attrs));
                    }
                } else {
                    // We need to find the correct place to position the message
                    current_msg_date = current_msg_date.format();
                    $msgs = this.$content.children('.chat-message');
                    msg_dates = _.map($msgs, function (el) {
                        return $(el).data('isodate');
                    });
                    msg_dates.push(current_msg_date);
                    msg_dates.sort();
                    idx = msg_dates.indexOf(current_msg_date)-1;
                    _.compose(
                            this.scrollDownMessageHeight.bind(this),
                            function ($el) {
                                $el.insertAfter(this.$content.find('.chat-message[data-isodate="'+msg_dates[idx]+'"]'));
                                return $el;
                            }.bind(this)
                        )(this.renderMessage(attrs));
                }
            },

            renderMessage: function (attrs) {
                /* Renders a chat message based on the passed in attributes.
                 *
                 * Parameters:
                 *  (Object) attrs: An object containing the message attributes.
                 *
                 *  Returns:
                 *      The DOM element representing the message.
                 */
                var msg_time = moment(attrs.time) || moment,
                    text = attrs.message,
                    match = text.match(/^\/(.*?)(?: (.*))?$/),
                    fullname = this.model.get('fullname') || attrs.fullname,
                    extra_classes = attrs.delayed && 'delayed' || '',
                    template, username;

                if ((match) && (match[1] === 'me')) {
                    text = text.replace(/^\/me/, '');
                    template = converse.templates.action;
                    username = fullname;
                } else  {
                    template = converse.templates.message;
                    username = attrs.sender === 'me' && __('me') || fullname;
                }
                this.$content.find('div.chat-event').remove();

                // FIXME: leaky abstraction from MUC
                if (this.is_chatroom && attrs.sender === 'them' && (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(text)) {
                    // Add special class to mark groupchat messages in which we
                    // are mentioned.
                    extra_classes += ' mentioned';
                }
                return $(template({
                        msgid: attrs.msgid,
                        'sender': attrs.sender,
                        'time': msg_time.format('hh:mm'),
                        'isodate': msg_time.format(),
                        'username': username,
                        'message': '',
                        'extra_classes': extra_classes
                    })).children('.chat-msg-content').first().text(text)
                        .addHyperlinks()
                        .addEmoticons(converse.visible_toolbar_buttons.emoticons).parent();
            },

            showHelpMessages: function (msgs, type, spinner) {
                var i, msgs_length = msgs.length;
                for (i=0; i<msgs_length; i++) {
                    this.$content.append($('<div class="chat-'+(type||'info')+'">'+msgs[i]+'</div>'));
                }
                if (spinner === true) {
                    this.$content.append('<span class="spinner"/>');
                } else if (spinner === false) {
                    this.$content.find('span.spinner').remove();
                }
                return this.scrollDown();
            },

            handleChatStateMessage: function (message) {
                if (message.get('chat_state') === converse.COMPOSING) {
                    this.showStatusNotification(message.get('fullname')+' '+__('is typing'));
                    this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 10000);
                } else if (message.get('chat_state') === converse.PAUSED) {
                    this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                } else if (_.contains([converse.INACTIVE, converse.ACTIVE], message.get('chat_state'))) {
                    this.$content.find('div.chat-event').remove();
                } else if (message.get('chat_state') === converse.GONE) {
                    this.showStatusNotification(message.get('fullname')+' '+__('has gone away'));
                }
            },

            handleTextMessage: function (message) {
                this.showMessage(_.clone(message.attributes));
                if ((message.get('sender') !== 'me') && (converse.windowState === 'blur')) {
                    converse.incrementMsgCounter();
                }
                if (!this.model.get('minimized') && !this.$el.is(':visible')) {
                    this.show();
                }
            },

            onMessageAdded: function (message) {
                /* Handler that gets called when a new message object is created.
                 *
                 * Parameters:
                 *    (Object) message - The message Backbone object that was added.
                 */
                if (typeof this.clear_status_timeout !== 'undefined') {
                    window.clearTimeout(this.clear_status_timeout);
                    delete this.clear_status_timeout;
                }
                if (!message.get('message')) {
                    this.handleChatStateMessage(message);
                } else {
                    this.handleTextMessage(message);
                }
            },

            createMessageStanza: function (message) {
                return $msg({
                            from: converse.connection.jid,
                            to: this.model.get('jid'),
                            type: 'chat',
                            id: message.get('msgid')
                       }).c('body').t(message.get('message')).up()
                         .c(converse.ACTIVE, {'xmlns': Strophe.NS.CHATSTATES}).up();
            },

            sendMessage: function (message) {
                /* Responsible for sending off a text message.
                 *
                 *  Parameters:
                 *    (Message) message - The chat message
                 */
                // TODO: We might want to send to specfic resources.
                // Especially in the OTR case.
                var messageStanza = this.createMessageStanza(message);
                converse.connection.send(messageStanza);
                if (converse.forward_messages) {
                    // Forward the message, so that other connected resources are also aware of it.
                    converse.connection.send(
                        $msg({ to: converse.bare_jid, type: 'chat', id: message.get('msgid') })
                        .c('forwarded', {xmlns:'urn:xmpp:forward:0'})
                        .c('delay', {xmns:'urn:xmpp:delay',stamp:(new Date()).getTime()}).up()
                        .cnode(messageStanza.tree())
                    );
                }
            },

            onMessageSubmitted: function (text) {
                /* This method gets called once the user has typed a message
                 * and then pressed enter in a chat box.
                 *
                 *  Parameters:
                 *    (string) text - The chat message text.
                 */
                if (!converse.connection.authenticated) {
                    return this.showHelpMessages(
                        ['Sorry, the connection has been lost, '+
                            'and your message could not be sent'],
                        'error'
                    );
                }
                var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/), msgs;
                if (match) {
                    if (match[1] === "clear") {
                        return this.clearMessages();
                    }
                    else if (match[1] === "help") {
                        msgs = [
                            '<strong>/help</strong>:'+__('Show this menu')+'',
                            '<strong>/me</strong>:'+__('Write in the third person')+'',
                            '<strong>/clear</strong>:'+__('Remove messages')+''
                            ];
                        this.showHelpMessages(msgs);
                        return;
                    }
                }
                var fullname = converse.xmppstatus.get('fullname');
                fullname = _.isEmpty(fullname)? converse.bare_jid: fullname;
                var message = this.model.messages.create({
                    fullname: fullname,
                    sender: 'me',
                    time: moment().format(),
                    message: text
                });
                this.sendMessage(message);
            },

            sendChatState: function () {
                /* Sends a message with the status of the user in this chat session
                 * as taken from the 'chat_state' attribute of the chat box.
                 * See XEP-0085 Chat State Notifications.
                 */
                converse.connection.send(
                    $msg({'to':this.model.get('jid'), 'type': 'chat'})
                        .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES})
                );
            },

            setChatState: function (state, no_save) {
                /* Mutator for setting the chat state of this chat session.
                 * Handles clearing of any chat state notification timeouts and
                 * setting new ones if necessary.
                 * Timeouts are set when the  state being set is COMPOSING or PAUSED.
                 * After the timeout, COMPOSING will become PAUSED and PAUSED will become INACTIVE.
                 * See XEP-0085 Chat State Notifications.
                 *
                 *  Parameters:
                 *    (string) state - The chat state (consts ACTIVE, COMPOSING, PAUSED, INACTIVE, GONE)
                 *    (Boolean) no_save - Just do the cleanup or setup but don't actually save the state.
                 */
                if (typeof this.chat_state_timeout !== 'undefined') {
                    window.clearTimeout(this.chat_state_timeout);
                    delete this.chat_state_timeout;
                }
                if (state === converse.COMPOSING) {
                    this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this), converse.TIMEOUTS.PAUSED, converse.PAUSED);
                } else if (state === converse.PAUSED) {
                    this.chat_state_timeout = window.setTimeout(
                            this.setChatState.bind(this), converse.TIMEOUTS.INACTIVE, converse.INACTIVE);
                }
                if (!no_save && this.model.get('chat_state') !== state) {
                    this.model.set('chat_state', state);
                }
                return this;
            },

            keyPressed: function (ev) {
                /* Event handler for when a key is pressed in a chat box textarea.
                 */
                var $textarea = $(ev.target), message;
                if (ev.keyCode === KEY.ENTER) {
                    ev.preventDefault();
                    message = $textarea.val();
                    $textarea.val('').focus();
                    if (message !== '') {
                        if (this.model.get('chatroom')) {
                            this.onChatRoomMessageSubmitted(message);
                        } else {
                            this.onMessageSubmitted(message);
                        }
                        converse.emit('messageSend', message);
                    }
                    this.setChatState(converse.ACTIVE);
                } else if (!this.model.get('chatroom')) { // chat state data is currently only for single user chat
                    // Set chat state to composing if keyCode is not a forward-slash
                    // (which would imply an internal command and not a message).
                    this.setChatState(converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
                }
            },

            onStartVerticalResize: function (ev) {
                if (!converse.allow_dragresize) { return true; }
                // Record element attributes for mouseMove().
                this.height = this.$el.children('.box-flyout').height();
                converse.resizing = {
                    'chatbox': this,
                    'direction': 'top'
                };
                this.prev_pageY = ev.pageY;
            },

            onStartHorizontalResize: function (ev) {
                if (!converse.allow_dragresize) { return true; }
                this.width = this.$el.children('.box-flyout').width();
                converse.resizing = {
                    'chatbox': this,
                    'direction': 'left'
                };
                this.prev_pageX = ev.pageX;
            },

            onStartDiagonalResize: function (ev) {
                this.onStartHorizontalResize(ev);
                this.onStartVerticalResize(ev);
                converse.resizing.direction = 'topleft';
            },

            setChatBoxHeight: function (height) {
                if (!this.model.get('minimized')) {
                    if (height) {
                        height = converse.applyDragResistance(height, this.model.get('default_height'))+'px';
                    } else {
                        height = "";
                    }
                    this.$el.children('.box-flyout')[0].style.height = height;
                }
            },

            setChatBoxWidth: function (width) {
                if (!this.model.get('minimized')) {
                    if (width) {
                        width = converse.applyDragResistance(width, this.model.get('default_width'))+'px';
                    } else {
                        width = "";
                    }
                    this.$el[0].style.width = width;
                    this.$el.children('.box-flyout')[0].style.width = width;
                }
            },

            resizeChatBox: function (ev) {
                var diff;
                if (converse.resizing.direction.indexOf('top') === 0) {
                    diff = ev.pageY - this.prev_pageY;
                    if (diff) {
                        this.height = ((this.height-diff) > (this.model.get('min_height') || 0)) ? (this.height-diff) : this.model.get('min_height');
                        this.prev_pageY = ev.pageY;
                        this.setChatBoxHeight(this.height);
                    }
                }
                if (converse.resizing.direction.indexOf('left') !== -1) {
                    diff = this.prev_pageX - ev.pageX;
                    if (diff) {
                        this.width = ((this.width+diff) > (this.model.get('min_width') || 0)) ? (this.width+diff) : this.model.get('min_width');
                        this.prev_pageX = ev.pageX;
                        this.setChatBoxWidth(this.width);
                    }
                }
            },

            clearMessages: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                var result = confirm(__("Are you sure you want to clear the messages from this chat box?"));
                if (result === true) {
                    this.$content.empty();
                    this.model.messages.reset();
                    this.model.messages.browserStorage._clear();
                }
                return this;
            },

            insertEmoticon: function (ev) {
                ev.stopPropagation();
                this.$el.find('.toggle-smiley ul').slideToggle(200);
                var $textbox = this.$el.find('textarea.chat-textarea');
                var value = $textbox.val();
                var $target = $(ev.target);
                $target = $target.is('a') ? $target : $target.children('a');
                if (value && (value[value.length-1] !== ' ')) {
                    value = value + ' ';
                }
                $textbox.focus().val(value+$target.data('emoticon')+' ');
            },

            toggleEmoticonMenu: function (ev) {
                ev.stopPropagation();
                this.$el.find('.toggle-smiley ul').slideToggle(200);
            },

            toggleCall: function (ev) {
                ev.stopPropagation();
                converse.emit('callButtonClicked', {
                    connection: converse.connection,
                    model: this.model
                });
            },

            onChatStatusChanged: function (item) {
                var chat_status = item.get('chat_status'),
                    fullname = item.get('fullname');
                fullname = _.isEmpty(fullname)? item.get('jid'): fullname;
                if (this.$el.is(':visible')) {
                    if (chat_status === 'offline') {
                        this.showStatusNotification(fullname+' '+__('has gone offline'));
                    } else if (chat_status === 'away') {
                        this.showStatusNotification(fullname+' '+__('has gone away'));
                    } else if ((chat_status === 'dnd')) {
                        this.showStatusNotification(fullname+' '+__('is busy'));
                    } else if (chat_status === 'online') {
                        this.$el.find('div.chat-event').remove();
                    }
                }
                converse.emit('contactStatusChanged', item.attributes);
            },

            onStatusChanged: function (item) {
                this.showStatusMessage();
                converse.emit('contactStatusMessageChanged', {
                    'contact': item.attributes,
                    'message': item.get('status')
                });
            },

            onMinimizedChanged: function (item) {
                if (item.get('minimized')) {
                    this.hide();
                } else {
                    this.maximize();
                }
            },

            showStatusMessage: function (msg) {
                msg = msg || this.model.get('status');
                if (typeof msg === "string") {
                    this.$el.find('p.user-custom-message').text(msg).attr('title', msg);
                }
                return this;
            },

            close: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                if (converse.connection.connected) {
                    this.model.destroy();
                    this.setChatState(converse.INACTIVE);
                } else {
                    this.hide();
                }
                converse.emit('chatBoxClosed', this);
                return this;
            },

            onShow: function () {
                converse.chatboxviews.trimChats(this);
                utils.refreshWebkit();
                this.$content.scrollTop(this.model.get('scroll'));
                this.setChatState(converse.ACTIVE).focus();
                converse.emit('chatBoxMaximized', this);
            },

            maximize: function () {
                // Restore a minimized chat box
                $('#conversejs').prepend(this.$el);
                this.$el.show('fast', this.onShow.bind(this)); 
                return this;
            },

            minimize: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                // save the scroll position to restore it on maximize
                this.model.save({'scroll': this.$content.scrollTop()});
                // Minimizes a chat box
                this.setChatState(converse.INACTIVE).model.minimize();
                this.$el.hide('fast', utils.refreshwebkit);
                converse.emit('chatBoxMinimized', this);
            },

            updateVCard: function () {
                if (!this.use_vcards) { return this; }
                var jid = this.model.get('jid'),
                    contact = converse.roster.get(jid);
                if ((contact) && (!contact.get('vcard_updated'))) {
                    converse.getVCard(
                        jid,
                        function (iq, jid, fullname, image, image_type, url) {
                            this.model.save({
                                'fullname' : fullname || jid,
                                'url': url,
                                'image_type': image_type,
                                'image': image
                            });
                        }.bind(this),
                        function () {
                            converse.log("ChatBoxView.initialize: An error occured while fetching vcard");
                        }
                    );
                }
                return this;
            },

            renderToolbar: function (options) {
                if (!converse.show_toolbar) {
                    return;
                }
                options = _.extend(options || {}, {
                    label_clear: __('Clear all messages'),
                    label_hide_occupants: __('Hide the list of occupants'),
                    label_insert_smiley: __('Insert a smiley'),
                    label_start_call: __('Start a call'),
                    show_call_button: converse.visible_toolbar_buttons.call,
                    show_clear_button: converse.visible_toolbar_buttons.clear,
                    show_emoticons: converse.visible_toolbar_buttons.emoticons,
                    // FIXME Leaky abstraction MUC
                    show_occupants_toggle: this.is_chatroom && converse.visible_toolbar_buttons.toggle_occupants
                });
                this.$el.find('.chat-toolbar').html(converse.templates.toolbar(_.extend(this.model.toJSON(), options || {})));
                return this;
            },

            renderAvatar: function () {
                if (!this.model.get('image')) {
                    return;
                }
                var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                    canvas = $('<canvas height="32px" width="32px" class="avatar"></canvas>').get(0);

                if (!(canvas.getContext && canvas.getContext('2d'))) {
                    return this;
                }
                var ctx = canvas.getContext('2d');
                var img = new Image();   // Create new Image object
                img.onload = function () {
                    var ratio = img.width/img.height;
                    if (ratio < 1) {
                        ctx.drawImage(img, 0,0, 32, 32*(1/ratio));
                    } else {
                        ctx.drawImage(img, 0,0, 32, 32*ratio);
                    }

                };
                img.src = img_src;
                this.$el.find('.chat-title').before(canvas);
                return this;
            },

            focus: function () {
                this.$el.find('.chat-textarea').focus();
                converse.emit('chatBoxFocused', this);
                return this;
            },

            hide: function () {
                if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                    this.$el.hide();
                    utils.refreshWebkit();
                }
                return this;
            },

            show: _.debounce(function (focus) {
                if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                    if (focus) { this.focus(); }
                    return this;
                }
                this.initDragResize().setDimensions();
                this.$el.fadeIn(function () {
                    if (converse.connection.connected) {
                        // Without a connection, we haven't yet initialized
                        // localstorage
                        this.model.save();
                    }
                    this.setChatState(converse.ACTIVE);
                    this.scrollDown();
                    if (focus) {
                        this.focus();
                    }
                }.bind(this));
                return this;
            }, 250, true),

            scrollDownMessageHeight: function ($message) {
                if (this.$content.is(':visible')) {
                    this.$content.scrollTop(this.$content.scrollTop() + $message[0].scrollHeight);
                }
                return this;
            },

            scrollDown: function () {
                if (this.$content.is(':visible')) {
                    this.$content.scrollTop(this.$content[0].scrollHeight);
                }
                return this;
            }
        });

        this.ChatBoxes = Backbone.Collection.extend({
            model: converse.ChatBox,
            comparator: 'time_opened',

            registerMessageHandler: function () {
                converse.connection.addHandler(
                    function (message) {
                        this.onMessage(message);
                        return true;
                    }.bind(this), null, 'message', 'chat');
            },

            onChatBoxFetched: function (collection, resp) {
                /* Show chat boxes upon receiving them from sessionStorage
                 *
                 * This method gets overridden entirely in src/converse-controlbox.js
                 * if the controlbox plugin is active.
                 */
                collection.each(function (chatbox) {
                    if (!chatbox.get('minimized')) {
                        chatbox.trigger('show');
                    }
                });
            },

            onConnected: function () {
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.chatboxes-'+converse.bare_jid));
                this.registerMessageHandler();
                this.fetch({
                    add: true,
                    success: this.onChatBoxFetched.bind(this)
                });
            },

            onMessage: function (message) {
                /* Handler method for all incoming single-user chat "message" stanzas.
                 */
                var $message = $(message),
                    contact_jid, $forwarded, $delay, from_bare_jid, from_resource, is_me, msgid,
                    chatbox, resource,
                    from_jid = $message.attr('from'),
                    to_jid = $message.attr('to'),
                    to_resource = Strophe.getResourceFromJid(to_jid),
                    archive_id = $message.find('result[xmlns="'+Strophe.NS.MAM+'"]').attr('id');

                if (to_resource && to_resource !== converse.resource) {
                    converse.log('Ignore incoming message intended for a different resource: '+to_jid, 'info');
                    return true;
                }
                if (from_jid === converse.connection.jid) {
                    // FIXME: Forwarded messages should be sent to specific resources, not broadcasted
                    converse.log("Ignore incoming message sent from this client's JID: "+from_jid, 'info');
                    return true;
                }
                $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    $message = $forwarded.children('message');
                    $delay = $forwarded.children('delay');
                    from_jid = $message.attr('from');
                    to_jid = $message.attr('to');
                }
                from_bare_jid = Strophe.getBareJidFromJid(from_jid);
                from_resource = Strophe.getResourceFromJid(from_jid);
                is_me = from_bare_jid === converse.bare_jid;
                msgid = $message.attr('id');

                if (is_me) {
                    // I am the sender, so this must be a forwarded message...
                    contact_jid = Strophe.getBareJidFromJid(to_jid);
                    resource = Strophe.getResourceFromJid(to_jid);
                } else {
                    contact_jid = from_bare_jid;
                    resource = from_resource;
                }
                // Get chat box, but only create a new one when the message has a body.
                chatbox = this.getChatBox(contact_jid, $message.find('body').length > 0);
                if (!chatbox) {
                    return true;
                }
                if (msgid && chatbox.messages.findWhere({msgid: msgid})) {
                    return true; // We already have this message stored.
                }
                chatbox.createMessage($message, $delay, archive_id);
                converse.roster.addResource(contact_jid, resource);
                converse.emit('message', message);
                return true;
            },

            getChatBox: function (jid, create) {
                /* Returns a chat box or optionally return a newly
                 * created one if one doesn't exist.
                 *
                 * Parameters:
                 *    (String) jid - The JID of the user whose chat box we want
                 *    (Boolean) create - Should a new chat box be created if none exists?
                 */
                jid = jid.toLowerCase();
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var chatbox = this.get(bare_jid);
                if (!chatbox && create) {
                    var roster_item = converse.roster.get(bare_jid);
                    if (roster_item === undefined) {
                        converse.log('Could not get roster item for JID '+bare_jid, 'error');
                        return;
                    }
                    chatbox = this.create({
                        'id': bare_jid,
                        'jid': bare_jid,
                        'fullname': _.isEmpty(roster_item.get('fullname'))? jid: roster_item.get('fullname'),
                        'image_type': roster_item.get('image_type'),
                        'image': roster_item.get('image'),
                        'url': roster_item.get('url')
                    });
                }
                return chatbox;
            }
        });

        this.ChatBoxViews = Backbone.Overview.extend({

            initialize: function () {
                this.model.on("add", this.onChatBoxAdded, this);
                this.model.on("change:minimized", function (item) {
                    if (item.get('minimized') === true) {
                        /* When a chat is minimized in trimChats, trimChats needs to be
                        * called again (in case the minimized chats toggle is newly shown).
                        */
                        this.trimChats();
                    } else {
                        this.trimChats(this.get(item.get('id')));
                    }
                }, this);
            },

            _ensureElement: function () {
                /* Override method from backbone.js
                 * If the #conversejs element doesn't exist, create it.
                 */
                if (!this.el) {
                    var $el = $('#conversejs');
                    if (!$el.length) {
                        $el = $('<div id="conversejs">');
                        $('body').append($el);
                    }
                    $el.html(converse.templates.chats_panel());
                    this.setElement($el, false);
                } else {
                    this.setElement(_.result(this, 'el'), false);
                }
            },

            onChatBoxAdded: function (item) {
                var view = this.get(item.get('id'));
                if (!view) {
                    view = new converse.ChatBoxView({model: item});
                    this.add(item.get('id'), view);
                } else {
                    delete view.model; // Remove ref to old model to help garbage collection
                    view.model = item;
                    view.initialize();
                }
                this.trimChats(view);
            },

            getChatBoxWidth: function (view) {
                if (!view.model.get('minimized') && view.$el.is(':visible')) {
                    return view.$el.outerWidth(true);
                }
                return 0;
            },

            trimChats: function (newchat) {
                /* This method is called when a newly created chat box will
                 * be shown.
                 *
                 * It checks whether there is enough space on the page to show
                 * another chat box. Otherwise it minimize the oldest chat box
                 * to create space.
                 */
                if (converse.no_trimming || (this.model.length <= 1)) {
                    return;
                }
                var oldest_chat,
                    $minimized = converse.minimized_chats.$el,
                    minimized_width = _.contains(this.model.pluck('minimized'), true) ? $minimized.outerWidth(true) : 0,
                    boxes_width = newchat ? newchat.$el.outerWidth(true) : 0,
                    new_id = newchat ? newchat.model.get('id') : null;

                boxes_width += _.reduce(this.xget(new_id), function (memo, view) {
                    return memo + this.getChatBoxWidth(view);
                }.bind(this), 0);

                if ((minimized_width + boxes_width) > $('body').outerWidth(true)) {
                    oldest_chat = this.getOldestMaximizedChat([new_id]);
                    if (oldest_chat) {
                        oldest_chat.minimize();
                    }
                }
            },

            getOldestMaximizedChat: function (exclude_ids) {
                // Get oldest view (if its id is not excluded)
                var i = 0;
                var model = this.model.sort().at(i);
                while (_.contains(exclude_ids, model.get('id')) ||
                       model.get('minimized') === true) {
                    i++;
                    model = this.model.at(i);
                    if (!model) {
                        return null;
                    }
                }
                return model;
            },

            closeAllChatBoxes: function () {
                /* This method gets overridden in src/converse-controlbox.js if
                 * the controlbox plugin is active.
                 */
                this.each(function (view) { view.close(); });
                return this;
            },

            showChat: function (attrs) {
                /* Find the chat box and show it. If it doesn't exist, create it.
                 */
                var chatbox  = this.model.get(attrs.jid);
                if (!chatbox) {
                    chatbox = this.model.create(attrs, {
                        'error': function (model, response) {
                            converse.log(response.responseText);
                        }
                    });
                }
                if (chatbox.get('minimized')) {
                    chatbox.maximize();
                } else {
                    chatbox.trigger('show', true);
                }
                return chatbox;
            }
        });

        this.MinimizedChatBoxView = Backbone.View.extend({
            tagName: 'div',
            className: 'chat-head',
            events: {
                'click .close-chatbox-button': 'close',
                'click .restore-chat': 'restore'
            },

            initialize: function () {
                this.model.messages.on('add', function (m) {
                    if (m.get('message')) {
                        this.updateUnreadMessagesCounter();
                    }
                }, this);
                this.model.on('change:minimized', this.clearUnreadMessagesCounter, this);
            },

            render: function () {
                var data = _.extend(
                    this.model.toJSON(),
                    { 'tooltip': __('Click to restore this chat') }
                );
                if (this.model.get('chatroom')) {
                    data.title = this.model.get('name');
                    this.$el.addClass('chat-head-chatroom');
                } else {
                    data.title = this.model.get('fullname');
                    this.$el.addClass('chat-head-chatbox');
                }
                return this.$el.html(converse.templates.trimmed_chat(data));
            },

            clearUnreadMessagesCounter: function () {
                this.model.set({'num_unread': 0});
                this.render();
            },

            updateUnreadMessagesCounter: function () {
                this.model.set({'num_unread': this.model.get('num_unread') + 1});
                this.render();
            },

            close: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.remove();
                this.model.destroy();
                converse.emit('chatBoxClosed', this);
                return this;
            },

            restore: _.debounce(function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.model.messages.off('add',null,this);
                this.remove();
                this.model.maximize();
            }, 200, true)
        });

        this.MinimizedChats = Backbone.Overview.extend({
            el: "#minimized-chats",
            events: {
                "click #toggle-minimized-chats": "toggle"
            },

            initialize: function () {
                this.initToggle();
                this.model.on("add", this.onChanged, this);
                this.model.on("destroy", this.removeChat, this);
                this.model.on("change:minimized", this.onChanged, this);
                this.model.on('change:num_unread', this.updateUnreadMessagesCounter, this);
            },

            tearDown: function () {
                this.model.off("add", this.onChanged);
                this.model.off("destroy", this.removeChat);
                this.model.off("change:minimized", this.onChanged);
                this.model.off('change:num_unread', this.updateUnreadMessagesCounter);
                return this;
            },

            initToggle: function () {
                this.toggleview = new converse.MinimizedChatsToggleView({
                    model: new converse.MinimizedChatsToggle()
                });
                var id = b64_sha1('converse.minchatstoggle'+converse.bare_jid);
                this.toggleview.model.id = id; // Appears to be necessary for backbone.browserStorage
                this.toggleview.model.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
                this.toggleview.model.fetch();
            },

            render: function () {
                if (this.keys().length === 0) {
                    this.$el.hide('fast');
                } else if (this.keys().length === 1) {
                    this.$el.show('fast');
                }
                return this.$el;
            },

            toggle: function (ev) {
                if (ev && ev.preventDefault) { ev.preventDefault(); }
                this.toggleview.model.save({'collapsed': !this.toggleview.model.get('collapsed')});
                this.$('.minimized-chats-flyout').toggle();
            },

            onChanged: function (item) {
                if (item.get('minimized')) {
                    this.addChat(item);
                } else if (this.get(item.get('id'))) {
                    this.removeChat(item);
                }
            },

            addChat: function (item) {
                var existing = this.get(item.get('id'));
                if (existing && existing.$el.parent().length !== 0) {
                    return;
                }
                var view = new converse.MinimizedChatBoxView({model: item});
                this.$('.minimized-chats-flyout').append(view.render());
                this.add(item.get('id'), view);
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            removeChat: function (item) {
                this.remove(item.get('id'));
                this.toggleview.model.set({'num_minimized': this.keys().length});
                this.render();
            },

            updateUnreadMessagesCounter: function () {
                var ls = this.model.pluck('num_unread'),
                    count = 0, i;
                for (i=0; i<ls.length; i++) { count += ls[i]; }
                this.toggleview.model.set({'num_unread': count});
                this.render();
            }
        });

        this.MinimizedChatsToggle = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'collapsed': this.get('collapsed') || false,
                    'num_minimized': this.get('num_minimized') || 0,
                    'num_unread':  this.get('num_unread') || 0
                });
            }
        });

        this.MinimizedChatsToggleView = Backbone.View.extend({
            el: '#toggle-minimized-chats',

            initialize: function () {
                this.model.on('change:num_minimized', this.render, this);
                this.model.on('change:num_unread', this.render, this);
                this.$flyout = this.$el.siblings('.minimized-chats-flyout');
            },

            render: function () {
                this.$el.html(converse.templates.toggle_chats(
                    _.extend(this.model.toJSON(), {
                        'Minimized': __('Minimized')
                    })
                ));
                if (this.model.get('collapsed')) {
                    this.$flyout.hide();
                } else {
                    this.$flyout.show();
                }
                return this.$el;
            }
        });

        this.XMPPStatus = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'status' : this.getStatus()
                });
                this.on('change', function (item) {
                    if (this.get('fullname') === undefined) {
                        converse.getVCard(
                            null, // No 'to' attr when getting one's own vCard
                            function (iq, jid, fullname, image, image_type, url) {
                                this.save({'fullname': fullname});
                            }.bind(this)
                        );
                    }
                    if (_.has(item.changed, 'status')) {
                        converse.emit('statusChanged', this.get('status'));
                    }
                    if (_.has(item.changed, 'status_message')) {
                        converse.emit('statusMessageChanged', this.get('status_message'));
                    }
                }.bind(this));
            },

            constructPresence: function (type, status_message) {
                if (typeof type === 'undefined') {
                    type = this.get('status') || 'online';
                }
                if (typeof status_message === 'undefined') {
                    status_message = this.get('status_message');
                }
                var presence;
                // Most of these presence types are actually not explicitly sent,
                // but I add all of them here fore reference and future proofing.
                if ((type === 'unavailable') ||
                        (type === 'probe') ||
                        (type === 'error') ||
                        (type === 'unsubscribe') ||
                        (type === 'unsubscribed') ||
                        (type === 'subscribe') ||
                        (type === 'subscribed')) {
                    presence = $pres({'type': type});
                } else if (type === 'offline') {
                    presence = $pres({'type': 'unavailable'});
                    if (status_message) {
                        presence.c('show').t(type);
                    }
                } else {
                    if (type === 'online') {
                        presence = $pres();
                    } else {
                        presence = $pres().c('show').t(type).up();
                    }
                    if (status_message) {
                        presence.c('status').t(status_message);
                    }
                }
                return presence;
            },

            sendPresence: function (type, status_message) {
                converse.connection.send(this.constructPresence(type, status_message));
            },

            setStatus: function (value) {
                this.sendPresence(value);
                this.save({'status': value});
            },

            getStatus: function () {
                return this.get('status') || 'online';
            },

            setStatusMessage: function (status_message) {
                this.sendPresence(this.getStatus(), status_message);
                var prev_status = this.get('status_message');
                this.save({'status_message': status_message});
                if (this.xhr_custom_status) {
                    $.ajax({
                        url:  this.xhr_custom_status_url,
                        type: 'POST',
                        data: {'msg': status_message}
                    });
                }
                if (prev_status === status_message) {
                    this.trigger("update-status-ui", this);
                }
            }
        });

        this.Session = Backbone.Model; // General session settings to be saved to sessionStorage.
        this.Feature = Backbone.Model;
        this.Features = Backbone.Collection.extend({
            /* Service Discovery
            * -----------------
            * This collection stores Feature Models, representing features
            * provided by available XMPP entities (e.g. servers)
            * See XEP-0030 for more details: http://xmpp.org/extensions/xep-0030.html
            * All features are shown here: http://xmpp.org/registrar/disco-features.html
            */
            model: converse.Feature,
            initialize: function () {
                this.addClientIdentities().addClientFeatures();
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.features'+converse.bare_jid));
                this.on('add', this.onFeatureAdded, this);
                if (this.browserStorage.records.length === 0) {
                    // browserStorage is empty, so we've likely never queried this
                    // domain for features yet
                    converse.connection.disco.info(converse.domain, null, this.onInfo.bind(this));
                    converse.connection.disco.items(converse.domain, null, this.onItems.bind(this));
                } else {
                    this.fetch({add:true});
                }
            },

            onFeatureAdded: function (feature) {
                var prefs = feature.get('preferences') || {};
                converse.emit('serviceDiscovered', feature);
                if (feature.get('var') === Strophe.NS.MAM && prefs['default'] !== converse.message_archiving) {
                    // Ask the server for archiving preferences
                    converse.connection.sendIQ(
                        $iq({'type': 'get'}).c('prefs', {'xmlns': Strophe.NS.MAM}),
                        _.bind(this.onMAMPreferences, this, feature),
                        _.bind(this.onMAMError, this, feature)
                    );
                }
            },

            onMAMPreferences: function (feature, iq) {
                /* Handle returned IQ stanza containing Message Archive
                 * Management (XEP-0313) preferences.
                 *
                 * XXX: For now we only handle the global default preference.
                 * The XEP also provides for per-JID preferences, which is
                 * currently not supported in converse.js.
                 *
                 * Per JID preferences will be set in chat boxes, so it'll
                 * probbaly be handled elsewhere in any case.
                 */
                var $prefs = $(iq).find('prefs[xmlns="'+Strophe.NS.MAM+'"]');
                var default_pref = $prefs.attr('default');
                var stanza;
                if (default_pref !== converse.message_archiving) {
                    stanza = $iq({'type': 'set'}).c('prefs', {'xmlns':Strophe.NS.MAM, 'default':converse.message_archiving});
                    $prefs.children().each(function (idx, child) {
                        stanza.cnode(child).up();
                    });
                    converse.connection.sendIQ(stanza, _.bind(function (feature, iq) {
                            // XXX: Strictly speaking, the server should respond with the updated prefs
                            // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                            // but Prosody doesn't do this, so we don't rely on it.
                            feature.save({'preferences': {'default':converse.message_archiving}});
                        }, this, feature),
                        _.bind(this.onMAMError, this, feature)
                    );
                } else {
                    feature.save({'preferences': {'default':converse.message_archiving}});
                }
            },

            onMAMError: function (iq) {
                if ($(iq).find('feature-not-implemented').length) {
                    converse.log("Message Archive Management (XEP-0313) not supported by this browser");
                } else {
                    converse.log("An error occured while trying to set archiving preferences.");
                    converse.log(iq);
                }
            },

            addClientIdentities: function () {
                /* See http://xmpp.org/registrar/disco-categories.html
                 */
                 converse.connection.disco.addIdentity('client', 'web', 'Converse.js');
                 return this;
            },

            addClientFeatures: function () {
                /* The strophe.disco.js plugin keeps a list of features which
                 * it will advertise to any #info queries made to it.
                 *
                 * See: http://xmpp.org/extensions/xep-0030.html#info
                 */
                converse.connection.disco.addFeature('jabber:x:conference');
                converse.connection.disco.addFeature(Strophe.NS.BOSH);
                converse.connection.disco.addFeature(Strophe.NS.CHATSTATES);
                converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                converse.connection.disco.addFeature(Strophe.NS.MAM);
                converse.connection.disco.addFeature(Strophe.NS.ROSTERX); // Limited support
                if (converse.use_vcards) {
                    converse.connection.disco.addFeature(Strophe.NS.VCARD);
                }
                if (converse.message_carbons) {
                    converse.connection.disco.addFeature(Strophe.NS.CARBONS);
                }
                return this;
            },

            onItems: function (stanza) {
                $(stanza).find('query item').each(function (idx, item) {
                    converse.connection.disco.info(
                        $(item).attr('jid'),
                        null,
                        this.onInfo.bind(this));
                }.bind(this));
            },

            onInfo: function (stanza) {
                var $stanza = $(stanza);
                if (($stanza.find('identity[category=server][type=im]').length === 0) &&
                    ($stanza.find('identity[category=conference][type=text]').length === 0)) {
                    // This isn't an IM server component
                    return;
                }
                $stanza.find('feature').each(function (idx, feature) {
                    var namespace = $(feature).attr('var');
                    this[namespace] = true;
                    this.create({
                        'var': namespace,
                        'from': $stanza.attr('from')
                    });
                }.bind(this));
            }
        });

        this.setUpXMLLogging = function () {
            if (this.debug) {
                this.connection.xmlInput = function (body) { converse.log(body); };
                this.connection.xmlOutput = function (body) { converse.log(body); };
            }
        };

        this.startNewBOSHSession = function () {
            $.ajax({
                url:  this.prebind_url,
                type: 'GET',
                success: function (response) {
                    this.connection.attach(
                            response.jid,
                            response.sid,
                            response.rid,
                            this.onConnectStatusChanged
                    );
                }.bind(this),
                error: function (response) {
                    delete this.connection;
                    this.emit('noResumeableSession');
                }.bind(this)
            });
        };

        this.attemptPreboundSession = function (tokens) {
            /* Handle session resumption or initialization when prebind is being used.
             */
            if (this.keepalive) {
                if (!this.jid) {
                    throw new Error("initConnection: when using 'keepalive' with 'prebind, you must supply the JID of the current user.");
                }
                try {
                    return this.connection.restore(this.jid, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session for jid: "+this.jid+" Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            } else { // Not keepalive
                if (this.jid && this.sid && this.rid) {
                    return this.connection.attach(this.jid, this.sid, this.rid, this.onConnectStatusChanged);
                } else {
                    throw new Error("initConnection: If you use prebind and not keepalive, "+
                        "then you MUST supply JID, RID and SID values");
                }
            }
            // We haven't been able to attach yet. Let's see if there
            // is a prebind_url, otherwise there's nothing with which
            // we can attach.
            if (this.prebind_url) {
                this.startNewBOSHSession();
            } else {
                delete this.connection;
                this.emit('noResumeableSession');
            }
        };

        this.attemptNonPreboundSession = function () {
            /* Handle session resumption or initialization when prebind is not being used.
             *
             * Two potential options exist and are handled in this method:
             *  1. keepalive
             *  2. auto_login
             */
            if (this.keepalive) {
                try {
                    return this.connection.restore(undefined, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session. Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            }
            if (this.auto_login) {
                if (!this.jid) {
                    throw new Error("initConnection: If you use auto_login, you also need to provide a jid value");
                }
                if (this.authentication === converse.ANONYMOUS) {
                    this.connection.connect(this.jid.toLowerCase(), null, this.onConnectStatusChanged);
                } else if (this.authentication === converse.LOGIN) {
                    if (!this.password) {
                        throw new Error("initConnection: If you use auto_login and "+
                            "authentication='login' then you also need to provide a password.");
                    }
                    var resource = Strophe.getResourceFromJid(this.jid);
                    if (!resource) {
                        this.jid = this.jid.toLowerCase() + converse.generateResource();
                    } else {
                        this.jid = Strophe.getBareJidFromJid(this.jid).toLowerCase()+'/'+resource;
                    }
                    this.connection.connect(this.jid, this.password, this.onConnectStatusChanged);
                }
            }
        };

        this.initConnection = function () {
            if (this.connection && this.connection.connected) {
                this.setUpXMLLogging();
                this.onConnected();
            } else {
                if (!this.bosh_service_url && ! this.websocket_url) {
                    throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
                }
                if (('WebSocket' in window || 'MozWebSocket' in window) && this.websocket_url) {
                    this.connection = new Strophe.Connection(this.websocket_url);
                } else if (this.bosh_service_url) {
                    this.connection = new Strophe.Connection(this.bosh_service_url, {'keepalive': this.keepalive});
                } else {
                    throw new Error("initConnection: this browser does not support websockets and bosh_service_url wasn't specified.");
                }
                this.setUpXMLLogging();
                // We now try to resume or automatically set up a new session.
                // Otherwise the user will be shown a login form.
                if (this.authentication === converse.PREBIND) {
                    this.attemptPreboundSession();
                } else {
                    this.attemptNonPreboundSession();
                }
            }
        };

        this._tearDown = function () {
            /* Remove those views which are only allowed with a valid
             * connection.
             */
            if (this.roster) {
                this.roster.off().reset(); // Removes roster contacts
            }
            this.chatboxes.remove(); // Don't call off(), events won't get re-registered upon reconnect.
            if (this.features) {
                this.features.reset();
            }
            if (this.minimized_chats) {
                this.minimized_chats.undelegateEvents().model.reset();
                this.minimized_chats.removeAll(); // Remove sub-views
                this.minimized_chats.tearDown().remove(); // Remove overview
                delete this.minimized_chats;
            }
            return this;
        };

        this._initialize = function () {
            this.chatboxes = new this.ChatBoxes();
            this.chatboxviews = new this.ChatBoxViews({model: this.chatboxes});
            this.initSession();
            this.initConnection();
            return this;
        };

        this.wrappedOverride = function (key, value, super_method, clean) {
            // We create a partially applied wrapper function, that
            // makes sure to set the proper super method when the
            // overriding method is called. This is done to enable
            // chaining of plugin methods, all the way up to the
            // original method.
            var ret;
            if (clean) {
                converse._super = { 'converse': converse };
            }
            this._super[key] = super_method;
            ret = value.apply(this, _.rest(arguments, 4));
            if (clean) { delete this._super; }
            return ret;
        };

        this._overrideAttribute = function (key, plugin) {
            // See converse.plugins.override
            var value = plugin.overrides[key];
            if (typeof value === "function") {
                var wrapped_function = _.partial(
                    converse.wrappedOverride.bind(converse),
                    key, value, converse[key].bind(converse), true
                );
                converse[key] = wrapped_function;
            } else {
                converse[key] = value;
            }
        };

        this._extendObject = function (obj, attributes) {
            // See converse.plugins.extend
            if (!obj.prototype._super) {
                obj.prototype._super = {'converse': converse};
            }
            _.each(attributes, function (value, key) {
                if (key === 'events') {
                    obj.prototype[key] = _.extend(value, obj.prototype[key]);
                } else if (typeof value === 'function') {
                    // We create a partially applied wrapper function, that
                    // makes sure to set the proper super method when the
                    // overriding method is called. This is done to enable
                    // chaining of plugin methods, all the way up to the
                    // original method.
                    var wrapped_function = _.partial(
                        converse.wrappedOverride,
                        key, value, obj.prototype[key], false
                    );
                    obj.prototype[key] = wrapped_function;
                } else {
                    obj.prototype[key] = value;
                }
            });
        };

        this.initializePlugins = function () {
            _.each(_.keys(this.plugins), function (name) {
                var plugin = this.plugins[name];
                if (_.contains(this.initialized_plugins, name)) {
                    // Don't initialize plugins twice, otherwise we get
                    // infinite recursion in overridden methods.
                    return;
                }
                plugin.converse = converse;
                _.each(Object.keys(plugin.overrides || {}), function (key) {
                    /* We automatically override all methods and Backbone views and
                     * models that are in the "overrides" namespace.
                     */
                    var override = plugin.overrides[key];
                    if (typeof override === "object") {
                        this._extendObject(converse[key], override);
                    } else {
                        this._overrideAttribute(key, plugin);
                    }
                }.bind(this));

                if (typeof plugin.initialize === "function") {
                    plugin.initialize.bind(plugin)(this);
                }
                this.initialized_plugins.push(name);
            }.bind(this));
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }
        this.initializePlugins();
        this._initialize();
        this.registerGlobalEventHandlers();
        converse.emit('initialized');
    };
    return converse;
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-api", [
            "jquery",
            "underscore",
            "moment_with_locales",
            "strophe",
            "utils",
            "converse-core"
        ],
        factory);
}(this, function ($, _, moment, strophe, utils, converse) {
    var Strophe = strophe.Strophe;
    return {
        'initialize': function (settings, callback) {
            converse.initialize(settings, callback);
        },
        'disconnect': function () {
              converse.connection.disconnect();
        },
        'user': {
            'logout': function () {
                converse.logOut();
            },
            'status': {
                'get': function () {
                    return converse.xmppstatus.get('status');
                },
                'set': function (value, message) {
                    var data = {'status': value};
                    if (!_.contains(_.keys(converse.STATUS_WEIGHTS), value)) {
                        throw new Error('Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1');
                    }
                    if (typeof message === "string") {
                        data.status_message = message;
                    }
                    converse.xmppstatus.save(data);
                },
                'message': {
                    'get': function () {
                        return converse.xmppstatus.get('status_message');
                    },
                    'set': function (stat) {
                        converse.xmppstatus.save({'status_message': stat});
                    }
                }
            },
        },
        'settings': {
            'get': function (key) {
                if (_.contains(Object.keys(converse.default_settings), key)) {
                    return converse[key];
                }
            },
            'set': function (key, val) {
                var o = {};
                if (typeof key === "object") {
                    _.extend(converse, _.pick(key, Object.keys(converse.default_settings)));
                } else if (typeof key === "string") {
                    o[key] = val;
                    _.extend(converse, _.pick(o, Object.keys(converse.default_settings)));
                }
            }
        },
        'contacts': {
            'get': function (jids) {
                var _transform = function (jid) {
                    var contact = converse.roster.get(Strophe.getBareJidFromJid(jid));
                    if (contact) {
                        return contact.attributes;
                    }
                    return null;
                };
                if (typeof jids === "undefined") {
                    jids = converse.roster.pluck('jid');
                } else if (typeof jids === "string") {
                    return _transform(jids);
                }
                return _.map(jids, _transform);
            },
            'add': function (jid, name) {
                if (typeof jid !== "string" || jid.indexOf('@') < 0) {
                    throw new TypeError('contacts.add: invalid jid');
                }
                converse.roster.addAndSubscribe(jid, _.isEmpty(name)? jid: name);
            }
        },
        'chats': {
            'open': function (jids) {
                var chatbox;
                if (typeof jids === "undefined") {
                    converse.log("chats.open: You need to provide at least one JID", "error");
                    return null;
                } else if (typeof jids === "string") {
                    chatbox = converse.wrappedChatBox(converse.chatboxes.getChatBox(jids, true));
                    chatbox.open();
                    return chatbox;
                }
                return _.map(jids, function (jid) {
                    chatbox = converse.wrappedChatBox(converse.chatboxes.getChatBox(jid, true));
                    chatbox.open();
                    return chatbox;
                });
            },
            'get': function (jids) {
                if (typeof jids === "undefined") {
                    converse.log("chats.get: You need to provide at least one JID", "error");
                    return null;
                } else if (typeof jids === "string") {
                    return converse.wrappedChatBox(converse.chatboxes.getChatBox(jids, true));
                }
                return _.map(jids, _.partial(_.compose(converse.wrappedChatBox, converse.chatboxes.getChatBox.bind(converse.chatboxes)), _, true));
            }
        },
        'archive': {
            'query': converse.queryForArchivedMessages.bind(converse)
        },
        'tokens': {
            'get': function (id) {
                if (!converse.expose_rid_and_sid || typeof converse.connection === "undefined") {
                    return null;
                }
                if (id.toLowerCase() === 'rid') {
                    return converse.connection.rid || converse.connection._proto.rid;
                } else if (id.toLowerCase() === 'sid') {
                    return converse.connection.sid || converse.connection._proto.sid;
                }
            }
        },
        'listen': {
            'once': function (evt, handler) {
                converse.once(evt, handler);
            },
            'on': function (evt, handler) {
                converse.on(evt, handler);
            },
            'not': function (evt, handler) {
                converse.off(evt, handler);
            },
        },
        'send': function (stanza) {
            converse.connection.send(stanza);
        },
        'plugins': {
            'add': function (name, plugin) {
                converse.plugins[name] = plugin;
            },
            'remove': function (name) {
                delete converse.plugins[name];
            },
            'override': function (name, value) {
                /* Helper method for overriding methods and attributes directly on the
                 * converse object. For Backbone objects, use instead the 'extend'
                 * method.
                 *
                 * If a method is overridden, then the original method will still be
                 * available via the _super attribute.
                 *
                 * name: The attribute being overridden.
                 * value: The value of the attribute being overridden.
                 */
                converse._overrideAttribute(name, value);
            },
            'extend': function (obj, attributes) {
                /* Helper method for overriding or extending Converse's Backbone Views or Models
                 *
                 * When a method is overriden, the original will still be available
                 * on the _super attribute of the object being overridden.
                 *
                 * obj: The Backbone View or Model
                 * attributes: A hash of attributes, such as you would pass to Backbone.Model.extend or Backbone.View.extend
                 */
                converse._extendObject(obj, attributes);
            }
        },
        'env': {
            '$build': strophe.$build,
            '$iq': strophe.$iq,
            '$msg': strophe.$msg,
            '$pres': strophe.$pres,
            'Strophe': strophe.Strophe,
            'b64_sha1':  strophe.SHA1.b64_sha1,
            '_': _,
            'jQuery': $,
            'moment': moment,
            'utils': utils
        }
    };
}));

/*
jed.js
v0.5.0beta

https://github.com/SlexAxton/Jed
-----------
A gettext compatible i18n library for modern JavaScript Applications

by Alex Sexton - AlexSexton [at] gmail - @SlexAxton
WTFPL license for use
Dojo CLA for contributions

Jed offers the entire applicable GNU gettext spec'd set of
functions, but also offers some nicer wrappers around them.
The api for gettext was written for a language with no function
overloading, so Jed allows a little more of that.

Many thanks to Joshua I. Miller - unrtst@cpan.org - who wrote
gettext.js back in 2008. I was able to vet a lot of my ideas
against his. I also made sure Jed passed against his tests
in order to offer easy upgrades -- jsgettext.berlios.de
*/
(function (root, undef) {

  // Set up some underscore-style functions, if you already have
  // underscore, feel free to delete this section, and use it
  // directly, however, the amount of functions used doesn't
  // warrant having underscore as a full dependency.
  // Underscore 1.3.0 was used to port and is licensed
  // under the MIT License by Jeremy Ashkenas.
  var ArrayProto    = Array.prototype,
      ObjProto      = Object.prototype,
      slice         = ArrayProto.slice,
      hasOwnProp    = ObjProto.hasOwnProperty,
      nativeForEach = ArrayProto.forEach,
      breaker       = {};

  // We're not using the OOP style _ so we don't need the
  // extra level of indirection. This still means that you
  // sub out for real `_` though.
  var _ = {
    forEach : function( obj, iterator, context ) {
      var i, l, key;
      if ( obj === null ) {
        return;
      }

      if ( nativeForEach && obj.forEach === nativeForEach ) {
        obj.forEach( iterator, context );
      }
      else if ( obj.length === +obj.length ) {
        for ( i = 0, l = obj.length; i < l; i++ ) {
          if ( i in obj && iterator.call( context, obj[i], i, obj ) === breaker ) {
            return;
          }
        }
      }
      else {
        for ( key in obj) {
          if ( hasOwnProp.call( obj, key ) ) {
            if ( iterator.call (context, obj[key], key, obj ) === breaker ) {
              return;
            }
          }
        }
      }
    },
    extend : function( obj ) {
      this.forEach( slice.call( arguments, 1 ), function ( source ) {
        for ( var prop in source ) {
          obj[prop] = source[prop];
        }
      });
      return obj;
    }
  };
  // END Miniature underscore impl

  // Jed is a constructor function
  var Jed = function ( options ) {
    // Some minimal defaults
    this.defaults = {
      "locale_data" : {
        "messages" : {
          "" : {
            "domain"       : "messages",
            "lang"         : "en",
            "plural_forms" : "nplurals=2; plural=(n != 1);"
          }
          // There are no default keys, though
        }
      },
      // The default domain if one is missing
      "domain" : "messages"
    };

    // Mix in the sent options with the default options
    this.options = _.extend( {}, this.defaults, options );
    this.textdomain( this.options.domain );

    if ( options.domain && ! this.options.locale_data[ this.options.domain ] ) {
      throw new Error('Text domain set to non-existent domain: `' + options.domain + '`');
    }
  };

  // The gettext spec sets this character as the default
  // delimiter for context lookups.
  // e.g.: context\u0004key
  // If your translation company uses something different,
  // just change this at any time and it will use that instead.
  Jed.context_delimiter = String.fromCharCode( 4 );

  function getPluralFormFunc ( plural_form_string ) {
    return Jed.PF.compile( plural_form_string || "nplurals=2; plural=(n != 1);");
  }

  function Chain( key, i18n ){
    this._key = key;
    this._i18n = i18n;
  }

  // Create a chainable api for adding args prettily
  _.extend( Chain.prototype, {
    onDomain : function ( domain ) {
      this._domain = domain;
      return this;
    },
    withContext : function ( context ) {
      this._context = context;
      return this;
    },
    ifPlural : function ( num, pkey ) {
      this._val = num;
      this._pkey = pkey;
      return this;
    },
    fetch : function ( sArr ) {
      if ( {}.toString.call( sArr ) != '[object Array]' ) {
        sArr = [].slice.call(arguments);
      }
      return ( sArr && sArr.length ? Jed.sprintf : function(x){ return x; } )(
        this._i18n.dcnpgettext(this._domain, this._context, this._key, this._pkey, this._val),
        sArr
      );
    }
  });

  // Add functions to the Jed prototype.
  // These will be the functions on the object that's returned
  // from creating a `new Jed()`
  // These seem redundant, but they gzip pretty well.
  _.extend( Jed.prototype, {
    // The sexier api start point
    translate : function ( key ) {
      return new Chain( key, this );
    },

    textdomain : function ( domain ) {
      if ( ! domain ) {
        return this._textdomain;
      }
      this._textdomain = domain;
    },

    gettext : function ( key ) {
      return this.dcnpgettext.call( this, undef, undef, key );
    },

    dgettext : function ( domain, key ) {
     return this.dcnpgettext.call( this, domain, undef, key );
    },

    dcgettext : function ( domain , key /*, category */ ) {
      // Ignores the category anyways
      return this.dcnpgettext.call( this, domain, undef, key );
    },

    ngettext : function ( skey, pkey, val ) {
      return this.dcnpgettext.call( this, undef, undef, skey, pkey, val );
    },

    dngettext : function ( domain, skey, pkey, val ) {
      return this.dcnpgettext.call( this, domain, undef, skey, pkey, val );
    },

    dcngettext : function ( domain, skey, pkey, val/*, category */) {
      return this.dcnpgettext.call( this, domain, undef, skey, pkey, val );
    },

    pgettext : function ( context, key ) {
      return this.dcnpgettext.call( this, undef, context, key );
    },

    dpgettext : function ( domain, context, key ) {
      return this.dcnpgettext.call( this, domain, context, key );
    },

    dcpgettext : function ( domain, context, key/*, category */) {
      return this.dcnpgettext.call( this, domain, context, key );
    },

    npgettext : function ( context, skey, pkey, val ) {
      return this.dcnpgettext.call( this, undef, context, skey, pkey, val );
    },

    dnpgettext : function ( domain, context, skey, pkey, val ) {
      return this.dcnpgettext.call( this, domain, context, skey, pkey, val );
    },

    // The most fully qualified gettext function. It has every option.
    // Since it has every option, we can use it from every other method.
    // This is the bread and butter.
    // Technically there should be one more argument in this function for 'Category',
    // but since we never use it, we might as well not waste the bytes to define it.
    dcnpgettext : function ( domain, context, singular_key, plural_key, val ) {
      // Set some defaults

      plural_key = plural_key || singular_key;

      // Use the global domain default if one
      // isn't explicitly passed in
      domain = domain || this._textdomain;

      // Default the value to the singular case
      val = typeof val == 'undefined' ? 1 : val;

      var fallback;

      // Handle special cases

      // No options found
      if ( ! this.options ) {
        // There's likely something wrong, but we'll return the correct key for english
        // We do this by instantiating a brand new Jed instance with the default set
        // for everything that could be broken.
        fallback = new Jed();
        return fallback.dcnpgettext.call( fallback, undefined, undefined, singular_key, plural_key, val );
      }

      // No translation data provided
      if ( ! this.options.locale_data ) {
        throw new Error('No locale data provided.');
      }

      if ( ! this.options.locale_data[ domain ] ) {
        throw new Error('Domain `' + domain + '` was not found.');
      }

      if ( ! this.options.locale_data[ domain ][ "" ] ) {
        throw new Error('No locale meta information provided.');
      }

      // Make sure we have a truthy key. Otherwise we might start looking
      // into the empty string key, which is the options for the locale
      // data.
      if ( ! singular_key ) {
        throw new Error('No translation key found.');
      }

      // Handle invalid numbers, but try casting strings for good measure
      if ( typeof val != 'number' ) {
        val = parseInt( val, 10 );

        if ( isNaN( val ) ) {
          throw new Error('The number that was passed in is not a number.');
        }
      }

      var key  = context ? context + Jed.context_delimiter + singular_key : singular_key,
          locale_data = this.options.locale_data,
          dict = locale_data[ domain ],
          pluralForms = dict[""].plural_forms || (locale_data.messages || this.defaults.locale_data.messages)[""].plural_forms,
          val_idx = getPluralFormFunc(pluralForms)(val) + 1,
          val_list,
          res;

      // Throw an error if a domain isn't found
      if ( ! dict ) {
        throw new Error('No domain named `' + domain + '` could be found.');
      }

      val_list = dict[ key ];

      // If there is no match, then revert back to
      // english style singular/plural with the keys passed in.
      if ( ! val_list || val_idx >= val_list.length ) {
        if (this.options.missing_key_callback) {
          this.options.missing_key_callback(key);
        }
        res = [ null, singular_key, plural_key ];
        return res[ getPluralFormFunc(pluralForms)( val ) + 1 ];
      }

      res = val_list[ val_idx ];

      // This includes empty strings on purpose
      if ( ! res  ) {
        res = [ null, singular_key, plural_key ];
        return res[ getPluralFormFunc(pluralForms)( val ) + 1 ];
      }
      return res;
    }
  });


  // We add in sprintf capabilities for post translation value interolation
  // This is not internally used, so you can remove it if you have this
  // available somewhere else, or want to use a different system.

  // We _slightly_ modify the normal sprintf behavior to more gracefully handle
  // undefined values.

  /**
   sprintf() for JavaScript 0.7-beta1
   http://www.diveintojavascript.com/projects/javascript-sprintf

   Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
   All rights reserved.

   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions are met:
       * Redistributions of source code must retain the above copyright
         notice, this list of conditions and the following disclaimer.
       * Redistributions in binary form must reproduce the above copyright
         notice, this list of conditions and the following disclaimer in the
         documentation and/or other materials provided with the distribution.
       * Neither the name of sprintf() for JavaScript nor the
         names of its contributors may be used to endorse or promote products
         derived from this software without specific prior written permission.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
   DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
   DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
   (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
   LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
   ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
   (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */
  var sprintf = (function() {
    function get_type(variable) {
      return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    }
    function str_repeat(input, multiplier) {
      for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
      return output.join('');
    }

    var str_format = function() {
      if (!str_format.cache.hasOwnProperty(arguments[0])) {
        str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
      }
      return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
    };

    str_format.format = function(parse_tree, argv) {
      var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
      for (i = 0; i < tree_length; i++) {
        node_type = get_type(parse_tree[i]);
        if (node_type === 'string') {
          output.push(parse_tree[i]);
        }
        else if (node_type === 'array') {
          match = parse_tree[i]; // convenience purposes only
          if (match[2]) { // keyword argument
            arg = argv[cursor];
            for (k = 0; k < match[2].length; k++) {
              if (!arg.hasOwnProperty(match[2][k])) {
                throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
              }
              arg = arg[match[2][k]];
            }
          }
          else if (match[1]) { // positional argument (explicit)
            arg = argv[match[1]];
          }
          else { // positional argument (implicit)
            arg = argv[cursor++];
          }

          if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
            throw(sprintf('[sprintf] expecting number but found %s', get_type(arg)));
          }

          // Jed EDIT
          if ( typeof arg == 'undefined' || arg === null ) {
            arg = '';
          }
          // Jed EDIT

          switch (match[8]) {
            case 'b': arg = arg.toString(2); break;
            case 'c': arg = String.fromCharCode(arg); break;
            case 'd': arg = parseInt(arg, 10); break;
            case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
            case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
            case 'o': arg = arg.toString(8); break;
            case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
            case 'u': arg = Math.abs(arg); break;
            case 'x': arg = arg.toString(16); break;
            case 'X': arg = arg.toString(16).toUpperCase(); break;
          }
          arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
          pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
          pad_length = match[6] - String(arg).length;
          pad = match[6] ? str_repeat(pad_character, pad_length) : '';
          output.push(match[5] ? arg + pad : pad + arg);
        }
      }
      return output.join('');
    };

    str_format.cache = {};

    str_format.parse = function(fmt) {
      var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
      while (_fmt) {
        if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
          parse_tree.push(match[0]);
        }
        else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
          parse_tree.push('%');
        }
        else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
          if (match[2]) {
            arg_names |= 1;
            var field_list = [], replacement_field = match[2], field_match = [];
            if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
              field_list.push(field_match[1]);
              while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                  field_list.push(field_match[1]);
                }
                else {
                  throw('[sprintf] huh?');
                }
              }
            }
            else {
              throw('[sprintf] huh?');
            }
            match[2] = field_list;
          }
          else {
            arg_names |= 2;
          }
          if (arg_names === 3) {
            throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
          }
          parse_tree.push(match);
        }
        else {
          throw('[sprintf] huh?');
        }
        _fmt = _fmt.substring(match[0].length);
      }
      return parse_tree;
    };

    return str_format;
  })();

  var vsprintf = function(fmt, argv) {
    argv.unshift(fmt);
    return sprintf.apply(null, argv);
  };

  Jed.parse_plural = function ( plural_forms, n ) {
    plural_forms = plural_forms.replace(/n/g, n);
    return Jed.parse_expression(plural_forms);
  };

  Jed.sprintf = function ( fmt, args ) {
    if ( {}.toString.call( args ) == '[object Array]' ) {
      return vsprintf( fmt, [].slice.call(args) );
    }
    return sprintf.apply(this, [].slice.call(arguments) );
  };

  Jed.prototype.sprintf = function () {
    return Jed.sprintf.apply(this, arguments);
  };
  // END sprintf Implementation

  // Start the Plural forms section
  // This is a full plural form expression parser. It is used to avoid
  // running 'eval' or 'new Function' directly against the plural
  // forms.
  //
  // This can be important if you get translations done through a 3rd
  // party vendor. I encourage you to use this instead, however, I
  // also will provide a 'precompiler' that you can use at build time
  // to output valid/safe function representations of the plural form
  // expressions. This means you can build this code out for the most
  // part.
  Jed.PF = {};

  Jed.PF.parse = function ( p ) {
    var plural_str = Jed.PF.extractPluralExpr( p );
    return Jed.PF.parser.parse.call(Jed.PF.parser, plural_str);
  };

  Jed.PF.compile = function ( p ) {
    // Handle trues and falses as 0 and 1
    function imply( val ) {
      return (val === true ? 1 : val ? val : 0);
    }

    var ast = Jed.PF.parse( p );
    return function ( n ) {
      return imply( Jed.PF.interpreter( ast )( n ) );
    };
  };

  Jed.PF.interpreter = function ( ast ) {
    return function ( n ) {
      var res;
      switch ( ast.type ) {
        case 'GROUP':
          return Jed.PF.interpreter( ast.expr )( n );
        case 'TERNARY':
          if ( Jed.PF.interpreter( ast.expr )( n ) ) {
            return Jed.PF.interpreter( ast.truthy )( n );
          }
          return Jed.PF.interpreter( ast.falsey )( n );
        case 'OR':
          return Jed.PF.interpreter( ast.left )( n ) || Jed.PF.interpreter( ast.right )( n );
        case 'AND':
          return Jed.PF.interpreter( ast.left )( n ) && Jed.PF.interpreter( ast.right )( n );
        case 'LT':
          return Jed.PF.interpreter( ast.left )( n ) < Jed.PF.interpreter( ast.right )( n );
        case 'GT':
          return Jed.PF.interpreter( ast.left )( n ) > Jed.PF.interpreter( ast.right )( n );
        case 'LTE':
          return Jed.PF.interpreter( ast.left )( n ) <= Jed.PF.interpreter( ast.right )( n );
        case 'GTE':
          return Jed.PF.interpreter( ast.left )( n ) >= Jed.PF.interpreter( ast.right )( n );
        case 'EQ':
          return Jed.PF.interpreter( ast.left )( n ) == Jed.PF.interpreter( ast.right )( n );
        case 'NEQ':
          return Jed.PF.interpreter( ast.left )( n ) != Jed.PF.interpreter( ast.right )( n );
        case 'MOD':
          return Jed.PF.interpreter( ast.left )( n ) % Jed.PF.interpreter( ast.right )( n );
        case 'VAR':
          return n;
        case 'NUM':
          return ast.val;
        default:
          throw new Error("Invalid Token found.");
      }
    };
  };

  Jed.PF.extractPluralExpr = function ( p ) {
    // trim first
    p = p.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

    if (! /;\s*$/.test(p)) {
      p = p.concat(';');
    }

    var nplurals_re = /nplurals\=(\d+);/,
        plural_re = /plural\=(.*);/,
        nplurals_matches = p.match( nplurals_re ),
        res = {},
        plural_matches;

    // Find the nplurals number
    if ( nplurals_matches.length > 1 ) {
      res.nplurals = nplurals_matches[1];
    }
    else {
      throw new Error('nplurals not found in plural_forms string: ' + p );
    }

    // remove that data to get to the formula
    p = p.replace( nplurals_re, "" );
    plural_matches = p.match( plural_re );

    if (!( plural_matches && plural_matches.length > 1 ) ) {
      throw new Error('`plural` expression not found: ' + p);
    }
    return plural_matches[ 1 ];
  };

  /* Jison generated parser */
  Jed.PF.parser = (function(){

var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expressions":3,"e":4,"EOF":5,"?":6,":":7,"||":8,"&&":9,"<":10,"<=":11,">":12,">=":13,"!=":14,"==":15,"%":16,"(":17,")":18,"n":19,"NUMBER":20,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",6:"?",7:":",8:"||",9:"&&",10:"<",11:"<=",12:">",13:">=",14:"!=",15:"==",16:"%",17:"(",18:")",19:"n",20:"NUMBER"},
productions_: [0,[3,2],[4,5],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,1],[4,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return { type : 'GROUP', expr: $$[$0-1] }; 
break;
case 2:this.$ = { type: 'TERNARY', expr: $$[$0-4], truthy : $$[$0-2], falsey: $$[$0] }; 
break;
case 3:this.$ = { type: "OR", left: $$[$0-2], right: $$[$0] };
break;
case 4:this.$ = { type: "AND", left: $$[$0-2], right: $$[$0] };
break;
case 5:this.$ = { type: 'LT', left: $$[$0-2], right: $$[$0] }; 
break;
case 6:this.$ = { type: 'LTE', left: $$[$0-2], right: $$[$0] };
break;
case 7:this.$ = { type: 'GT', left: $$[$0-2], right: $$[$0] };
break;
case 8:this.$ = { type: 'GTE', left: $$[$0-2], right: $$[$0] };
break;
case 9:this.$ = { type: 'NEQ', left: $$[$0-2], right: $$[$0] };
break;
case 10:this.$ = { type: 'EQ', left: $$[$0-2], right: $$[$0] };
break;
case 11:this.$ = { type: 'MOD', left: $$[$0-2], right: $$[$0] };
break;
case 12:this.$ = { type: 'GROUP', expr: $$[$0-1] }; 
break;
case 13:this.$ = { type: 'VAR' }; 
break;
case 14:this.$ = { type: 'NUM', val: Number(yytext) }; 
break;
}
},
table: [{3:1,4:2,17:[1,3],19:[1,4],20:[1,5]},{1:[3]},{5:[1,6],6:[1,7],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16]},{4:17,17:[1,3],19:[1,4],20:[1,5]},{5:[2,13],6:[2,13],7:[2,13],8:[2,13],9:[2,13],10:[2,13],11:[2,13],12:[2,13],13:[2,13],14:[2,13],15:[2,13],16:[2,13],18:[2,13]},{5:[2,14],6:[2,14],7:[2,14],8:[2,14],9:[2,14],10:[2,14],11:[2,14],12:[2,14],13:[2,14],14:[2,14],15:[2,14],16:[2,14],18:[2,14]},{1:[2,1]},{4:18,17:[1,3],19:[1,4],20:[1,5]},{4:19,17:[1,3],19:[1,4],20:[1,5]},{4:20,17:[1,3],19:[1,4],20:[1,5]},{4:21,17:[1,3],19:[1,4],20:[1,5]},{4:22,17:[1,3],19:[1,4],20:[1,5]},{4:23,17:[1,3],19:[1,4],20:[1,5]},{4:24,17:[1,3],19:[1,4],20:[1,5]},{4:25,17:[1,3],19:[1,4],20:[1,5]},{4:26,17:[1,3],19:[1,4],20:[1,5]},{4:27,17:[1,3],19:[1,4],20:[1,5]},{6:[1,7],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[1,28]},{6:[1,7],7:[1,29],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16]},{5:[2,3],6:[2,3],7:[2,3],8:[2,3],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[2,3]},{5:[2,4],6:[2,4],7:[2,4],8:[2,4],9:[2,4],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[2,4]},{5:[2,5],6:[2,5],7:[2,5],8:[2,5],9:[2,5],10:[2,5],11:[2,5],12:[2,5],13:[2,5],14:[2,5],15:[2,5],16:[1,16],18:[2,5]},{5:[2,6],6:[2,6],7:[2,6],8:[2,6],9:[2,6],10:[2,6],11:[2,6],12:[2,6],13:[2,6],14:[2,6],15:[2,6],16:[1,16],18:[2,6]},{5:[2,7],6:[2,7],7:[2,7],8:[2,7],9:[2,7],10:[2,7],11:[2,7],12:[2,7],13:[2,7],14:[2,7],15:[2,7],16:[1,16],18:[2,7]},{5:[2,8],6:[2,8],7:[2,8],8:[2,8],9:[2,8],10:[2,8],11:[2,8],12:[2,8],13:[2,8],14:[2,8],15:[2,8],16:[1,16],18:[2,8]},{5:[2,9],6:[2,9],7:[2,9],8:[2,9],9:[2,9],10:[2,9],11:[2,9],12:[2,9],13:[2,9],14:[2,9],15:[2,9],16:[1,16],18:[2,9]},{5:[2,10],6:[2,10],7:[2,10],8:[2,10],9:[2,10],10:[2,10],11:[2,10],12:[2,10],13:[2,10],14:[2,10],15:[2,10],16:[1,16],18:[2,10]},{5:[2,11],6:[2,11],7:[2,11],8:[2,11],9:[2,11],10:[2,11],11:[2,11],12:[2,11],13:[2,11],14:[2,11],15:[2,11],16:[2,11],18:[2,11]},{5:[2,12],6:[2,12],7:[2,12],8:[2,12],9:[2,12],10:[2,12],11:[2,12],12:[2,12],13:[2,12],14:[2,12],15:[2,12],16:[2,12],18:[2,12]},{4:30,17:[1,3],19:[1,4],20:[1,5]},{5:[2,2],6:[1,7],7:[2,2],8:[1,8],9:[1,9],10:[1,10],11:[1,11],12:[1,12],13:[1,13],14:[1,14],15:[1,15],16:[1,16],18:[2,2]}],
defaultActions: {6:[2,1]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        _handle_error:
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+"\nExpecting "+expected.join(', ') + ", got '" + this.terminals_[symbol]+ "'";
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){

var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* skip whitespace */
break;
case 1:return 20
break;
case 2:return 19
break;
case 3:return 8
break;
case 4:return 9
break;
case 5:return 6
break;
case 6:return 7
break;
case 7:return 11
break;
case 8:return 13
break;
case 9:return 10
break;
case 10:return 12
break;
case 11:return 14
break;
case 12:return 15
break;
case 13:return 16
break;
case 14:return 17
break;
case 15:return 18
break;
case 16:return 5
break;
case 17:return 'INVALID'
break;
}
};
lexer.rules = [/^\s+/,/^[0-9]+(\.[0-9]+)?\b/,/^n\b/,/^\|\|/,/^&&/,/^\?/,/^:/,/^<=/,/^>=/,/^</,/^>/,/^!=/,/^==/,/^%/,/^\(/,/^\)/,/^$/,/^./];
lexer.conditions = {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
// End parser

  // Handle node, amd, and global systems
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Jed;
    }
    exports.Jed = Jed;
  }
  else {
    if (typeof define === 'function' && define.amd) {
      define('jed', [],function() {
        return Jed;
      });
    }
    // Leak a global regardless of module system
    root['Jed'] = Jed;
  }

})(this);

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, Backbone */

(function (root, factory) {
    define("converse-controlbox", ["converse-core", "converse-api"], factory);
}(this, function (converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    // For translations
    var __ = utils.__.bind(converse);

    converse_api.plugins.add('controlbox', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initSession: function () {
                this.controlboxtoggle = new this.ControlBoxToggle();
                this._super.initSession.apply(this, arguments);
            },

            initConnection: function () {
                this._super.initConnection.apply(this, arguments);
                if (this.connection) {
                    this.addControlBox();
                }
            },

            _tearDown: function () {
                this._super._tearDown.apply(this, arguments);
                if (this.rosterview) {
                    this.rosterview.unregisterHandlers();
                    // Removes roster groups
                    this.rosterview.model.off().reset();
                    this.rosterview.undelegateEvents().remove();
                }
            },

            clearSession: function () {
                this._super.clearSession.apply(this, arguments);
                if (this.connection.connected) {
                    this.chatboxes.get('controlbox').save({'connected': false});
                }
            },

            ChatBoxes: {
                onChatBoxFetched: function (collection, resp) {
                    collection.each(function (chatbox) {
                        if (chatbox.get('id') !== 'controlbox' && !chatbox.get('minimized')) {
                            chatbox.trigger('show');
                        }
                    });
                    if (!_.include(_.pluck(resp, 'id'), 'controlbox')) {
                        this.add({
                            id: 'controlbox',
                            box_id: 'controlbox'
                        });
                    }
                    this.get('controlbox').save({connected:true});
                },

            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('box_id') === 'controlbox') {
                        view = new converse.ControlBoxView({model: item});
                        this.add(item.get('id'), view);
                        this.trimChats(view);
                    } else {
                        this._super.onChatBoxAdded.apply(this, arguments);
                    }
                },

                closeAllChatBoxes: function () {
                    this.each(function (view) {
                        if (view.model.get('id') !== 'controlbox') {
                            view.close();
                        }
                    });
                    return this;
                },

                getOldestMaximizedChat: function (exclude_ids) {
                    exclude_ids.push('controlbox');
                    this._super.getOldestMaximizedChat(exclude_ids);
                },

                getChatBoxWidth: function (view) {
                    var controlbox = this.get('controlbox');
                    if (view.model.get('id') === 'controlbox') {
                        /* We return the width of the controlbox or its toggle,
                         * depending on which is visible.
                         */
                        if (!controlbox || !controlbox.$el.is(':visible')) {
                            return converse.controlboxtoggle.$el.outerWidth(true);
                        } else {
                            return controlbox.$el.outerWidth(true);
                        }
                    } else {
                        return this._super.getChatBoxWidth.apply(this, arguments);
                    }
                }
            },


            MinimizedChats: {
                onChanged: function (item) {
                    if (item.get('id') === 'controlbox')  {
                        return;
                    } else {
                        this._super.onChanged.apply(this, arguments);
                    }
                }
            },


            ChatBox: {
                initialize: function () {
                    if (this.get('id') === 'controlbox') {
                        this.set(
                            _.extend(
                                this.getDefaultSettings(),
                                { 'time_opened': moment(0).valueOf() }
                            ));
                    } else {
                        this._super.initialize.apply(this, arguments);
                    }
                },
            },


            ChatBoxView: {
                insertIntoPage: function () {
                    this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                    return this;
                },

                maximize: function () {
                    var chatboxviews = converse.chatboxviews;
                    // Restores a minimized chat box
                    this.$el.insertAfter(chatboxviews.get("controlbox").$el).show('fast', this.onShow.bind(this));
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            var settings = {
                show_controlbox_by_default: false,
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

            var STATUSES = {
                'dnd': __('This contact is busy'),
                'online': __('This contact is online'),
                'offline': __('This contact is offline'),
                'unavailable': __('This contact is unavailable'),
                'xa': __('This contact is away for an extended period'),
                'away': __('This contact is away')
            };
            var DESC_GROUP_TOGGLE = __('Click to hide these contacts');
            var LABEL_CONTACTS = __('Contacts');
            var LABEL_GROUPS = __('Groups');
            var HEADER_CURRENT_CONTACTS =  __('My contacts');
            var HEADER_PENDING_CONTACTS = __('Pending contacts');
            var HEADER_REQUESTING_CONTACTS = __('Contact requests');
            var HEADER_UNGROUPED = __('Ungrouped');
            var HEADER_WEIGHTS = {};
            HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 0;
            HEADER_WEIGHTS[HEADER_UNGROUPED]           = 1;
            HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 2;
            HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

            converse.addControlBox = function () {
                return converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    closed: !converse.show_controlbox_by_default
                });
            };

            converse.renderLoginPanel = function () {
                converse._tearDown();
                var view = converse.chatboxviews.get('controlbox');
                view.model.set({connected:false});
                view.renderLoginPanel();
            };


            converse.ControlBoxView = converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    this.$el.insertAfter(converse.controlboxtoggle.$el);
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        this.initRoster();
                    }
                    if (typeof this.model.get('closed')==='undefined') {
                        this.model.set('closed', !converse.show_controlbox_by_default);
                    }
                    if (!this.model.get('closed')) {
                        this.show();
                    } else {
                        this.hide();
                    }
                },

                render: function () {
                    if (!converse.connection.connected || !converse.connection.authenticated || converse.connection.disconnecting) {
                        // TODO: we might need to take prebinding into consideration here.
                        this.renderLoginPanel();
                    } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                        this.renderContactsPanel();
                    }
                    return this;
                },

                giveFeedback: function (message, klass) {
                    var $el = this.$('.conn-feedback');
                    $el.addClass('conn-feedback').text(message);
                    if (klass) {
                        $el.addClass(klass);
                    }
                },

                onConnected: function () {
                    if (this.model.get('connected')) {
                        this.render().initRoster();
                    }
                },

                initRoster: function () {
                    /* We initialize the roster, which will appear inside the
                    * Contacts Panel.
                    */
                    var rostergroups = new converse.RosterGroups();
                    rostergroups.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1('converse.roster.groups'+converse.bare_jid));
                    converse.rosterview = new converse.RosterView({model: rostergroups});
                    this.contactspanel.$el.append(converse.rosterview.$el);
                    converse.rosterview.render().fetch().update();
                    return this;
                },

                renderLoginPanel: function () {
                    var $feedback = this.$('.conn-feedback'); // we want to still show any existing feedback.
                    this.$el.html(converse.templates.controlbox(this.model.toJSON()));
                    var cfg = {
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    };
                    if (!this.loginpanel) {
                        this.loginpanel = new converse.LoginPanel(cfg);
                    } else {
                        this.loginpanel.delegateEvents().initialize(cfg);
                    }
                    this.loginpanel.render();
                    this.initDragResize().setDimensions();
                    if ($feedback.length && $feedback.text() !== __('Connecting')) {
                        this.$('.conn-feedback').replaceWith($feedback);
                    }
                    return this;
                },

                renderContactsPanel: function () {
                    this.$el.html(converse.templates.controlbox(this.model.toJSON()));
                    this.contactspanel = new converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.render();
                    converse.xmppstatusview = new converse.XMPPStatusView({
                        'model': converse.xmppstatus
                    });
                    converse.xmppstatusview.render();
                    this.initDragResize().setDimensions();
                },

                close: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (converse.connection.connected) {
                        this.model.save({'closed': true});
                    } else {
                        this.model.trigger('hide');
                    }
                    converse.emit('controlBoxClosed', this);
                    return this;
                },

                ensureClosedState: function () {
                    if (this.model.get('closed')) {
                        this.hide();
                    } else {
                        this.show();
                    }
                },

                hide: function (callback) {
                    this.$el.hide('fast', function () {
                        utils.refreshWebkit();
                        converse.emit('chatBoxClosed', this);
                        converse.controlboxtoggle.show(function () {
                            if (typeof callback === "function") {
                                callback();
                            }
                        });
                    });
                    return this;
                },

                show: function () {
                    converse.controlboxtoggle.hide(function () {
                        this.$el.show('fast', function () {
                            if (converse.rosterview) {
                                converse.rosterview.update();
                            }
                            utils.refreshWebkit();
                        }.bind(this));
                        converse.emit('controlBoxOpened', this);
                    }.bind(this));
                    return this;
                },

                switchTab: function (ev) {
                    // TODO: automatically focus the relevant input
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $tab = $(ev.target),
                        $sibling = $tab.parent().siblings('li').children('a'),
                        $tab_panel = $($tab.attr('href'));
                    $($sibling.attr('href')).hide();
                    $sibling.removeClass('current');
                    $tab.addClass('current');
                    $tab_panel.show();
                    return this;
                },

                showHelpMessages: function (msgs) {
                    // Override showHelpMessages in ChatBoxView, for now do nothing.
                    return;
                }
            });


            converse.LoginPanel = Backbone.View.extend({
                tagName: 'div',
                id: "login-dialog",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-login': 'authenticate'
                },

                initialize: function (cfg) {
                    cfg.$parent.html(this.$el.html(
                        converse.templates.login_panel({
                            'LOGIN': converse.LOGIN,
                            'ANONYMOUS': converse.ANONYMOUS,
                            'PREBIND': converse.PREBIND,
                            'auto_login': converse.auto_login,
                            'authentication': converse.authentication,
                            'label_username': __('XMPP Username:'),
                            'label_password': __('Password:'),
                            'label_anon_login': __('Click here to log in anonymously'),
                            'label_login': __('Log In'),
                            'placeholder_username': (converse.locked_domain || converse.default_domain) && __('Username') || __('user@server'),
                            'placeholder_password': __('password')
                        })
                    ));
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    this.$tabs.append(converse.templates.login_tab({label_sign_in: __('Sign in')}));
                    this.$el.find('input#jid').focus();
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                    return this;
                },

                authenticate: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target);
                    if (converse.authentication === converse.ANONYMOUS) {
                        this.connect($form, converse.jid, null);
                        return;
                    }
                    var $jid_input = $form.find('input[name=jid]'),
                        jid = $jid_input.val(),
                        $pw_input = $form.find('input[name=password]'),
                        password = $pw_input.val(),
                        errors = false;

                    if (! jid) {
                        errors = true;
                        $jid_input.addClass('error');
                    }
                    if (! password)  {
                        errors = true;
                        $pw_input.addClass('error');
                    }
                    if (errors) { return; }
                    if (converse.locked_domain) {
                        jid = Strophe.escapeNode(jid) + '@' + converse.locked_domain;
                    } else if (converse.default_domain && jid.indexOf('@') === -1) {
                        jid = jid + '@' + converse.default_domain;
                    }
                    this.connect($form, jid, password);
                    return false;
                },

                connect: function ($form, jid, password) {
                    var resource;
                    if ($form) {
                        $form.find('input[type=submit]').hide().after('<span class="spinner login-submit"/>');
                    }
                    if (jid) {
                        resource = Strophe.getResourceFromJid(jid);
                        if (!resource) {
                            jid = jid.toLowerCase() + converse.generateResource();
                        } else {
                            jid = Strophe.getBareJidFromJid(jid).toLowerCase()+'/'+resource;
                        }
                    }
                    converse.connection.connect(jid, password, converse.onConnectStatusChanged);
                },

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });


            converse.XMPPStatusView = Backbone.View.extend({
                el: "span#xmpp-status-holder",

                events: {
                    "click a.choose-xmpp-status": "toggleOptions",
                    "click #fancy-xmpp-status-select a.change-xmpp-status-message": "renderStatusChangeForm",
                    "submit #set-custom-xmpp-status": "setStatusMessage",
                    "click .dropdown dd ul li a": "setStatus"
                },

                initialize: function () {
                    this.model.on("change:status", this.updateStatusUI, this);
                    this.model.on("change:status_message", this.updateStatusUI, this);
                    this.model.on("update-status-ui", this.updateStatusUI, this);
                },

                render: function () {
                    // Replace the default dropdown with something nicer
                    var $select = this.$el.find('select#select-xmpp-status'),
                        chat_status = this.model.get('status') || 'offline',
                        options = $('option', $select),
                        $options_target,
                        options_list = [];
                    this.$el.html(converse.templates.choose_status());
                    this.$el.find('#fancy-xmpp-status-select')
                            .html(converse.templates.chat_status({
                                'status_message': this.model.get('status_message') || __("I am %1$s", this.getPrettyStatus(chat_status)),
                                'chat_status': chat_status,
                                'desc_custom_status': __('Click here to write a custom status message'),
                                'desc_change_status': __('Click to change your chat status')
                                }));
                    // iterate through all the <option> elements and add option values
                    options.each(function () {
                        options_list.push(converse.templates.status_option({
                            'value': $(this).val(),
                            'text': this.text
                        }));
                    });
                    $options_target = this.$el.find("#target dd ul").hide();
                    $options_target.append(options_list.join(''));
                    $select.remove();
                    return this;
                },

                toggleOptions: function (ev) {
                    ev.preventDefault();
                    $(ev.target).parent().parent().siblings('dd').find('ul').toggle('fast');
                },

                renderStatusChangeForm: function (ev) {
                    ev.preventDefault();
                    var status_message = this.model.get('status') || 'offline';
                    var input = converse.templates.change_status_message({
                        'status_message': status_message,
                        'label_custom_status': __('Custom status'),
                        'label_save': __('Save')
                    });
                    var $xmppstatus = this.$el.find('.xmpp-status');
                    $xmppstatus.parent().addClass('no-border');
                    $xmppstatus.replaceWith(input);
                    this.$el.find('.custom-xmpp-status').focus().focus();
                },

                setStatusMessage: function (ev) {
                    ev.preventDefault();
                    this.model.setStatusMessage($(ev.target).find('input').val());
                },

                setStatus: function (ev) {
                    ev.preventDefault();
                    var $el = $(ev.currentTarget),
                        value = $el.attr('data-value');
                    if (value === 'logout') {
                        this.$el.find(".dropdown dd ul").hide();
                        converse.logOut();
                    } else {
                        this.model.setStatus(value);
                        this.$el.find(".dropdown dd ul").hide();
                    }
                },

                getPrettyStatus: function (stat) {
                    if (stat === 'chat') {
                        return __('online');
                    } else if (stat === 'dnd') {
                        return __('busy');
                    } else if (stat === 'xa') {
                        return __('away for long');
                    } else if (stat === 'away') {
                        return __('away');
                    } else if (stat === 'offline') {
                        return __('offline');
                    } else {
                        return __(stat) || __('online');
                    }
                },

                updateStatusUI: function (model) {
                    var stat = model.get('status');
                    // For translators: the %1$s part gets replaced with the status
                    // Example, I am online
                    var status_message = model.get('status_message') || __("I am %1$s", this.getPrettyStatus(stat));
                    this.$el.find('#fancy-xmpp-status-select').removeClass('no-border').html(
                        converse.templates.chat_status({
                            'chat_status': stat,
                            'status_message': status_message,
                            'desc_custom_status': __('Click here to write a custom status message'),
                            'desc_change_status': __('Click to change your chat status')
                        }));
                }
            });


            converse.ContactsPanel = Backbone.View.extend({
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'users',
                events: {
                    'click a.toggle-xmpp-contact-form': 'toggleContactForm',
                    'submit form.add-xmpp-contact': 'addContactFromForm',
                    'submit form.search-xmpp-contact': 'searchContacts',
                    'click a.subscribe-to-user': 'addContactFromList'
                },

                initialize: function (cfg) {
                    cfg.$parent.append(this.$el);
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                },

                render: function () {
                    var markup;
                    var widgets = converse.templates.contacts_panel({
                        label_online: __('Online'),
                        label_busy: __('Busy'),
                        label_away: __('Away'),
                        label_offline: __('Offline'),
                        label_logout: __('Log out'),
                        include_offline_state: converse.include_offline_state,
                        allow_logout: converse.allow_logout
                    });
                    this.$tabs.append(converse.templates.contacts_tab({label_contacts: LABEL_CONTACTS}));
                    if (converse.xhr_user_search) {
                        markup = converse.templates.search_contact({
                            label_contact_name: __('Contact name'),
                            label_search: __('Search')
                        });
                    } else {
                        markup = converse.templates.add_contact_form({
                            label_contact_username: __('e.g. user@example.com'),
                            label_add: __('Add')
                        });
                    }
                    if (converse.allow_contact_requests) {
                        widgets += converse.templates.add_contact_dropdown({
                            label_click_to_chat: __('Click to add new chat contacts'),
                            label_add_contact: __('Add a contact')
                        });
                    }
                    this.$el.html(widgets);
                    this.$el.find('.search-xmpp ul').append(markup);
                    return this;
                },

                toggleContactForm: function (ev) {
                    ev.preventDefault();
                    this.$el.find('.search-xmpp').toggle('fast', function () {
                        if ($(this).is(':visible')) {
                            $(this).find('input.username').focus();
                        }
                    });
                },

                searchContacts: function (ev) {
                    ev.preventDefault();
                    $.getJSON(converse.xhr_user_search_url+ "?q=" + $(ev.target).find('input.username').val(), function (data) {
                        var $ul= $('.search-xmpp ul');
                        $ul.find('li.found-user').remove();
                        $ul.find('li.chat-info').remove();
                        if (!data.length) {
                            $ul.append('<li class="chat-info">'+__('No users found')+'</li>');
                        }
                        $(data).each(function (idx, obj) {
                            $ul.append(
                                $('<li class="found-user"></li>')
                                .append(
                                    $('<a class="subscribe-to-user" href="#" title="'+__('Click to add as a chat contact')+'"></a>')
                                    .attr('data-recipient', Strophe.getNodeFromJid(obj.id)+"@"+Strophe.getDomainFromJid(obj.id))
                                    .text(obj.fullname)
                                )
                            );
                        });
                    });
                },

                addContactFromForm: function (ev) {
                    ev.preventDefault();
                    var $input = $(ev.target).find('input');
                    var jid = $input.val();
                    if (! jid) {
                        // this is not a valid JID
                        $input.addClass('error');
                        return;
                    }
                    converse.roster.addAndSubscribe(jid);
                    $('.search-xmpp').hide();
                },

                addContactFromList: function (ev) {
                    ev.preventDefault();
                    var $target = $(ev.target),
                        jid = $target.attr('data-recipient'),
                        name = $target.text();
                    converse.roster.addAndSubscribe(jid, name);
                    $target.parent().remove();
                    $('.search-xmpp').hide();
                }
            });


            converse.RosterContactView = Backbone.View.extend({
                tagName: 'dd',

                events: {
                    "click .accept-xmpp-request": "acceptRequest",
                    "click .decline-xmpp-request": "declineRequest",
                    "click .open-chat": "openChat",
                    "click .remove-xmpp-contact": "removeContact"
                },

                initialize: function () {
                    this.model.on("change", this.render, this);
                    this.model.on("remove", this.remove, this);
                    this.model.on("destroy", this.remove, this);
                    this.model.on("open", this.openChat, this);
                },

                render: function () {
                    if (!this.model.showInRoster()) {
                        this.$el.hide();
                        return this;
                    } else if (this.$el[0].style.display === "none") {
                        this.$el.show();
                    }
                    var item = this.model,
                        ask = item.get('ask'),
                        chat_status = item.get('chat_status'),
                        requesting  = item.get('requesting'),
                        subscription = item.get('subscription');

                    var classes_to_remove = [
                        'current-xmpp-contact',
                        'pending-xmpp-contact',
                        'requesting-xmpp-contact'
                        ].concat(_.keys(STATUSES));

                    _.each(classes_to_remove,
                        function (cls) {
                            if (this.el.className.indexOf(cls) !== -1) {
                                this.$el.removeClass(cls);
                            }
                        }, this);
                    this.$el.addClass(chat_status).data('status', chat_status);

                    if ((ask === 'subscribe') || (subscription === 'from')) {
                        /* ask === 'subscribe'
                        *      Means we have asked to subscribe to them.
                        *
                        * subscription === 'from'
                        *      They are subscribed to use, but not vice versa.
                        *      We assume that there is a pending subscription
                        *      from us to them (otherwise we're in a state not
                        *      supported by converse.js).
                        *
                        *  So in both cases the user is a "pending" contact.
                        */
                        this.$el.addClass('pending-xmpp-contact');
                        this.$el.html(converse.templates.pending_contact(
                            _.extend(item.toJSON(), {
                                'desc_remove': __('Click to remove this contact'),
                                'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                            })
                        ));
                    } else if (requesting === true) {
                        this.$el.addClass('requesting-xmpp-contact');
                        this.$el.html(converse.templates.requesting_contact(
                            _.extend(item.toJSON(), {
                                'desc_accept': __("Click to accept this contact request"),
                                'desc_decline': __("Click to decline this contact request"),
                                'allow_chat_pending_contacts': converse.allow_chat_pending_contacts
                            })
                        ));
                        converse.controlboxtoggle.showControlBox();
                    } else if (subscription === 'both' || subscription === 'to') {
                        this.$el.addClass('current-xmpp-contact');
                        this.$el.removeClass(_.without(['both', 'to'], subscription)[0]).addClass(subscription);
                        this.$el.html(converse.templates.roster_item(
                            _.extend(item.toJSON(), {
                                'desc_status': STATUSES[chat_status||'offline'],
                                'desc_chat': __('Click to chat with this contact'),
                                'desc_remove': __('Click to remove this contact'),
                                'title_fullname': __('Name'),
                                'allow_contact_removal': converse.allow_contact_removal
                            })
                        ));
                    }
                    return this;
                },

                openChat: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    return converse.chatboxviews.showChat(this.model.attributes);
                },

                removeContact: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    if (!converse.allow_contact_removal) { return; }
                    var result = confirm(__("Are you sure you want to remove this contact?"));
                    if (result === true) {
                        var iq = $iq({type: 'set'})
                            .c('query', {xmlns: Strophe.NS.ROSTER})
                            .c('item', {jid: this.model.get('jid'), subscription: "remove"});
                        converse.connection.sendIQ(iq,
                            function (iq) {
                                this.model.destroy();
                                this.remove();
                            }.bind(this),
                            function (err) {
                                alert(__("Sorry, there was an error while trying to remove "+name+" as a contact."));
                                converse.log(err);
                            }
                        );
                    }
                },

                acceptRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    converse.roster.sendContactAddIQ(
                        this.model.get('jid'),
                        this.model.get('fullname'),
                        [],
                        function () { this.model.authorize().subscribe(); }.bind(this)
                    );
                },

                declineRequest: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var result = confirm(__("Are you sure you want to decline this contact request?"));
                    if (result === true) {
                        this.model.unauthorize().destroy();
                    }
                    return this;
                }
            });


            converse.RosterGroup = Backbone.Model.extend({
                initialize: function (attributes, options) {
                    this.set(_.extend({
                        description: DESC_GROUP_TOGGLE,
                        state: converse.OPENED
                    }, attributes));
                    // Collection of contacts belonging to this group.
                    this.contacts = new converse.RosterContacts();
                }
            });


            converse.RosterGroupView = Backbone.Overview.extend({
                tagName: 'dt',
                className: 'roster-group',
                events: {
                    "click a.group-toggle": "toggle"
                },

                initialize: function () {
                    this.model.contacts.on("add", this.addContact, this);
                    this.model.contacts.on("change:subscription", this.onContactSubscriptionChange, this);
                    this.model.contacts.on("change:requesting", this.onContactRequestChange, this);
                    this.model.contacts.on("change:chat_status", function (contact) {
                        // This might be optimized by instead of first sorting,
                        // finding the correct position in positionContact
                        this.model.contacts.sort();
                        this.positionContact(contact).render();
                    }, this);
                    this.model.contacts.on("destroy", this.onRemove, this);
                    this.model.contacts.on("remove", this.onRemove, this);
                    converse.roster.on('change:groups', this.onContactGroupChange, this);
                },

                render: function () {
                    this.$el.attr('data-group', this.model.get('name'));
                    this.$el.html(
                        $(converse.templates.group_header({
                            label_group: this.model.get('name'),
                            desc_group_toggle: this.model.get('description'),
                            toggle_state: this.model.get('state')
                        }))
                    );
                    return this;
                },

                addContact: function (contact) {
                    var view = new converse.RosterContactView({model: contact});
                    this.add(contact.get('id'), view);
                    view = this.positionContact(contact).render();
                    if (contact.showInRoster()) {
                        if (this.model.get('state') === converse.CLOSED) {
                            if (view.$el[0].style.display !== "none") { view.$el.hide(); }
                            if (!this.$el.is(':visible')) { this.$el.show(); }
                        } else {
                            if (this.$el[0].style.display !== "block") { this.show(); }
                        }
                    }
                },

                positionContact: function (contact) {
                    /* Place the contact's DOM element in the correct alphabetical
                    * position amongst the other contacts in this group.
                    */
                    var view = this.get(contact.get('id'));
                    var index = this.model.contacts.indexOf(contact);
                    view.$el.detach();
                    if (index === 0) {
                        this.$el.after(view.$el);
                    } else if (index === (this.model.contacts.length-1)) {
                        this.$el.nextUntil('dt').last().after(view.$el);
                    } else {
                        this.$el.nextUntil('dt').eq(index).before(view.$el);
                    }
                    return view;
                },

                show: function () {
                    this.$el.show();
                    _.each(this.getAll(), function (contactView) {
                        if (contactView.model.showInRoster()) {
                            contactView.$el.show();
                        }
                    });
                },

                hide: function () {
                    this.$el.nextUntil('dt').addBack().hide();
                },

                filter: function (q) {
                    /* Filter the group's contacts based on the query "q".
                    * The query is matched against the contact's full name.
                    * If all contacts are filtered out (i.e. hidden), then the
                    * group must be filtered out as well.
                    */
                    var matches;
                    if (q.length === 0) {
                        if (this.model.get('state') === converse.OPENED) {
                            this.model.contacts.each(function (item) {
                                if (item.showInRoster()) {
                                    this.get(item.get('id')).$el.show();
                                }
                            }.bind(this));
                        }
                        this.showIfNecessary();
                    } else {
                        q = q.toLowerCase();
                        matches = this.model.contacts.filter(utils.contains.not('fullname', q));
                        if (matches.length === this.model.contacts.length) { // hide the whole group
                            this.hide();
                        } else {
                            _.each(matches, function (item) {
                                this.get(item.get('id')).$el.hide();
                            }.bind(this));
                            _.each(this.model.contacts.reject(utils.contains.not('fullname', q)), function (item) {
                                this.get(item.get('id')).$el.show();
                            }.bind(this));
                            this.showIfNecessary();
                        }
                    }
                },

                showIfNecessary: function () {
                    if (!this.$el.is(':visible') && this.model.contacts.length > 0) {
                        this.$el.show();
                    }
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$el.nextUntil('dt').slideUp();
                        this.model.save({state: converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.model.save({state: converse.OPENED});
                        this.filter(
                            converse.rosterview.$('.roster-filter').val(),
                            converse.rosterview.$('.filter-type').val()
                        );
                    }
                },

                onContactGroupChange: function (contact) {
                    var in_this_group = _.contains(contact.get('groups'), this.model.get('name'));
                    var cid = contact.get('id');
                    var in_this_overview = !this.get(cid);
                    if (in_this_group && !in_this_overview) {
                        this.model.contacts.remove(cid);
                    } else if (!in_this_group && in_this_overview) {
                        this.addContact(contact);
                    }
                },

                onContactSubscriptionChange: function (contact) {
                    if ((this.model.get('name') === HEADER_PENDING_CONTACTS) && contact.get('subscription') !== 'from') {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onContactRequestChange: function (contact) {
                    if ((this.model.get('name') === HEADER_REQUESTING_CONTACTS) && !contact.get('requesting')) {
                        this.model.contacts.remove(contact.get('id'));
                    }
                },

                onRemove: function (contact) {
                    this.remove(contact.get('id'));
                    if (this.model.contacts.length === 0) {
                        this.$el.hide();
                    }
                }
            });


            converse.RosterGroups = Backbone.Collection.extend({
                model: converse.RosterGroup,
                comparator: function (a, b) {
                    /* Groups are sorted alphabetically, ignoring case.
                    * However, Ungrouped, Requesting Contacts and Pending Contacts
                    * appear last and in that order. */
                    a = a.get('name');
                    b = b.get('name');
                    var special_groups = _.keys(HEADER_WEIGHTS);
                    var a_is_special = _.contains(special_groups, a);
                    var b_is_special = _.contains(special_groups, b);
                    if (!a_is_special && !b_is_special ) {
                        return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
                    } else if (a_is_special && b_is_special) {
                        return HEADER_WEIGHTS[a] < HEADER_WEIGHTS[b] ? -1 : (HEADER_WEIGHTS[a] > HEADER_WEIGHTS[b] ? 1 : 0);
                    } else if (!a_is_special && b_is_special) {
                        return (b === HEADER_CURRENT_CONTACTS) ? 1 : -1;
                    } else if (a_is_special && !b_is_special) {
                        return (a === HEADER_CURRENT_CONTACTS) ? -1 : 1;
                    }
                }
            });

            converse.RosterView = Backbone.Overview.extend({
                tagName: 'div',
                id: 'converse-roster',
                events: {
                    "keydown .roster-filter": "liveFilter",
                    "click .onX": "clearFilter",
                    "mousemove .x": "togglePointer",
                    "change .filter-type": "changeFilterType"
                },

                initialize: function () {
                    this.roster_handler_ref = this.registerRosterHandler();
                    this.rosterx_handler_ref = this.registerRosterXHandler();
                    this.presence_ref = this.registerPresenceHandler();
                    converse.roster.on("add", this.onContactAdd, this);
                    converse.roster.on('change', this.onContactChange, this);
                    converse.roster.on("destroy", this.update, this);
                    converse.roster.on("remove", this.update, this);
                    this.model.on("add", this.onGroupAdd, this);
                    this.model.on("reset", this.reset, this);
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                },

                unregisterHandlers: function () {
                    converse.connection.deleteHandler(this.roster_handler_ref);
                    delete this.roster_handler_ref;
                    converse.connection.deleteHandler(this.rosterx_handler_ref);
                    delete this.rosterx_handler_ref;
                    converse.connection.deleteHandler(this.presence_ref);
                    delete this.presence_ref;
                },

                update: _.debounce(function () {
                    var $count = $('#online-count');
                    $count.text('('+converse.roster.getNumOnlineContacts()+')');
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                    if (this.$roster.parent().length === 0) {
                        this.$el.append(this.$roster.show());
                    }
                    return this.showHideFilter();
                }, converse.animate ? 100 : 0),

                render: function () {
                    this.$el.html(converse.templates.roster({
                        placeholder: __('Type to filter'),
                        label_contacts: LABEL_CONTACTS,
                        label_groups: LABEL_GROUPS
                    }));
                    if (!converse.allow_contact_requests) {
                        // XXX: if we ever support live editing of config then
                        // we'll need to be able to remove this class on the fly.
                        this.$el.addClass('no-contact-requests');
                    }
                    return this;
                },

                fetch: function () {
                    this.model.fetch({
                        silent: true, // We use the success handler to handle groups that were added,
                                    // we need to first have all groups before positionFetchedGroups
                                    // will work properly.
                        success: function (collection, resp, options) {
                            if (collection.length !== 0) {
                                this.positionFetchedGroups(collection, resp, options);
                            }
                            converse.roster.fetch({
                                add: true,
                                success: function (collection) {
                                    if (collection.length === 0) {
                                        /* We don't have any roster contacts stored in sessionStorage,
                                        * so lets fetch the roster from the XMPP server. We pass in
                                        * 'sendPresence' as callback method, because after initially
                                        * fetching the roster we are ready to receive presence
                                        * updates from our contacts.
                                        */
                                        converse.roster.fetchFromServer(function () {
                                            converse.xmppstatus.sendPresence();
                                        });
                                    } else if (converse.send_initial_presence) {
                                        /* We're not going to fetch the roster again because we have
                                        * it already cached in sessionStorage, but we still need to
                                        * send out a presence stanza because this is a new session.
                                        * See: https://github.com/jcbrand/converse.js/issues/536
                                        */
                                        converse.xmppstatus.sendPresence();
                                    }
                                }
                            });
                        }.bind(this)
                    });
                    return this;
                },

                changeFilterType: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.clearFilter();
                    this.filter(
                        this.$('.roster-filter').val(),
                        ev.target.value
                    );
                },

                tog: function (v) {
                    return v?'addClass':'removeClass';
                },

                togglePointer: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var el = ev.target;
                    $(el)[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
                },

                filter: function (query, type) {
                    query = query.toLowerCase();
                    if (type === 'groups') {
                        _.each(this.getAll(), function (view, idx) {
                            if (view.model.get('name').toLowerCase().indexOf(query.toLowerCase()) === -1) {
                                view.hide();
                            } else if (view.model.contacts.length > 0) {
                                view.show();
                            }
                        });
                    } else {
                        _.each(this.getAll(), function (view) {
                            view.filter(query, type);
                        });
                    }
                },

                liveFilter: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $filter = this.$('.roster-filter');
                    var q = $filter.val();
                    var t = this.$('.filter-type').val();
                    $filter[this.tog(q)]('x');
                    this.filter(q, t);
                }, 300),

                clearFilter: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                        $(ev.target).removeClass('x onX').val('');
                    }
                    this.filter('');
                },

                showHideFilter: function () {
                    if (!this.$el.is(':visible')) {
                        return;
                    }
                    var $filter = this.$('.roster-filter');
                    var $type  = this.$('.filter-type');
                    var visible = $filter.is(':visible');
                    if (visible && $filter.val().length > 0) {
                        // Don't hide if user is currently filtering.
                        return;
                    }
                    if (this.$roster.hasScrollBar()) {
                        if (!visible) {
                            $filter.show();
                            $type.show();
                        }
                    } else {
                        $filter.hide();
                        $type.hide();
                    }
                    return this;
                },

                reset: function () {
                    converse.roster.reset();
                    this.removeAll();
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                    this.render().update();
                    return this;
                },

                registerRosterHandler: function () {
                    converse.connection.addHandler(
                        converse.roster.onRosterPush.bind(converse.roster),
                        Strophe.NS.ROSTER, 'iq', "set"
                    );
                },

                registerRosterXHandler: function () {
                    var t = 0;
                    converse.connection.addHandler(
                        function (msg) {
                            window.setTimeout(
                                function () {
                                    converse.connection.flush();
                                    converse.roster.subscribeToSuggestedItems.bind(converse.roster)(msg);
                                },
                                t
                            );
                            t += $(msg).find('item').length*250;
                            return true;
                        },
                        Strophe.NS.ROSTERX, 'message', null
                    );
                },

                registerPresenceHandler: function () {
                    converse.connection.addHandler(
                        function (presence) {
                            converse.roster.presenceHandler(presence);
                            return true;
                        }.bind(this), null, 'presence', null);
                },

                onGroupAdd: function (group) {
                    var view = new converse.RosterGroupView({model: group});
                    this.add(group.get('name'), view.render());
                    this.positionGroup(view);
                },

                onContactAdd: function (contact) {
                    this.addRosterContact(contact).update();
                    if (!contact.get('vcard_updated')) {
                        // This will update the vcard, which triggers a change
                        // request which will rerender the roster contact.
                        converse.getVCard(contact.get('jid'));
                    }
                },

                onContactChange: function (contact) {
                    this.updateChatBox(contact).update();
                    if (_.has(contact.changed, 'subscription')) {
                        if (contact.changed.subscription === 'from') {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (_.contains(['both', 'to'], contact.get('subscription'))) {
                            this.addExistingContact(contact);
                        }
                    }
                    if (_.has(contact.changed, 'ask') && contact.changed.ask === 'subscribe') {
                        this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                    }
                    if (_.has(contact.changed, 'subscription') && contact.changed.requesting === 'true') {
                        this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                    }
                    this.liveFilter();
                },

                updateChatBox: function (contact) {
                    var chatbox = converse.chatboxes.get(contact.get('jid')),
                        changes = {};
                    if (!chatbox) {
                        return this;
                    }
                    if (_.has(contact.changed, 'chat_status')) {
                        changes.chat_status = contact.get('chat_status');
                    }
                    if (_.has(contact.changed, 'status')) {
                        changes.status = contact.get('status');
                    }
                    chatbox.save(changes);
                    return this;
                },

                positionFetchedGroups: function (model, resp, options) {
                    /* Instead of throwing an add event for each group
                    * fetched, we wait until they're all fetched and then
                    * we position them.
                    * Works around the problem of positionGroup not
                    * working when all groups besides the one being
                    * positioned aren't already in inserted into the
                    * roster DOM element.
                    */
                    model.sort();
                    model.each(function (group, idx) {
                        var view = this.get(group.get('name'));
                        if (!view) {
                            view = new converse.RosterGroupView({model: group});
                            this.add(group.get('name'), view.render());
                        }
                        if (idx === 0) {
                            this.$roster.append(view.$el);
                        } else {
                            this.appendGroup(view);
                        }
                    }.bind(this));
                },

                positionGroup: function (view) {
                    /* Place the group's DOM element in the correct alphabetical
                    * position amongst the other groups in the roster.
                    */
                    var $groups = this.$roster.find('.roster-group'),
                        index = $groups.length ? this.model.indexOf(view.model) : 0;
                    if (index === 0) {
                        this.$roster.prepend(view.$el);
                    } else if (index === (this.model.length-1)) {
                        this.appendGroup(view);
                    } else {
                        $($groups.eq(index)).before(view.$el);
                    }
                    return this;
                },

                appendGroup: function (view) {
                    /* Add the group at the bottom of the roster
                    */
                    var $last = this.$roster.find('.roster-group').last();
                    var $siblings = $last.siblings('dd');
                    if ($siblings.length > 0) {
                        $siblings.last().after(view.$el);
                    } else {
                        $last.after(view.$el);
                    }
                    return this;
                },

                getGroup: function (name) {
                    /* Returns the group as specified by name.
                    * Creates the group if it doesn't exist.
                    */
                    var view =  this.get(name);
                    if (view) {
                        return view.model;
                    }
                    return this.model.create({name: name, id: b64_sha1(name)});
                },

                addContactToGroup: function (contact, name) {
                    this.getGroup(name).contacts.add(contact);
                },

                addExistingContact: function (contact) {
                    var groups;
                    if (converse.roster_groups) {
                        groups = contact.get('groups');
                        if (groups.length === 0) {
                            groups = [HEADER_UNGROUPED];
                        }
                    } else {
                        groups = [HEADER_CURRENT_CONTACTS];
                    }
                    _.each(groups, _.bind(this.addContactToGroup, this, contact));
                },

                addRosterContact: function (contact) {
                    if (contact.get('subscription') === 'both' || contact.get('subscription') === 'to') {
                        this.addExistingContact(contact);
                    } else {
                        if ((contact.get('ask') === 'subscribe') || (contact.get('subscription') === 'from')) {
                            this.addContactToGroup(contact, HEADER_PENDING_CONTACTS);
                        } else if (contact.get('requesting') === true) {
                            this.addContactToGroup(contact, HEADER_REQUESTING_CONTACTS);
                        }
                    }
                    return this;
                }
            });


            converse.ControlBoxToggle = Backbone.View.extend({
                tagName: 'a',
                className: 'toggle-controlbox',
                id: 'toggle-controlbox',
                events: {
                    'click': 'onClick'
                },
                attributes: {
                    'href': "#"
                },

                initialize: function () {
                    this.render();
                },

                render: function () {
                    $('#conversejs').prepend(this.$el.html(
                        converse.templates.controlbox_toggle({
                            'label_toggle': __('Toggle chat')
                        })
                    ));
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    this.$el.hide();
                    return this;
                },

                hide: function (callback) {
                    this.$el.fadeOut('fast', callback);
                },

                show: function (callback) {
                    this.$el.show('fast', callback);
                },

                showControlBox: function () {
                    var controlbox = converse.chatboxes.get('controlbox');
                    if (!controlbox) {
                        controlbox = converse.addControlBox();
                    }
                    if (converse.connection.connected) {
                        controlbox.save({closed: false});
                    } else {
                        controlbox.trigger('show');
                    }
                },

                onClick: function (e) {
                    e.preventDefault();
                    if ($("div#controlbox").is(':visible')) {
                        var controlbox = converse.chatboxes.get('controlbox');
                        if (converse.connection.connected) {
                            controlbox.save({closed: true});
                        } else {
                            controlbox.trigger('hide');
                        }
                    } else {
                        this.showControlBox();
                    }
                }
            });
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, setTimeout */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-muc", [
            "converse-core",
            "converse-api",
            "converse-controlbox"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        $build = converse_api.env.$build,
        $msg = converse_api.env.$msg,
        $pres = converse_api.env.$pres,
        b64_sha1 = converse_api.env.b64_sha1,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    // Add Strophe Namespaces
    Strophe.addNamespace('MUC_ADMIN', Strophe.NS.MUC + "#admin");
    Strophe.addNamespace('MUC_OWNER', Strophe.NS.MUC + "#owner");
    Strophe.addNamespace('MUC_REGISTER', "jabber:iq:register");
    Strophe.addNamespace('MUC_ROOMCONF', Strophe.NS.MUC + "#roomconfig");
    Strophe.addNamespace('MUC_USER', Strophe.NS.MUC + "#user");

    converse_api.plugins.add('muc', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    this._super.addClientFeatures.apply(this, arguments);
                    if (this.allow_muc) {
                        this.connection.disco.addFeature(Strophe.NS.MUC);
                    }
                }
            },

            ControlBoxView: {
                renderContactsPanel: function () {
                    var converse = this._super.converse;
                    this._super.renderContactsPanel.apply(this, arguments);
                    if (converse.allow_muc) {
                        this.roomspanel = new converse.RoomsPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': new (Backbone.Model.extend({
                                id: b64_sha1('converse.roomspanel'+converse.bare_jid), // Required by sessionStorage
                                browserStorage: new Backbone.BrowserStorage[converse.storage](
                                    b64_sha1('converse.roomspanel'+converse.bare_jid))
                            }))()
                        });
                        this.roomspanel.render().model.fetch();
                        if (!this.roomspanel.model.get('nick')) {
                            this.roomspanel.model.save({
                                nick: Strophe.getNodeFromJid(converse.bare_jid)
                            });
                        }
                    }
                },

                onConnected: function () {
                    var converse = this._super.converse;
                    this._super.onConnected.apply(this, arguments);

                    if (this.model.get('connected')) {
                        converse.features.off('add', this.featureAdded, this);
                        converse.features.on('add', this.featureAdded, this);
                        // Features could have been added before the controlbox was
                        // initialized. We're only interested in MUC
                        var feature = converse.features.findWhere({
                            'var': Strophe.NS.MUC
                        });
                        if (feature) {
                            this.featureAdded(feature);
                        }
                    }
                },

                featureAdded: function (feature) {
                    var converse = this._super.converse;
                    if ((feature.get('var') === Strophe.NS.MUC) && (converse.allow_muc)) {
                        this.roomspanel.model.save({muc_domain: feature.get('from')});
                        var $server= this.$el.find('input.new-chatroom-server');
                        if (! $server.is(':focus')) {
                            $server.val(this.roomspanel.model.get('muc_domain'));
                        }
                    }
                }
            },

            ChatBoxView: {
                clearChatRoomMessages: function (ev) {
                    /* New method added to the ChatBox model which allows all
                     * messages in a chatroom to be cleared.
                     */
                    if (typeof ev !== "undefined") { ev.stopPropagation(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                    if (result === true) {
                        this.$content.empty();
                    }
                    return this;
                },
            },

            ChatBoxes: {
                registerMessageHandler: function () {
                    /* Override so that we can register a handler
                     * for chat room invites.
                     */
                    this._super.registerMessageHandler.apply(this, arguments); // First call the original
                    this._super.converse.connection.addHandler(
                        function (message) {
                            this.onInvite(message);
                            return true;
                        }.bind(this), 'jabber:x:conference', 'message');
                },

                onInvite: function (message) {
                    /* An invitation to join a chat room has been received */
                    var converse = this._super.converse,
                        $message = $(message),
                        $x = $message.children('x[xmlns="jabber:x:conference"]'),
                        from = Strophe.getBareJidFromJid($message.attr('from')),
                        room_jid = $x.attr('jid'),
                        reason = $x.attr('reason'),
                        contact = converse.roster.get(from),
                        result;

                    if (converse.auto_join_on_invite) {
                        result = true;
                    } else {
                        contact = contact? contact.get('fullname'): Strophe.getNodeFromJid(from);   // Invite request might come from someone not your roster list
                        if (!reason) {
                            result = confirm(
                                __(___("%1$s has invited you to join a chat room: %2$s"), contact, room_jid)
                            );
                        } else {
                            result = confirm(
                                __(___('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"'), contact, room_jid, reason)
                            );
                        }
                    }
                    if (result === true) {
                        var chatroom = converse.chatboxviews.showChat({
                            'id': room_jid,
                            'jid': room_jid,
                            'name': Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                            'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(converse.connection.jid)),
                            'chatroom': true,
                            'box_id': b64_sha1(room_jid),
                            'password': $x.attr('password')
                        });
                        if (!_.contains(
                                    [Strophe.Status.CONNECTING, Strophe.Status.CONNECTED],
                                    chatroom.get('connection_status'))
                                ) {
                            converse.chatboxviews.get(room_jid).join(null);
                        }
                    }
                }
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('chatroom')) {
                        view = new converse.ChatRoomView({'model': item});
                        this.add(item.get('id'), view);
                        this.trimChats(view);
                    } else {
                        this._super.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Configuration values for this plugin
            var settings = {
                allow_muc: true,
                auto_join_on_invite: false,  // Auto-join chatroom on invite
                hide_muc_server: false,
                muc_history_max_stanzas: undefined, // Takes an integer, limits the amount of messages to fetch from chat room's history
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

            converse.ChatRoomView = converse.ChatBoxView.extend({
                /* Backbone View which renders a chat room, based upon the view
                * for normal one-on-one chat boxes.
                */
                length: 300,
                tagName: 'div',
                className: 'chatbox chatroom',
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .toggle-chatbox-button': 'minimize',
                    'click .configure-chatroom-button': 'configureChatRoom',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearChatRoomMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-occupants a': 'toggleOccupants',
                    'keypress textarea.chat-textarea': 'keyPressed',
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },
                is_chatroom: true,

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('change:minimized', function (item) {
                        if (item.get('minimized')) {
                            this.hide();
                        } else {
                            this.maximize();
                        }
                    }, this);
                    this.model.on('destroy', function () {
                        this.hide().leave();
                    }, this);

                    this.occupantsview = new converse.ChatRoomOccupantsView({
                        model: new converse.ChatRoomOccupants({nick: this.model.get('nick')})
                    });
                    var id = b64_sha1('converse.occupants'+converse.bare_jid+this.model.get('id')+this.model.get('nick'));
                    this.occupantsview.model.browserStorage = new Backbone.BrowserStorage[converse.storage](id);

                    this.occupantsview.chatroomview = this;
                    this.render().$el.hide();
                    this.occupantsview.model.fetch({add:true});
                    this.join(null, {'maxstanzas': converse.muc_history_max_stanzas});
                    this.fetchMessages();
                    converse.emit('chatRoomOpened', this);

                    this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                    if (this.model.get('minimized')) {
                        this.hide();
                    } else {
                        this.show();
                    }
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                            .html(converse.templates.chatroom(this.model.toJSON()));
                    this.renderChatArea();
                    this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    this.setWidth();
                    setTimeout(converse.refreshWebkit, 50);
                    return this;
                },

                renderChatArea: function () {
                    if (!this.$('.chat-area').length) {
                        this.$('.chatroom-body').empty()
                            .append(
                                converse.templates.chatarea({
                                    'show_toolbar': converse.show_toolbar,
                                    'label_message': __('Message')
                                }))
                            .append(this.occupantsview.render().$el);
                        this.renderToolbar();
                        this.$content = this.$el.find('.chat-content');
                    }
                    this.toggleOccupants(null, true);
                    return this;
                },

                toggleOccupants: function (ev, preserve_state) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    if (preserve_state) {
                        // Bit of a hack, to make sure that the sidebar's state doesn't change
                        this.model.set({hidden_occupants: !this.model.get('hidden_occupants')});
                    }
                    var $el = this.$('.icon-hide-users');
                    if (!this.model.get('hidden_occupants')) {
                        this.model.save({hidden_occupants: true});
                        $el.removeClass('icon-hide-users').addClass('icon-show-users');
                        this.$('.occupants').addClass('hidden');
                        this.$('.chat-area').addClass('full');
                        this.scrollDown();
                    } else {
                        this.model.save({hidden_occupants: false});
                        $el.removeClass('icon-show-users').addClass('icon-hide-users');
                        this.$('.chat-area').removeClass('full');
                        this.$('div.occupants').removeClass('hidden');
                        this.scrollDown();
                    }
                },

                directInvite: function (recipient, reason) {
                    var attrs = {
                        xmlns: 'jabber:x:conference',
                        jid: this.model.get('jid')
                    };
                    if (reason !== null) { attrs.reason = reason; }
                    if (this.model.get('password')) { attrs.password = this.model.get('password'); }
                    var invitation = $msg({
                        from: converse.connection.jid,
                        to: recipient,
                        id: converse.connection.getUniqueId()
                    }).c('x', attrs);
                    converse.connection.send(invitation);
                    converse.emit('roomInviteSent', {
                        'room': this,
                        'recipient': recipient,
                        'reason': reason
                    });
                },

                onCommandError: function (stanza) {
                    this.showStatusNotification(__("Error: could not execute the command"), true);
                },

                sendChatRoomMessage: function (text) {
                    var msgid = converse.connection.getUniqueId();
                    var msg = $msg({
                        to: this.model.get('jid'),
                        from: converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c("composing");
                    converse.connection.send(msg);

                    var fullname = converse.xmppstatus.get('fullname');
                    this.model.messages.create({
                        fullname: _.isEmpty(fullname)? converse.bare_jid: fullname,
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid: msgid
                    });
                },

                setAffiliation: function(room, jid, affiliation, reason, onSuccess, onError) {
                    var item = $build("item", {jid: jid, affiliation: affiliation});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                modifyRole: function(room, nick, role, reason, onSuccess, onError) {
                    var item = $build("item", {nick: nick, role: role});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                member: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'member', reason, handler_cb, error_cb);
                },
                revoke: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'none', reason, handler_cb, error_cb);
                },
                owner: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'owner', reason, handler_cb, error_cb);
                },
                admin: function(room, jid, reason, handler_cb, error_cb) {
                    return this.setAffiliation(room, jid, 'admin', reason, handler_cb, error_cb);
                },

                validateRoleChangeCommand: function (command, args) {
                    /* Check that a command to change a chat room user's role or
                    * affiliation has anough arguments.
                    */
                    // TODO check if first argument is valid
                    if (args.length < 1 || args.length > 2) {
                        this.showStatusNotification(
                            __("Error: the \""+command+"\" command takes two arguments, the user's nickname and optionally a reason."),
                            true
                        );
                        return false;
                    }
                    return true;
                },

                onChatRoomMessageSubmitted: function (text) {
                    /* Gets called when the user presses enter to send off a
                    * message in a chat room.
                    *
                    * Parameters:
                    *    (String) text - The message text.
                    */
                    var match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                        args = match[2] && match[2].splitOnce(' ') || [];
                    switch (match[1]) {
                        case 'admin':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'admin', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'ban':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'outcast', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'clear':
                            this.clearChatRoomMessages();
                            break;
                        case 'deop':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'help':
                            this.showHelpMessages([
                                '<strong>/admin</strong>: ' +__("Change user's affiliation to admin"),
                                '<strong>/ban</strong>: '   +__('Ban user from room'),
                                '<strong>/clear</strong>: ' +__('Remove messages'),
                                '<strong>/deop</strong>: '  +__('Change user role to occupant'),
                                '<strong>/help</strong>: '  +__('Show this menu'),
                                '<strong>/kick</strong>: '  +__('Kick user from room'),
                                '<strong>/me</strong>: '    +__('Write in 3rd person'),
                                '<strong>/member</strong>: '+__('Grant membership to a user'),
                                '<strong>/mute</strong>: '  +__("Remove user's ability to post messages"),
                                '<strong>/nick</strong>: '  +__('Change your nickname'),
                                '<strong>/op</strong>: '    +__('Grant moderator role to user'),
                                '<strong>/owner</strong>: ' +__('Grant ownership of this room'),
                                '<strong>/revoke</strong>: '+__("Revoke user's membership"),
                                '<strong>/topic</strong>: ' +__('Set room topic'),
                                '<strong>/voice</strong>: ' +__('Allow muted user to post messages')
                            ]);
                            break;
                        case 'kick':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'mute':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'visitor', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'member':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'member', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'nick':
                            converse.connection.send($pres({
                                from: converse.connection.jid,
                                to: this.getRoomJIDAndNick(match[2]),
                                id: converse.connection.getUniqueId()
                            }).tree());
                            break;
                        case 'owner':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'owner', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'op':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'revoke':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation(
                                    this.model.get('jid'), args[0], 'none', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'topic':
                            converse.connection.send(
                                $msg({
                                    to: this.model.get('jid'),
                                    from: converse.connection.jid,
                                    type: "groupchat"
                                }).c("subject", {xmlns: "jabber:client"}).t(match[2]).tree()
                            );
                            break;
                        case 'voice':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'occupant', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        default:
                            this.sendChatRoomMessage(text);
                        break;
                    }
                },

                handleMUCStanza: function (stanza) {
                    var xmlns, xquery, i;
                    var from = stanza.getAttribute('from');
                    var is_mam = $(stanza).find('[xmlns="'+Strophe.NS.MAM+'"]').length > 0;
                    if (!from || (this.model.get('id') !== from.split("/")[0])  || is_mam) {
                        return true;
                    }
                    if (stanza.nodeName === "message") {
                        _.compose(this.onChatRoomMessage.bind(this), this.showStatusMessages.bind(this))(stanza);
                    } else if (stanza.nodeName === "presence") {
                        xquery = stanza.getElementsByTagName("x");
                        if (xquery.length > 0) {
                            for (i = 0; i < xquery.length; i++) {
                                xmlns = xquery[i].getAttribute("xmlns");
                                if (xmlns && xmlns.match(Strophe.NS.MUC)) {
                                    this.onChatRoomPresence(stanza);
                                    break;
                                }
                            }
                        }
                    }
                    return true;
                },

                getRoomJIDAndNick: function (nick) {
                    nick = nick || this.model.get('nick');
                    var room = this.model.get('jid');
                    var node = Strophe.getNodeFromJid(room);
                    var domain = Strophe.getDomainFromJid(room);
                    return node + "@" + domain + (nick !== null ? "/" + nick : "");
                },

                join: function (password, history_attrs, extended_presence) {
                    var stanza = $pres({
                        from: converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    }).c("x", {
                        xmlns: Strophe.NS.MUC
                    });
                    if (typeof history_attrs === "object" && Object.keys(history_attrs).length) {
                        stanza = stanza.c("history", history_attrs).up();
                    }
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    if (typeof extended_presence !== "undefined" && extended_presence !== null) {
                        stanza.up.cnode(extended_presence);
                    }
                    if (!this.handler) {
                        this.handler = converse.connection.addHandler(this.handleMUCStanza.bind(this));
                    }
                    this.model.set('connection_status', Strophe.Status.CONNECTING);
                    return converse.connection.send(stanza);
                },

                leave: function(exit_msg) {
                    var presenceid = converse.connection.getUniqueId();
                    var presence = $pres({
                        type: "unavailable",
                        id: presenceid,
                        from: converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    converse.connection.addHandler(
                        function () { this.model.set('connection_status', Strophe.Status.DISCONNECTED); }.bind(this),
                        null, "presence", null, presenceid);
                    converse.connection.send(presence);
                },

                renderConfigurationForm: function (stanza) {
                    var $form = this.$el.find('form.chatroom-form'),
                        $fieldset = $form.children('fieldset:first'),
                        $stanza = $(stanza),
                        $fields = $stanza.find('field'),
                        title = $stanza.find('title').text(),
                        instructions = $stanza.find('instructions').text();
                    $fieldset.find('span.spinner').remove();
                    $fieldset.append($('<legend>').text(title));
                    if (instructions && instructions !== title) {
                        $fieldset.append($('<p class="instructions">').text(instructions));
                    }
                    _.each($fields, function (field) {
                        $fieldset.append(utils.xForm2webForm($(field), $stanza));
                    });
                    $form.append('<fieldset></fieldset>');
                    $fieldset = $form.children('fieldset:last');
                    $fieldset.append('<input type="submit" class="pure-button button-primary" value="'+__('Save')+'"/>');
                    $fieldset.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                    $fieldset.find('input[type=button]').on('click', this.cancelConfiguration.bind(this));
                    $form.on('submit', this.saveConfiguration.bind(this));
                },

                sendConfiguration: function(config, onSuccess, onError) {
                    // Send an IQ stanza with the room configuration.
                    var iq = $iq({to: this.model.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config, function (node) { iq.cnode(node).up(); });
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
                },

                saveConfiguration: function (ev) {
                    ev.preventDefault();
                    var that = this;
                    var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                        count = $inputs.length,
                        configArray = [];
                    $inputs.each(function () {
                        configArray.push(utils.webForm2xForm(this));
                        if (!--count) {
                            that.sendConfiguration(
                                configArray,
                                that.onConfigSaved.bind(that),
                                that.onErrorConfigSaved.bind(that)
                            );
                        }
                    });
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                        });
                },

                onConfigSaved: function (stanza) {
                    // TODO: provide feedback
                },

                onErrorConfigSaved: function (stanza) {
                    this.showStatusNotification(__("An error occurred while trying to save the form."));
                },

                cancelConfiguration: function (ev) {
                    ev.preventDefault();
                    var that = this;
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                        });
                },

                configureChatRoom: function (ev) {
                    ev.preventDefault();
                    if (this.$el.find('div.chatroom-form-container').length) {
                        return;
                    }
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('.chatroom-body').append(converse.templates.chatroom_form());
                    converse.connection.sendIQ(
                            $iq({
                                to: this.model.get('jid'),
                                type: "get"
                            }).c("query", {xmlns: Strophe.NS.MUC_OWNER}).tree(),
                            this.renderConfigurationForm.bind(this)
                    );
                },

                submitPassword: function (ev) {
                    ev.preventDefault();
                    var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(password);
                },

                renderPasswordForm: function () {
                    this.$('.chatroom-body').children().hide();
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append(
                        converse.templates.chatroom_password_form({
                            heading: __('This chatroom requires a password'),
                            label_password: __('Password: '),
                            label_submit: __('Submit')
                        }));
                    this.$('.chatroom-form').on('submit', this.submitPassword.bind(this));
                },

                showDisconnectMessage: function (msg) {
                    this.$('.chat-area').hide();
                    this.$('.occupants').hide();
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append($('<p>'+msg+'</p>'));
                },

                /* http://xmpp.org/extensions/xep-0045.html
                * ----------------------------------------
                * 100 message      Entering a room         Inform user that any occupant is allowed to see the user's full JID
                * 101 message (out of band)                Affiliation change  Inform user that his or her affiliation changed while not in the room
                * 102 message      Configuration change    Inform occupants that room now shows unavailable members
                * 103 message      Configuration change    Inform occupants that room now does not show unavailable members
                * 104 message      Configuration change    Inform occupants that a non-privacy-related room configuration change has occurred
                * 110 presence     Any room presence       Inform user that presence refers to one of its own room occupants
                * 170 message or initial presence          Configuration change    Inform occupants that room logging is now enabled
                * 171 message      Configuration change    Inform occupants that room logging is now disabled
                * 172 message      Configuration change    Inform occupants that the room is now non-anonymous
                * 173 message      Configuration change    Inform occupants that the room is now semi-anonymous
                * 174 message      Configuration change    Inform occupants that the room is now fully-anonymous
                * 201 presence     Entering a room         Inform user that a new room has been created
                * 210 presence     Entering a room         Inform user that the service has assigned or modified the occupant's roomnick
                * 301 presence     Removal from room       Inform user that he or she has been banned from the room
                * 303 presence     Exiting a room          Inform all occupants of new room nickname
                * 307 presence     Removal from room       Inform user that he or she has been kicked from the room
                * 321 presence     Removal from room       Inform user that he or she is being removed from the room because of an affiliation change
                * 322 presence     Removal from room       Inform user that he or she is being removed from the room because the room has been changed to members-only and the user is not a member
                * 332 presence     Removal from room       Inform user that he or she is being removed from the room because of a system shutdown
                */
                infoMessages: {
                    100: __('This room is not anonymous'),
                    102: __('This room now shows unavailable members'),
                    103: __('This room does not show unavailable members'),
                    104: __('Non-privacy-related room configuration has changed'),
                    170: __('Room logging is now enabled'),
                    171: __('Room logging is now disabled'),
                    172: __('This room is now non-anonymous'),
                    173: __('This room is now semi-anonymous'),
                    174: __('This room is now fully-anonymous'),
                    201: __('A new room has been created')
                },

                disconnectMessages: {
                    301: __('You have been banned from this room'),
                    307: __('You have been kicked from this room'),
                    321: __("You have been removed from this room because of an affiliation change"),
                    322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
                },

                actionInfoMessages: {
                    /* XXX: Note the triple underscore function and not double
                    * underscore.
                    *
                    * This is a hack. We can't pass the strings to __ because we
                    * don't yet know what the variable to interpolate is.
                    *
                    * Triple underscore will just return the string again, but we
                    * can then at least tell gettext to scan for it so that these
                    * strings are picked up by the translation machinery.
                    */
                    301: ___("<strong>%1$s</strong> has been banned"),
                    303: ___("<strong>%1$s</strong>'s nickname has changed"),
                    307: ___("<strong>%1$s</strong> has been kicked out"),
                    321: ___("<strong>%1$s</strong> has been removed because of an affiliation change"),
                    322: ___("<strong>%1$s</strong> has been removed for not being a member")
                },

                newNicknameMessages: {
                    210: ___('Your nickname has been automatically changed to: <strong>%1$s</strong>'),
                    303: ___('Your nickname has been changed to: <strong>%1$s</strong>')
                },

                showStatusMessages: function (el, is_self) {
                    /* Check for status codes and communicate their purpose to the user.
                    * Allow user to configure chat room if they are the owner.
                    * See: http://xmpp.org/registrar/mucstatus.html
                    */
                    var $el = $(el),
                        i, disconnect_msgs = [], msgs = [], reasons = [];

                    $el.find('x[xmlns="'+Strophe.NS.MUC_USER+'"]').each(function (idx, x) {
                        var $item = $(x).find('item');
                        if (Strophe.getBareJidFromJid($item.attr('jid')) === converse.bare_jid && $item.attr('affiliation') === 'owner') {
                            this.$el.find('a.configure-chatroom-button').show();
                        }
                        $(x).find('item reason').each(function (idx, reason) {
                            if ($(reason).text()) {
                                reasons.push($(reason).text());
                            }
                        });
                        $(x).find('status').each(function (idx, stat) {
                            var code = stat.getAttribute('code');
                            var from_nick = Strophe.unescapeNode(Strophe.getResourceFromJid($el.attr('from')));
                            if (is_self && code === "210") {
                                msgs.push(__(this.newNicknameMessages[code], from_nick));
                            } else if (is_self && code === "303") {
                                msgs.push(__(this.newNicknameMessages[code], $item.attr('nick')));
                            } else if (is_self && _.contains(_.keys(this.disconnectMessages), code)) {
                                disconnect_msgs.push(this.disconnectMessages[code]);
                            } else if (!is_self && _.contains(_.keys(this.actionInfoMessages), code)) {
                                msgs.push(__(this.actionInfoMessages[code], from_nick));
                            } else if (_.contains(_.keys(this.infoMessages), code)) {
                                msgs.push(this.infoMessages[code]);
                            } else if (code !== '110') {
                                if ($(stat).text()) {
                                    msgs.push($(stat).text()); // Sometimes the status contains human readable text and not a code.
                                }
                            }
                        }.bind(this));
                    }.bind(this));

                    if (disconnect_msgs.length > 0) {
                        for (i=0; i<disconnect_msgs.length; i++) {
                            this.showDisconnectMessage(disconnect_msgs[i]);
                        }
                        for (i=0; i<reasons.length; i++) {
                            this.showDisconnectMessage(__('The reason given is: "'+reasons[i]+'"'), true);
                        }
                        this.model.set('connection_status', Strophe.Status.DISCONNECTED);
                        return;
                    }
                    for (i=0; i<msgs.length; i++) {
                        this.$content.append(converse.templates.info({message: msgs[i]}));
                    }
                    for (i=0; i<reasons.length; i++) {
                        this.showStatusNotification(__('The reason given is: "'+reasons[i]+'"'), true);
                    }
                    this.scrollDown();
                    return el;
                },

                showErrorMessage: function ($error) {
                    // We didn't enter the room, so we must remove it from the MUC
                    // add-on
                    if ($error.attr('type') === 'auth') {
                        if ($error.find('not-authorized').length) {
                            this.renderPasswordForm();
                        } else if ($error.find('registration-required').length) {
                            this.showDisconnectMessage(__('You are not on the member list of this room'));
                        } else if ($error.find('forbidden').length) {
                            this.showDisconnectMessage(__('You have been banned from this room'));
                        }
                    } else if ($error.attr('type') === 'modify') {
                        if ($error.find('jid-malformed').length) {
                            this.showDisconnectMessage(__('No nickname was specified'));
                        }
                    } else if ($error.attr('type') === 'cancel') {
                        if ($error.find('not-allowed').length) {
                            this.showDisconnectMessage(__('You are not allowed to create new rooms'));
                        } else if ($error.find('not-acceptable').length) {
                            this.showDisconnectMessage(__("Your nickname doesn't conform to this room's policies"));
                        } else if ($error.find('conflict').length) {
                            this.showDisconnectMessage(__("Your nickname is already taken"));
                            // TODO: give user the option of choosing a different nickname
                        } else if ($error.find('item-not-found').length) {
                            this.showDisconnectMessage(__("This room does not (yet) exist"));
                        } else if ($error.find('service-unavailable').length) {
                            this.showDisconnectMessage(__("This room has reached it's maximum number of occupants"));
                        }
                    }
                },

                onChatRoomPresence: function (pres) {
                    var $presence = $(pres), is_self;
                    var nick = this.model.get('nick');
                    if ($presence.attr('type') === 'error') {
                        this.model.set('connection_status', Strophe.Status.DISCONNECTED);
                        this.showErrorMessage($presence.find('error'));
                    } else {
                        is_self = ($presence.find("status[code='110']").length) ||
                            ($presence.attr('from') === this.model.get('id')+'/'+Strophe.escapeNode(nick));
                        if (this.model.get('connection_status') !== Strophe.Status.CONNECTED) {
                            this.model.set('connection_status', Strophe.Status.CONNECTED);
                        }
                        this.showStatusMessages(pres, is_self);
                    }
                    this.occupantsview.updateOccupantsOnPresence(pres);
                },

                onChatRoomMessage: function (message) {
                    var $message = $(message),
                        archive_id = $message.find('result[xmlns="'+Strophe.NS.MAM+'"]').attr('id'),
                        delayed = $message.find('delay').length > 0,
                        $forwarded = $message.find('forwarded'),
                        $delay;

                    if ($forwarded.length) {
                        $message = $forwarded.children('message');
                        $delay = $forwarded.children('delay');
                        delayed = $delay.length > 0;
                    }
                    var body = $message.children('body').text(),
                        jid = $message.attr('from'),
                        msgid = $message.attr('id'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = $message.children('subject').text();

                    if (msgid && this.model.messages.findWhere({msgid: msgid})) {
                        return true; // We already have this message stored.
                    }
                    if (subject) {
                        this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                        // For translators: the %1$s and %2$s parts will get replaced by the user and topic text respectively
                        // Example: Topic set by JC Brand to: Hello World!
                        this.$content.append(
                            converse.templates.info({
                                'message': __('Topic set by %1$s to: %2$s', sender, subject)
                            }));
                    }
                    if (sender === '') {
                        return true;
                    }
                    this.model.createMessage($message, $delay, archive_id);
                    if (!delayed && sender !== this.model.get('nick') && (new RegExp("\\b"+this.model.get('nick')+"\\b")).test(body)) {
                        converse.notifyOfNewMessage();
                    }
                    if (sender !== this.model.get('nick')) {
                        // We only emit an event if it's not our own message
                        converse.emit('message', message);
                    }
                    return true;
                },
                
                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                    *
                    * Then, upon receiving them, call onChatRoomMessage
                    * so that they are displayed inside it.
                    */
                    if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                        return;
                    }
                    this.addSpinner();
                    converse_api.archive.query(_.extend(options, {'groupchat': true}),
                        function (messages) {
                            this.clearSpinner();
                            if (messages.length) {
                                _.map(messages, this.onChatRoomMessage.bind(this));
                            }
                        }.bind(this),
                        function () {
                            this.clearSpinner();
                            converse.log("Error while trying to fetch archived messages", "error");
                        }.bind(this)
                    );
                }
            });

            converse.ChatRoomOccupant = Backbone.Model;
            converse.ChatRoomOccupantView = Backbone.View.extend({
                tagName: 'li',
                initialize: function () {
                    this.model.on('add', this.render, this);
                    this.model.on('change', this.render, this);
                    this.model.on('destroy', this.destroy, this);
                },
                render: function () {
                    var $new = converse.templates.occupant(
                        _.extend(
                            this.model.toJSON(), {
                                'desc_moderator': __('This user is a moderator'),
                                'desc_occupant': __('This user can send messages in this room'),
                                'desc_visitor': __('This user can NOT send messages in this room')
                        })
                    );
                    this.$el.replaceWith($new);
                    this.setElement($new, true);
                    return this;
                },

                destroy: function () {
                    this.$el.remove();
                }
            });

            converse.ChatRoomOccupants = Backbone.Collection.extend({
                model: converse.ChatRoomOccupant
            });

            converse.ChatRoomOccupantsView = Backbone.Overview.extend({
                tagName: 'div',
                className: 'occupants',

                initialize: function () {
                    this.model.on("add", this.onOccupantAdded, this);
                },

                render: function () {
                    this.$el.html(
                        converse.templates.chatroom_sidebar({
                            'label_invitation': __('Invite...'),
                            'label_occupants': __('Occupants')
                        })
                    );
                    return this.initInviteWidget();
                },

                onOccupantAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = this.add(item.get('id'), new converse.ChatRoomOccupantView({model: item}));
                    } else {
                        delete view.model; // Remove ref to old model to help garbage collection
                        view.model = item;
                        view.initialize();
                    }
                    this.$('.occupant-list').append(view.render().$el);
                },

                parsePresence: function (pres) {
                    var id = Strophe.getResourceFromJid(pres.getAttribute("from"));
                    var data = {
                        id: id,
                        nick: id,
                        type: pres.getAttribute("type"),
                        states: []
                    };
                    _.each(pres.childNodes, function (child) {
                        switch (child.nodeName) {
                            case "status":
                                data.status = child.textContent || null;
                                break;
                            case "show":
                                data.show = child.textContent || null;
                                break;
                            case "x":
                                if (child.getAttribute("xmlns") === Strophe.NS.MUC_USER) {
                                    _.each(child.childNodes, function (item) {
                                        switch (item.nodeName) {
                                            case "item":
                                                data.affiliation = item.getAttribute("affiliation");
                                                data.role = item.getAttribute("role");
                                                data.jid = item.getAttribute("jid");
                                                data.nick = item.getAttribute("nick") || data.nick;
                                                break;
                                            case "status":
                                                if (item.getAttribute("code")) {
                                                    data.states.push(item.getAttribute("code"));
                                                }
                                        }
                                    });
                                }
                        }
                    });
                    return data;
                },

                updateOccupantsOnPresence: function (pres) {
                    var occupant;
                    var data = this.parsePresence(pres);
                    switch (data.type) {
                        case 'error':
                            return true;
                        case 'unavailable':
                            occupant = this.model.get(data.id);
                            if (occupant) { occupant.destroy(); }
                            break;
                        default:
                            occupant = this.model.get(data.id);
                            if (occupant) {
                                occupant.save(data);
                            } else {
                                this.model.create(data);
                            }
                    }
                },

                initInviteWidget: function () {
                    var $el = this.$('input.invited-contact');
                    $el.typeahead({
                        minLength: 1,
                        highlight: true
                    }, {
                        name: 'contacts-dataset',
                        source: function (q, cb) {
                            var results = [];
                            _.each(converse.roster.filter(utils.contains(['fullname', 'jid'], q)), function (n) {
                                results.push({value: n.get('fullname'), jid: n.get('jid')});
                            });
                            cb(results);
                        },
                        templates: {
                            suggestion: _.template('<p data-jid="{{jid}}">{{value}}</p>')
                        }
                    });
                    $el.on('typeahead:selected', function (ev, suggestion, dname) {
                        var reason = prompt(
                            __(___('You are about to invite %1$s to the chat room "%2$s". '), suggestion.value, this.model.get('id')) +
                            __("You may optionally include a message, explaining the reason for the invitation.")
                        );
                        if (reason !== null) {
                            this.chatroomview.directInvite(suggestion.jid, reason);
                        }
                        $(ev.target).typeahead('val', '');
                    }.bind(this));
                    return this;
                }
            });

            converse.RoomsPanel = Backbone.View.extend({
                /* Backbone View which renders the "Rooms" tab and accompanying
                * panel in the control box.
                *
                * In this panel, chat rooms can be listed, joined and new rooms
                * can be created.
                */
                tagName: 'div',
                className: 'controlbox-pane',
                id: 'chatrooms',
                events: {
                    'submit form.add-chatroom': 'createChatRoom',
                    'click input#show-rooms': 'showRooms',
                    'click a.open-room': 'createChatRoom',
                    'click a.room-info': 'showRoomInfo',
                    'change input[name=server]': 'setDomain',
                    'change input[name=nick]': 'setNick'
                },

                initialize: function (cfg) {
                    this.$parent = cfg.$parent;
                    this.model.on('change:muc_domain', this.onDomainChange, this);
                    this.model.on('change:nick', this.onNickChange, this);
                },

                render: function () {
                    this.$parent.append(
                        this.$el.html(
                            converse.templates.room_panel({
                                'server_input_type': converse.hide_muc_server && 'hidden' || 'text',
                                'server_label_global_attr': converse.hide_muc_server && ' hidden' || '',
                                'label_room_name': __('Room name'),
                                'label_nickname': __('Nickname'),
                                'label_server': __('Server'),
                                'label_join': __('Join Room'),
                                'label_show_rooms': __('Show rooms')
                            })
                        ).hide());
                    this.$tabs = this.$parent.parent().find('#controlbox-tabs');
                    this.$tabs.append(converse.templates.chatrooms_tab({label_rooms: __('Rooms')}));
                    return this;
                },

                onDomainChange: function (model) {
                    var $server = this.$el.find('input.new-chatroom-server');
                    $server.val(model.get('muc_domain'));
                    if (converse.auto_list_rooms) {
                        this.updateRoomsList();
                    }
                },

                onNickChange: function (model) {
                    var $nick = this.$el.find('input.new-chatroom-nick');
                    $nick.val(model.get('nick'));
                },

                informNoRoomsFound: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    // For translators: %1$s is a variable and will be replaced with the XMPP server name
                    $available_chatrooms.html('<dt>'+__('No rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                    $('input#show-rooms').show().siblings('span.spinner').remove();
                },

                onRoomsFound: function (iq) {
                    /* Handle the IQ stanza returned from the server, containing
                    * all its public rooms.
                    */
                    var name, jid, i, fragment,
                        $available_chatrooms = this.$el.find('#available-chatrooms');
                    this.rooms = $(iq).find('query').find('item');
                    if (this.rooms.length) {
                        // For translators: %1$s is a variable and will be
                        // replaced with the XMPP server name
                        $available_chatrooms.html('<dt>'+__('Rooms on %1$s',this.model.get('muc_domain'))+'</dt>');
                        fragment = document.createDocumentFragment();
                        for (i=0; i<this.rooms.length; i++) {
                            name = Strophe.unescapeNode($(this.rooms[i]).attr('name')||$(this.rooms[i]).attr('jid'));
                            jid = $(this.rooms[i]).attr('jid');
                            fragment.appendChild($(
                                converse.templates.room_item({
                                    'name':name,
                                    'jid':jid,
                                    'open_title': __('Click to open this room'),
                                    'info_title': __('Show more information on this room')
                                    })
                                )[0]);
                        }
                        $available_chatrooms.append(fragment);
                        $('input#show-rooms').show().siblings('span.spinner').remove();
                    } else {
                        this.informNoRoomsFound();
                    }
                    return true;
                },

                updateRoomsList: function () {
                    /* Send and IQ stanza to the server asking for all rooms
                    */
                    converse.connection.sendIQ(
                        $iq({
                            to: this.model.get('muc_domain'),
                            from: converse.connection.jid,
                            type: "get"
                        }).c("query", {xmlns: Strophe.NS.DISCO_ITEMS}),
                        this.onRoomsFound.bind(this),
                        this.informNoRoomsFound.bind(this)
                    );
                },

                showRooms: function () {
                    var $available_chatrooms = this.$el.find('#available-chatrooms');
                    var $server = this.$el.find('input.new-chatroom-server');
                    var server = $server.val();
                    if (!server) {
                        $server.addClass('error');
                        return;
                    }
                    this.$el.find('input.new-chatroom-name').removeClass('error');
                    $server.removeClass('error');
                    $available_chatrooms.empty();
                    $('input#show-rooms').hide().after('<span class="spinner"/>');
                    this.model.save({muc_domain: server});
                    this.updateRoomsList();
                },

                showRoomInfo: function (ev) {
                    var target = ev.target,
                        $dd = $(target).parent('dd'),
                        $div = $dd.find('div.room-info');
                    if ($div.length) {
                        $div.remove();
                    } else {
                        $dd.find('span.spinner').remove();
                        $dd.append('<span class="spinner hor_centered"/>');
                        converse.connection.disco.info(
                            $(target).attr('data-room-jid'),
                            null,
                            function (stanza) {
                                var $stanza = $(stanza);
                                // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                                $dd.find('span.spinner').replaceWith(
                                    converse.templates.room_description({
                                        'desc': $stanza.find('field[var="muc#roominfo_description"] value').text(),
                                        'occ': $stanza.find('field[var="muc#roominfo_occupants"] value').text(),
                                        'hidden': $stanza.find('feature[var="muc_hidden"]').length,
                                        'membersonly': $stanza.find('feature[var="muc_membersonly"]').length,
                                        'moderated': $stanza.find('feature[var="muc_moderated"]').length,
                                        'nonanonymous': $stanza.find('feature[var="muc_nonanonymous"]').length,
                                        'open': $stanza.find('feature[var="muc_open"]').length,
                                        'passwordprotected': $stanza.find('feature[var="muc_passwordprotected"]').length,
                                        'persistent': $stanza.find('feature[var="muc_persistent"]').length,
                                        'publicroom': $stanza.find('feature[var="muc_public"]').length,
                                        'semianonymous': $stanza.find('feature[var="muc_semianonymous"]').length,
                                        'temporary': $stanza.find('feature[var="muc_temporary"]').length,
                                        'unmoderated': $stanza.find('feature[var="muc_unmoderated"]').length,
                                        'label_desc': __('Description:'),
                                        'label_occ': __('Occupants:'),
                                        'label_features': __('Features:'),
                                        'label_requires_auth': __('Requires authentication'),
                                        'label_hidden': __('Hidden'),
                                        'label_requires_invite': __('Requires an invitation'),
                                        'label_moderated': __('Moderated'),
                                        'label_non_anon': __('Non-anonymous'),
                                        'label_open_room': __('Open room'),
                                        'label_permanent_room': __('Permanent room'),
                                        'label_public': __('Public'),
                                        'label_semi_anon':  __('Semi-anonymous'),
                                        'label_temp_room':  __('Temporary room'),
                                        'label_unmoderated': __('Unmoderated')
                                    }));
                            }.bind(this));
                    }
                },

                createChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name,
                        server, $server,
                        jid,
                        $nick = this.$el.find('input.new-chatroom-nick'),
                        nick = $nick.val(),
                        chatroom;

                    if (!nick) { $nick.addClass('error'); }
                    else { $nick.removeClass('error'); }

                    if (ev.type === 'click') {
                        name = $(ev.target).text();
                        jid = $(ev.target).attr('data-room-jid');
                    } else {
                        $name = this.$el.find('input.new-chatroom-name');
                        $server= this.$el.find('input.new-chatroom-server');
                        server = $server.val();
                        name = $name.val().trim();
                        $name.val(''); // Clear the input
                        if (name && server) {
                            jid = Strophe.escapeNode(name.toLowerCase()) + '@' + server.toLowerCase();
                            $name.removeClass('error');
                            $server.removeClass('error');
                            this.model.save({muc_domain: server});
                        } else {
                            if (!name) { $name.addClass('error'); }
                            if (!server) { $server.addClass('error'); }
                            return;
                        }
                    }
                    if (!nick) { return; }
                    chatroom = converse.chatboxviews.showChat({
                        'id': jid,
                        'jid': jid,
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                        'nick': nick,
                        'chatroom': true,
                        'box_id': b64_sha1(jid)
                    });
                },

                setDomain: function (ev) {
                    this.model.save({muc_domain: ev.target.value});
                },

                setNick: function (ev) {
                    this.model.save({nick: ev.target.value});
                }
            });

            _.extend(converse_api, {
                /* We extend the default converse.js API to add methods specific to MUC
                * chat rooms.
                */
                'rooms': {
                    'open': function (jids, nick) {
                        if (!nick) {
                            nick = Strophe.getNodeFromJid(converse.bare_jid);
                        }
                        if (typeof nick !== "string") {
                            throw new TypeError('rooms.open: invalid nick, must be string');
                        }
                        var _transform = function (jid) {
                            jid = jid.toLowerCase();
                            var chatroom = converse.chatboxes.get(jid);
                            converse.log('jid');
                            if (!chatroom) {
                                chatroom = converse.chatboxviews.showChat({
                                    'id': jid,
                                    'jid': jid,
                                    'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                                    'nick': nick,
                                    'chatroom': true,
                                    'box_id': b64_sha1(jid)
                                });
                            }
                            return converse.wrappedChatBox(converse.chatboxes.getChatBox(jid, true));
                        };
                        if (typeof jids === "undefined") {
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (typeof jids === "string") {
                            return _transform(jids);
                        }
                        return _.map(jids, _transform);
                    },
                    'get': function (jids) {
                        if (typeof jids === "undefined") {
                            throw new TypeError("rooms.get: You need to provide at least one JID");
                        } else if (typeof jids === "string") {
                            return converse.wrappedChatBox(converse.chatboxes.getChatBox(jids, true));
                        }
                        return _.map(jids, _.partial(converse.wrappedChatBox, _.bind(converse.chatboxes.getChatBox, converse.chatboxes, _, true)));

                    }
                }
            });
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, crypto, CryptoJS */

/* This is a Converse.js plugin which add support Off-the-record (OTR)
 * encryption of one-on-one chat messages.
 */
(function (root, factory) {
    define("converse-otr", ["otr", "converse-core", "converse-api"], factory);
}(this, function (otr, converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        utils = converse_api.env.utils,
        b64_sha1 = converse_api.env.b64_sha1;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._;

    // For translations
    var __ = utils.__.bind(converse);

    var HAS_CSPRNG = ((typeof crypto !== 'undefined') &&
        ((typeof crypto.randomBytes === 'function') ||
            (typeof crypto.getRandomValues === 'function')
    ));
    var HAS_CRYPTO = HAS_CSPRNG && (
        (typeof CryptoJS !== "undefined") &&
        (typeof otr.OTR !== "undefined") &&
        (typeof otr.DSA !== "undefined")
    );

    var UNENCRYPTED = 0;
    var UNVERIFIED= 1;
    var VERIFIED= 2;
    var FINISHED = 3;

    var OTR_TRANSLATED_MAPPING  = {}; // Populated in initialize
    var OTR_CLASS_MAPPING = {};
    OTR_CLASS_MAPPING[UNENCRYPTED] = 'unencrypted';
    OTR_CLASS_MAPPING[UNVERIFIED] = 'unverified';
    OTR_CLASS_MAPPING[VERIFIED] = 'verified';
    OTR_CLASS_MAPPING[FINISHED] = 'finished';

    converse_api.plugins.add('otr', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
 
            _initialize: function () {
                this._super._initialize.apply(this, arguments);
                this.otr = new this.OTR();
            },

            registerGlobalEventHandlers: function () {
                this._super.registerGlobalEventHandlers();

                $(document).click(function () {
                    if ($('.toggle-otr ul').is(':visible')) {
                        $('.toggle-otr ul', this).slideUp();
                    }
                    if ($('.toggle-smiley ul').is(':visible')) {
                        $('.toggle-smiley ul', this).slideUp();
                    }
                });
            },

            wrappedChatBox: function (chatbox) {
                var wrapped_chatbox = this._super.wrappedChatBox.apply(this, arguments);
                if (!chatbox) { return; }
                return _.extend(wrapped_chatbox, {
                    'endOTR': chatbox.endOTR.bind(chatbox),
                    'initiateOTR': chatbox.initiateOTR.bind(chatbox),
                });
            },

            ChatBox: {
                initialize: function () {
                    this._super.initialize.apply(this, arguments);
                    if (this.get('box_id') !== 'controlbox') {
                        this.save({
                            'otr_status': this.get('otr_status') || UNENCRYPTED
                        });
                    }
                },

                isOTRMessage: function ($message) {
                    var $body = $message.children('body'),
                        text = ($body.length > 0 ? $body.text() : undefined);
                    return !!text.match(/^\?OTR/);
                },

                shouldPlayNotification: function ($message) {
                    /* Don't play a notification if this is an OTR message but
                     * encryption is not yet set up. That would mean that the
                     * OTR session is still being established, so there are no
                     * "visible" OTR messages being exchanged.
                     */
                    return this._super.shouldPlayNotification.apply(this, arguments) &&
                        !(this.isOTRMessage($message) && !_.contains([UNVERIFIED, VERIFIED], this.get('otr_status')));
                },

                createMessage: function ($message, $delay, archive_id) {
                    var converse = this._super.converse,
                        $body = $message.children('body'),
                        text = ($body.length > 0 ? $body.text() : undefined);

                    if ((!text) || (!converse.allow_otr)) {
                        return this._super.createMessage.apply(this, arguments);
                    }
                    if (text.match(/^\?OTRv23?/)) {
                        this.initiateOTR(text);
                    } else {
                        if (_.contains([UNVERIFIED, VERIFIED], this.get('otr_status'))) {
                            this.otr.receiveMsg(text);
                        } else {
                            if (text.match(/^\?OTR/)) {
                                if (!this.otr) {
                                    this.initiateOTR(text);
                                } else {
                                    this.otr.receiveMsg(text);
                                }
                            } else {
                                // Normal unencrypted message.
                                return this._super.createMessage.apply(this, arguments);
                            }
                        }
                    }
                },
                
                getSession: function (callback) {
                    var converse = this._super.converse;
                    var cipher = CryptoJS.lib.PasswordBasedCipher;
                    var pass, instance_tag, saved_key, pass_check;
                    if (converse.cache_otr_key) {
                        pass = converse.otr.getSessionPassphrase();
                        if (typeof pass !== "undefined") {
                            instance_tag = window.sessionStorage[b64_sha1(this.id+'instance_tag')];
                            saved_key = window.sessionStorage[b64_sha1(this.id+'priv_key')];
                            pass_check = window.sessionStorage[b64_sha1(this.connection.jid+'pass_check')];
                            if (saved_key && instance_tag && typeof pass_check !== 'undefined') {
                                var decrypted = cipher.decrypt(CryptoJS.algo.AES, saved_key, pass);
                                var key = otr.DSA.parsePrivate(decrypted.toString(CryptoJS.enc.Latin1));
                                if (cipher.decrypt(CryptoJS.algo.AES, pass_check, pass).toString(CryptoJS.enc.Latin1) === 'match') {
                                    // Verified that the passphrase is still the same
                                    this.trigger('showHelpMessages', [__('Re-establishing encrypted session')]);
                                    callback({
                                        'key': key,
                                        'instance_tag': instance_tag
                                    });
                                    return; // Our work is done here
                                }
                            }
                        }
                    }
                    // We need to generate a new key and instance tag
                    this.trigger('showHelpMessages', [
                        __('Generating private key.'),
                        __('Your browser might become unresponsive.')],
                        null,
                        true // show spinner
                    );
                    window.setTimeout(function () {
                        var instance_tag = otr.OTR.makeInstanceTag();
                        callback({
                            'key': converse.otr.generatePrivateKey.call(this, instance_tag),
                            'instance_tag': instance_tag
                        });
                    }, 500);
                },

                updateOTRStatus: function (state) {
                    switch (state) {
                        case otr.OTR.CONST.STATUS_AKE_SUCCESS:
                            if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_ENCRYPTED) {
                                this.save({'otr_status': UNVERIFIED});
                            }
                            break;
                        case otr.OTR.CONST.STATUS_END_OTR:
                            if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_FINISHED) {
                                this.save({'otr_status': FINISHED});
                            } else if (this.otr.msgstate === otr.OTR.CONST.MSGSTATE_PLAINTEXT) {
                                this.save({'otr_status': UNENCRYPTED});
                            }
                            break;
                    }
                },

                onSMP: function (type, data) {
                    // Event handler for SMP (Socialist's Millionaire Protocol)
                    // used by OTR (off-the-record).
                    switch (type) {
                        case 'question':
                            this.otr.smpSecret(prompt(__(
                                'Authentication request from %1$s\n\nYour chat contact is attempting to verify your identity, by asking you the question below.\n\n%2$s',
                                [this.get('fullname'), data])));
                            break;
                        case 'trust':
                            if (data === true) {
                                this.save({'otr_status': VERIFIED});
                            } else {
                                this.trigger(
                                    'showHelpMessages',
                                    [__("Could not verify this user's identify.")],
                                    'error');
                                this.save({'otr_status': UNVERIFIED});
                            }
                            break;
                        default:
                            throw new TypeError('ChatBox.onSMP: Unknown type for SMP');
                    }
                },

                initiateOTR: function (query_msg) {
                    // Sets up an OTR object through which we can send and receive
                    // encrypted messages.
                    //
                    // If 'query_msg' is passed in, it means there is an alread incoming
                    // query message from our contact. Otherwise, it is us who will
                    // send the query message to them.
                    this.save({'otr_status': UNENCRYPTED});
                    this.getSession(function (session) {
                        var converse = this._super.converse;
                        this.otr = new otr.OTR({
                            fragment_size: 140,
                            send_interval: 200,
                            priv: session.key,
                            instance_tag: session.instance_tag,
                            debug: this.debug
                        });
                        this.otr.on('status', this.updateOTRStatus.bind(this));
                        this.otr.on('smp', this.onSMP.bind(this));

                        this.otr.on('ui', function (msg) {
                            this.trigger('showReceivedOTRMessage', msg);
                        }.bind(this));
                        this.otr.on('io', function (msg) {
                            this.trigger('sendMessage', new converse.Message({ message: msg }));
                        }.bind(this));
                        this.otr.on('error', function (msg) {
                            this.trigger('showOTRError', msg);
                        }.bind(this));

                        this.trigger('showHelpMessages', [__('Exchanging private key with contact.')]);
                        if (query_msg) {
                            this.otr.receiveMsg(query_msg);
                        } else {
                            this.otr.sendQueryMsg();
                        }
                    }.bind(this));
                },

                endOTR: function () {
                    if (this.otr) {
                        this.otr.endOtr();
                    }
                    this.save({'otr_status': UNENCRYPTED});
                }
            },

            ChatBoxView:  {
                events: {
                    'click .toggle-otr': 'toggleOTRMenu',
                    'click .start-otr': 'startOTRFromToolbar',
                    'click .end-otr': 'endOTR',
                    'click .auth-otr': 'authOTR'
                },

                initialize: function () {
                    var converse = this._super.converse;
                    this._super.initialize.apply(this, arguments);
                    this.model.on('change:otr_status', this.onOTRStatusChanged, this);
                    this.model.on('showOTRError', this.showOTRError, this);
                    this.model.on('showSentOTRMessage', function (text) {
                        this.showMessage({'message': text, 'sender': 'me'});
                    }, this);
                    this.model.on('showReceivedOTRMessage', function (text) {
                        this.showMessage({'message': text, 'sender': 'them'});
                    }, this);
                    if ((_.contains([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) || converse.use_otr_by_default) {
                        this.model.initiateOTR();
                    }
                },

                createMessageStanza: function () {
                    var stanza = this._super.createMessageStanza.apply(this, arguments);
                    if (this.model.get('otr_status') !== UNENCRYPTED) {
                        // OTR messages aren't carbon copied
                        stanza.c('private', {'xmlns': Strophe.NS.CARBONS});
                    }
                    return stanza;
                },

                onMessageSubmitted: function (text) {
                    var converse = this._super.converse;
                    if (!converse.connection.authenticated) {
                        return this.showHelpMessages(
                            ['Sorry, the connection has been lost, '+
                              'and your message could not be sent'],
                            'error'
                        );
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*)\s*$/);
                    if (match) {
                        if ((converse.allow_otr) && (match[1] === "endotr")) {
                            return this.endOTR();
                        } else if ((converse.allow_otr) && (match[1] === "otr")) {
                            return this.model.initiateOTR();
                        }
                    }
                    if (_.contains([UNVERIFIED, VERIFIED], this.model.get('otr_status'))) {
                        // Off-the-record encryption is active
                        this.model.otr.sendMsg(text);
                        this.model.trigger('showSentOTRMessage', text);
                    } else {
                        this._super.onMessageSubmitted.apply(this, arguments);
                    }
                },

                onOTRStatusChanged: function () {
                    this.renderToolbar().informOTRChange();
                },

                informOTRChange: function () {
                    var data = this.model.toJSON();
                    var msgs = [];
                    if (data.otr_status === UNENCRYPTED) {
                        msgs.push(__("Your messages are not encrypted anymore"));
                    } else if (data.otr_status === UNVERIFIED) {
                        msgs.push(__("Your messages are now encrypted but your contact's identity has not been verified."));
                    } else if (data.otr_status === VERIFIED) {
                        msgs.push(__("Your contact's identify has been verified."));
                    } else if (data.otr_status === FINISHED) {
                        msgs.push(__("Your contact has ended encryption on their end, you should do the same."));
                    }
                    return this.showHelpMessages(msgs, 'info', false);
                },

                showOTRError: function (msg) {
                    var converse = this._super.converse;
                    if (msg === 'Message cannot be sent at this time.') {
                        this.showHelpMessages(
                            [__('Your message could not be sent')], 'error');
                    } else if (msg === 'Received an unencrypted message.') {
                        this.showHelpMessages(
                            [__('We received an unencrypted message')], 'error');
                    } else if (msg === 'Received an unreadable encrypted message.') {
                        this.showHelpMessages(
                            [__('We received an unreadable encrypted message')],
                            'error');
                    } else {
                        this.showHelpMessages(['Encryption error occured: '+msg], 'error');
                    }
                    converse.log("OTR ERROR:"+msg);
                },

                startOTRFromToolbar: function (ev) {
                    $(ev.target).parent().parent().slideUp();
                    ev.stopPropagation();
                    this.model.initiateOTR();
                },

                endOTR: function (ev) {
                    if (typeof ev !== "undefined") {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    this.model.endOTR();
                },

                authOTR: function (ev) {
                    var converse = this._super.converse;
                    var scheme = $(ev.target).data().scheme;
                    var result, question, answer;
                    if (scheme === 'fingerprint') {
                        result = confirm(__('Here are the fingerprints, please confirm them with %1$s, outside of this chat.\n\nFingerprint for you, %2$s: %3$s\n\nFingerprint for %1$s: %4$s\n\nIf you have confirmed that the fingerprints match, click OK, otherwise click Cancel.', [
                                this.model.get('fullname'),
                                converse.xmppstatus.get('fullname')||converse.bare_jid,
                                this.model.otr.priv.fingerprint(),
                                this.model.otr.their_priv_pk.fingerprint()
                            ]
                        ));
                        if (result === true) {
                            this.model.save({'otr_status': VERIFIED});
                        } else {
                            this.model.save({'otr_status': UNVERIFIED});
                        }
                    } else if (scheme === 'smp') {
                        alert(__('You will be prompted to provide a security question and then an answer to that question.\n\nYour contact will then be prompted the same question and if they type the exact same answer (case sensitive), their identity will be verified.'));
                        question = prompt(__('What is your security question?'));
                        if (question) {
                            answer = prompt(__('What is the answer to the security question?'));
                            this.model.otr.smpSecret(answer, question);
                        }
                    } else {
                        this.showHelpMessages([__('Invalid authentication scheme provided')], 'error');
                    }
                },

                toggleOTRMenu: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-otr ul').slideToggle(200);
                },
                
                getOTRTooltip: function () {
                    var data = this.model.toJSON();
                    if (data.otr_status === UNENCRYPTED) {
                        return __('Your messages are not encrypted. Click here to enable OTR encryption.');
                    } else if (data.otr_status === UNVERIFIED) {
                        return __('Your messages are encrypted, but your contact has not been verified.');
                    } else if (data.otr_status === VERIFIED) {
                        return __('Your messages are encrypted and your contact verified.');
                    } else if (data.otr_status === FINISHED) {
                        return __('Your contact has closed their end of the private session, you should do the same');
                    }
                },

                renderToolbar: function (options) {
                    var converse = this._super.converse;
                    if (!converse.show_toolbar) {
                        return;
                    }
                    var data = this.model.toJSON();
                    options = _.extend(options || {}, {
                        FINISHED: FINISHED,
                        UNENCRYPTED: UNENCRYPTED,
                        UNVERIFIED: UNVERIFIED,
                        VERIFIED: VERIFIED,
                        // FIXME: Leaky abstraction MUC
                        allow_otr: converse.allow_otr && !this.is_chatroom,
                        label_end_encrypted_conversation: __('End encrypted conversation'),
                        label_refresh_encrypted_conversation: __('Refresh encrypted conversation'),
                        label_start_encrypted_conversation: __('Start encrypted conversation'),
                        label_verify_with_fingerprints: __('Verify with fingerprints'),
                        label_verify_with_smp: __('Verify with SMP'),
                        label_whats_this: __("What\'s this?"),
                        otr_status_class: OTR_CLASS_MAPPING[data.otr_status],
                        otr_tooltip: this.getOTRTooltip(),
                        otr_translated_status: OTR_TRANSLATED_MAPPING[data.otr_status],
                    });
                    this._super.renderToolbar.call(this, options);
                    this.$el.find('.chat-toolbar').append(
                            converse.templates.toolbar_otr(
                                _.extend(this.model.toJSON(), options || {})
                            ));
                    return this;
                }
            },

            MinimizedChatBoxView: {
                initialize: function () {
                    this._super.initialize.apply(this, arguments);
                    this.model.on('showReceivedOTRMessage', this.updateUnreadMessagesCounter, this);
                    this.model.on('showSentOTRMessage', this.updateUnreadMessagesCounter, this);
                },
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Translation aware constants
            // ---------------------------
            // We can only call the __ translation method *after* converse.js
            // has been initialized and with it the i18n machinery. That's why
            // we do it here in the "initialize" method and not at the top of
            // the module.
            OTR_TRANSLATED_MAPPING[UNENCRYPTED] = __('unencrypted');
            OTR_TRANSLATED_MAPPING[UNVERIFIED] = __('unverified');
            OTR_TRANSLATED_MAPPING[VERIFIED] = __('verified');
            OTR_TRANSLATED_MAPPING[FINISHED] = __('finished');

            // For translations
            __ = utils.__.bind(converse);
            // Configuration values for this plugin
            var settings = {
                allow_otr: true,
                cache_otr_key: false,
                use_otr_by_default: false
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

            // Only allow OTR if we have the capability
            converse.allow_otr = converse.allow_otr && HAS_CRYPTO;
            // Only use OTR by default if allow OTR is enabled to begin with
            converse.use_otr_by_default = converse.use_otr_by_default && converse.allow_otr;

            // Backbone Models and Views
            // -------------------------
            converse.OTR = Backbone.Model.extend({
                // A model for managing OTR settings.
                getSessionPassphrase: function () {
                    if (converse.authentication === 'prebind') {
                        var key = b64_sha1(converse.connection.jid),
                            pass = window.sessionStorage[key];
                        if (typeof pass === 'undefined') {
                            pass = Math.floor(Math.random()*4294967295).toString();
                            window.sessionStorage[key] = pass;
                        }
                        return pass;
                    } else {
                        return converse.connection.pass;
                    }
                },

                generatePrivateKey: function (instance_tag) {
                    var key = new otr.DSA();
                    var jid = converse.connection.jid;
                    if (converse.cache_otr_key) {
                        var cipher = CryptoJS.lib.PasswordBasedCipher;
                        var pass = this.getSessionPassphrase();
                        if (typeof pass !== "undefined") {
                            // Encrypt the key and set in sessionStorage. Also store instance tag.
                            window.sessionStorage[b64_sha1(jid+'priv_key')] =
                                cipher.encrypt(CryptoJS.algo.AES, key.packPrivate(), pass).toString();
                            window.sessionStorage[b64_sha1(jid+'instance_tag')] = instance_tag;
                            window.sessionStorage[b64_sha1(jid+'pass_check')] =
                                cipher.encrypt(CryptoJS.algo.AES, 'match', pass).toString();
                        }
                    }
                    return key;
                }
            });
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for in-band registration
 * as specified in XEP-0077.
 */
(function (root, factory) {
    define("converse-register", [
            "converse-core",
            "converse-api",
            "converse-controlbox"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        utils = converse_api.env.utils,
        $iq = converse_api.env.$iq;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._;
    // For translations
    var __ = utils.__.bind(converse);
    
    // Add Strophe Namespaces
    Strophe.addNamespace('REGISTER', 'jabber:iq:register');

    // Add Strophe Statuses
    var i = 0;
    Object.keys(Strophe.Status).forEach(function (key) {
        i = Math.max(i, Strophe.Status[key]);
    });
    Strophe.Status.REGIFAIL        = i + 1;
    Strophe.Status.REGISTERED      = i + 2;
    Strophe.Status.CONFLICT        = i + 3;
    Strophe.Status.NOTACCEPTABLE   = i + 5;

    converse_api.plugins.add('register', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ControlBoxView: {

                renderLoginPanel: function () {
                    /* Also render a registration panel, when rendering the
                     * login panel.
                     */
                    this._super.renderLoginPanel.apply(this, arguments);
                    var converse = this._super.converse,
                        cfg;
                    if (converse.allow_registration) {
                        cfg = {
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': this
                        };
                        if (typeof this.registerpanel === 'undefined') {
                            this.registerpanel = new converse.RegisterPanel(cfg);
                        } else {
                            this.registerpanel.delegateEvents().initialize(cfg);
                        }
                        this.registerpanel.render().$el.hide();
                    }
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // For translations
            // Configuration values for this plugin
            var settings = {
                allow_registration: true,
                domain_placeholder: __(" e.g. conversejs.org"),  // Placeholder text shown in the domain input on the registration form
                providers_link: 'https://xmpp.net/directory.php', // Link to XMPP providers shown on registration page
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));


            converse.RegisterPanel = Backbone.View.extend({
                tagName: 'div',
                id: "register",
                className: 'controlbox-pane',
                events: {
                    'submit form#converse-register': 'onProviderChosen'
                },

                initialize: function (cfg) {
                    this.reset();
                    this.$parent = cfg.$parent;
                    this.$tabs = cfg.$parent.parent().find('#controlbox-tabs');
                    this.registerHooks();
                },

                render: function () {
                    this.$parent.append(this.$el.html(
                        converse.templates.register_panel({
                            'label_domain': __("Your XMPP provider's domain name:"),
                            'label_register': __('Fetch registration form'),
                            'help_providers': __('Tip: A list of public XMPP providers is available'),
                            'help_providers_link': __('here'),
                            'href_providers': converse.providers_link,
                            'domain_placeholder': converse.domain_placeholder
                        })
                    ));
                    this.$tabs.append(converse.templates.register_tab({label_register: __('Register')}));
                    return this;
                },

                registerHooks: function () {
                    /* Hook into Strophe's _connect_cb, so that we can send an IQ
                    * requesting the registration fields.
                    */
                    var conn = converse.connection;
                    var connect_cb = conn._connect_cb.bind(conn);
                    conn._connect_cb = function (req, callback, raw) {
                        if (!this._registering) {
                            connect_cb(req, callback, raw);
                        } else {
                            if (this.getRegistrationFields(req, callback, raw)) {
                                this._registering = false;
                            }
                        }
                    }.bind(this);
                },

                getRegistrationFields: function (req, _callback, raw) {
                    /*  Send an IQ stanza to the XMPP server asking for the
                    *  registration fields.
                    *  Parameters:
                    *    (Strophe.Request) req - The current request
                    *    (Function) callback
                    */
                    converse.log("sendQueryStanza was called");
                    var conn = converse.connection;
                    conn.connected = true;

                    var body = conn._proto._reqToData(req);
                    if (!body) { return; }
                    if (conn._proto._connect_cb(body) === Strophe.Status.CONNFAIL) {
                        return false;
                    }
                    var register = body.getElementsByTagName("register");
                    var mechanisms = body.getElementsByTagName("mechanism");
                    if (register.length === 0 && mechanisms.length === 0) {
                        conn._proto._no_auth_received(_callback);
                        return false;
                    }
                    if (register.length === 0) {
                        conn._changeConnectStatus(
                            Strophe.Status.REGIFAIL,
                            __('Sorry, the given provider does not support in band account registration. Please try with a different provider.')
                        );
                        return true;
                    }
                    // Send an IQ stanza to get all required data fields
                    conn._addSysHandler(this.onRegistrationFields.bind(this), null, "iq", null, null);
                    conn.send($iq({type: "get"}).c("query", {xmlns: Strophe.NS.REGISTER}).tree());
                    return true;
                },

                onRegistrationFields: function (stanza) {
                    /*  Handler for Registration Fields Request.
                    *
                    *  Parameters:
                    *    (XMLElement) elem - The query stanza.
                    */
                    if (stanza.getElementsByTagName("query").length !== 1) {
                        converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                        return false;
                    }
                    this.setFields(stanza);
                    this.renderRegistrationForm(stanza);
                    return false;
                },

                reset: function (settings) {
                    var defaults = {
                        fields: {},
                        urls: [],
                        title: "",
                        instructions: "",
                        registered: false,
                        _registering: false,
                        domain: null,
                        form_type: null
                    };
                    _.extend(this, defaults);
                    if (settings) {
                        _.extend(this, _.pick(settings, Object.keys(defaults)));
                    }
                },

                onProviderChosen: function (ev) {
                    /* Callback method that gets called when the user has chosen an
                    * XMPP provider.
                    *
                    * Parameters:
                    *      (Submit Event) ev - Form submission event.
                    */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $form = $(ev.target),
                        $domain_input = $form.find('input[name=domain]'),
                        domain = $domain_input.val();
                    if (!domain) {
                        $domain_input.addClass('error');
                        return;
                    }
                    $form.find('input[type=submit]').hide()
                        .after(converse.templates.registration_request({
                            cancel: __('Cancel'),
                            info_message: __('Requesting a registration form from the XMPP server')
                        }));
                    $form.find('button.cancel').on('click', this.cancelRegistration.bind(this));
                    this.reset({
                        domain: Strophe.getDomainFromJid(domain),
                        _registering: true
                    });
                    converse.connection.connect(this.domain, "", this.onRegistering.bind(this));
                    return false;
                },

                giveFeedback: function (message, klass) {
                    this.$('.reg-feedback').attr('class', 'reg-feedback').text(message);
                    if (klass) {
                        $('.reg-feedback').addClass(klass);
                    }
                },

                onRegistering: function (status, error) {
                    var that;
                    converse.log('onRegistering');
                    if (_.contains([
                                Strophe.Status.DISCONNECTED,
                                Strophe.Status.CONNFAIL,
                                Strophe.Status.REGIFAIL,
                                Strophe.Status.NOTACCEPTABLE,
                                Strophe.Status.CONFLICT
                            ], status)) {

                        converse.log('Problem during registration: Strophe.Status is: '+status);
                        this.cancelRegistration();
                        if (error) {
                            this.giveFeedback(error, 'error');
                        } else {
                            this.giveFeedback(__(
                                    'Something went wrong while establishing a connection with "%1$s". Are you sure it exists?',
                                    this.domain
                                ), 'error');
                        }
                    } else if (status === Strophe.Status.REGISTERED) {
                        converse.log("Registered successfully.");
                        converse.connection.reset();
                        that = this;
                        this.$('form').hide(function () {
                            $(this).replaceWith('<span class="spinner centered"/>');
                            if (that.fields.password && that.fields.username) {
                                // automatically log the user in
                                converse.connection.connect(
                                    that.fields.username.toLowerCase()+'@'+that.domain.toLowerCase(),
                                    that.fields.password,
                                    converse.onConnectStatusChanged
                                );
                                converse.chatboxviews.get('controlbox')
                                    .switchTab({target: that.$tabs.find('.current')})
                                    .giveFeedback(__('Now logging you in'));
                            } else {
                                converse.chatboxviews.get('controlbox')
                                    .renderLoginPanel()
                                    .giveFeedback(__('Registered successfully'));
                            }
                            that.reset();
                        });
                    }
                },

                renderRegistrationForm: function (stanza) {
                    /* Renders the registration form based on the XForm fields
                    * received from the XMPP server.
                    *
                    * Parameters:
                    *      (XMLElement) stanza - The IQ stanza received from the XMPP server.
                    */
                    var $form= this.$('form'),
                        $stanza = $(stanza),
                        $fields, $input;
                    $form.empty().append(converse.templates.registration_form({
                        'domain': this.domain,
                        'title': this.title,
                        'instructions': this.instructions
                    }));
                    if (this.form_type === 'xform') {
                        $fields = $stanza.find('field');
                        _.each($fields, function (field) {
                            $form.append(utils.xForm2webForm.bind(this, $(field), $stanza));
                        }.bind(this));
                    } else {
                        // Show fields
                        _.each(Object.keys(this.fields), function (key) {
                            if (key === "username") {
                                $input = converse.templates.form_username({
                                    domain: ' @'+this.domain,
                                    name: key,
                                    type: "text",
                                    label: key,
                                    value: '',
                                    required: 1
                                });
                            } else {
                                $form.append('<label>'+key+'</label>');
                                $input = $('<input placeholder="'+key+'" name="'+key+'"></input>');
                                if (key === 'password' || key === 'email') {
                                    $input.attr('type', key);
                                }
                            }
                            $form.append($input);
                        }.bind(this));
                        // Show urls
                        _.each(this.urls, function (url) {
                            $form.append($('<a target="blank"></a>').attr('href', url).text(url));
                        }.bind(this));
                    }
                    if (this.fields) {
                        $form.append('<input type="submit" class="pure-button button-primary" value="'+__('Register')+'"/>');
                        $form.on('submit', this.submitRegistrationForm.bind(this));
                        $form.append('<input type="button" class="pure-button button-cancel" value="'+__('Cancel')+'"/>');
                        $form.find('input[type=button]').on('click', this.cancelRegistration.bind(this));
                    } else {
                        $form.append('<input type="button" class="submit" value="'+__('Return')+'"/>');
                        $form.find('input[type=button]').on('click', this.cancelRegistration.bind(this));
                    }
                },

                reportErrors: function (stanza) {
                    /* Report back to the user any error messages received from the
                    * XMPP server after attempted registration.
                    *
                    * Parameters:
                    *      (XMLElement) stanza - The IQ stanza received from the
                    *      XMPP server.
                    */
                    var $form= this.$('form'), flash;
                    var $errmsgs = $(stanza).find('error text');
                    var $flash = $form.find('.form-errors');
                    if (!$flash.length) {
                    flash = '<legend class="form-errors"></legend>';
                        if ($form.find('p.instructions').length) {
                            $form.find('p.instructions').append(flash);
                        } else {
                            $form.prepend(flash);
                        }
                        $flash = $form.find('.form-errors');
                    } else {
                        $flash.empty();
                    }
                    $errmsgs.each(function (idx, txt) {
                        $flash.append($('<p>').text($(txt).text()));
                    });
                    if (!$errmsgs.length) {
                        $flash.append($('<p>').text(
                            __('The provider rejected your registration attempt. '+
                            'Please check the values you entered for correctness.')));
                    }
                    $flash.show();
                },

                cancelRegistration: function (ev) {
                    /* Handler, when the user cancels the registration form.
                    */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    converse.connection.reset();
                    this.render();
                },

                submitRegistrationForm : function (ev) {
                    /* Handler, when the user submits the registration form.
                    * Provides form error feedback or starts the registration
                    * process.
                    *
                    * Parameters:
                    *      (Event) ev - the submit event.
                    */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $empty_inputs = this.$('input.required:emptyVal');
                    if ($empty_inputs.length) {
                        $empty_inputs.addClass('error');
                        return;
                    }
                    var $inputs = $(ev.target).find(':input:not([type=button]):not([type=submit])'),
                        iq = $iq({type: "set"}).c("query", {xmlns:Strophe.NS.REGISTER});

                    if (this.form_type === 'xform') {
                        iq.c("x", {xmlns: Strophe.NS.XFORM, type: 'submit'});
                        $inputs.each(function () {
                            iq.cnode(utils.webForm2xForm(this)).up();
                        });
                    } else {
                        $inputs.each(function () {
                            var $input = $(this);
                            iq.c($input.attr('name'), {}, $input.val());
                        });
                    }
                    converse.connection._addSysHandler(this._onRegisterIQ.bind(this), null, "iq", null, null);
                    converse.connection.send(iq);
                    this.setFields(iq.tree());
                },

                setFields: function (stanza) {
                    /* Stores the values that will be sent to the XMPP server
                    * during attempted registration.
                    *
                    * Parameters:
                    *      (XMLElement) stanza - the IQ stanza that will be sent to the XMPP server.
                    */
                    var $query = $(stanza).find('query'), $xform;
                    if ($query.length > 0) {
                        $xform = $query.find('x[xmlns="'+Strophe.NS.XFORM+'"]');
                        if ($xform.length > 0) {
                            this._setFieldsFromXForm($xform);
                        } else {
                            this._setFieldsFromLegacy($query);
                        }
                    }
                },

                _setFieldsFromLegacy: function ($query) {
                    $query.children().each(function (idx, field) {
                        var $field = $(field);
                        if (field.tagName.toLowerCase() === 'instructions') {
                            this.instructions = Strophe.getText(field);
                            return;
                        } else if (field.tagName.toLowerCase() === 'x') {
                            if ($field.attr('xmlns') === 'jabber:x:oob') {
                                $field.find('url').each(function (idx, url) {
                                    this.urls.push($(url).text());
                                }.bind(this));
                            }
                            return;
                        }
                        this.fields[field.tagName.toLowerCase()] = Strophe.getText(field);
                    }.bind(this));
                    this.form_type = 'legacy';
                },

                _setFieldsFromXForm: function ($xform) {
                    this.title = $xform.find('title').text();
                    this.instructions = $xform.find('instructions').text();
                    $xform.find('field').each(function (idx, field) {
                        var _var = field.getAttribute('var');
                        if (_var) {
                            this.fields[_var.toLowerCase()] = $(field).children('value').text();
                        } else {
                            // TODO: other option seems to be type="fixed"
                            converse.log("WARNING: Found field we couldn't parse");
                        }
                    }.bind(this));
                    this.form_type = 'xform';
                },

                _onRegisterIQ: function (stanza) {
                    /* Callback method that gets called when a return IQ stanza
                    * is received from the XMPP server, after attempting to
                    * register a new user.
                    *
                    * Parameters:
                    *      (XMLElement) stanza - The IQ stanza.
                    */
                    var error = null,
                        query = stanza.getElementsByTagName("query");
                    if (query.length > 0) {
                        query = query[0];
                    }
                    if (stanza.getAttribute("type") === "error") {
                        converse.log("Registration failed.");
                        error = stanza.getElementsByTagName("error");
                        if (error.length !== 1) {
                            converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, "unknown");
                            return false;
                        }
                        error = error[0].firstChild.tagName.toLowerCase();
                        if (error === 'conflict') {
                            converse.connection._changeConnectStatus(Strophe.Status.CONFLICT, error);
                        } else if (error === 'not-acceptable') {
                            converse.connection._changeConnectStatus(Strophe.Status.NOTACCEPTABLE, error);
                        } else {
                            converse.connection._changeConnectStatus(Strophe.Status.REGIFAIL, error);
                        }
                        this.reportErrors(stanza);
                    } else {
                        converse.connection._changeConnectStatus(Strophe.Status.REGISTERED, null);
                    }
                    return false;
                },

                remove: function () {
                    this.$tabs.empty();
                    this.$el.parent().empty();
                }
            });
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

/* This is a Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 */
(function (root, factory) {
    define("converse-ping", [
        "converse-core",
        "converse-api",
        "strophe.ping"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe;
    // Other necessary globals
    var _ = converse_api.env._;
    
    converse_api.plugins.add('ping', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            onConnected: function () {
                this._super.onConnected().done(converse.registerPingHandler);
            },
            onReconnected: function () {
                // We need to re-register the ping event handler on the newly
                // created connection.
                this._super.onReconnected().done(converse.registerPingHandler);
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Configuration values for this plugin
            var settings = {
                ping_interval: 180 //in seconds
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

            converse.ping = function (jid, success, error, timeout) {
                // XXX: We could first check here if the server advertised that
                // it supports PING.
                // However, some servers don't advertise while still keeping the
                // connection option due to pings.
                //
                // var feature = converse.features.findWhere({'var': Strophe.NS.PING});
                converse.lastStanzaDate = new Date();
                if (typeof jid === 'undefined' || jid === null) {
                    jid = Strophe.getDomainFromJid(converse.bare_jid);
                }
                if (typeof timeout === 'undefined' ) { timeout = null; }
                if (typeof success === 'undefined' ) { success = null; }
                if (typeof error === 'undefined' ) { error = null; }
                if (converse.connection) {
                    converse.connection.ping.ping(jid, success, error, timeout);
                    return true;
                }
                return false;
            };

            converse.pong = function (ping) {
                converse.lastStanzaDate = new Date();
                converse.connection.ping.pong(ping);
                return true;
            };

            converse.registerPongHandler = function () {
                converse.connection.disco.addFeature(Strophe.NS.PING);
                converse.connection.ping.addPingHandler(converse.pong);
            };

            converse.registerPingHandler = function () {
                converse.registerPongHandler();
                if (converse.ping_interval > 0) {
                    converse.connection.addHandler(function () {
                        /* Handler on each stanza, saves the received date
                         * in order to ping only when needed.
                         */
                        converse.lastStanzaDate = new Date();
                        return true;
                    });
                    converse.connection.addTimedHandler(1000, function () {
                        var now = new Date();
                        if (!converse.lastStanzaDate) {
                            converse.lastStanzaDate = now;
                        }
                        if ((now - converse.lastStanzaDate)/1000 > converse.ping_interval) {
                            return converse.ping();
                        }
                        return true;
                    });
                }
            };

            _.extend(converse_api, {
                /* We extend the default converse.js API to add a method specific
                 * to this plugin.
                 */
                'ping': function (jid) {
                    converse.ping(jid);
                }
            });
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

(function (root, factory) {
    define("converse-notification", ["converse-core", "converse-api"], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        _ = converse_api.env._;
    // For translations
    var __ = utils.__.bind(converse);
    var ___ = utils.___;

    var supports_html5_notification = "Notification" in window;

    if (supports_html5_notification && Notification.permission !== 'denied') {
        // Ask user to enable HTML5 notifications
        Notification.requestPermission();
    }

    converse_api.plugins.add('notification', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            // Configuration values for this plugin
            var settings = {
                show_desktop_notifications: true,
                play_sounds: false,
                sounds_path: '/sounds/',
                notification_icon: '/logo/conversejs.png'
            };
            _.extend(converse.default_settings, settings);
            _.extend(converse, settings);
            _.extend(converse, _.pick(converse.user_settings, Object.keys(settings)));

            converse.isOnlyChatStateNotification = function ($msg) {
                // See XEP-0085 Chat State Notification
                return (
                    $msg.find('body').length === 0 && (
                        $msg.find(converse.ACTIVE).length !== 0 ||
                        $msg.find(converse.COMPOSING).length !== 0 ||
                        $msg.find(converse.INACTIVE).length !== 0 ||
                        $msg.find(converse.PAUSED).length !== 0 ||
                        $msg.find(converse.GONE).length !== 0
                    )
                );
            };

            converse.shouldNotifyOfNewMessage = function ($message) {
                var $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    return false;
                }
                var is_me = Strophe.getBareJidFromJid($message.attr('from')) === converse.bare_jid;
                return !converse.isOnlyChatStateNotification($message) && !is_me;
            };

            converse.playSoundNotification = function ($message) {
                /* Plays a sound to notify that a new message was recieved.
                 */
                // XXX Eventually this can be refactored to use Notification's sound
                // feature, but no browser currently supports it.
                // https://developer.mozilla.org/en-US/docs/Web/API/notification/sound
                var audio;
                if (converse.play_sounds && typeof Audio !== "undefined") {
                    audio = new Audio(converse.sounds_path+"msg_received.ogg");
                    if (audio.canPlayType('/audio/ogg')) {
                        audio.play();
                    } else {
                        audio = new Audio(converse.sounds_path+"msg_received.mp3");
                        audio.play();
                    }
                }
            };

            converse.showChatStateNotification = function (evt, contact) {
                /* Show an HTML5 notification indicating that a contact changed
                 * their chat state.
                 */
                var chat_state = contact.chat_status,
                    message = null;
                if (chat_state === 'offline') {
                    message = __('has gone offline');
                } else if (chat_state === 'away') {
                    message = __('has gone away');
                } else if ((chat_state === 'dnd')) {
                    message = __('is busy');
                } else if (chat_state === 'online') {
                    message = __('has come online');
                }
                if (message === null) {
                    return;
                }
                var n = new Notification(contact.fullname, {
                        body: message,
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.showMessageNotification = function (evt, $message) {
                /* Shows an HTML5 Notification to indicate that a new chat
                 * message was received.
                 */
                if (!supports_html5_notification ||
                        !converse.show_desktop_notifications ||
                        converse.windowState !== 'blur' ||
                        Notification.permission !== "granted") {
                    return;
                }
                var contact_jid = Strophe.getBareJidFromJid($message.attr('from'));
                var roster_item = converse.roster.get(contact_jid);
                var n = new Notification(__(___("%1$s says"), roster_item.get('fullname')), {
                        body: $message.children('body').text(),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.notifyOfNewMessage = function (message) {
                /* Event handler for the on('message') event. Will call methods
                 * to play sounds and show HTML5 notifications.
                 */
                var $message = $(message);
                if (!converse.shouldNotifyOfNewMessage($message)) {
                    return false;
                }
                converse.playSoundNotification($message);
                converse.showMessageNotification($message);
            };

            converse.on('contactStatusChanged',  converse.showChatStateNotification);
            converse.on('message',  converse.notifyOfNewMessage);
        }
    });
}));

var config;
if (typeof(require) === 'undefined') {
    /* XXX: Hack to work around r.js's stupid parsing.
     * We want to save the configuration in a variable so that we can reuse it in
     * tests/main.js.
     */
    require = { // jshint ignore:line
        config: function (c) {
            config = c;
        }
    };
}

require.config({
    baseUrl: '.',
    paths: {
        "backbone":                 "components/backbone/backbone",
        "backbone.browserStorage":  "components/backbone.browserStorage/backbone.browserStorage",
        "backbone.overview":        "components/backbone.overview/backbone.overview",
        "eventemitter":             "components/otr/build/dep/eventemitter",
        "jquery":                   "components/jquery/dist/jquery",
        "jquery-private":           "src/jquery-private",
        "jquery.browser":           "components/jquery.browser/dist/jquery.browser",
        "jquery.easing":            "components/jquery-easing-original/index",          // XXX: Only required for https://conversejs.org website
        "moment":                   "components/momentjs/moment",
        "strophe":                  "components/strophejs/src/wrapper",
        "strophe-base64":           "components/strophejs/src/base64",
        "strophe-bosh":             "components/strophejs/src/bosh",
        "strophe-core":             "components/strophejs/src/core",
        "strophe-md5":              "components/strophejs/src/md5",
        "strophe-polyfill":         "components/strophejs/src/polyfills",
        "strophe-sha1":             "components/strophejs/src/sha1",
        "strophe-utils":            "components/strophejs/src/utils",
        "strophe-websocket":        "components/strophejs/src/websocket",
        "strophe.disco":            "components/strophejs-plugins/disco/strophe.disco",
        "strophe.ping":             "src/strophe.ping",
        "strophe.rsm":              "components/strophejs-plugins/rsm/strophe.rsm",
        "strophe.vcard":            "src/strophe.vcard",
        "text":                     'components/requirejs-text/text',
        "tpl":                      'components/requirejs-tpl-jcbrand/tpl',
        "typeahead":                "components/typeahead.js/index",
        "underscore":               "components/underscore/underscore",
        "utils":                    "src/utils",
        "polyfill":                 "src/polyfill",
        
        // Converse
        "converse-api":             "src/converse-api",
        "converse-controlbox":      "src/converse-controlbox",
        "converse-core":            "src/converse-core",
        "converse-muc":             "src/converse-muc",
        "converse-notification":    "src/converse-notification",
        "converse-otr":             "src/converse-otr",
        "converse-ping":            "src/converse-ping",
        "converse-register":        "src/converse-register",
        "converse-templates":       "src/converse-templates",

        // Off-the-record-encryption
        "bigint":               "src/bigint",
        "crypto":               "src/crypto",
        "crypto.aes":           "components/otr/vendor/cryptojs/aes",
        "crypto.cipher-core":   "components/otr/vendor/cryptojs/cipher-core",
        "crypto.core":          "components/otr/vendor/cryptojs/core",
        "crypto.enc-base64":    "components/otr/vendor/cryptojs/enc-base64",
        "crypto.evpkdf":        "components/crypto-js-evanvosberg/src/evpkdf",
        "crypto.hmac":          "components/otr/vendor/cryptojs/hmac",
        "crypto.md5":           "components/crypto-js-evanvosberg/src/md5",
        "crypto.mode-ctr":      "components/otr/vendor/cryptojs/mode-ctr",
        "crypto.pad-nopadding": "components/otr/vendor/cryptojs/pad-nopadding",
        "crypto.sha1":          "components/otr/vendor/cryptojs/sha1",
        "crypto.sha256":        "components/otr/vendor/cryptojs/sha256",
        "salsa20":              "components/otr/build/dep/salsa20",
        "otr":                  "src/otr",

        // Locales paths
        "locales":   "src/locales",
        "jed":       "components/jed/jed",
        "af":        "locale/af/LC_MESSAGES/converse.json",
        "de":        "locale/de/LC_MESSAGES/converse.json",
        "en":        "locale/en/LC_MESSAGES/converse.json",
        "es":        "locale/es/LC_MESSAGES/converse.json",
        "fr":        "locale/fr/LC_MESSAGES/converse.json",
        "he":        "locale/he/LC_MESSAGES/converse.json",
        "hu":        "locale/hu/LC_MESSAGES/converse.json",
        "id":        "locale/id/LC_MESSAGES/converse.json",
        "it":        "locale/it/LC_MESSAGES/converse.json",
        "ja":        "locale/ja/LC_MESSAGES/converse.json",
        "nb":        "locale/nb/LC_MESSAGES/converse.json",
        "nl":        "locale/nl/LC_MESSAGES/converse.json",
        "pl":        "locale/pl/LC_MESSAGES/converse.json",
        "pt_BR":     "locale/pt_BR/LC_MESSAGES/converse.json",
        "ru":        "locale/ru/LC_MESSAGES/converse.json",
        "uk":        "locale/uk/LC_MESSAGES/converse.json",
        "zh":        "locale/zh/LC_MESSAGES/converse.json",

        "moment_with_locales": "src/moment_locales",
        'moment_af':        "components/momentjs/locale/af",
        'moment_de':        "components/momentjs/locale/de",
        'moment_es':        "components/momentjs/locale/es",
        'moment_fr':        "components/momentjs/locale/fr",
        'moment_he':        "components/momentjs/locale/he",
        'moment_hu':        "components/momentjs/locale/hu",
        'moment_id':        "components/momentjs/locale/id",
        'moment_it':        "components/momentjs/locale/it",
        'moment_ja':        "components/momentjs/locale/ja",
        'moment_nb':        "components/momentjs/locale/nb",
        'moment_nl':        "components/momentjs/locale/nl",
        'moment_pl':        "components/momentjs/locale/pl",
        'moment_pt-br':     "components/momentjs/locale/pt-br",
        'moment_ru':        "components/momentjs/locale/ru",
        'moment_uk':        "components/momentjs/locale/uk",
        'moment_zh':        "components/momentjs/locale/zh-cn",

        // Templates
        "action":                   "src/templates/action",
        "add_contact_dropdown":     "src/templates/add_contact_dropdown",
        "add_contact_form":         "src/templates/add_contact_form",
        "change_status_message":    "src/templates/change_status_message",
        "chat_status":              "src/templates/chat_status",
        "chatarea":                 "src/templates/chatarea",
        "chatbox":                  "src/templates/chatbox",
        "chatroom":                 "src/templates/chatroom",
        "chatroom_form":            "src/templates/chatroom_form",
        "chatroom_password_form":   "src/templates/chatroom_password_form",
        "chatroom_sidebar":         "src/templates/chatroom_sidebar",
        "chatrooms_tab":            "src/templates/chatrooms_tab",
        "chats_panel":              "src/templates/chats_panel",
        "choose_status":            "src/templates/choose_status",
        "contacts_panel":           "src/templates/contacts_panel",
        "contacts_tab":             "src/templates/contacts_tab",
        "controlbox":               "src/templates/controlbox",
        "controlbox_toggle":        "src/templates/controlbox_toggle",
        "field":                    "src/templates/field",
        "form_captcha":             "src/templates/form_captcha",
        "form_checkbox":            "src/templates/form_checkbox",
        "form_input":               "src/templates/form_input",
        "form_select":              "src/templates/form_select",
        "form_textarea":            "src/templates/form_textarea",
        "form_username":            "src/templates/form_username",
        "group_header":             "src/templates/group_header",
        "info":                     "src/templates/info",
        "login_panel":              "src/templates/login_panel",
        "login_tab":                "src/templates/login_tab",
        "message":                  "src/templates/message",
        "new_day":                  "src/templates/new_day",
        "occupant":                 "src/templates/occupant",
        "pending_contact":          "src/templates/pending_contact",
        "pending_contacts":         "src/templates/pending_contacts",
        "register_panel":           "src/templates/register_panel",
        "register_tab":             "src/templates/register_tab",
        "registration_form":        "src/templates/registration_form",
        "registration_request":     "src/templates/registration_request",
        "requesting_contact":       "src/templates/requesting_contact",
        "requesting_contacts":      "src/templates/requesting_contacts",
        "room_description":         "src/templates/room_description",
        "room_item":                "src/templates/room_item",
        "room_panel":               "src/templates/room_panel",
        "roster":                   "src/templates/roster",
        "roster_item":              "src/templates/roster_item",
        "search_contact":           "src/templates/search_contact",
        "select_option":            "src/templates/select_option",
        "status_option":            "src/templates/status_option",
        "toggle_chats":             "src/templates/toggle_chats",
        "toolbar":                  "src/templates/toolbar",
        "toolbar_otr":              "src/templates/toolbar_otr",
        "trimmed_chat":             "src/templates/trimmed_chat",
        "vcard":                    "src/templates/vcard"
    },

    map: {
        // '*' means all modules will get 'jquery-private'
        // for their 'jquery' dependency.
        '*': { 'jquery': 'jquery-private' },
        // 'jquery-private' wants the real jQuery module
        // though. If this line was not here, there would
        // be an unresolvable cyclic dependency.
        'jquery-private': { 'jquery': 'jquery' }
    },

    tpl: {
        // Configuration for requirejs-tpl
        // Use Mustache style syntax for variable interpolation
        templateSettings: {
            evaluate : /\{\[([\s\S]+?)\]\}/g,
            interpolate : /\{\{([\s\S]+?)\}\}/g
        }
    },

    // define module dependencies for modules not using define
    shim: {
        'crypto.aes':           { deps: ['crypto.cipher-core'] },
        'crypto.cipher-core':   { deps: ['crypto.enc-base64', 'crypto.evpkdf'] },
        'crypto.enc-base64':    { deps: ['crypto.core'] },
        'crypto.evpkdf':        { deps: ['crypto.md5'] },
        'crypto.hmac':          { deps: ['crypto.core'] },
        'crypto.md5':           { deps: ['crypto.core'] },
        'crypto.mode-ctr':      { deps: ['crypto.cipher-core'] },
        'crypto.pad-nopadding': { deps: ['crypto.cipher-core'] },
        'crypto.sha1':          { deps: ['crypto.core'] },
        'crypto.sha256':        { deps: ['crypto.core'] },
        'bigint':               { deps: ['crypto'] },
        'strophe.ping':         { deps: ['strophe'] },
        'strophe.register':     { deps: ['strophe'] },
        'strophe.vcard':        { deps: ['strophe'] }
    }
});


/* Converse.js components configuration
 *
 * This file is used to tell require.js which components (or plugins) to load
 * when it generates a build.
 */
if (typeof define !== 'undefined') {
    /* When running tests, define is not defined. */
    define("converse", [
        "converse-api",

        /* START: Removable components
        * --------------------
        * Any of the following components may be removed if they're not needed.
        */
        "locales",              // Translations for converse.js. This line can be removed
                                // to remove *all* translations, or you can modify the
                                // file src/locales.js to include only those
                                // translations that you care about.

        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-controlbox",  // The control box
        "converse-register",    // XEP-0077 In-band registration
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        /* END: Removable components */

    ], function(converse_api) {
        window.converse = converse_api;
        return converse_api;
    });
}
;

require(["converse"]);
/*global jQuery */
define('jquery', [], function () { return jQuery; });
define('jquery-private', [], function () { return jQuery; });

/*global jQuery, _, moment, Strophe, $build, $iq, $msg, $pres, SHA1, Base64, MD5, DSA, OTR */
define('jquery.browser', [], function () { return jQuery; });
define('typeahead', [], function () { return jQuery; });
define('underscore', [], function () { return _; });
define('moment_with_locales', [], function () { return moment; });
define('strophe', [], function () {
    return {
        'Strophe':         Strophe,
        '$build':          $build,
        '$iq':             $iq,
        '$msg':            $msg,
        '$pres':           $pres,
        'SHA1':            SHA1,
        'Base64':          Base64,
        'MD5':             MD5,
        'b64_hmac_sha1':   SHA1.b64_hmac_sha1,
        'b64_sha1':        SHA1.b64_sha1,
        'str_hmac_sha1':   SHA1.str_hmac_sha1,
        'str_sha1':        SHA1.str_sha1
    };
});
var strophePlugin = function () { return Strophe; };
var emptyFunction = function () { };
define('strophe.disco', ['strophe'], strophePlugin);
define('strophe.ping', ['strophe'], strophePlugin);
define('strophe.rsm', ['strophe'], strophePlugin);
define('strophe.vcard', ['strophe'], strophePlugin);
define('backbone', [], emptyFunction);
define('backbone.browserStorage', ['backbone'], emptyFunction);
define('backbone.overview', ['backbone'], emptyFunction);
define('otr', [], function () { return { 'DSA': DSA, 'OTR': OTR };});
define("locales", [], emptyFunction);
