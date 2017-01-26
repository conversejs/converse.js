/**
 * @license almond 0.3.3 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/almond/LICENSE
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
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
            foundI, foundStarMap, starI, i, j, part, normalizedBaseParts,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name) {
            name = name.split('/');
            lastIndex = name.length - 1;

            // If wanting node ID compatibility, strip .js from end
            // of IDs. Have to do this here, and not in nameToUrl
            // because node allows either .js or non .js to map
            // to same file.
            if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
            }

            // Starts with a '.' so need the baseName
            if (name[0].charAt(0) === '.' && baseParts) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that 'directory' and not name of the baseName's
                //module. For instance, baseName of 'one/two/three', maps to
                //'one/two/three.js', but we want the directory, 'one/two' for
                //this normalization.
                normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                name = normalizedBaseParts.concat(name);
            }

            //start trimDots
            for (i = 0; i < name.length; i++) {
                part = name[i];
                if (part === '.') {
                    name.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && name[2] === '..') || name[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        name.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
            //end trimDots

            name = name.join('/');
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

    //Creates a parts array for a relName where first part is plugin ID,
    //second part is resource ID. Assumes relName has already been normalized.
    function makeRelParts(relName) {
        return relName ? splitPrefix(relName) : [];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relParts) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0],
            relResourceName = relParts[1];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relResourceName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relResourceName));
            } else {
                name = normalize(name, relResourceName);
            }
        } else {
            name = normalize(name, relResourceName);
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
        var cjsModule, depName, ret, map, i, relParts,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;
        relParts = makeRelParts(relName);

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relParts);
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
            return callDep(makeMap(deps, makeRelParts(callback)).f);
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

define("almond", function(){});

/**
 * @license text 2.0.15 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/text/LICENSE
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

    function useDefault(value, defaultValue) {
        return value === undefined || value === '' ? defaultValue : value;
    }

    //Allow for default ports for http and https.
    function isSamePort(protocol1, port1, protocol2, port2) {
        if (port1 === port2) {
            return true;
        } else if (protocol1 === protocol2) {
            if (protocol1 === 'http') {
                return useDefault(port1, '80') === useDefault(port2, '80');
            } else if (protocol1 === 'https') {
                return useDefault(port1, '443') === useDefault(port2, '443');
            }
        }
        return false;
    }

    text = {
        version: '2.0.15',

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
                   ((!uPort && !uHostName) || isSamePort(uProtocol, uPort, protocol, port));
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
                var ext = config.tpl && !_.isUndefined(config.tpl.extension) ? config.tpl.extension : '.html';
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

/*global escape, locales, Jed */
(function (root, factory) {
    define('utils',[
        "jquery",
        "jquery.browser",
        "lodash",
        "tpl!field",
        "tpl!select_option",
        "tpl!form_select",
        "tpl!form_textarea",
        "tpl!form_checkbox",
        "tpl!form_username",
        "tpl!form_input",
        "tpl!form_captcha"
    ], factory);
}(this, function (
        $, dummy, _,
        tpl_field,
        tpl_select_option,
        tpl_form_select,
        tpl_form_textarea,
        tpl_form_checkbox,
        tpl_form_username,
        tpl_form_input,
        tpl_form_captcha
    ) {
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

    var isImage = function (url) {
        var deferred = new $.Deferred();
        $("<img>", {
            src: url,
            error: deferred.reject,
            load: deferred.resolve
        });
        return deferred.promise();
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

    $.fn.throttledHTML = _.throttle($.fn.html, 500);

    $.fn.addHyperlinks = function () {
        if (this.length > 0) {
            this.each(function (i, obj) {
                var prot, escaped_url;
                var $obj = $(obj);
                var x = $obj.html();
                var list = x.match(/\b(https?:\/\/|www\.|https?:\/\/www\.)[^\s<]{2,200}\b/g );
                if (list) {
                    for (i=0; i<list.length; i++) {
                        prot = list[i].indexOf('http://') === 0 || list[i].indexOf('https://') === 0 ? '' : 'http://';
                        escaped_url = encodeURI(decodeURI(list[i])).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        x = x.replace(list[i], '<a target="_blank" rel="noopener" href="' + prot + escaped_url + '">'+ list[i] + '</a>' );
                    }
                }
                $obj.html(x);
                _.forEach(list, function (url) {
                    isImage(url).then(function (ev) {
                        var prot = url.indexOf('http://') === 0 || url.indexOf('https://') === 0 ? '' : 'http://';
                        var escaped_url = encodeURI(decodeURI(url)).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");
                        var new_url = '<a target="_blank" rel="noopener" href="' + prot + escaped_url + '">'+ url + '</a>';
                        ev.target.className = 'chat-image';
                        x = x.replace(new_url, ev.target.outerHTML);
                        $obj.throttledHTML(x);
                    });
                });
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

        isLocaleAvailable: function (locale, available) {
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
        },

        detectLocale: function (library_check) {
            /* Determine which locale is supported by the user's system as well
             * as by the relevant library (e.g. converse.js or moment.js).
             *
             * Parameters:
             *      (Function) library_check - returns a boolean indicating whether the locale is supported
             */
            var locale, i;
            if (window.navigator.userLanguage) {
                locale = utils.isLocaleAvailable(window.navigator.userLanguage, library_check);
            }
            if (window.navigator.languages && !locale) {
                for (i=0; i<window.navigator.languages.length && !locale; i++) {
                    locale = utils.isLocaleAvailable(window.navigator.languages[i], library_check);
                }
            }
            if (window.navigator.browserLanguage && !locale) {
                locale = utils.isLocaleAvailable(window.navigator.browserLanguage, library_check);
            }
            if (window.navigator.language && !locale) {
                locale = utils.isLocaleAvailable(window.navigator.language, library_check);
            }
            if (window.navigator.systemLanguage && !locale) {
                locale = utils.isLocaleAvailable(window.navigator.systemLanguage, library_check);
            }
            return locale || 'en';

        },

        fadeIn: function (el, callback) {
            if ($.fx.off) {
                el.classList.remove('hidden');
                if (_.isFunction(callback)) {
                    callback();
                }
                return;
            }
            el.addEventListener("animationend", function () {
                el.classList.remove('visible');
                if (_.isFunction(callback)) {
                    callback();
                }
            }, false);
            el.classList.add('visible');
            el.classList.remove('hidden');
        },

        isOTRMessage: function (message) {
            var $body = $(message).children('body'),
                text = ($body.length > 0 ? $body.text() : undefined);
            return text && !!text.match(/^\?OTR/);
        },

        isHeadlineMessage: function (message) {
            var $message = $(message),
                from_jid = $message.attr('from');
            if ($message.attr('type') === 'headline' ||
                // Some servers (I'm looking at you Prosody) don't set the message
                // type to "headline" when sending server messages. For now we
                // check if an @ signal is included, and if not, we assume it's
                // a headline message.
                (   $message.attr('type') !== 'error' &&
                    typeof from_jid !== 'undefined' &&
                    from_jid.indexOf('@') === -1
                )) {
                return true;
            }
            return false;
        },

        merge: function merge (first, second) {
            /* Merge the second object into the first one.
             */
            for (var k in second) {
                if (_.isObject(first[k])) {
                    merge(first[k], second[k]);
                } else {
                    first[k] = second[k];
                }
            }
        },

        applyUserSettings: function applyUserSettings (context, settings, user_settings) {
            /* Configuration settings might be nested objects. We only want to
             * add settings which are whitelisted.
             */
            for (var k in settings) {
                if (_.isUndefined(user_settings[k])) {
                    continue;
                }
                if (_.isObject(settings[k]) && !_.isArray(settings[k])) {
                    applyUserSettings(context[k], settings[k], user_settings[k]);
                } else {
                    context[k] = user_settings[k];
                }
            }
        },

        refreshWebkit: function () {
            /* This works around a webkit bug. Refreshes the browser's viewport,
             * otherwise chatboxes are not moved along when one is closed.
             */
            if ($.browser.webkit && window.requestAnimationFrame) {
                window.requestAnimationFrame(function () {
                    var conversejs = document.getElementById('conversejs');
                    conversejs.style.display = 'none';
                    var tmp = conversejs.offsetHeight; // jshint ignore:line
                    conversejs.style.display = 'block';
                });
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
            return $(tpl_field({
                name: $input.attr('name'),
                value: value
            }))[0];
        },

        contains: function (attr, query) {
            return function (item) {
                if (typeof attr === 'object') {
                    var value = false;
                    _.forEach(attr, function (a) {
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
                    options.push(tpl_select_option({
                        value: value,
                        label: $($options[j]).attr('label'),
                        selected: (values.indexOf(value) >= 0),
                        required: $field.find('required').length
                    }));
                }
                return tpl_form_select({
                    name: $field.attr('var'),
                    label: $field.attr('label'),
                    options: options.join(''),
                    multiple: ($field.attr('type') === 'list-multi'),
                    required: $field.find('required').length
                });
            } else if ($field.attr('type') === 'fixed') {
                return $('<p class="form-help">').text($field.find('value').text());
            } else if ($field.attr('type') === 'jid-multi') {
                return tpl_form_textarea({
                    name: $field.attr('var'),
                    label: $field.attr('label') || '',
                    value: $field.find('value').text(),
                    required: $field.find('required').length
                });
            } else if ($field.attr('type') === 'boolean') {
                return tpl_form_checkbox({
                    name: $field.attr('var'),
                    type: XFORM_TYPE_MAP[$field.attr('type')],
                    label: $field.attr('label') || '',
                    checked: $field.find('value').text() === "1" && 'checked="1"' || '',
                    required: $field.find('required').length
                });
            } else if ($field.attr('type') && $field.attr('var') === 'username') {
                return tpl_form_username({
                    domain: ' @'+this.domain,
                    name: $field.attr('var'),
                    type: XFORM_TYPE_MAP[$field.attr('type')],
                    label: $field.attr('label') || '',
                    value: $field.find('value').text(),
                    required: $field.find('required').length
                });
            } else if ($field.attr('type')) {
                return tpl_form_input({
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
                                return tpl_form_captcha({
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
;
define("polyfill", function(){});

/*
       ____  __                        __    __         _
      / __ \/ /_  __ ___   ___  ____ _/ /_  / /__      (_)____
     / /_/ / / / / / __ \/ __ \/ __/ / __ \/ / _ \    / / ___/
    / ____/ / /_/ / /_/ / /_/ / /_/ / /_/ / /  __/   / (__  )
   /_/   /_/\__,_/\__, /\__, /\__/_/_.___/_/\___(_)_/ /____/
                 /____//____/                    /___/
 */

// Pluggable.js lets you to make your Javascript code pluggable while still
// keeping sensitive objects and data private through closures.

/* Start AMD header */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define("pluggable", ["underscore"], factory);
    } else {
        window.pluggable = factory(_);
    }
}(this, function (_) {
    "use strict";
/* End AMD header */

    // The `PluginSocket` class contains the plugin architecture, and gets
    // created whenever `pluggable.enable(obj);` is called on the object
    // that you want to make pluggable.
    // You can also see it as the thing into which the plugins are plugged.
    // It takes two parameters, first, the object being made pluggable, and
    // then the name by which the pluggable object may be referenced on the
    // __super__ object (inside overrides).
    function PluginSocket (plugged, name) {
        this.name = name; 
        this.plugged = plugged;
        this.plugged.__super__ = {};
        this.plugins = {};
        this.initialized_plugins = [];
    }

    // Now we add methods to the PluginSocket by adding them to its
    // prototype.
    _.extend(PluginSocket.prototype, {

        // `wrappedOverride` creates a partially applied wrapper function
        // that makes sure to set the proper super method when the
        // overriding method is called. This is done to enable
        // chaining of plugin methods, all the way up to the
        // original method.
        wrappedOverride: function (key, value, super_method) {
            if (typeof super_method === "function") {
                if (typeof this.__super__ === "undefined") {
                    /* We're not on the context of the plugged object.
                     * This can happen when the overridden method is called via
                     * an event handler. In this case, we simply tack on the
                     * __super__ obj.
                     */
                    this.__super__ = {};
                }
                this.__super__[key] = super_method.bind(this);
            }
            return value.apply(this, _.rest(arguments, 3));
        },

        // `_overrideAttribute` overrides an attribute on the original object
        // (the thing being plugged into).
        //
        // If the attribute being overridden is a function, then the original
        // function will still be available via the `__super__` attribute.
        //
        // If the same function is being overridden multiple times, then
        // the original function will be available at the end of a chain of
        // functions, starting from the most recent override, all the way
        // back to the original function, each being referenced by the
        // previous' __super__ attribute.
        //
        // For example:
        //
        // `plugin2.MyFunc.__super__.myFunc => plugin1.MyFunc.__super__.myFunc => original.myFunc`
        _overrideAttribute: function (key, plugin) {
            var value = plugin.overrides[key];
            if (typeof value === "function") {
                var wrapped_function = _.partial(
                    this.wrappedOverride, key, value, this.plugged[key]
                );
                this.plugged[key] = wrapped_function;
            } else {
                this.plugged[key] = value;
            }
        },

        _extendObject: function (obj, attributes) {
            if (!obj.prototype.__super__) {
                obj.prototype.__super__ = {};
                obj.prototype.__super__[this.name] = this.plugged;
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
                        this.wrappedOverride, key, value, obj.prototype[key]
                    );
                    obj.prototype[key] = wrapped_function;
                } else {
                    obj.prototype[key] = value;
                }
            }.bind(this));
        },

        // Plugins can specify optional dependencies (by means of the
        // `optional_dependencies` list attribute) which refers to dependencies
        // which will be initialized first, before the plugin itself gets initialized.
        // They are optional in the sense that if they aren't available, an
        // error won't be thrown.
        // However, if you want to make these dependencies strict (i.e.
        // non-optional), you can set the `strict_plugin_dependencies` attribute to `true`
        // on the object being made pluggable (i.e. the object passed to
        // `pluggable.enable`).
        loadOptionalDependencies: function (plugin) {
            _.each(plugin.optional_dependencies, function (name) {
                var dep = this.plugins[name];
                if (dep) {
                    if (_.contains(dep.optional_dependencies, plugin.__name__)) {
                        /* FIXME: circular dependency checking is only one level deep. */
                        throw "Found a circular dependency between the plugins \""+
                              plugin.__name__+"\" and \""+name+"\"";
                    }
                    this.initializePlugin(dep);
                } else {
                    this.throwUndefinedDependencyError(
                        "Could not find optional dependency \""+name+"\" "+
                        "for the plugin \""+plugin.__name__+"\". "+
                        "If it's needed, make sure it's loaded by require.js");
                }
            }.bind(this));
        },

        throwUndefinedDependencyError: function (msg) {
            if (this.plugged.strict_plugin_dependencies) {
                throw msg;
            } else {
                console.log(msg);
                return;
            }
        },

        // `applyOverrides` is called by initializePlugin. It applies any
        // and all overrides of methods or Backbone views and models that
        // are defined on any of the plugins.
        applyOverrides: function (plugin) {
            _.each(Object.keys(plugin.overrides || {}), function (key) {
                var override = plugin.overrides[key];
                if (typeof override === "object") {
                    if (typeof this.plugged[key] === 'undefined') {
                        this.throwUndefinedDependencyError(
                            "Error: Plugin \""+plugin.__name__+
                            "\" tried to override "+key+" but it's not found.");
                    } else {
                        this._extendObject(this.plugged[key], override);
                    }
                } else {
                    this._overrideAttribute(key, plugin);
                }
            }.bind(this));
        },

        // `initializePlugin` applies the overrides (if any) defined on all
        // the registered plugins and then calls the initialize method for each plugin.
        initializePlugin: function (plugin) {
            if (_.contains(this.initialized_plugins, plugin.__name__)) {
                /* Don't initialize plugins twice, otherwise we get
                 * infinite recursion in overridden methods.
                 */
                return;
            }
            _.extend(plugin, this.properties);
            if (plugin.optional_dependencies) {
                this.loadOptionalDependencies(plugin);
            }
            this.applyOverrides(plugin);
            if (typeof plugin.initialize === "function") {
                plugin.initialize.bind(plugin)(this);
            }
            this.initialized_plugins.push(plugin.__name__);
        },

        // `registerPlugin` registers (or inserts, if you'd like) a plugin,
        // by adding it to the `plugins` map on the PluginSocket instance.
        registerPlugin: function (name, plugin) {
            plugin.__name__ = name;
            this.plugins[name] = plugin;
        },

        // `initializePlugins` should get called once all plugins have been
        // registered. It will then iterate through all the plugins, calling
        // `initializePlugin` for each.
        // The passed in  properties variable is an object with attributes and methods
        // which will be attached to the plugins.
        initializePlugins: function (properties) {
            if (!_.size(this.plugins)) {
                return;
            }
            this.properties = properties;
            _.each(_.values(this.plugins), this.initializePlugin.bind(this));
        }
    });
    return {
        // Call the `enable` method to make an object pluggable
        //
        // It takes three parameters:
        // - `object`: The object that gets made pluggable.
        // - `name`: The string name by which the now pluggable object
        //     may be referenced on the __super__ obj (in overrides).
        //     The default value is "plugged".
        // - `attrname`: The string name of the attribute on the now
        //     pluggable object, which refers to the PluginSocket instance
        //     that gets created.
        'enable': function (object, name, attrname) {
            if (typeof attrname === "undefined") {
                attrname = "pluginSocket";
            }
            if (typeof name === 'undefined') {
                name = 'plugged';
            }
            var ref = {};
            ref[attrname] = new PluginSocket(object, name);
            return _.extend(object, ref);
        }
    };
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window, document */

(function (root, factory) {
    define("converse-core", [
        "jquery",
        "lodash",
        "polyfill",
        "utils",
        "moment_with_locales",
        "strophe",
        "pluggable",
        "strophe.disco",
        "backbone.browserStorage",
        "backbone.overview",
    ], factory);
}(this, function ($, _, dummy, utils, moment, Strophe, pluggable) {
    /*
     * Cannot use this due to Safari bug.
     * See https://github.com/jcbrand/converse.js/issues/196
     */
    // "use strict";

    // Strophe globals
    var $build = Strophe.$build;
    var $iq = Strophe.$iq;
    var $pres = Strophe.$pres;
    var b64_sha1 = Strophe.SHA1.b64_sha1;
    Strophe = Strophe.Strophe;

    // Use Mustache style syntax for variable interpolation
    /* Configuration of Lodash templates (this config is distinct to the
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
        templates: {},

        emit: function (evt, data) {
            $(event_context).trigger(evt, data);
        },

        once: function (evt, handler, context) {
            if (context) {
                handler = handler.bind(context);
            }
            $(event_context).one(evt, handler);
        },

        on: function (evt, handler, context) {
            if (_.includes(['ready', 'initialized'], evt)) {
                converse.log('Warning: The "'+evt+'" event has been deprecated and will be removed, please use "connected".');
            }
            if (context) {
                handler = handler.bind(context);
            }
            $(event_context).bind(evt, handler);
        },

        off: function (evt, handler) {
            $(event_context).unbind(evt, handler);
        }
    };

    // Make converse pluggable
    pluggable.enable(converse, 'converse', 'pluggable');

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
    converse.ANONYMOUS  = "anonymous";
    converse.CLOSED = 'closed';
    converse.EXTERNAL = "external";
    converse.LOGIN = "login";
    converse.LOGOUT = "logout";
    converse.OPENED = 'opened';
    converse.PREBIND = "prebind";

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
        settings = typeof settings !== "undefined" ? settings : {};
        var init_deferred = new $.Deferred();
        var converse = this;

        if (typeof converse.chatboxes !== 'undefined') {
            // Looks like converse.initialized was called again without logging
            // out or disconnecting in the previous session.
            // This happens in tests.
            // We therefore first clean up.
            converse._tearDown();
        }

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
        Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
        Strophe.addNamespace('XFORM', 'jabber:x:data');
        Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
        Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
        Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');

        // Instance level constants
        this.TIMEOUTS = { // Set as module attr so that we can override in tests.
            'PAUSED':     10000,
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
        var locales = typeof locales === "undefined" ? {} : locales;
        this.isConverseLocale = function (locale) { return typeof locales[locale] !== "undefined"; };
        this.isMomentLocale = function (locale) { return moment.locale() !== moment.locale(locale); };
        if (!moment.locale) { //moment.lang is deprecated after 2.8.1, use moment.locale instead
            moment.locale = moment.lang;
        }
        moment.locale(utils.detectLocale(this.isMomentLocale));
        this.i18n = settings.i18n ? settings.i18n : locales[utils.detectLocale(this.isConverseLocale)] || {};

        // Translation machinery
        // ---------------------
        var __ = utils.__.bind(this);
        var DESC_GROUP_TOGGLE = __('Click to hide these contacts');

        // Default configuration values
        // ----------------------------
        this.default_settings = {
            allow_contact_requests: true,
            animate: true,
            authentication: 'login', // Available values are "login", "prebind", "anonymous" and "external".
            auto_away: 0, // Seconds after which user status is set to 'away'
            auto_login: false, // Currently only used in connection with anonymous login
            auto_reconnect: false,
            auto_subscribe: false,
            auto_xa: 0, // Seconds after which user status is set to 'xa'
            bosh_service_url: undefined, // The BOSH connection manager URL.
            connection_options: {},
            credentials_url: null, // URL from where login credentials can be fetched
            csi_waiting_time: 0, // Support for XEP-0352. Seconds before client is considered idle and CSI is sent out.
            debug: false,
            default_state: 'online',
            expose_rid_and_sid: false,
            filter_by_resource: false,
            forward_messages: false,
            hide_offline_users: false,
            include_offline_state: false,
            jid: undefined,
            keepalive: false,
            locked_domain: undefined,
            message_carbons: false, // Support for XEP-280
            password: undefined,
            prebind: false, // XXX: Deprecated, use "authentication" instead.
            prebind_url: null,
            rid: undefined,
            roster_groups: false,
            show_only_online_users: false,
            sid: undefined,
            storage: 'session',
            message_storage: 'session',
            strict_plugin_dependencies: false,
            synchronize_availability: true, // Set to false to not sync with other clients or with resource name of the particular client that it should synchronize with
            websocket_url: undefined,
            xhr_custom_status: false,
            xhr_custom_status_url: '',
        };
        _.assignIn(this, this.default_settings);
        // Allow only whitelisted configuration attributes to be overwritten
        _.assignIn(this, _.pick(settings, Object.keys(this.default_settings)));

        // BBB
        if (this.prebind === true) { this.authentication = converse.PREBIND; }

        if (this.authentication === converse.ANONYMOUS) {
            if (this.auto_login && !this.jid) {
                throw new Error("Config Error: you need to provide the server's " +
                      "domain via the 'jid' option when using anonymous " +
                      "authentication with auto_login.");
            }
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
        this.user_settings = settings; // Save the user settings so that they can be used by plugins

        // Module-level functions
        // ----------------------
        this.wrappedChatBox = function (chatbox) {
            /* Wrap a chatbox for outside consumption (i.e. so that it can be
             * returned via the API.
             */
            if (!chatbox) { return; }
            var view = converse.chatboxviews.get(chatbox.get('id'));
            return {
                'close': view.close.bind(view),
                'focus': view.focus.bind(view),
                'get': chatbox.get.bind(chatbox),
                'open': view.show.bind(view),
                'set': chatbox.set.bind(chatbox)
            };
        };

        this.generateResource = function () {
            return '/converse.js-' + Math.floor(Math.random()*139749825).toString();
        };

        this.sendCSI = function (stat) {
            /* Send out a Chat Status Notification (XEP-0352) */
            if (converse.features[Strophe.NS.CSI] || true) {
                converse.connection.send($build(stat, {xmlns: Strophe.NS.CSI}));
                converse.inactive = (stat === converse.INACTIVE) ? true : false;
            }
        };

        this.onUserActivity = function () {
            /* Resets counters and flags relating to CSI and auto_away/auto_xa */
            if (converse.idle_seconds > 0) {
                converse.idle_seconds = 0;
            }
            if (!converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // converse can happen when the connection reconnects.
                return;
            }
            if (converse.inactive) {
                converse.sendCSI(converse.ACTIVE);
            }
            if (converse.auto_changed_status === true) {
                converse.auto_changed_status = false;
                // XXX: we should really remember the original state here, and
                // then set it back to that...
                converse.xmppstatus.setStatus(converse.default_state);
            }
        };

        this.onEverySecond = function () {
            /* An interval handler running every second.
             * Used for CSI and the auto_away and auto_xa features.
             */
            if (!converse.connection.authenticated) {
                // We can't send out any stanzas when there's no authenticated connection.
                // This can happen when the connection reconnects.
                return;
            }
            var stat = converse.xmppstatus.getStatus();
            converse.idle_seconds++;
            if (converse.csi_waiting_time > 0 &&
                    converse.idle_seconds > converse.csi_waiting_time &&
                    !converse.inactive) {
                converse.sendCSI(converse.INACTIVE);
            }
            if (converse.auto_away > 0 &&
                    converse.idle_seconds > converse.auto_away &&
                    stat !== 'away' && stat !== 'xa') {
                converse.auto_changed_status = true;
                converse.xmppstatus.setStatus('away');
            } else if (converse.auto_xa > 0 &&
                    converse.idle_seconds > converse.auto_xa && stat !== 'xa') {
                converse.auto_changed_status = true;
                converse.xmppstatus.setStatus('xa');
            }
        };

        this.registerIntervalHandler = function () {
            /* Set an interval of one second and register a handler for it.
             * Required for the auto_away, auto_xa and csi_waiting_time features.
             */
            if (converse.auto_away < 1 && converse.auto_xa < 1 && converse.csi_waiting_time < 1) {
                // Waiting time of less then one second means features aren't used.
                return;
            }
            converse.idle_seconds = 0;
            converse.auto_changed_status = false; // Was the user's status changed by converse.js?
            $(window).on('click mousemove keypress focus'+unloadevent, converse.onUserActivity);
            converse.everySecondTrigger = window.setInterval(converse.onEverySecond, 1000);
        };

        this.giveFeedback = function (subject, klass, message) {
            $('.conn-feedback').each(function (idx, el) {
                var $el = $(el);
                $el.addClass('conn-feedback').text(subject);
                if (klass) {
                    $el.addClass(klass);
                } else {
                    $el.removeClass('error');
                }
            });
            converse.emit('feedback', {
                'klass': klass,
                'message': message,
                'subject': subject
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


        this.reconnect = _.debounce(function (condition) {
            converse.log('The connection has dropped, attempting to reconnect.');
            converse.giveFeedback(
                __("Reconnecting"),
                'warn',
                __('The connection has dropped, attempting to reconnect.')
            );
            converse.connection.reconnecting = true;
            converse.connection.disconnect('re-connecting');
            converse.connection.reset();
            converse._tearDown();
            converse.logIn(null, true);
        }, 1000);

        this.disconnect = function () {
            delete converse.connection.reconnecting;
            converse._tearDown();
            converse.chatboxviews.closeAllChatBoxes();
            converse.emit('disconnected');
            converse.log('DISCONNECTED');
            return 'disconnected';
        };

        this.onDisconnected = function (condition) {
            if (converse.disconnection_cause !== converse.LOGOUT && converse.auto_reconnect) {
                if (converse.disconnection_cause === Strophe.Status.CONNFAIL) {
                    converse.reconnect(condition);
                    converse.log('RECONNECTING');
                } else if (converse.disconnection_cause === Strophe.Status.DISCONNECTING ||
                           converse.disconnection_cause === Strophe.Status.DISCONNECTED) {
                    window.setTimeout(_.partial(converse.reconnect, condition), 3000);
                    converse.log('RECONNECTING IN 3 SECONDS');
                }
                converse.emit('reconnecting');
                return 'reconnecting';
            }
            return this.disconnect();
        };

        this.setDisconnectionCause = function (connection_status) {
            if (typeof converse.disconnection_cause === "undefined") {
                converse.disconnection_cause = connection_status;
            }
        };

        this.onConnectStatusChanged = function (status, condition) {
            converse.log("Status changed to: "+PRETTY_CONNECTION_STATUS[status]);
            if (status === Strophe.Status.CONNECTED || status === Strophe.Status.ATTACHED) {
                // By default we always want to send out an initial presence stanza.
                converse.send_initial_presence = true;
                delete converse.disconnection_cause;
                if (converse.connection.reconnecting) {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Reconnected' : 'Reattached');
                    converse.onConnected(true);
                } else {
                    converse.log(status === Strophe.Status.CONNECTED ? 'Connected' : 'Attached');
                    if (converse.connection.restored) {
                        // No need to send an initial presence stanza when
                        // we're restoring an existing session.
                        converse.send_initial_presence = false;
                    }
                    converse.onConnected();
                }
            } else if (status === Strophe.Status.DISCONNECTED) {
                converse.setDisconnectionCause(status);
                converse.onDisconnected(condition);
            } else if (status === Strophe.Status.ERROR) {
                converse.giveFeedback(
                    __('Connection error'), 'error',
                    __('An error occurred while connecting to the chat server.')
                );
            } else if (status === Strophe.Status.CONNECTING) {
                converse.giveFeedback(__('Connecting'));
            } else if (status === Strophe.Status.AUTHENTICATING) {
                converse.giveFeedback(__('Authenticating'));
            } else if (status === Strophe.Status.AUTHFAIL) {
                converse.giveFeedback(__('Authentication failed.'), 'error');
                converse.connection.disconnect(__('Authentication Failed'));
                converse.disconnection_cause = Strophe.Status.AUTHFAIL;
            } else if (status === Strophe.Status.CONNFAIL) {
                converse.setDisconnectionCause(status);
            } else if (status === Strophe.Status.DISCONNECTING) {
                converse.setDisconnectionCause(status);
                if (condition) {
                    converse.giveFeedback(
                        __("Disconnected"), 'warn',
                        __("The connection to the chat server has dropped")
                    );
                }
            }
        };

        this.updateMsgCounter = function () {
            if (this.msg_counter > 0) {
                if (document.title.search(/^Messages \(\d+\) /) === -1) {
                    document.title = "Messages (" + this.msg_counter + ") " + document.title;
                } else {
                    document.title = document.title.replace(/^Messages \(\d+\) /, "Messages (" + this.msg_counter + ") ");
                }
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

        this.initStatus = function () {
            var deferred = new $.Deferred();
            this.xmppstatus = new this.XMPPStatus();
            var id = b64_sha1('converse.xmppstatus-'+converse.bare_jid);
            this.xmppstatus.id = id; // Appears to be necessary for backbone.browserStorage
            this.xmppstatus.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.xmppstatus.fetch({
                success: deferred.resolve,
                error: deferred.resolve
            });
            converse.emit('statusInitialized');
            return deferred.promise();
        };

        this.initSession = function () {
            this.session = new this.Session();
            var id = b64_sha1('converse.bosh-session');
            this.session.id = id; // Appears to be necessary for backbone.browserStorage
            this.session.browserStorage = new Backbone.BrowserStorage[converse.storage](id);
            this.session.fetch();
        };

        this.clearSession = function () {
            if (!_.isUndefined(this.roster)) {
                this.roster.browserStorage._clear();
            }
            this.session.browserStorage._clear();
        };

        this.logOut = function () {
            converse.chatboxviews.closeAllChatBoxes();
            converse.disconnection_cause = converse.LOGOUT;
            if (typeof converse.connection !== 'undefined') {
                converse.connection.disconnect();
                converse.connection.reset();
            }
            converse.clearSession();
            converse._tearDown();
            converse.emit('logout');
        };

        this.saveWindowState = function (ev, hidden) {
            // XXX: eventually we should be able to just use
            // document.visibilityState (when we drop support for older
            // browsers).
            var state;
            var v = "visible", h = "hidden",
                event_map = {
                    'focus': v,
                    'focusin': v,
                    'pageshow': v,
                    'blur': h,
                    'focusout': h,
                    'pagehide': h
                };
            ev = ev || document.createEvent('Events');
            if (ev.type in event_map) {
                state = event_map[ev.type];
            } else {
                state = document[hidden] ? "hidden" : "visible";
            }
            if (state  === 'visible') {
                converse.clearMsgCounter();
            }
            converse.windowState = state;
        };

        this.registerGlobalEventHandlers = function () {
            // Taken from:
            // http://stackoverflow.com/questions/1060008/is-there-a-way-to-detect-if-a-browser-window-is-not-currently-active
            var hidden = "hidden";
            // Standards:
            if (hidden in document) {
                document.addEventListener("visibilitychange", _.partial(converse.saveWindowState, _, hidden));
            } else if ((hidden = "mozHidden") in document) {
                document.addEventListener("mozvisibilitychange", _.partial(converse.saveWindowState, _, hidden));
            } else if ((hidden = "webkitHidden") in document) {
                document.addEventListener("webkitvisibilitychange", _.partial(converse.saveWindowState, _, hidden));
            } else if ((hidden = "msHidden") in document) {
                document.addEventListener("msvisibilitychange", _.partial(converse.saveWindowState, _, hidden));
            } else if ("onfocusin" in document) {
                // IE 9 and lower:
                document.onfocusin = document.onfocusout = _.partial(converse.saveWindowState, _, hidden);
            } else {
                // All others:
                window.onpageshow = window.onpagehide = window.onfocus = window.onblur = _.partial(converse.saveWindowState, _, hidden);
            }
            // set the initial state (but only if browser supports the Page Visibility API)
            if( document[hidden] !== undefined ) {
                _.partial(converse.saveWindowState, _, hidden)({type: document[hidden] ? "blur" : "focus"});
            }
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

        this.initRoster = function () {
            /* Initialize the Bakcbone collections that represent the contats
             * roster and the roster groups.
             */
            converse.roster = new converse.RosterContacts();
            converse.roster.browserStorage = new Backbone.BrowserStorage.session(
                b64_sha1('converse.contacts-'+converse.bare_jid));
            converse.rostergroups = new converse.RosterGroups();
            converse.rostergroups.browserStorage = new Backbone.BrowserStorage.session(
                b64_sha1('converse.roster.groups'+converse.bare_jid));
            converse.emit('rosterInitialized');
        };

        this.populateRoster = function () {
            /* Fetch all the roster groups, and then the roster contacts.
             * Emit an event after fetching is done in each case.
             */
            converse.rostergroups.fetchRosterGroups().then(function () {
                converse.emit('rosterGroupsFetched');
                converse.roster.fetchRosterContacts().then(function () {
                    converse.emit('rosterContactsFetched');
                    converse.sendInitialPresence();
                });
            });
        };

        this.unregisterPresenceHandler = function () {
            if (typeof converse.presence_ref !== 'undefined') {
                converse.connection.deleteHandler(converse.presence_ref);
                delete converse.presence_ref;
            }
        };

        this.registerPresenceHandler = function () {
            converse.unregisterPresenceHandler();
            converse.presence_ref = converse.connection.addHandler(
                function (presence) {
                    converse.roster.presenceHandler(presence);
                    return true;
                }, null, 'presence', null);
        };


        this.sendInitialPresence = function () {
            if (converse.send_initial_presence) {
                converse.xmppstatus.sendPresence();
            }
        };

        this.onStatusInitialized = function (reconnecting) {
            /* Continue with session establishment (e.g. fetching chat boxes,
             * populating the roster etc.) necessary once the connection has
             * been established.
             */
            if (reconnecting) {
                // No need to recreate the roster, otherwise we lose our
                // cached data. However we still emit an event, to give
                // event handlers a chance to register views for the
                // roster and its groups, before we start populating.
                converse.emit('rosterReadyAfterReconnection');
            } else {
                converse.registerIntervalHandler();
                converse.initRoster();
            }
            // First set up chat boxes, before populating the roster, so that
            // the controlbox is properly set up and ready for the rosterview.
            converse.chatboxes.onConnected();
            converse.populateRoster();
            converse.registerPresenceHandler();
            converse.giveFeedback(__('Contacts'));
            if (reconnecting) {
                converse.xmppstatus.sendPresence();
            } else {
                init_deferred.resolve();
                converse.emit('initialized');
            }
        };

        this.setUserJid = function () {
            converse.jid = converse.connection.jid;
            converse.bare_jid = Strophe.getBareJidFromJid(converse.connection.jid);
            converse.resource = Strophe.getResourceFromJid(converse.connection.jid);
            converse.domain = Strophe.getDomainFromJid(converse.connection.jid);
        };

        this.onConnected = function (reconnecting) {
            /* Called as soon as a new connection has been established, either
             * by logging in or by attaching to an existing BOSH session.
             */
            // Solves problem of returned PubSub BOSH response not received
            // by browser.
            converse.connection.flush();

            converse.setUserJid();
            converse.enableCarbons();

            // If there's no xmppstatus obj, then we were never connected to
            // begin with, so we set reconnecting to false.
            reconnecting = _.isUndefined(converse.xmppstatus) ? false : reconnecting;

            if (reconnecting) {
                converse.onStatusInitialized(true);
                converse.emit('reconnected');
            } else {
                // There might be some open chat boxes. We don't
                // know whether these boxes are of the same account or not, so we
                // close them now.
                converse.chatboxviews.closeAllChatBoxes();
                converse.features = new converse.Features();
                converse.initStatus().done(_.partial(converse.onStatusInitialized, false));
                converse.emit('connected');
            }
        };

        this.RosterContact = Backbone.Model.extend({

            initialize: function (attributes, options) {
                var jid = attributes.jid;
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var resource = Strophe.getResourceFromJid(jid);
                attributes.jid = bare_jid;
                this.set(_.assignIn({
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
                this.on('change:chat_status', function (item) {
                    converse.emit('contactStatusChanged', item.attributes);
                });
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

            fetchRosterContacts: function () {
                /* Fetches the roster contacts, first by trying the
                 * sessionStorage cache, and if that's empty, then by querying
                 * the XMPP server.
                 *
                 * Returns a promise which resolves once the contacts have been
                 * fetched.
                 */
                var deferred = new $.Deferred();
                this.fetch({
                    add: true,
                    success: function (collection) {
                        if (collection.length === 0) {
                            /* We don't have any roster contacts stored in sessionStorage,
                             * so lets fetch the roster from the XMPP server. We pass in
                             * 'sendPresence' as callback method, because after initially
                             * fetching the roster we are ready to receive presence
                             * updates from our contacts.
                             */
                            converse.send_initial_presence = true;
                            converse.roster.fetchFromServer(deferred.resolve);
                        } else {
                            converse.emit('cachedRoster', collection);
                            deferred.resolve();
                        }
                    }
                });
                return deferred.promise();
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
                 *    (Function) callback - A function to call once the IQ is returned
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
                        var contact = this.create(_.assignIn({
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
                $(iq).children('query').find('item').each(function (idx, item) {
                    this.updateContact(item);
                }.bind(this));
                converse.emit('roster', iq);
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

            createRequestingContact: function (presence) {
                /* Creates a Requesting Contact.
                 *
                 * Note: this method gets completely overridden by converse-vcard.js
                 */
                var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                var nick = $(presence).children('nick[xmlns='+Strophe.NS.NICK+']').text();
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: nick || bare_jid,
                };
                this.create(user_data);
                converse.emit('contactRequest', user_data);
            },

            handleIncomingSubscription: function (presence) {
                var jid = presence.getAttribute('from');
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var contact = this.get(bare_jid);
                if (!converse.allow_contact_requests) {
                    converse.rejectPresenceSubscription(
                        jid,
                        __("This client does not allow presence subscriptions")
                    );
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
                        this.createRequestingContact(presence);
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
                    if ((converse.connection.jid !== jid) &&
                        (presence_type !== 'unavailable') &&
                        (converse.synchronize_availability === true ||
                         converse.synchronize_availability === resource)) {
                        // Another resource has changed its status and
                        // synchronize_availability option set to update,
                        // we'll update ours as well.
                        converse.xmppstatus.save({'status': chat_status});
                        if (status_message.length) {
                            converse.xmppstatus.save({
                                'status_message': status_message.text()
                            });
                        }
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
                    this.handleIncomingSubscription(presence);
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


        this.RosterGroup = Backbone.Model.extend({
            initialize: function (attributes, options) {
                this.set(_.assignIn({
                    description: DESC_GROUP_TOGGLE,
                    state: converse.OPENED
                }, attributes));
                // Collection of contacts belonging to this group.
                this.contacts = new converse.RosterContacts();
            }
        });


        this.RosterGroups = Backbone.Collection.extend({
            model: converse.RosterGroup,

            fetchRosterGroups: function () {
                /* Fetches all the roster groups from sessionStorage.
                 *
                 * Returns a promise which resolves once the groups have been
                 * returned.
                 */
                var deferred = new $.Deferred();
                this.fetch({
                    silent: true, // We need to first have all groups before
                                  // we can start positioning them, so we set
                                  // 'silent' to true.
                    success: deferred.resolve
                });
                return deferred.promise();
            }
        });


        this.Message = Backbone.Model.extend({
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
                this.messages.browserStorage = new Backbone.BrowserStorage[converse.message_storage](
                    b64_sha1('converse.messages'+this.get('jid')+converse.bare_jid));
                this.save({
                    // The chat_state will be set to ACTIVE once the chat box is opened
                    // and we listen for change:chat_state, so shouldn't set it to ACTIVE here.
                    'box_id' : b64_sha1(this.get('jid')),
                    'chat_state': undefined,
                    'num_unread': this.get('num_unread') || 0,
                    'time_opened': this.get('time_opened') || moment().valueOf(),
                    'url': '',
                    'user_id' : Strophe.getNodeFromJid(this.get('jid'))
                });
            },

            getMessageAttributes: function ($message, $delay, original_stanza) {
                $delay = $delay || $message.find('delay');
                var type = $message.attr('type'),
                    body, stamp, time, sender, from;

                if (type === 'error') {
                    body = $message.find('error').children('text').text();
                } else {
                    body = $message.children('body').text();
                }
                var delayed = $delay.length > 0,
                    fullname = this.get('fullname'),
                    is_groupchat = type === 'groupchat',
                    chat_state = $message.find(converse.COMPOSING).length && converse.COMPOSING ||
                        $message.find(converse.PAUSED).length && converse.PAUSED ||
                        $message.find(converse.INACTIVE).length && converse.INACTIVE ||
                        $message.find(converse.ACTIVE).length && converse.ACTIVE ||
                        $message.find(converse.GONE).length && converse.GONE;

                if (is_groupchat) {
                    from = Strophe.unescapeNode(Strophe.getResourceFromJid($message.attr('from')));
                } else {
                    from = Strophe.getBareJidFromJid($message.attr('from'));
                }
                if (_.isEmpty(fullname)) {
                    fullname = from;
                }
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
                return {
                    'type': type,
                    'chat_state': chat_state,
                    'delayed': delayed,
                    'fullname': fullname,
                    'message': body || undefined,
                    'msgid': $message.attr('id'),
                    'sender': sender,
                    'time': time
                };
            },

            createMessage: function ($message, $delay, original_stanza) {
                return this.messages.create(this.getMessageAttributes.apply(this, arguments));
            }
        });

        this.ChatBoxes = Backbone.Collection.extend({
            model: converse.ChatBox,
            comparator: 'time_opened',

            registerMessageHandler: function () {
                converse.connection.addHandler(this.onMessage.bind(this), null, 'message', 'chat');
                converse.connection.addHandler(this.onErrorMessage.bind(this), null, 'message', 'error');
            },

            chatBoxMayBeShown: function (chatbox) {
                return true;
            },

            onChatBoxesFetched: function (collection) {
                /* Show chat boxes upon receiving them from sessionStorage
                 *
                 * This method gets overridden entirely in src/converse-controlbox.js
                 * if the controlbox plugin is active.
                 */
                var that = this;
                collection.each(function (chatbox) {
                    if (that.chatBoxMayBeShown(chatbox)) {
                        chatbox.trigger('show');
                    }
                });
                converse.emit('chatBoxesFetched');
            },

            onConnected: function () {
                this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                    b64_sha1('converse.chatboxes-'+converse.bare_jid));
                this.registerMessageHandler();
                this.fetch({
                    add: true,
                    success: this.onChatBoxesFetched.bind(this)
                });
            },

            onErrorMessage: function (message) {
                /* Handler method for all incoming error message stanzas
                 */
                // TODO: we can likely just reuse "onMessage" below
                var $message = $(message),
                    from_jid =  Strophe.getBareJidFromJid($message.attr('from'));
                if (from_jid === converse.bare_jid) {
                    return true;
                }
                // Get chat box, but only create a new one when the message has a body.
                var chatbox = this.getChatBox(from_jid);
                if (!chatbox) {
                    return true;
                }
                chatbox.createMessage($message, null, message);
                return true;
            },

            onMessage: function (message) {
                /* Handler method for all incoming single-user chat "message"
                 * stanzas.
                 */
                var $message = $(message),
                    contact_jid, $forwarded, $delay, from_bare_jid,
                    from_resource, is_me, msgid,
                    chatbox, resource,
                    from_jid = $message.attr('from'),
                    to_jid = $message.attr('to'),
                    to_resource = Strophe.getResourceFromJid(to_jid);

                if (converse.filter_by_resource && (to_resource && to_resource !== converse.resource)) {
                    converse.log(
                        'onMessage: Ignoring incoming message intended for a different resource: '+to_jid,
                        'info'
                    );
                    return true;
                } else if (utils.isHeadlineMessage(message)) {
                    // XXX: Ideally we wouldn't have to check for headline
                    // messages, but Prosody sends headline messages with the
                    // wrong type ('chat'), so we need to filter them out here.
                    converse.log(
                        "onMessage: Ignoring incoming headline message sent with type 'chat' from JID: "+from_jid,
                        'info'
                    );
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
                converse.emit('message', message);
                // Get chat box, but only create a new one when the message has a body.
                chatbox = this.getChatBox(contact_jid, $message.find('body').length > 0);
                if (!chatbox) {
                    return true;
                }
                if (msgid && chatbox.messages.findWhere({msgid: msgid})) {
                    return true; // We already have this message stored.
                }
                chatbox.createMessage($message, $delay, message);
                return true;
            },

            getChatBox: function (jid, create, attrs) {
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
                    chatbox = this.create(_.assignIn({
                        'id': bare_jid,
                        'jid': bare_jid,
                        'fullname': _.isEmpty(roster_item.get('fullname'))? jid: roster_item.get('fullname'),
                        'image_type': roster_item.get('image_type'),
                        'image': roster_item.get('image'),
                        'url': roster_item.get('url')
                    }, attrs || {}));
                }
                return chatbox;
            }
        });

        this.ChatBoxViews = Backbone.Overview.extend({

            initialize: function () {
                this.model.on("add", this.onChatBoxAdded, this);
                this.model.on("destroy", this.removeChat, this);
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
                    $el.html('');
                    this.setElement($el, false);
                } else {
                    this.setElement(_.result(this, 'el'), false);
                }
            },

            onChatBoxAdded: function (item) {
                // Views aren't created here, since the core code doesn't
                // contain any views. Instead, they're created in overrides in
                // plugins, such as in converse-chatview.js and converse-muc.js
                return this.get(item.get('id'));
            },

            removeChat: function (item) {
                this.remove(item.get('id'));
            },

            closeAllChatBoxes: function () {
                /* This method gets overridden in src/converse-controlbox.js if
                 * the controlbox plugin is active.
                 */
                this.each(function (view) { view.close(); });
                return this;
            },

            chatBoxMayBeShown: function (chatbox) {
                return this.model.chatBoxMayBeShown(chatbox);
            },

            getChatBox: function (attrs, create) {
                var chatbox  = this.model.get(attrs.jid);
                if (!chatbox && create) {
                    chatbox = this.model.create(attrs, {
                        'error': function (model, response) {
                            converse.log(response.responseText);
                        }
                    });
                }
                return chatbox;
            },

            showChat: function (attrs) {
                /* Find the chat box and show it (if it may be shown).
                 * If it doesn't exist, create it.
                 */
                var chatbox = this.getChatBox(attrs, true);
                if (this.chatBoxMayBeShown(chatbox)) {
                    chatbox.trigger('show', true);
                }
                return chatbox;
            }
        });


        this.XMPPStatus = Backbone.Model.extend({
            initialize: function () {
                this.set({
                    'status' : this.getStatus()
                });
                this.on('change', function (item) {
                    if (_.has(item.changed, 'status')) {
                        converse.emit('statusChanged', this.get('status'));
                    }
                    if (_.has(item.changed, 'status_message')) {
                        converse.emit('statusMessageChanged', this.get('status_message'));
                    }
                }.bind(this));
            },

            constructPresence: function (type, status_message) {
                var presence;
                type = typeof type === 'string' ? type : (this.get('status') || converse.default_state);
                status_message = typeof status_message === 'string' ? status_message : undefined;
                // Most of these presence types are actually not explicitly sent,
                // but I add all of them here for reference and future proofing.
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
                } else if (type === 'online') {
                    presence = $pres();
                } else {
                    presence = $pres().c('show').t(type).up();
                }
                if (status_message) {
                    presence.c('status').t(status_message);
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
                return this.get('status') || converse.default_state;
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
                    b64_sha1('converse.features'+converse.bare_jid)
                );
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
                converse.emit('serviceDiscovered', feature);
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
                converse.connection.disco.addFeature(Strophe.NS.BOSH);
                converse.connection.disco.addFeature(Strophe.NS.CHATSTATES);
                converse.connection.disco.addFeature(Strophe.NS.DISCO_INFO);
                converse.connection.disco.addFeature(Strophe.NS.ROSTERX); // Limited support
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
            Strophe.log = function (level, msg) {
                converse.log(msg, level);
            };
            if (this.debug) {
                this.connection.xmlInput = function (body) { converse.log(body.outerHTML); };
                this.connection.xmlOutput = function (body) { converse.log(body.outerHTML); };
            }
        };

        this.fetchLoginCredentials = function () {
            var deferred = new $.Deferred();
            $.ajax({
                url:  converse.credentials_url,
                type: 'GET',
                dataType: "json",
                success: function (response) {
                    deferred.resolve({
                        'jid': response.jid,
                        'password': response.password
                    });
                },
                error: function (response) {
                    delete converse.connection;
                    converse.emit('noResumeableSession');
                    deferred.reject(response);
                }
            });
            return deferred.promise();
        };

        this.startNewBOSHSession = function () {
            var that = this;
            $.ajax({
                url:  this.prebind_url,
                type: 'GET',
                dataType: "json",
                success: function (response) {
                    that.connection.attach(
                            response.jid,
                            response.sid,
                            response.rid,
                            that.onConnectStatusChanged
                    );
                },
                error: function (response) {
                    delete that.connection;
                    that.emit('noResumeableSession');
                }
            });
        };

        this.attemptPreboundSession = function (reconnecting) {
            /* Handle session resumption or initialization when prebind is being used.
             */
            if (!reconnecting && this.keepalive) {
                if (!this.jid) {
                    throw new Error("attemptPreboundSession: when using 'keepalive' with 'prebind, "+
                                    "you must supply the JID of the current user.");
                }
                try {
                    return this.connection.restore(this.jid, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session for jid: "+this.jid+" Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            }

            // No keepalive, or session resumption has failed.
            if (!reconnecting && this.jid && this.sid && this.rid) {
                return this.connection.attach(this.jid, this.sid, this.rid, this.onConnectStatusChanged);
            } else if (this.prebind_url) {
                return this.startNewBOSHSession();
            } else {
                throw new Error("attemptPreboundSession: If you use prebind and not keepalive, "+
                    "then you MUST supply JID, RID and SID values or a prebind_url.");
            }
        };

        this.autoLogin = function (credentials) {
            if (credentials) {
                // If passed in, then they come from credentials_url, so we
                // set them on the converse object.
                this.jid = credentials.jid;
                this.password = credentials.password;
            }
            if (this.authentication === converse.ANONYMOUS) {
                if (!this.jid) {
                    throw new Error("Config Error: when using anonymous login " +
                        "you need to provide the server's domain via the 'jid' option. " +
                        "Either when calling converse.initialize, or when calling " +
                        "converse.user.login.");
                }
                this.connection.connect(this.jid.toLowerCase(), null, this.onConnectStatusChanged);
            } else if (this.authentication === converse.LOGIN) {
                var password = converse.connection.pass || this.password;
                if (!password) {
                    if (this.auto_login && !this.password) {
                        throw new Error("initConnection: If you use auto_login and "+
                            "authentication='login' then you also need to provide a password.");
                    }
                    converse.disconnection_cause = Strophe.Status.AUTHFAIL;
                    converse.disconnect();
                    return;
                }
                var resource = Strophe.getResourceFromJid(this.jid);
                if (!resource) {
                    this.jid = this.jid.toLowerCase() + converse.generateResource();
                } else {
                    this.jid = Strophe.getBareJidFromJid(this.jid).toLowerCase()+'/'+resource;
                }
                this.connection.connect(this.jid, password, this.onConnectStatusChanged);
            }
        };

        this.attemptNonPreboundSession = function (credentials, reconnecting) {
            /* Handle session resumption or initialization when prebind is not being used.
             *
             * Two potential options exist and are handled in this method:
             *  1. keepalive
             *  2. auto_login
             */
            if (this.keepalive && !reconnecting) {
                try {
                    return this.connection.restore(this.jid, this.onConnectStatusChanged);
                } catch (e) {
                    this.log("Could not restore session. Error message: "+e.message);
                    this.clearSession(); // If there's a roster, we want to clear it (see #555)
                }
            }
            if (this.auto_login) {
                if (credentials) {
                    // When credentials are passed in, they override prebinding
                    // or credentials fetching via HTTP
                    this.autoLogin(credentials);
                } else if (this.credentials_url) {
                    this.fetchLoginCredentials().done(this.autoLogin.bind(this));
                } else if (!this.jid) {
                    throw new Error(
                        "initConnection: If you use auto_login, you also need"+
                        "to give either a jid value (and if applicable a "+
                        "password) or you need to pass in a URL from where the "+
                        "username and password can be fetched (via credentials_url)."
                    );
                } else {
                    // Probably ANONYMOUS login
                    this.autoLogin();
                }
            } else if (reconnecting) {
                this.autoLogin();
            }
        };

        this.logIn = function (credentials, reconnecting) {
            // We now try to resume or automatically set up a new session.
            // Otherwise the user will be shown a login form.
            if (this.authentication === converse.PREBIND) {
                this.attemptPreboundSession(reconnecting);
            } else {
                this.attemptNonPreboundSession(credentials, reconnecting);
            }
        };

        this.initConnection = function () {
            if (this.connection) {
                return;
            }
            if (!this.bosh_service_url && ! this.websocket_url) {
                throw new Error("initConnection: you must supply a value for either the bosh_service_url or websocket_url or both.");
            }
            if (('WebSocket' in window || 'MozWebSocket' in window) && this.websocket_url) {
                this.connection = new Strophe.Connection(this.websocket_url, this.connection_options);
            } else if (this.bosh_service_url) {
                this.connection = new Strophe.Connection(
                    this.bosh_service_url,
                    _.assignIn(this.connection_options, {'keepalive': this.keepalive})
                );
            } else {
                throw new Error("initConnection: this browser does not support websockets and bosh_service_url wasn't specified.");
            }
        };

        this._tearDown = function () {
            /* Remove those views which are only allowed with a valid
             * connection.
             */
            this.unregisterPresenceHandler();
            if (this.roster) {
                this.roster.off().reset(); // Removes roster contacts
            }
            this.chatboxes.remove(); // Don't call off(), events won't get re-registered upon reconnect.
            if (this.features) {
                this.features.reset();
            }
            $(window).off('click mousemove keypress focus'+unloadevent, converse.onUserActivity);
            window.clearInterval(converse.everySecondTrigger);
            return this;
        };

        this.initChatBoxes = function () {
            this.chatboxes = new this.ChatBoxes();
            this.chatboxviews = new this.ChatBoxViews({model: this.chatboxes});
        };

        this._initialize = function () {
            this.initChatBoxes();
            this.initSession();
            this.initConnection();
            this.setUpXMLLogging();
            this.logIn();
            return this;
        };

        // Initialization
        // --------------
        // This is the end of the initialize method.
        if (settings.connection) {
            this.connection = settings.connection;
        }
        var updateSettings = function (settings) {
            /* Helper method which gets put on the plugin and allows it to
             * add more user-facing config settings to converse.js.
             */
            utils.merge(converse.default_settings, settings);
            utils.merge(converse, settings);
            utils.applyUserSettings(converse, settings, converse.user_settings);
        };

        // If initialize gets called a second time (e.g. during tests), then we
        // need to re-apply all plugins (for a new converse instance), and we
        // therefore need to clear this array that prevents plugins from being
        // initialized twice.
        // If initialize is called for the first time, then this array is empty
        // in any case.
        converse.pluggable.initialized_plugins = [];

        converse.pluggable.initializePlugins({
            'updateSettings': updateSettings,
            'converse': converse
        });
        converse.emit('pluginsInitialized');
        converse._initialize();
        converse.registerGlobalEventHandlers();

        if (!_.isUndefined(converse.connection) &&
            converse.connection.service === 'jasmine tests') {
            return converse;
        } else {
            return init_deferred.promise();
        }
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
(function (root, factory) {
    define("converse-api", [
            "jquery",
            "lodash",
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
            return converse.initialize(settings, callback);
        },
        'log': converse.log,
        'connection': {
            'connected': function () {
                return converse.connection && converse.connection.connected || false;
            },
            'disconnect': function () {
                converse.connection.disconnect();
            },
        },
        'user': {
            'jid': function () {
                return converse.connection.jid;
            },
            'login': function (credentials) {
                converse.initConnection();
                converse.logIn(credentials);
            },
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
                    converse.xmppstatus.sendPresence(value);
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
                    _.assignIn(converse, _.pick(key, Object.keys(converse.default_settings)));
                } else if (typeof key === "string") {
                    o[key] = val;
                    _.assignIn(converse, _.pick(o, Object.keys(converse.default_settings)));
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
                    chatbox = converse.wrappedChatBox(
                        converse.chatboxes.getChatBox(jids, true).trigger('show')
                    );
                    return chatbox;
                }
                return _.map(jids, function (jid) {
                    chatbox = converse.wrappedChatBox(
                        converse.chatboxes.getChatBox(jid, true).trigger('show')
                    );
                    return chatbox;
                });
            },
            'get': function (jids) {
                if (typeof jids === "undefined") {
                    var result = [];
                    converse.chatboxes.each(function (chatbox) {
                        // FIXME: Leaky abstraction from MUC. We need to add a
                        // base type for chat boxes, and check for that.
                        if (chatbox.get('type') !== 'chatroom') {
                            result.push(converse.wrappedChatBox(chatbox));
                        }
                    });
                    return result;
                } else if (typeof jids === "string") {
                    return converse.wrappedChatBox(converse.chatboxes.getChatBox(jids));
                }
                return _.map(jids,
                    _.partial(
                        _.compose(
                            converse.wrappedChatBox.bind(converse), converse.chatboxes.getChatBox.bind(converse.chatboxes)
                        ), _, true
                    )
                );
            }
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
            'once': function (evt, handler, context) {
                converse.once(evt, handler, context);
            },
            'on': function (evt, handler, context) {
                converse.on(evt, handler, context);
            },
            'not': function (evt, handler) {
                converse.off(evt, handler);
            },
            'stanza': function (name, options, handler) {
                if (typeof options === 'function') {
                    handler = options;
                    options = {};
                } else {
                    options = options || {};
                }
                converse.connection.addHandler(
                    handler,
                    options.ns,
                    name,
                    options.type,
                    options.id,
                    options.from,
                    options
                );
            },
        },
        'send': function (stanza) {
            converse.connection.send(stanza);
        },
        'plugins': {
            'add': function (name, plugin) {
                plugin.__name__ = name;
                converse.pluggable.plugins[name] = plugin;
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
                 * available via the __super__ attribute.
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
                 * on the __super__ attribute of the object being overridden.
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


define('text!ca',[],function () { return '{\n   "domain": "converse",\n   "locale_data": {\n      "converse": {\n         "": {\n            "domain": "converse",\n            "plural_forms": "nplurals=2; plural=(n != 1);",\n            "lang": "ca"\n         },\n         "Bookmark this room": [\n            null,\n            ""\n         ],\n         "The name for this bookmark:": [\n            null,\n            ""\n         ],\n         "Would you like this room to be automatically joined upon startup?": [\n            null,\n            ""\n         ],\n         "What should your nickname for this room be?": [\n            null,\n            ""\n         ],\n         "Save": [\n            null,\n            "Desa"\n         ],\n         "Cancel": [\n            null,\n            "Cancel·la"\n         ],\n         "Bookmarked Rooms": [\n            null,\n            ""\n         ],\n         "Click to open this room": [\n            null,\n            "Feu clic per obrir aquesta sala"\n         ],\n         "Show more information on this room": [\n            null,\n            "Mostra més informació d\'aquesta sala"\n         ],\n         "Remove this bookmark": [\n            null,\n            ""\n         ],\n         "Close this chat box": [\n            null,\n            "Tanca aquest quadre del xat"\n         ],\n         "Personal message": [\n            null,\n            "Missatge personal"\n         ],\n         "me": [\n            null,\n            "jo"\n         ],\n         "A very large message has been received.This might be due to an attack meant to degrade the chat performance.Output has been shortened.": [\n            null,\n            ""\n         ],\n         "is typing": [\n            null,\n            "està escrivint"\n         ],\n         "has stopped typing": [\n            null,\n            "ha deixat d\'escriure"\n         ],\n         "has gone away": [\n            null,\n            "ha marxat"\n         ],\n         "Show this menu": [\n            null,\n            "Mostra aquest menú"\n         ],\n         "Write in the third person": [\n            null,\n            "Escriu en tercera persona"\n         ],\n         "Remove messages": [\n            null,\n            "Elimina els missatges"\n         ],\n         "Are you sure you want to clear the messages from this chat box?": [\n            null,\n            "Segur que voleu esborrar els missatges d\'aquest quadre del xat?"\n         ],\n         "has gone offline": [\n            null,\n            "s\'ha desconnectat"\n         ],\n         "is busy": [\n            null,\n            "està ocupat"\n         ],\n         "Clear all messages": [\n            null,\n            "Esborra tots els missatges"\n         ],\n         "Insert a smiley": [\n            null,\n            "Insereix una cara somrient"\n         ],\n         "Start a call": [\n            null,\n            "Inicia una trucada"\n         ],\n         "Contacts": [\n            null,\n            "Contactes"\n         ],\n         "XMPP Username:": [\n            null,\n            "Nom d\'usuari XMPP:"\n         ],\n         "Password:": [\n            null,\n            "Contrasenya:"\n         ],\n         "Click here to log in anonymously": [\n            null,\n            "Feu clic aquí per iniciar la sessió de manera anònima"\n         ],\n         "Log In": [\n            null,\n            "Inicia la sessió"\n         ],\n         "user@server": [\n            null,\n            "usuari@servidor"\n         ],\n         "password": [\n            null,\n            "contrasenya"\n         ],\n         "Sign in": [\n            null,\n            "Inicia la sessió"\n         ],\n         "I am %1$s": [\n            null,\n            "Estic %1$s"\n         ],\n         "Click here to write a custom status message": [\n            null,\n            "Feu clic aquí per escriure un missatge d\'estat personalitzat"\n         ],\n         "Click to change your chat status": [\n            null,\n            "Feu clic per canviar l\'estat del xat"\n         ],\n         "Custom status": [\n            null,\n            "Estat personalitzat"\n         ],\n         "online": [\n            null,\n            "en línia"\n         ],\n         "busy": [\n            null,\n            "ocupat"\n         ],\n         "away for long": [\n            null,\n            "absent durant una estona"\n         ],\n         "away": [\n            null,\n            "absent"\n         ],\n         "offline": [\n            null,\n            "desconnectat"\n         ],\n         "Online": [\n            null,\n            "En línia"\n         ],\n         "Busy": [\n            null,\n            "Ocupat"\n         ],\n         "Away": [\n            null,\n            "Absent"\n         ],\n         "Offline": [\n            null,\n            "Desconnectat"\n         ],\n         "Log out": [\n            null,\n            "Tanca la sessió"\n         ],\n         "Contact name": [\n            null,\n            "Nom del contacte"\n         ],\n         "Search": [\n            null,\n            "Cerca"\n         ],\n         "Add": [\n            null,\n            "Afegeix"\n         ],\n         "Click to add new chat contacts": [\n            null,\n            "Feu clic per afegir contactes nous al xat"\n         ],\n         "Add a contact": [\n            null,\n            "Afegeix un contacte"\n         ],\n         "No users found": [\n            null,\n            "No s\'ha trobat cap usuari"\n         ],\n         "Click to add as a chat contact": [\n            null,\n            "Feu clic per afegir com a contacte del xat"\n         ],\n         "Toggle chat": [\n            null,\n            "Canvia de xat"\n         ],\n         "Click to hide these contacts": [\n            null,\n            "Feu clic per amagar aquests contactes"\n         ],\n         "The connection has dropped, attempting to reconnect.": [\n            null,\n            ""\n         ],\n         "Connecting": [\n            null,\n            "S\'està establint la connexió"\n         ],\n         "Authenticating": [\n            null,\n            "S\'està efectuant l\'autenticació"\n         ],\n         "Authentication Failed": [\n            null,\n            "Error d\'autenticació"\n         ],\n         "Disconnected": [\n            null,\n            ""\n         ],\n         "The connection to the chat server has dropped": [\n            null,\n            ""\n         ],\n         "Sorry, there was an error while trying to add ": [\n            null,\n            "S\'ha produït un error en intentar afegir "\n         ],\n         "This client does not allow presence subscriptions": [\n            null,\n            "Aquest client no admet les subscripcions de presència"\n         ],\n         "Minimize this chat box": [\n            null,\n            "Minimitza aquest quadre del xat"\n         ],\n         "Click to restore this chat": [\n            null,\n            "Feu clic per restaurar aquest xat"\n         ],\n         "Minimized": [\n            null,\n            "Minimitzat"\n         ],\n         "This room is not anonymous": [\n            null,\n            "Aquesta sala no és anònima"\n         ],\n         "This room now shows unavailable members": [\n            null,\n            "Aquesta sala ara mostra membres no disponibles"\n         ],\n         "This room does not show unavailable members": [\n            null,\n            "Aquesta sala no mostra membres no disponibles"\n         ],\n         "Room logging is now enabled": [\n            null,\n            "El registre de la sala està habilitat"\n         ],\n         "Room logging is now disabled": [\n            null,\n            "El registre de la sala està deshabilitat"\n         ],\n         "This room is now semi-anonymous": [\n            null,\n            "Aquesta sala ara és parcialment anònima"\n         ],\n         "This room is now fully-anonymous": [\n            null,\n            "Aquesta sala ara és totalment anònima"\n         ],\n         "A new room has been created": [\n            null,\n            "S\'ha creat una sala nova"\n         ],\n         "You have been banned from this room": [\n            null,\n            "Se us ha expulsat d\'aquesta sala"\n         ],\n         "You have been kicked from this room": [\n            null,\n            "Se us ha expulsat d\'aquesta sala"\n         ],\n         "You have been removed from this room because of an affiliation change": [\n            null,\n            "Se us ha eliminat d\'aquesta sala a causa d\'un canvi d\'afiliació"\n         ],\n         "You have been removed from this room because the room has changed to members-only and you\'re not a member": [\n            null,\n            "Se us ha eliminat d\'aquesta sala perquè ara només permet membres i no en sou membre"\n         ],\n         "You have been removed from this room because the MUC (Multi-user chat) service is being shut down.": [\n            null,\n            "Se us ha eliminat d\'aquesta sala perquè s\'està tancant el servei MUC (xat multiusuari)."\n         ],\n         "<strong>%1$s</strong> has been banned": [\n            null,\n            "S\'ha expulsat <strong>%1$s</strong>"\n         ],\n         "<strong>%1$s</strong>\'s nickname has changed": [\n            null,\n            "L\'àlies de <strong>%1$s</strong> ha canviat"\n         ],\n         "<strong>%1$s</strong> has been kicked out": [\n            null,\n            "S\'ha expulsat <strong>%1$s</strong>"\n         ],\n         "<strong>%1$s</strong> has been removed because of an affiliation change": [\n            null,\n            "S\'ha eliminat <strong>%1$s</strong> a causa d\'un canvi d\'afiliació"\n         ],\n         "<strong>%1$s</strong> has been removed for not being a member": [\n            null,\n            "S\'ha eliminat <strong>%1$s</strong> perquè no és membre"\n         ],\n         "Your nickname has been changed to: <strong>%1$s</strong>": [\n            null,\n            "El vostre àlies ha canviat a: <strong>%1$s</strong>"\n         ],\n         "Message": [\n            null,\n            "Missatge"\n         ],\n         "Hide the list of occupants": [\n            null,\n            "Amaga la llista d\'ocupants"\n         ],\n         "Error: the \\"": [\n            null,\n            "Error: el \\""\n         ],\n         "Are you sure you want to clear the messages from this room?": [\n            null,\n            "Segur que voleu esborrar els missatges d\'aquesta sala?"\n         ],\n         "Error: could not execute the command": [\n            null,\n            "Error: no s\'ha pogut executar l\'ordre"\n         ],\n         "Change user\'s affiliation to admin": [\n            null,\n            "Canvia l\'afiliació de l\'usuari a administrador"\n         ],\n         "Ban user from room": [\n            null,\n            "Expulsa l\'usuari de la sala"\n         ],\n         "Change user role to occupant": [\n            null,\n            "Canvia el rol de l\'usuari a ocupant"\n         ],\n         "Kick user from room": [\n            null,\n            "Expulsa l\'usuari de la sala"\n         ],\n         "Write in 3rd person": [\n            null,\n            "Escriu en tercera persona"\n         ],\n         "Grant membership to a user": [\n            null,\n            "Atorga una afiliació a un usuari"\n         ],\n         "Remove user\'s ability to post messages": [\n            null,\n            "Elimina la capacitat de l\'usuari de publicar missatges"\n         ],\n         "Change your nickname": [\n            null,\n            "Canvieu el vostre àlies"\n         ],\n         "Grant moderator role to user": [\n            null,\n            "Atorga el rol de moderador a l\'usuari"\n         ],\n         "Grant ownership of this room": [\n            null,\n            "Atorga la propietat d\'aquesta sala"\n         ],\n         "Revoke user\'s membership": [\n            null,\n            "Revoca l\'afiliació de l\'usuari"\n         ],\n         "Set room topic": [\n            null,\n            "Defineix un tema per a la sala"\n         ],\n         "Allow muted user to post messages": [\n            null,\n            "Permet que un usuari silenciat publiqui missatges"\n         ],\n         "The nickname you chose is reserved or currently in use, please choose a different one.": [\n            null,\n            ""\n         ],\n         "Nickname": [\n            null,\n            "Àlies"\n         ],\n         "This chatroom requires a password": [\n            null,\n            "Aquesta sala de xat requereix una contrasenya"\n         ],\n         "Password: ": [\n            null,\n            "Contrasenya:"\n         ],\n         "Submit": [\n            null,\n            "Envia"\n         ],\n         "The reason given is: \\"": [\n            null,\n            "El motiu indicat és: \\""\n         ],\n         "You are not on the member list of this room": [\n            null,\n            "No sou a la llista de membres d\'aquesta sala"\n         ],\n         "No nickname was specified": [\n            null,\n            "No s\'ha especificat cap àlies"\n         ],\n         "You are not allowed to create new rooms": [\n            null,\n            "No teniu permís per crear sales noves"\n         ],\n         "Your nickname doesn\'t conform to this room\'s policies": [\n            null,\n            "El vostre àlies no s\'ajusta a les polítiques d\'aquesta sala"\n         ],\n         "This room does not (yet) exist": [\n            null,\n            "Aquesta sala (encara) no existeix"\n         ],\n         "Topic set by %1$s to: %2$s": [\n            null,\n            "Tema definit per %1$s en: %2$s"\n         ],\n         "Occupants": [\n            null,\n            "Ocupants"\n         ],\n         "You are about to invite %1$s to the chat room \\"%2$s\\". ": [\n            null,\n            "Esteu a punt de convidar %1$s a la sala de xat \\"%2$s\\". "\n         ],\n         "You may optionally include a message, explaining the reason for the invitation.": [\n            null,\n            "Teniu l\'opció d\'incloure un missatge per explicar el motiu de la invitació."\n         ],\n         "Room name": [\n            null,\n            "Nom de la sala"\n         ],\n         "Server": [\n            null,\n            "Servidor"\n         ],\n         "Join Room": [\n            null,\n            "Uneix-me a la sala"\n         ],\n         "Show rooms": [\n            null,\n            "Mostra les sales"\n         ],\n         "Rooms": [\n            null,\n            "Sales"\n         ],\n         "No rooms on %1$s": [\n            null,\n            "No hi ha cap sala a %1$s"\n         ],\n         "Rooms on %1$s": [\n            null,\n            "Sales a %1$s"\n         ],\n         "Description:": [\n            null,\n            "Descripció:"\n         ],\n         "Occupants:": [\n            null,\n            "Ocupants:"\n         ],\n         "Features:": [\n            null,\n            "Característiques:"\n         ],\n         "Requires authentication": [\n            null,\n            "Cal autenticar-se"\n         ],\n         "Hidden": [\n            null,\n            "Amagat"\n         ],\n         "Requires an invitation": [\n            null,\n            "Cal tenir una invitació"\n         ],\n         "Moderated": [\n            null,\n            "Moderada"\n         ],\n         "Non-anonymous": [\n            null,\n            "No és anònima"\n         ],\n         "Open room": [\n            null,\n            "Obre la sala"\n         ],\n         "Permanent room": [\n            null,\n            "Sala permanent"\n         ],\n         "Public": [\n            null,\n            "Pública"\n         ],\n         "Semi-anonymous": [\n            null,\n            "Semianònima"\n         ],\n         "Temporary room": [\n            null,\n            "Sala temporal"\n         ],\n         "Unmoderated": [\n            null,\n            "No moderada"\n         ],\n         "%1$s has invited you to join a chat room: %2$s": [\n            null,\n            "%1$s us ha convidat a unir-vos a una sala de xat: %2$s"\n         ],\n         "%1$s has invited you to join a chat room: %2$s, and left the following reason: \\"%3$s\\"": [\n            null,\n            "%1$s us ha convidat a unir-vos a una sala de xat (%2$s) i ha deixat el següent motiu: \\"%3$s\\""\n         ],\n         "Notification from %1$s": [\n            null,\n            ""\n         ],\n         "%1$s says": [\n            null,\n            ""\n         ],\n         "wants to be your contact": [\n            null,\n            ""\n         ],\n         "Re-establishing encrypted session": [\n            null,\n            "S\'està tornant a establir la sessió xifrada"\n         ],\n         "Generating private key.": [\n            null,\n            "S\'està generant la clau privada"\n         ],\n         "Your browser might become unresponsive.": [\n            null,\n            "És possible que el navegador no respongui."\n         ],\n         "Authentication request from %1$s\\n\\nYour chat contact is attempting to verify your identity, by asking you the question below.\\n\\n%2$s": [\n            null,\n            "Sol·licitud d\'autenticació de %1$s\\n\\nEl contacte del xat està intentant verificar la vostra identitat mitjançant la pregunta següent.\\n\\n%2$s"\n         ],\n         "Could not verify this user\'s identify.": [\n            null,\n            "No s\'ha pogut verificar la identitat d\'aquest usuari."\n         ],\n         "Exchanging private key with contact.": [\n            null,\n            "S\'està intercanviant la clau privada amb el contacte."\n         ],\n         "Your messages are not encrypted anymore": [\n            null,\n            "Els vostres missatges ja no estan xifrats"\n         ],\n         "Your messages are now encrypted but your contact\'s identity has not been verified.": [\n            null,\n            "Ara, els vostres missatges estan xifrats, però no s\'ha verificat la identitat del contacte."\n         ],\n         "Your contact\'s identify has been verified.": [\n            null,\n            "S\'ha verificat la identitat del contacte."\n         ],\n         "Your contact has ended encryption on their end, you should do the same.": [\n            null,\n            "El contacte ha conclòs el xifratge; cal que feu el mateix."\n         ],\n         "Your message could not be sent": [\n            null,\n            "No s\'ha pogut enviar el missatge"\n         ],\n         "We received an unencrypted message": [\n            null,\n            "Hem rebut un missatge sense xifrar"\n         ],\n         "We received an unreadable encrypted message": [\n            null,\n            "Hem rebut un missatge xifrat il·legible"\n         ],\n         "Here are the fingerprints, please confirm them with %1$s, outside of this chat.\\n\\nFingerprint for you, %2$s: %3$s\\n\\nFingerprint for %1$s: %4$s\\n\\nIf you have confirmed that the fingerprints match, click OK, otherwise click Cancel.": [\n            null,\n            "Aquí es mostren les empremtes. Confirmeu-les amb %1$s fora d\'aquest xat.\\n\\nEmpremta de l\'usuari %2$s: %3$s\\n\\nEmpremta de %1$s: %4$s\\n\\nSi heu confirmat que les empremtes coincideixen, feu clic a D\'acord; en cas contrari, feu clic a Cancel·la."\n         ],\n         "You will be prompted to provide a security question and then an answer to that question.\\n\\nYour contact will then be prompted the same question and if they type the exact same answer (case sensitive), their identity will be verified.": [\n            null,\n            "Se us demanarà que indiqueu una pregunta de seguretat i la resposta corresponent.\\n\\nEs farà la mateixa pregunta al vostre contacte i, si escriu exactament la mateixa resposta (es distingeix majúscules de minúscules), se\'n verificarà la identitat."\n         ],\n         "What is your security question?": [\n            null,\n            "Quina és la vostra pregunta de seguretat?"\n         ],\n         "What is the answer to the security question?": [\n            null,\n            "Quina és la resposta a la pregunta de seguretat?"\n         ],\n         "Invalid authentication scheme provided": [\n            null,\n            "S\'ha indicat un esquema d\'autenticació no vàlid"\n         ],\n         "Your messages are not encrypted. Click here to enable OTR encryption.": [\n            null,\n            "Els vostres missatges no estan xifrats. Feu clic aquí per habilitar el xifratge OTR."\n         ],\n         "Your messages are encrypted, but your contact has not been verified.": [\n            null,\n            "Els vostres missatges estan xifrats, però no s\'ha verificat el contacte."\n         ],\n         "Your messages are encrypted and your contact verified.": [\n            null,\n            "Els vostres missatges estan xifrats i s\'ha verificat el contacte."\n         ],\n         "Your contact has closed their end of the private session, you should do the same": [\n            null,\n            "El vostre contacte ha tancat la seva sessió privada; cal que feu el mateix."\n         ],\n         "End encrypted conversation": [\n            null,\n            "Finalitza la conversa xifrada"\n         ],\n         "Refresh encrypted conversation": [\n            null,\n            "Actualitza la conversa xifrada"\n         ],\n         "Start encrypted conversation": [\n            null,\n            "Comença la conversa xifrada"\n         ],\n         "Verify with fingerprints": [\n            null,\n            "Verifica amb empremtes"\n         ],\n         "Verify with SMP": [\n            null,\n            "Verifica amb SMP"\n         ],\n         "What\'s this?": [\n            null,\n            "Què és això?"\n         ],\n         "unencrypted": [\n            null,\n            "sense xifrar"\n         ],\n         "unverified": [\n            null,\n            "sense verificar"\n         ],\n         "verified": [\n            null,\n            "verificat"\n         ],\n         "finished": [\n            null,\n            "acabat"\n         ],\n         " e.g. conversejs.org": [\n            null,\n            "p. ex. conversejs.org"\n         ],\n         "Your XMPP provider\'s domain name:": [\n            null,\n            "Nom de domini del vostre proveïdor XMPP:"\n         ],\n         "Fetch registration form": [\n            null,\n            "Obtingues un formulari de registre"\n         ],\n         "Tip: A list of public XMPP providers is available": [\n            null,\n            "Consell: hi ha disponible una llista de proveïdors XMPP públics"\n         ],\n         "here": [\n            null,\n            "aquí"\n         ],\n         "Register": [\n            null,\n            "Registre"\n         ],\n         "Sorry, the given provider does not support in band account registration. Please try with a different provider.": [\n            null,\n            "El proveïdor indicat no admet el registre del compte. Proveu-ho amb un altre proveïdor."\n         ],\n         "Requesting a registration form from the XMPP server": [\n            null,\n            "S\'està sol·licitant un formulari de registre del servidor XMPP"\n         ],\n         "Something went wrong while establishing a connection with \\"%1$s\\". Are you sure it exists?": [\n            null,\n            "Ha passat alguna cosa mentre s\'establia la connexió amb \\"%1$s\\". Segur que existeix?"\n         ],\n         "Now logging you in": [\n            null,\n            "S\'està iniciant la vostra sessió"\n         ],\n         "Registered successfully": [\n            null,\n            "Registre correcte"\n         ],\n         "Return": [\n            null,\n            "Torna"\n         ],\n         "The provider rejected your registration attempt. Please check the values you entered for correctness.": [\n            null,\n            "El proveïdor ha rebutjat l\'intent de registre. Comproveu que els valors que heu introduït siguin correctes."\n         ],\n         "This contact is busy": [\n            null,\n            "Aquest contacte està ocupat"\n         ],\n         "This contact is online": [\n            null,\n            "Aquest contacte està en línia"\n         ],\n         "This contact is offline": [\n            null,\n            "Aquest contacte està desconnectat"\n         ],\n         "This contact is unavailable": [\n            null,\n            "Aquest contacte no està disponible"\n         ],\n         "This contact is away for an extended period": [\n            null,\n            "Aquest contacte està absent durant un període prolongat"\n         ],\n         "This contact is away": [\n            null,\n            "Aquest contacte està absent"\n         ],\n         "Groups": [\n            null,\n            "Grups"\n         ],\n         "My contacts": [\n            null,\n            "Els meus contactes"\n         ],\n         "Pending contacts": [\n            null,\n            "Contactes pendents"\n         ],\n         "Contact requests": [\n            null,\n            "Sol·licituds de contacte"\n         ],\n         "Ungrouped": [\n            null,\n            "Sense agrupar"\n         ],\n         "Filter": [\n            null,\n            ""\n         ],\n         "State": [\n            null,\n            ""\n         ],\n         "Any": [\n            null,\n            ""\n         ],\n         "Chatty": [\n            null,\n            ""\n         ],\n         "Extended Away": [\n            null,\n            ""\n         ],\n         "Click to remove this contact": [\n            null,\n            "Feu clic per eliminar aquest contacte"\n         ],\n         "Click to accept this contact request": [\n            null,\n            "Feu clic per acceptar aquesta sol·licitud de contacte"\n         ],\n         "Click to decline this contact request": [\n            null,\n            "Feu clic per rebutjar aquesta sol·licitud de contacte"\n         ],\n         "Click to chat with this contact": [\n            null,\n            "Feu clic per conversar amb aquest contacte"\n         ],\n         "Name": [\n            null,\n            "Nom"\n         ],\n         "Are you sure you want to remove this contact?": [\n            null,\n            "Segur que voleu eliminar aquest contacte?"\n         ],\n         "Sorry, there was an error while trying to remove ": [\n            null,\n            "S\'ha produït un error en intentar eliminar "\n         ],\n         "Are you sure you want to decline this contact request?": [\n            null,\n            "Segur que voleu rebutjar aquesta sol·licitud de contacte?"\n         ]\n      }\n   }\n}';});


define('tpl!chatbox', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head chat-head-chatbox">\n        <a class="chatbox-btn close-chatbox-button icon-close" title="'+
((__t=(info_close))==null?'':__t)+
'"></a>\n        <div class="chat-title">\n            ';
 if (url) { 
__p+='\n                <a href="'+
((__t=(url))==null?'':__t)+
'" target="_blank" rel="noopener" class="user">\n            ';
 } 
__p+='\n                    '+
((__t=( title ))==null?'':__t)+
'\n            ';
 if (url) { 
__p+='\n                </a>\n            ';
 } 
__p+='\n            <p class="user-custom-message"><p/>\n        </div>\n    </div>\n    <div class="chat-body">\n        <div class="chat-content"></div>\n        <div class="new-msgs-indicator hidden">▼ '+
((__t=( unread_msgs ))==null?'':__t)+
' ▼</div>\n        ';
 if (show_textarea) { 
__p+='\n        <form class="sendXMPPMessage" action="" method="post">\n            ';
 if (show_toolbar) { 
__p+='\n                <ul class="chat-toolbar no-text-select"></ul>\n            ';
 } 
__p+='\n        <textarea\n            type="text"\n            class="chat-textarea"\n            placeholder="'+
((__t=(label_personal_message))==null?'':__t)+
'"/>\n        </form>\n        ';
 } 
__p+='\n    </div>\n</div>\n';
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
' </span>\n    <span class="chat-msg-content"><!-- message gets added here via renderMessage --></span>\n</div>\n';
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
':&nbsp;</span>\n    <span class="chat-msg-content"><!-- message gets added here via renderMessage --></span>\n</div>\n';
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
 if (show_clear_button)  { 
__p+='\n<li class="toggle-clear"><a class="icon-remove" title="'+
((__t=(label_clear))==null?'':__t)+
'"></a></li>\n';
 } 
__p+='\n';
}
return __p;
}; });


define('tpl!avatar', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<canvas height="32px" width="32px" class="avatar"></canvas>\n';
}
return __p;
}; });

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define("converse-chatview", [
            "converse-core",
            "converse-api",
            "tpl!chatbox",
            "tpl!new_day",
            "tpl!action",
            "tpl!message",
            "tpl!toolbar",
            "tpl!avatar"
    ], factory);
}(this, function (
            converse,
            converse_api,
            tpl_chatbox,
            tpl_new_day,
            tpl_action,
            tpl_message,
            tpl_toolbar,
            tpl_avatar
    ) {
    "use strict";
    converse.templates.chatbox = tpl_chatbox;
    converse.templates.new_day = tpl_new_day;
    converse.templates.action = tpl_action;
    converse.templates.message = tpl_message;
    converse.templates.toolbar = tpl_toolbar;
    converse.templates.avatar = tpl_avatar;

    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        $msg = converse_api.env.$msg,
        _ = converse_api.env._,
        __ = utils.__.bind(converse),
        moment = converse_api.env.moment;

    var KEY = {
        ENTER: 13,
        FORWARD_SLASH: 47
    };


    converse_api.plugins.add('converse-chatview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view) {
                        view = new converse.ChatBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                show_toolbar: true,
                chatview_avatar_width: 32,
                chatview_avatar_height: 32,
                visible_toolbar_buttons: {
                    'emoticons': true,
                    'call': false,
                    'clear': true
                },
            });

            converse.ChatBoxView = Backbone.View.extend({
                length: 200,
                tagName: 'div',
                className: 'chatbox hidden',
                is_chatroom: false,  // Leaky abstraction from MUC

                events: {
                    'click .close-chatbox-button': 'close',
                    'keypress .chat-textarea': 'keyPressed',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .new-msgs-indicator': 'viewUnreadMessages'
                },

                initialize: function () {
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    // TODO check for changed fullname as well
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:chat_status', this.onChatStatusChanged, this);
                    this.model.on('change:image', this.renderAvatar, this);
                    this.model.on('change:status', this.onStatusChanged, this);
                    this.model.on('showHelpMessages', this.showHelpMessages, this);
                    this.model.on('sendMessage', this.sendMessage, this);
                    this.render().fetchMessages().insertIntoDOM();
                    // XXX: adding the event below to the events map above doesn't work.
                    // The code that gets executed because of that looks like this:
                    //      this.$el.on('scroll', '.chat-content', this.markScrolled.bind(this));
                    // Which for some reason doesn't work.
                    // So working around that fact here:
                    this.$el.find('.chat-content').on('scroll', this.markScrolled.bind(this));
                    converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: converse.show_toolbar,
                                        show_textarea: true,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this chat box'),
                                        label_personal_message: __('Personal message')
                                    }
                                )
                            )
                        );
                    this.$content = this.$el.find('.chat-content');
                    this.renderToolbar().renderAvatar();
                    converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this.showStatusMessage();
                },

                afterMessagesFetched: function () {
                    // Provides a hook for plugins, such as converse-mam.
                    return;
                },

                fetchMessages: function () {
                    this.model.messages.fetch({
                        'add': true,
                        'success': this.afterMessagesFetched.bind(this)
                    });
                    return this;
                },

                insertIntoDOM: function () {
                    /* This method gets overridden in src/converse-controlbox.js if
                     * the controlbox plugin is active.
                     */
                    $('#conversejs').prepend(this.$el);
                    return this;
                },

                clearStatusNotification: function () {
                    this.$content.find('div.chat-event').remove();
                },

                showStatusNotification: function (message, keep_old, permanent) {
                    if (!keep_old) {
                        this.clearStatusNotification();
                    }
                    var $el = $('<div class="chat-info"></div>').text(message);
                    if (!permanent) {
                        $el.addClass('chat-event');
                    }
                    this.$content.append($el);
                    this.scrollDown();
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

                insertDayIndicator: function (date, prepend) {
                    /* Appends (or prepends if "prepend" is truthy) an indicator
                     * into the chat area, showing the day as given by the
                     * passed in date.
                     *
                     * Parameters:
                     *  (String) date - An ISO8601 date string.
                     */
                    var day_date = moment(date).startOf('day');
                    var insert = prepend ? this.$content.prepend: this.$content.append;
                    insert.call(this.$content, converse.templates.new_day({
                        isodate: day_date.format(),
                        datestring: day_date.format("dddd MMM Do YYYY")
                    }));
                },

                insertMessage: function (attrs, prepend) {
                    /* Helper method which appends a message (or prepends if the
                     * 2nd parameter is set to true) to the end of the chat box's
                     * content area.
                     *
                     * Parameters:
                     *  (Object) attrs: An object containing the message attributes.
                     */
                    var that = this;
                    var insert = prepend ? this.$content.prepend : this.$content.append;
                    _.compose(
                        this.scrollDownMessageHeight.bind(this),
                        function ($el) {
                            insert.call(that.$content, $el);
                            return $el;
                        }
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
                    var msg_dates, idx,
                        $first_msg = this.$content.find('.chat-message:first'),
                        first_msg_date = $first_msg.data('isodate'),
                        current_msg_date = moment(attrs.time) || moment,
                        last_msg_date = this.$content.find('.chat-message:last').data('isodate');

                    if (!first_msg_date) {
                        // This is the first received message, so we insert a
                        // date indicator before it.
                        this.insertDayIndicator(current_msg_date);
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isAfter(last_msg_date) || current_msg_date.isSame(last_msg_date)) {
                        // The new message is after the last message
                        if (current_msg_date.isAfter(last_msg_date, 'day')) {
                            // Append a new day indicator
                            this.insertDayIndicator(current_msg_date);
                        }
                        this.insertMessage(attrs);
                        return;
                    }
                    if (current_msg_date.isBefore(first_msg_date) || current_msg_date.isSame(first_msg_date)) {
                        // The message is before the first, but on the same day.
                        // We need to prepend the message immediately before the
                        // first message (so that it'll still be after the day indicator).
                        this.insertMessage(attrs, 'prepend');
                        if (current_msg_date.isBefore(first_msg_date, 'day')) {
                            // This message is also on a different day, so we prepend a day indicator.
                            this.insertDayIndicator(current_msg_date, 'prepend');
                        }
                        return;
                    }
                    // Find the correct place to position the message
                    current_msg_date = current_msg_date.format();
                    msg_dates = _.map(this.$content.find('.chat-message'), function (el) {
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
                },

                getExtraMessageTemplateAttributes: function (attrs) {
                    // Provides a hook for sending more attributes to the
                    // message template.
                    return {};
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
                    if (text.length > 8000) {
                        text = text.substring(0, 10) + '...';
                        this.showStatusNotification(
                            __("A very large message has been received."+
                               "This might be due to an attack meant to degrade the chat performance."+
                               "Output has been shortened."),
                            true, true);
                    }
                    var $msg = $(template(
                        _.extend(this.getExtraMessageTemplateAttributes(attrs), {
                            'msgid': attrs.msgid,
                            'sender': attrs.sender,
                            'time': msg_time.format('hh:mm'),
                            'isodate': msg_time.format(),
                            'username': username,
                            'extra_classes': extra_classes
                        })
                    ));
                    $msg.find('.chat-msg-content').first()
                        .text(text)
                        .addHyperlinks()
                        .addEmoticons(converse.visible_toolbar_buttons.emoticons);
                    return $msg;
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
                        this.clear_status_timeout = window.setTimeout(this.clearStatusNotification.bind(this), 30000);
                    } else if (message.get('chat_state') === converse.PAUSED) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has stopped typing'));
                    } else if (_.contains([converse.INACTIVE, converse.ACTIVE], message.get('chat_state'))) {
                        this.$content.find('div.chat-event').remove();
                    } else if (message.get('chat_state') === converse.GONE) {
                        this.showStatusNotification(message.get('fullname')+' '+__('has gone away'));
                    }
                },

                shouldShowOnTextMessage: function () {
                    return !this.$el.is(':visible');
                },

                updateNewMessageIndicators: function (message) {
                    /* We have two indicators of new messages. The unread messages
                     * counter, which shows the number of unread messages in
                     * the document.title, and the "new messages" indicator in
                     * a chat area, if it's scrolled up so that new messages
                     * aren't visible.
                     *
                     * In both cases we ignore MAM messages.
                     */
                    if (!message.get('archive_id')) {
                        if (this.model.get('scrolled', true)) {
                            this.$el.find('.new-msgs-indicator').removeClass('hidden');
                        }
                        if (converse.windowState === 'hidden' || this.model.get('scrolled', true)) {
                            converse.incrementMsgCounter();
                        }
                    }
                },

                handleTextMessage: function (message) {
                    this.showMessage(_.clone(message.attributes));
                    if (message.get('sender') !== 'me') {
                        this.updateNewMessageIndicators(message);
                    } else {
                        // We remove the "scrolled" flag so that the chat area
                        // gets scrolled down. We always want to scroll down
                        // when the user writes a message as opposed to when a
                        // message is received.
                        this.model.set('scrolled', false);
                    }
                    if (this.shouldShowOnTextMessage()) {
                        this.show();
                    } else {
                        this.scrollDown();
                    }
                },

                handleErrorMessage: function (message) {
                    var $message = $('[data-msgid='+message.get('msgid')+']');
                    if ($message.length) {
                        $message.after($('<div class="chat-info chat-error"></div>').text(message.get('message')));
                        this.scrollDown();
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
                    if (message.get('type') === 'error') {
                        this.handleErrorMessage(message);
                    } else if (!message.get('message')) {
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
                            .c(this.model.get('chat_state'), {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
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
                            this.onMessageSubmitted(message);
                            converse.emit('messageSend', message);
                        }
                        this.setChatState(converse.ACTIVE);
                    } else {
                        // Set chat state to composing if keyCode is not a forward-slash
                        // (which would imply an internal command and not a message).
                        this.setChatState(converse.COMPOSING, ev.keyCode === KEY.FORWARD_SLASH);
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

                insertIntoTextArea: function (value) {
                    var $textbox = this.$el.find('textarea.chat-textarea');
                    var existing = $textbox.val();
                    if (existing && (existing[existing.length-1] !== ' ')) {
                        existing = existing + ' ';
                    }
                    $textbox.focus().val(existing+value+' ');
                },

                insertEmoticon: function (ev) {
                    ev.stopPropagation();
                    this.$el.find('.toggle-smiley ul').slideToggle(200);
                    var $target = $(ev.target);
                    $target = $target.is('a') ? $target : $target.children('a');
                    this.insertIntoTextArea($target.data('emoticon'));
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
                },

                onStatusChanged: function (item) {
                    this.showStatusMessage();
                    converse.emit('contactStatusMessageChanged', {
                        'contact': item.attributes,
                        'message': item.get('status')
                    });
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
                        // Immediately sending the chat state, because the
                        // model is going to be destroyed afterwards.
                        this.model.set('chat_state', converse.INACTIVE);
                        this.sendChatState();
                        this.model.destroy();
                    }
                    this.remove();
                    converse.emit('chatBoxClosed', this);
                    return this;
                },

                getToolbarOptions: function (options) {
                    return _.extend(options || {}, {
                        'label_clear': __('Clear all messages'),
                        'label_insert_smiley': __('Insert a smiley'),
                        'label_start_call': __('Start a call'),
                        'show_call_button': converse.visible_toolbar_buttons.call,
                        'show_clear_button': converse.visible_toolbar_buttons.clear,
                        'show_emoticons': converse.visible_toolbar_buttons.emoticons,
                    });
                },

                renderToolbar: function (toolbar, options) {
                    if (!converse.show_toolbar) { return; }
                    toolbar = toolbar || converse.templates.toolbar;
                    options = _.extend(
                        this.model.toJSON(),
                        this.getToolbarOptions(options || {})
                    );
                    this.$el.find('.chat-toolbar').html(toolbar(options));
                    return this;
                },

                renderAvatar: function () {
                    if (!this.model.get('image')) {
                        return;
                    }
                    var width = converse.chatview_avatar_width;
                    var height = converse.chatview_avatar_height;
                    var img_src = 'data:'+this.model.get('image_type')+';base64,'+this.model.get('image'),
                        canvas = $(converse.templates.avatar({
                            'width': width,
                            'height': height
                        })).get(0);

                    if (!(canvas.getContext && canvas.getContext('2d'))) {
                        return this;
                    }
                    var ctx = canvas.getContext('2d');
                    var img = new Image();   // Create new Image object
                    img.onload = function () {
                        var ratio = img.width/img.height;
                        if (ratio < 1) {
                            ctx.drawImage(img, 0,0, width, height*(1/ratio));
                        } else {
                            ctx.drawImage(img, 0,0, width, height*ratio);
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
                    this.el.classList.add('hidden');
                    utils.refreshWebkit();
                    return this;
                },

                afterShown: function () {
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
                },

                _show: function (focus) {
                    /* Inner show method that gets debounced */
                    if (this.$el.is(':visible') && this.$el.css('opacity') === "1") {
                        if (focus) { this.focus(); }
                        return;
                    }
                    utils.fadeIn(this.el, this.afterShown.bind(this));
                },

                show: function (focus) {
                    if (typeof this.debouncedShow === 'undefined') {
                        /* We wrap the method in a debouncer and set it on the
                         * instance, so that we have it debounced per instance.
                         * Debouncing it on the class-level is too broad.
                         */
                        this.debouncedShow = _.debounce(this._show, 250, true);
                    }
                    this.debouncedShow.apply(this, arguments);
                    return this;
                },

                markScrolled: _.debounce(function (ev) {
                    /* Called when the chat content is scrolled up or down.
                     * We want to record when the user has scrolled away from
                     * the bottom, so that we don't automatically scroll away
                     * from what the user is reading when new messages are
                     * received.
                     */
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var is_at_bottom = this.$content.scrollTop() + this.$content.innerHeight() >= this.$content[0].scrollHeight-10;
                    if (is_at_bottom) {
                        this.model.set('scrolled', false);
                        this.$el.find('.new-msgs-indicator').addClass('hidden');
                    } else {
                        // We're not at the bottom of the chat area, so we mark
                        // that the box is in a scrolled-up state.
                        this.model.set('scrolled', true);
                    }
                }, 150),


                viewUnreadMessages: function () {
                    this.model.set('scrolled', false);
                    this.scrollDown();
                },

                scrollDownMessageHeight: function ($message) {
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content.scrollTop() + $message[0].scrollHeight);
                    }
                    return this;
                },

                scrollDown: function () {
                    if (this.$content.is(':visible') && !this.model.get('scrolled')) {
                        this.$content.scrollTop(this.$content[0].scrollHeight);
                        this.$el.find('.new-msgs-indicator').addClass('hidden');
                    }
                    return this;
                }
            });
        }
    });
}));


define('tpl!add_contact_dropdown', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dl class="add-converse-contact dropdown">\n    <dt id="xmpp-contact-search" class="fancy-dropdown">\n        <a class="toggle-xmpp-contact-form icon-plus" href="#" title="'+
((__t=(label_click_to_chat))==null?'':__t)+
'"> '+
((__t=(label_add_contact))==null?'':__t)+
'</a>\n    </dt>\n    <dd class="search-xmpp"><ul></ul></dd>\n</dl>\n';
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
__p+='<li><a class="s ';
 if (is_current) { 
__p+=' current ';
 } 
__p+='"\n       data-id="users" href="#users">\n    '+
((__t=(label_contacts))==null?'':__t)+
'\n</a></li>\n';
}
return __p;
}; });


define('tpl!controlbox', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="flyout box-flyout">\n    <div class="dragresize dragresize-top"></div>\n    <div class="dragresize dragresize-topleft"></div>\n    <div class="dragresize dragresize-left"></div>\n    <div class="chat-head controlbox-head">\n        <ul id="controlbox-tabs"></ul>\n        ';
 if (!sticky_controlbox) { 
__p+='\n            <a class="chatbox-btn close-chatbox-button icon-close"></a>\n        ';
 } 
__p+='\n    </div>\n    <div class="controlbox-panes"></div>\n</div>\n';
}
return __p;
}; });


define('tpl!controlbox_toggle', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<span class="conn-feedback">'+
((__t=(label_toggle))==null?'':__t)+
'</span>\n';
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
 if (authentication == LOGIN || authentication == EXTERNAL) { 
__p+='\n            <label>'+
((__t=(label_username))==null?'':__t)+
'</label>\n            <input type="text" name="jid" placeholder="'+
((__t=(placeholder_username))==null?'':__t)+
'">\n            ';
 if (authentication !== EXTERNAL) { 
__p+='\n                <label>'+
((__t=(label_password))==null?'':__t)+
'</label>\n                <input type="password" name="password" placeholder="'+
((__t=(placeholder_password))==null?'':__t)+
'">\n            ';
 } 
__p+='\n            <input class="pure-button button-primary" type="submit" value="'+
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


define('tpl!roster', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<form class="pure-form roster-filter-group input-button-group">\n    <input value="'+
((__t=(filter_text))==null?'':__t)+
'" class="roster-filter"\n           placeholder="'+
((__t=(placeholder))==null?'':__t)+
'"\n           ';
 if (filter_type === 'state') { 
__p+='  style="display: none" ';
 } 
__p+=' >\n    <select class="state-type" ';
 if (filter_type !== 'state') { 
__p+='  style="display: none" ';
 } 
__p+=' >\n        <option value="">'+
((__t=(label_any))==null?'':__t)+
'</option>\n        <option ';
 if (chat_state === 'online') { 
__p+=' selected="selected" ';
 } 
__p+='\n            value="online">'+
((__t=(label_online))==null?'':__t)+
'</option>\n        <option ';
 if (chat_state === 'chat') { 
__p+=' selected="selected" ';
 } 
__p+='\n            value="chat">'+
((__t=(label_chatty))==null?'':__t)+
'</option>\n        <option ';
 if (chat_state === 'dnd') { 
__p+=' selected="selected" ';
 } 
__p+='\n            value="dnd">'+
((__t=(label_busy))==null?'':__t)+
'</option>\n        <option ';
 if (chat_state === 'away') { 
__p+=' selected="selected" ';
 } 
__p+='\n            value="away">'+
((__t=(label_away))==null?'':__t)+
'</option>\n        <option ';
 if (chat_state === 'xa') { 
__p+=' selected="selected" ';
 } 
__p+='\n            value="xa">'+
((__t=(label_xa))==null?'':__t)+
'</option>\n        <option ';
 if (chat_state === 'offline') { 
__p+=' selected="selected" ';
 } 
__p+='\n            value="offline">'+
((__t=(label_offline))==null?'':__t)+
'</option>\n    </select>\n    <select class="filter-type">\n        <option ';
 if (filter_type === 'contacts') { 
__p+=' selected="selected" ';
 } 
__p+='\n                value="contacts">'+
((__t=(label_contacts))==null?'':__t)+
'</option>\n        <option ';
 if (filter_type === 'groups') { 
__p+=' selected="selected" ';
 } 
__p+='\n                value="groups">'+
((__t=(label_groups))==null?'':__t)+
'</option>\n        <option ';
 if (filter_type === 'state') { 
__p+=' selected="selected" ';
 } 
__p+='\n                value="state">'+
((__t=(label_state))==null?'':__t)+
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

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

(function (root, factory) {
    define("converse-rosterview", [
            "converse-core",
            "converse-api",
            "tpl!group_header",
            "tpl!pending_contact",
            "tpl!requesting_contact",
            "tpl!roster",
            "tpl!roster_item"
    ], factory);
}(this, function (
            converse,
            converse_api, 
            tpl_group_header,
            tpl_pending_contact,
            tpl_requesting_contact,
            tpl_roster,
            tpl_roster_item) {
    "use strict";
    converse.templates.group_header = tpl_group_header;
    converse.templates.pending_contact = tpl_pending_contact;
    converse.templates.requesting_contact = tpl_requesting_contact;
    converse.templates.roster = tpl_roster;
    converse.templates.roster_item = tpl_roster_item;

    var $ = converse_api.env.jQuery,
        utils = converse_api.env.utils,
        Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1,
        _ = converse_api.env._,
        __ = utils.__.bind(converse);

    converse_api.plugins.add('rosterview', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
            afterReconnected: function () {
                this.rosterview.registerRosterXHandler();
                this.__super__.afterReconnected.apply(this, arguments);
            },

            _tearDown: function () {
                /* Remove the rosterview when tearing down. It gets created
                 * anew when reconnecting or logging in.
                 */
                this.__super__._tearDown.apply(this, arguments);
                if (!_.isUndefined(this.rosterview)) {
                    this.rosterview.remove();
                }
            },

            RosterGroups: {
                comparator: function () {
                    // RosterGroupsComparator only gets set later (once i18n is
                    // set up), so we need to wrap it in this nameless function.
                    return converse.RosterGroupsComparator.apply(this, arguments);
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                allow_chat_pending_contacts: false,
                allow_contact_removal: true,
                show_toolbar: true,
            });

            var STATUSES = {
                'dnd': __('This contact is busy'),
                'online': __('This contact is online'),
                'offline': __('This contact is offline'),
                'unavailable': __('This contact is unavailable'),
                'xa': __('This contact is away for an extended period'),
                'away': __('This contact is away')
            };
            var LABEL_CONTACTS = __('Contacts');
            var LABEL_GROUPS = __('Groups');
            var HEADER_CURRENT_CONTACTS =  __('My contacts');
            var HEADER_PENDING_CONTACTS = __('Pending contacts');
            var HEADER_REQUESTING_CONTACTS = __('Contact requests');
            var HEADER_UNGROUPED = __('Ungrouped');
            var HEADER_WEIGHTS = {};
            HEADER_WEIGHTS[HEADER_REQUESTING_CONTACTS] = 0;
            HEADER_WEIGHTS[HEADER_CURRENT_CONTACTS]    = 1;
            HEADER_WEIGHTS[HEADER_UNGROUPED]           = 2;
            HEADER_WEIGHTS[HEADER_PENDING_CONTACTS]    = 3;

            converse.RosterGroupsComparator = function (a, b) {
                /* Groups are sorted alphabetically, ignoring case.
                 * However, Ungrouped, Requesting Contacts and Pending Contacts
                 * appear last and in that order.
                 */
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
                    return (b === HEADER_REQUESTING_CONTACTS) ? 1 : -1;
                } else if (a_is_special && !b_is_special) {
                    return (a === HEADER_REQUESTING_CONTACTS) ? -1 : 1;
                }
            };


            converse.RosterFilter = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'filter_text': '',
                        'filter_type': 'contacts',
                        'chat_state': ''
                    });
                },
            });

            converse.RosterFilterView = Backbone.View.extend({
                tagName: 'span',
                events: {
                    "keydown .roster-filter": "liveFilter",
                    "click .onX": "clearFilter",
                    "mousemove .x": "toggleX",
                    "change .filter-type": "changeTypeFilter",
                    "change .state-type": "changeChatStateFilter"
                },

                initialize: function () {
                    this.model.on('change', this.render, this);
                },

                render: function () {
                    this.$el.html(converse.templates.roster(
                        _.extend(this.model.toJSON(), {
                            placeholder: __('Filter'),
                            label_contacts: LABEL_CONTACTS,
                            label_groups: LABEL_GROUPS,
                            label_state: __('State'),
                            label_any: __('Any'),
                            label_online: __('Online'),
                            label_chatty: __('Chatty'),
                            label_busy: __('Busy'),
                            label_away: __('Away'),
                            label_xa: __('Extended Away'),
                            label_offline: __('Offline')
                        })
                    ));
                    var $roster_filter = this.$('.roster-filter');
                    $roster_filter[this.tog($roster_filter.val())]('x');
                    return this.$el;
                },

                tog: function (v) {
                    return v?'addClass':'removeClass';
                },

                toggleX: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var el = ev.target;
                    $(el)[this.tog(el.offsetWidth-18 < ev.clientX-el.getBoundingClientRect().left)]('onX');
                },

                changeChatStateFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.save({
                        'chat_state': this.$('.state-type').val()
                    });
                },

                changeTypeFilter: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var type = ev.target.value;
                    if (type === 'state') {
                        this.model.save({
                            'filter_type': type,
                            'chat_state': this.$('.state-type').val()
                        });
                    } else {
                        this.model.save({
                            'filter_type': type,
                            'filter_text': this.$('.roster-filter').val(),
                        });
                    }
                },

                liveFilter: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.save({
                        'filter_type': this.$('.filter-type').val(),
                        'filter_text': this.$('.roster-filter').val()
                    });
                }, 250),

                isActive: function () {
                    /* Returns true if the filter is enabled (i.e. if the user
                     * has added values to the filter).
                     */
                    if (this.model.get('filter_type') === 'state' ||
                        this.model.get('filter_text')) {
                        return true;
                    }
                    return false;
                },

                show: function () {
                    if (this.$el.is(':visible')) { return this; }
                    this.$el.show();
                    return this;
                },

                hide: function () {
                    if (!this.$el.is(':visible')) { return this; }
                    if (this.$('.roster-filter').val().length > 0) {
                        // Don't hide if user is currently filtering.
                        return;
                    }
                    this.model.save({
                        'filter_text': '',
                        'chat_state': ''
                    });
                    this.$el.hide();
                    return this;
                },

                clearFilter: function (ev) {
                    if (ev && ev.preventDefault) {
                        ev.preventDefault();
                        $(ev.target).removeClass('x onX').val('');
                    }
                    this.model.save({
                        'filter_text': ''
                    });
                }
            });

            converse.RosterView = Backbone.Overview.extend({
                tagName: 'div',
                id: 'converse-roster',

                initialize: function () {
                    this.roster_handler_ref = this.registerRosterHandler();
                    this.rosterx_handler_ref = this.registerRosterXHandler();
                    converse.roster.on("add", this.onContactAdd, this);
                    converse.roster.on('change', this.onContactChange, this);
                    converse.roster.on("destroy", this.update, this);
                    converse.roster.on("remove", this.update, this);
                    this.model.on("add", this.onGroupAdd, this);
                    this.model.on("reset", this.reset, this);
                    converse.on('rosterGroupsFetched', this.positionFetchedGroups, this);
                    converse.on('rosterContactsFetched', this.update, this);
                    this.createRosterFilter();
                },

                render: function () {
                    this.$roster = $('<dl class="roster-contacts" style="display: none;"></dl>');
                    this.$el.html(this.filter_view.render());
                    if (!converse.allow_contact_requests) {
                        // XXX: if we ever support live editing of config then
                        // we'll need to be able to remove this class on the fly.
                        this.$el.addClass('no-contact-requests');
                    }
                    return this;
                },

                createRosterFilter: function () {
                    // Create a model on which we can store filter properties
                    var model = new converse.RosterFilter();
                    model.id = b64_sha1('converse.rosterfilter'+converse.bare_jid);
                    model.browserStorage = new Backbone.BrowserStorage.local(this.filter.id);
                    this.filter_view = new converse.RosterFilterView({'model': model});
                    this.filter_view.model.on('change', this.updateFilter, this);
                    this.filter_view.model.fetch();
                },

                updateFilter: _.debounce(function () {
                    /* Filter the roster again.
                     * Called whenever the filter settings have been changed or
                     * when contacts have been added, removed or changed.
                     *
                     * Debounced so that it doesn't get called for every
                     * contact fetched from browser storage.
                     */
                    var type = this.filter_view.model.get('filter_type');
                    if (type === 'state') {
                        this.filter(this.filter_view.model.get('chat_state'), type);
                    } else {
                        this.filter(this.filter_view.model.get('filter_text'), type);
                    }
                }, 100),

                unregisterHandlers: function () {
                    converse.connection.deleteHandler(this.roster_handler_ref);
                    delete this.roster_handler_ref;
                    converse.connection.deleteHandler(this.rosterx_handler_ref);
                    delete this.rosterx_handler_ref;
                },

                update: _.debounce(function () {
                    if (this.$roster.parent().length === 0) {
                        this.$el.append(this.$roster.show());
                    }
                    return this.showHideFilter();
                }, converse.animate ? 100 : 0),

                showHideFilter: function () {
                    if (!this.$el.is(':visible')) {
                        return;
                    }
                    if (this.$roster.hasScrollBar()) {
                        this.filter_view.show();
                    } else if (!this.filter_view.isActive()) {
                        this.filter_view.hide();
                    }
                    return this;
                },

                filter: function (query, type) {
                    // First we make sure the filter is restored to its
                    // original state
                    _.each(this.getAll(), function (view) {
                        if (view.model.contacts.length > 0) {
                            view.show().filter('');
                        }
                    });
                    // Now we can filter
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

                onGroupAdd: function (group) {
                    var view = new converse.RosterGroupView({model: group});
                    this.add(group.get('name'), view.render());
                    this.positionGroup(view);
                },

                onContactAdd: function (contact) {
                    this.addRosterContact(contact).update();
                    this.updateFilter();
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
                    this.updateFilter();
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
                    this.model.sort();
                    this.model.each(function (group, idx) {
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
                    if (!this.mayBeShown()) {
                        this.$el.hide();
                        return this;
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

                isGroupCollapsed: function () {
                    /* Check whether the group in which this contact appears is
                     * collapsed.
                     */
                    // XXX: this sucks and is fragile.
                    // It's because I tried to do the "right thing"
                    // and use definition lists to represent roster groups.
                    // If roster group items were inside the group elements, we
                    // would simplify things by not having to check whether the
                    // group is collapsed or not.
                    var name = this.$el.prevAll('dt:first').data('group');
                    var group = converse.rosterview.model.where({'name': name})[0];
                    if (group.get('state') === converse.CLOSED) {
                        return true;
                    }
                    return false;
                },

                mayBeShown: function () {
                    /* Return a boolean indicating whether this contact should
                     * generally be visible in the roster.
                     *
                     * It doesn't check for the more specific case of whether
                     * the group it's in is collapsed (see isGroupCollapsed).
                     */
                    var chatStatus = this.model.get('chat_status');
                    if ((converse.show_only_online_users && chatStatus !== 'online') ||
                        (converse.hide_offline_users && chatStatus === 'offline')) {
                        // If pending or requesting, show
                        if ((this.model.get('ask') === 'subscribe') ||
                                (this.model.get('subscription') === 'from') ||
                                (this.model.get('requesting') === true)) {
                            return true;
                        }
                        return false;
                    }
                    return true;
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
                    if (view.mayBeShown()) {
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
                    _.each(this.getAll(), function (view) {
                        if (view.mayBeShown() && !view.isGroupCollapsed()) {
                            view.$el.show();
                        }
                    });
                    return this;
                },

                hide: function () {
                    this.$el.nextUntil('dt').addBack().hide();
                },

                filter: function (q, type) {
                    /* Filter the group's contacts based on the query "q".
                     * The query is matched against the contact's full name.
                     * If all contacts are filtered out (i.e. hidden), then the
                     * group must be filtered out as well.
                     */
                    var matches;
                    if (q.length === 0) {
                        if (this.model.get('state') === converse.OPENED) {
                            this.model.contacts.each(function (item) {
                                var view = this.get(item.get('id'));
                                if (view.mayBeShown() && !view.isGroupCollapsed()) {
                                    view.$el.show();
                                }
                            }.bind(this));
                        }
                        this.showIfNecessary();
                    } else {
                        q = q.toLowerCase();
                        if (type === 'state') {
                            if (this.model.get('name') === HEADER_REQUESTING_CONTACTS) {
                                // When filtering by chat state, we still want to
                                // show requesting contacts, even though they don't
                                // have the state in question.
                                matches = this.model.contacts.filter(
                                    function (contact) {
                                        return utils.contains.not('chat_status', q)(contact) && !contact.get('requesting');
                                    }
                                );
                            } else {
                                matches = this.model.contacts.filter(
                                    utils.contains.not('chat_status', q)
                                );
                            }
                        } else  {
                            matches = this.model.contacts.filter(
                                utils.contains.not('fullname', q)
                            );
                        }
                        if (matches.length === this.model.contacts.length) {
                            // hide the whole group
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
                            converse.rosterview.$('.roster-filter').val() || '',
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
                        /* We suppress events, otherwise the remove event will
                         * also cause the contact's view to be removed from the
                         * "Pending Contacts" group.
                         */
                        this.model.contacts.remove(contact.get('id'), {'silent': true});
                        // Since we suppress events, we make sure the view and
                        // contact are removed from this group.
                        this.get(contact.get('id')).remove();
                        this.onRemove(contact);
                    }
                },

                onRemove: function (contact) {
                    this.remove(contact.get('id'));
                    if (this.model.contacts.length === 0) {
                        this.$el.hide();
                    }
                }
            });

            /* -------- Event Handlers ----------- */

            var initRoster = function () {
                /* Create an instance of RosterView once the RosterGroups
                 * collection has been created (in converse-core.js)
                 */
                converse.rosterview = new converse.RosterView({
                    'model': converse.rostergroups
                });
                converse.rosterview.render();
            };
            converse.on('rosterInitialized', initRoster);
            converse.on('rosterReadyAfterReconnection', initRoster);
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, Backbone */

(function (root, factory) {
    define("converse-controlbox", [
            "converse-core",
            "converse-api",
            "tpl!add_contact_dropdown",
            "tpl!add_contact_form",
            "tpl!change_status_message",
            "tpl!chat_status",
            "tpl!choose_status",
            "tpl!contacts_panel",
            "tpl!contacts_tab",
            "tpl!controlbox",
            "tpl!controlbox_toggle",
            "tpl!login_panel",
            "tpl!login_tab",
            "tpl!search_contact",
            "tpl!status_option",
            "converse-chatview",
            "converse-rosterview"
    ], factory);
}(this, function (
            converse,
            converse_api,
            tpl_add_contact_dropdown,
            tpl_add_contact_form,
            tpl_change_status_message,
            tpl_chat_status,
            tpl_choose_status,
            tpl_contacts_panel,
            tpl_contacts_tab,
            tpl_controlbox,
            tpl_controlbox_toggle,
            tpl_login_panel,
            tpl_login_tab,
            tpl_search_contact,
            tpl_status_option
        ) {
    "use strict";
    converse.templates.add_contact_dropdown = tpl_add_contact_dropdown;
    converse.templates.add_contact_form = tpl_add_contact_form;
    converse.templates.change_status_message = tpl_change_status_message;
    converse.templates.chat_status = tpl_chat_status;
    converse.templates.choose_status = tpl_choose_status;
    converse.templates.contacts_panel = tpl_contacts_panel;
    converse.templates.contacts_tab = tpl_contacts_tab;
    converse.templates.controlbox = tpl_controlbox;
    converse.templates.controlbox_toggle = tpl_controlbox_toggle;
    converse.templates.login_panel = tpl_login_panel;
    converse.templates.login_tab = tpl_login_tab;
    converse.templates.search_contact = tpl_search_contact;
    converse.templates.status_option = tpl_status_option;

    var USERS_PANEL_ID = 'users';

    // Strophe methods for building stanzas
    var Strophe = converse_api.env.Strophe,
        utils = converse_api.env.utils;
    // Other necessary globals
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        __ = utils.__.bind(converse),
        moment = converse_api.env.moment;


    converse_api.plugins.add('converse-controlbox', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initSession: function () {
                this.controlboxtoggle = new this.ControlBoxToggle();
                this.__super__.initSession.apply(this, arguments);
            },

            initConnection: function () {
                this.__super__.initConnection.apply(this, arguments);
                if (this.connection) {
                    this.addControlBox();
                }
            },

            _tearDown: function () {
                this.__super__._tearDown.apply(this, arguments);
                if (this.rosterview) {
                    this.rosterview.unregisterHandlers();
                    // Removes roster groups
                    this.rosterview.model.off().reset();
                    this.rosterview.each(function (groupview) {
                        groupview.removeAll();
                        groupview.remove();
                    });
                    this.rosterview.removeAll().remove();
                }
            },

            clearSession: function () {
                this.__super__.clearSession.apply(this, arguments);
                if (_.isUndefined(this.connection) && this.connection.connected) {
                    this.chatboxes.get('controlbox').save({'connected': false});
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           chatbox.get('id') !== 'controlbox';
                },

                onChatBoxesFetched: function (collection, resp) {
                    this.__super__.onChatBoxesFetched.apply(this, arguments);
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
                    if (item.get('box_id') === 'controlbox') {
                        var view = this.get(item.get('id'));
                        if (view) {
                            view.model = item;
                            view.initialize();
                            return view;
                        } else {
                            view = new converse.ControlBoxView({model: item});
                            return this.add(item.get('id'), view);
                        }
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                },

                closeAllChatBoxes: function () {
                    this.each(function (view) {
                        if (!converse.connection.connected ||
                            view.model.get('id') !== 'controlbox') {
                                view.close();
                        }
                    });
                    return this;
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
                        return this.__super__.getChatBoxWidth.apply(this, arguments);
                    }
                }
            },


            ChatBox: {
                initialize: function () {
                    if (this.get('id') === 'controlbox') {
                        this.set({
                            'time_opened': moment(0).valueOf(),
                            'num_unread': 0
                        });
                    } else {
                        this.__super__.initialize.apply(this, arguments);
                    }
                },
            },


            ChatBoxView: {
                insertIntoDOM: function () {
                    this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                    return this;
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            this.updateSettings({
                allow_logout: true,
                default_domain: undefined,
                show_controlbox_by_default: false,
                sticky_controlbox: false,
                xhr_user_search: false,
                xhr_user_search_url: ''
            });

            var LABEL_CONTACTS = __('Contacts');

            converse.addControlBox = function () {
                return converse.chatboxes.add({
                    id: 'controlbox',
                    box_id: 'controlbox',
                    closed: !converse.show_controlbox_by_default
                });
            };

            converse.ControlBoxView = converse.ChatBoxView.extend({
                tagName: 'div',
                className: 'chatbox',
                id: 'controlbox',
                events: {
                    'click a.close-chatbox-button': 'close',
                    'click ul#controlbox-tabs li a': 'switchTab',
                },

                initialize: function () {
                    this.$el.insertAfter(converse.controlboxtoggle.$el);
                    this.model.on('change:connected', this.onConnected, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('hide', this.hide, this);
                    this.model.on('show', this.show, this);
                    this.model.on('change:closed', this.ensureClosedState, this);
                    this.render();
                    if (this.model.get('connected')) {
                        this.insertRoster();
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
                    this.$el.html(converse.templates.controlbox(
                        _.extend(this.model.toJSON(), {
                            sticky_controlbox: converse.sticky_controlbox
                        }))
                    );
                    if (!converse.connection.connected || !converse.connection.authenticated || converse.connection.disconnecting) {
                        this.renderLoginPanel();
                    } else if (!this.contactspanel || !this.contactspanel.$el.is(':visible')) {
                        this.renderContactsPanel();
                    }
                    return this;
                },

                onConnected: function () {
                    if (this.model.get('connected')) {
                        this.render().insertRoster();
                    }
                },

                insertRoster: function () {
                    /* Place the rosterview inside the "Contacts" panel.
                     */
                    this.contactspanel.$el.append(converse.rosterview.$el);
                    return this;
                },

                renderLoginPanel: function () {
                    this.loginpanel = new converse.LoginPanel({
                        '$parent': this.$el.find('.controlbox-panes'),
                        'model': this
                    });
                    this.loginpanel.render();
                    return this;
                },

                renderContactsPanel: function () {
                    if (_.isUndefined(this.model.get('active-panel'))) {
                        this.model.save({'active-panel': USERS_PANEL_ID});
                    }
                    this.contactspanel = new converse.ContactsPanel({
                        '$parent': this.$el.find('.controlbox-panes')
                    });
                    this.contactspanel.render();
                    converse.xmppstatusview = new converse.XMPPStatusView({
                        'model': converse.xmppstatus
                    });
                    converse.xmppstatusview.render();
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
                    this.$el.addClass('hidden');
                    utils.refreshWebkit();
                    converse.emit('chatBoxClosed', this);
                    if (!converse.connection.connected) {
                        converse.controlboxtoggle.render();
                    }
                    converse.controlboxtoggle.show(callback);
                    return this;
                },

                onControlBoxToggleHidden: function () {
                    var that = this;
                    utils.fadeIn(this.el, function () {
                        converse.controlboxtoggle.updateOnlineCount();
                        utils.refreshWebkit();
                        converse.emit('controlBoxOpened', that);
                    });
                },

                show: function () {
                    converse.controlboxtoggle.hide(
                        this.onControlBoxToggleHidden.bind(this)
                    );
                    return this;
                },

                switchTab: function (ev) {
                    // TODO: automatically focus the relevant input
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $tab = $(ev.target),
                        $sibling = $tab.parent().siblings('li').children('a'),
                        $tab_panel = $($tab.attr('href'));
                    $($sibling.attr('href')).addClass('hidden');
                    $sibling.removeClass('current');
                    $tab.addClass('current');
                    $tab_panel.removeClass('hidden');
                    if (converse.connection.connected) {
                        this.model.save({'active-panel': $tab.data('id')});
                    }
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
                            'ANONYMOUS': converse.ANONYMOUS,
                            'EXTERNAL': converse.EXTERNAL,
                            'LOGIN': converse.LOGIN,
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

                    if (!jid) {
                        errors = true;
                        $jid_input.addClass('error');
                    }
                    if (!password && converse.authentication !== converse.EXTERNAL)  {
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
                    var controlbox = converse.chatboxes.get('controlbox');
                    this.$tabs.append(converse.templates.contacts_tab({
                        'label_contacts': LABEL_CONTACTS,
                        'is_current': controlbox.get('active-panel') === USERS_PANEL_ID
                    }));
                    if (converse.xhr_user_search) {
                        markup = converse.templates.search_contact({
                            label_contact_name: __('Contact name'),
                            label_search: __('Search')
                        });
                    } else {
                        markup = converse.templates.add_contact_form({
                            label_contact_username: __('e.g. user@example.org'),
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
                    if (controlbox.get('active-panel') !== USERS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
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


            converse.ControlBoxToggle = Backbone.View.extend({
                tagName: 'a',
                className: 'toggle-controlbox hidden',
                id: 'toggle-controlbox',
                events: {
                    'click': 'onClick'
                },
                attributes: {
                    'href': "#"
                },

                initialize: function () {
                    converse.chatboxviews.$el.prepend(this.render());
                    this.updateOnlineCount();
                    var that = this;
                    converse.on('initialized', function () {
                        converse.roster.on("add", that.updateOnlineCount, that);
                        converse.roster.on('change', that.updateOnlineCount, that);
                        converse.roster.on("destroy", that.updateOnlineCount, that);
                        converse.roster.on("remove", that.updateOnlineCount, that);
                    });
                },

                render: function () {
                    // We let the render method of ControlBoxView decide whether
                    // the ControlBox or the Toggle must be shown. This prevents
                    // artifacts (i.e. on page load the toggle is shown only to then
                    // seconds later be hidden in favor of the control box).
                    return this.$el.html(
                        converse.templates.controlbox_toggle({
                            'label_toggle': __('Toggle chat')
                        })
                    );
                },

                updateOnlineCount: _.debounce(function () {
                    if (typeof converse.roster === 'undefined') {
                        return;
                    }
                    var $count = this.$('#online-count');
                    $count.text('('+converse.roster.getNumOnlineContacts()+')');
                    if (!$count.is(':visible')) {
                        $count.show();
                    }
                }, converse.animate ? 100 : 0),

                hide: function (callback) {
                    this.el.classList.add('hidden');
                    callback();
                },

                show: function (callback) {
                    utils.fadeIn(this.el, callback);
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

            var disconnect =  function () {
                /* Upon disconnection, set connected to `false`, so that if
                 * we reconnect,
                 * "onConnected" will be called, to fetch the roster again and
                 * to send out a presence stanza.
                 */
                var view = converse.chatboxviews.get('controlbox');
                view.model.set({connected:false});
                view.$('#controlbox-tabs').empty();
                view.renderLoginPanel();
            };
            converse.on('disconnected', disconnect);

            var afterReconnected = function () {
                /* After reconnection makes sure the controlbox's is aware.
                 */
                var view = converse.chatboxviews.get('controlbox');
                if (view.model.get('connected')) {
                    converse.chatboxviews.get("controlbox").onConnected();
                } else {
                    view.model.set({connected:true});
                }
            };
            converse.on('reconnected', afterReconnected);

        }
    });
}));


define('tpl!chatarea', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chat-area">\n    <div class="chat-content"></div>\n    <div class="new-msgs-indicator hidden">▼ '+
((__t=( unread_msgs ))==null?'':__t)+
' ▼</div>\n    <form class="sendXMPPMessage" action="" method="post">\n        ';
 if (show_toolbar) { 
__p+='\n            <ul class="chat-toolbar no-text-select"></ul>\n        ';
 } 
__p+='\n        <textarea type="text" class="chat-textarea" \n            placeholder="'+
((__t=(label_message))==null?'':__t)+
'"/>\n    </form>\n</div>\n';
}
return __p;
}; });


define('tpl!chatroom', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="flyout box-flyout">\n    <div class="chat-head chat-head-chatroom"></div>\n    <div class="chat-body chatroom-body"><span class="spinner centered"/></div>\n</div>\n';
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


define('tpl!chatroom_nickname_form', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chatroom-form-container">\n    <form class="pure-form converse-form chatroom-form">\n        <fieldset>\n            <label>'+
((__t=(heading))==null?'':__t)+
'</label>\n            <p class="validation-message">'+
((__t=(validation_message))==null?'':__t)+
'</p>\n            <input type="text" required="required" name="nick" class="new-chatroom-nick" placeholder="'+
((__t=(label_nickname))==null?'':__t)+
'"/>\n        </fieldset>\n        <fieldset>\n            <input type="submit" class="pure-button button-primary" name="join" value="'+
((__t=(label_join))==null?'':__t)+
'"/>\n        </fieldset>\n    </form>\n</div>\n';
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
__p+='<!-- <div class="occupants"> -->\n';
 if (allow_muc_invitations) { 
__p+='\n<form class="pure-form room-invite">\n    <input class="invited-contact" placeholder="'+
((__t=(label_invitation))==null?'':__t)+
'" type="text"/>\n</form>\n';
 } 
__p+='\n<p class="occupants-heading">'+
((__t=(label_occupants))==null?'':__t)+
':</p>\n<ul class="occupant-list"></ul>\n<!-- </div> -->\n';
}
return __p;
}; });


define('tpl!chatroom_toolbar', [],function () { return function(obj){
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
__p+='\n\n';
}
return __p;
}; });


define('tpl!chatroom_head', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a class="chatbox-btn close-chatbox-button icon-close" title="'+
((__t=(info_close))==null?'':__t)+
'"></a>\n';
 if (affiliation == 'owner') { 
__p+='\n    <a class="chatbox-btn configure-chatroom-button icon-wrench" title="'+
((__t=(info_configure))==null?'':__t)+
' "></a>\n';
 } 
__p+='\n<div class="chat-title">\n    '+
((__t=( _.escape(name) ))==null?'':__t)+
'\n    <p class="chatroom-topic"><p/>\n</div>\n';
}
return __p;
}; });


define('tpl!chatrooms_tab', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li><a class="s ';
 if (is_current) { 
__p+=' current ';
 } 
__p+='"\n       data-id="chatrooms" href="#chatrooms">\n    '+
((__t=(label_rooms))==null?'':__t)+
'\n</a></li>\n';
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


define('tpl!occupant', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<li class="'+
((__t=(role))==null?'':__t)+
' occupant" id="'+
((__t=(id))==null?'':__t)+
'"\n    ';
 if (role === "moderator") { 
__p+='\n       title="'+
((__t=(desc_moderator))==null?'':__t)+
' '+
((__t=(hint_occupant))==null?'':__t)+
'"\n    ';
 } 
__p+='\n    ';
 if (role === "occupant") { 
__p+='\n       title="'+
((__t=(desc_occupant))==null?'':__t)+
' '+
((__t=(hint_occupant))==null?'':__t)+
'"\n    ';
 } 
__p+='\n    ';
 if (role === "visitor") { 
__p+='\n       title="'+
((__t=(desc_visitor))==null?'':__t)+
' '+
((__t=(hint_occupant))==null?'':__t)+
'"\n    ';
 } 
__p+='>'+
((__t=(nick))==null?'':__t)+
'</li>\n';
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
'"/>\n        ';
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
'"/>\n        <input type="submit" class="pure-button button-primary" name="join" value="'+
((__t=(label_join))==null?'':__t)+
'"/>\n        <input type="button" class="pure-button button-secondary" name="show" id="show-rooms" value="'+
((__t=(label_show_rooms))==null?'':__t)+
'"/>\n    </fieldset>\n</form>\n<dl id="available-chatrooms" class="rooms-list"></dl>\n';
}
return __p;
}; });

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for multi-user chat rooms, as
 * specified in XEP-0045 Multi-user chat.
 */
(function (root, factory) {
    define("converse-muc", [
            "converse-core",
            "converse-api",
            "tpl!chatarea",
            "tpl!chatroom",
            "tpl!chatroom_form",
            "tpl!chatroom_nickname_form",
            "tpl!chatroom_password_form",
            "tpl!chatroom_sidebar",
            "tpl!chatroom_toolbar",
            "tpl!chatroom_head",
            "tpl!chatrooms_tab",
            "tpl!info",
            "tpl!occupant",
            "tpl!room_description",
            "tpl!room_item",
            "tpl!room_panel",
            "typeahead",
            "converse-chatview"
    ], factory);
}(this, function (
            converse,
            converse_api,
            tpl_chatarea,
            tpl_chatroom,
            tpl_chatroom_form,
            tpl_chatroom_nickname_form,
            tpl_chatroom_password_form,
            tpl_chatroom_sidebar,
            tpl_chatroom_toolbar,
            tpl_chatroom_head,
            tpl_chatrooms_tab,
            tpl_info,
            tpl_occupant,
            tpl_room_description,
            tpl_room_item,
            tpl_room_panel
    ) {
    "use strict";
    converse.templates.chatarea = tpl_chatarea;
    converse.templates.chatroom = tpl_chatroom;
    converse.templates.chatroom_form = tpl_chatroom_form;
    converse.templates.chatroom_nickname_form = tpl_chatroom_nickname_form;
    converse.templates.chatroom_password_form = tpl_chatroom_password_form;
    converse.templates.chatroom_sidebar = tpl_chatroom_sidebar;
    converse.templates.chatroom_head = tpl_chatroom_head;
    converse.templates.chatrooms_tab = tpl_chatrooms_tab;
    converse.templates.info = tpl_info;
    converse.templates.occupant = tpl_occupant;
    converse.templates.room_description = tpl_room_description;
    converse.templates.room_item = tpl_room_item;
    converse.templates.room_panel = tpl_room_panel;

    var ROOMS_PANEL_ID = 'chatrooms';

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

    converse_api.plugins.add('converse-muc', {
        /* Optional dependencies are other plugins which might be
         * overridden or relied upon, if they exist, otherwise they're ignored.
         *
         * However, if the setting "strict_plugin_dependencies" is set to true,
         * an error will be raised if the plugin is not found.
         *
         * NB: These plugins need to have already been loaded via require.js.
         */
        optional_dependencies: ["converse-controlbox"],

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            wrappedChatBox: function (chatbox) {
                /* Wrap a chatbox for outside consumption (i.e. so that it can be
                * returned via the API.
                */
                if (!chatbox) { return; }
                var view = converse.chatboxviews.get(chatbox.get('id'));
                var box = this.__super__.wrappedChatBox.apply(this, arguments);
                box.is_chatroom = view.is_chatroom;
                return box;
            },

            Features: {
                addClientFeatures: function () {
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (converse.allow_muc_invitations) {
                        converse.connection.disco.addFeature('jabber:x:conference'); // Invites
                    }
                    if (converse.allow_muc) {
                        converse.connection.disco.addFeature(Strophe.NS.MUC);
                    }
                }
            },

            ControlBoxView: {
                renderContactsPanel: function () {
                    var converse = this.__super__.converse;
                    this.__super__.renderContactsPanel.apply(this, arguments);
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
                    var converse = this.__super__.converse;
                    this.__super__.onConnected.apply(this, arguments);
                    if (!this.model.get('connected')) {
                        return;
                    }
                    if (_.isUndefined(converse.muc_domain)) {
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
                    } else {
                        this.setMUCDomain(converse.muc_domain);
                    }
                },

                setMUCDomain: function (domain) {
                    this.roomspanel.model.save({'muc_domain': domain});
                    var $server= this.$el.find('input.new-chatroom-server');
                    if (!$server.is(':focus')) {
                        $server.val(this.roomspanel.model.get('muc_domain'));
                    }
                },

                featureAdded: function (feature) {
                    var converse = this.__super__.converse;
                    if ((feature.get('var') === Strophe.NS.MUC) && (converse.allow_muc)) {
                        this.setMUCDomain(feature.get('from'));
                    }
                }
            },

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'chatroom') {
                        view = new converse.ChatRoomView({'model': item});
                        return this.add(item.get('id'), view);
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;

            // XXX: Inside plugins, all calls to the translation machinery
            // (e.g. utils.__) should only be done in the initialize function.
            // If called before, we won't know what language the user wants,
            // and it'll fallback to English.

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
            converse.muc = {
                info_messages: {
                    100: __('This room is not anonymous'),
                    102: __('This room now shows unavailable members'),
                    103: __('This room does not show unavailable members'),
                    104: __('The room configuration has changed'),
                    170: __('Room logging is now enabled'),
                    171: __('Room logging is now disabled'),
                    172: __('This room is now no longer anonymous'),
                    173: __('This room is now semi-anonymous'),
                    174: __('This room is now fully-anonymous'),
                    201: __('A new room has been created')
                },

                disconnect_messages: {
                    301: __('You have been banned from this room'),
                    307: __('You have been kicked from this room'),
                    321: __("You have been removed from this room because of an affiliation change"),
                    322: __("You have been removed from this room because the room has changed to members-only and you're not a member"),
                    332: __("You have been removed from this room because the MUC (Multi-user chat) service is being shut down.")
                },

                action_info_messages: {
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

                new_nickname_messages: {
                    210: ___('Your nickname has been automatically set to: <strong>%1$s</strong>'),
                    303: ___('Your nickname has been changed to: <strong>%1$s</strong>')
                }
            };

            // Configuration values for this plugin
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_muc: true,
                allow_muc_invitations: true,
                auto_join_on_invite: false,
                auto_join_rooms: [],
                auto_list_rooms: false,
                hide_muc_server: false,
                muc_disable_moderator_commands: false,
                muc_domain: undefined,
                muc_history_max_stanzas: undefined,
                muc_instant_rooms: true,
                muc_nickname_from_jid: false,
                visible_toolbar_buttons: {
                    'toggle_occupants': true
                },
            });

            converse.createChatRoom = function (settings) {
                /* Creates a new chat room, making sure that certain attributes
                 * are correct, for example that the "type" is set to
                 * "chatroom".
                 */
                return converse.chatboxviews.showChat(
                    _.extend(settings, {
                        'type': 'chatroom',
                        'affiliation': null,
                        'features_fetched': false,
                        'hidden': false,
                        'membersonly': false,
                        'moderated': false,
                        'nonanonymous': false,
                        'open': false,
                        'passwordprotected': false,
                        'persistent': false,
                        'public': false,
                        'semianonymous': false,
                        'temporary': false,
                        'unmoderated': false,
                        'unsecured': false,
                        'connection_status': Strophe.Status.DISCONNECTED
                    })
                );
            };

            converse.ChatRoomView = converse.ChatBoxView.extend({
                /* Backbone View which renders a chat room, based upon the view
                 * for normal one-on-one chat boxes.
                 */
                length: 300,
                tagName: 'div',
                className: 'chatbox chatroom hidden',
                is_chatroom: true,
                events: {
                    'click .close-chatbox-button': 'close',
                    'click .configure-chatroom-button': 'configureChatRoom',
                    'click .toggle-smiley': 'toggleEmoticonMenu',
                    'click .toggle-smiley ul li': 'insertEmoticon',
                    'click .toggle-clear': 'clearChatRoomMessages',
                    'click .toggle-call': 'toggleCall',
                    'click .toggle-occupants a': 'toggleOccupants',
                    'click .new-msgs-indicator': 'viewUnreadMessages',
                    'click .occupant': 'onOccupantClicked',
                    'keypress .chat-textarea': 'keyPressed'
                },

                initialize: function () {
                    var that = this;
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:chat_state', this.sendChatState, this);
                    this.model.on('change:affiliation', this.renderHeading, this);
                    this.model.on('change:name', this.renderHeading, this);

                    this.createOccupantsView();
                    this.render().insertIntoDOM(); // TODO: hide chat area until messages received.
                    // XXX: adding the event below to the declarative events map doesn't work.
                    // The code that gets executed because of that looks like this:
                    //      this.$el.on('scroll', '.chat-content', this.markScrolled.bind(this));
                    // Which for some reason doesn't work.
                    // So working around that fact here:
                    this.$el.find('.chat-content').on('scroll', this.markScrolled.bind(this));

                    this.getRoomFeatures().always(function () {
                        that.join();
                        that.fetchMessages();
                        converse.emit('chatRoomOpened', that);
                    });
                },

                createOccupantsView: function () {
                    /* Create the ChatRoomOccupantsView Backbone.View
                     */
                    this.occupantsview = new converse.ChatRoomOccupantsView({
                        model: new converse.ChatRoomOccupants()
                    });
                    var id = b64_sha1('converse.occupants'+converse.bare_jid+this.model.get('jid'));
                    this.occupantsview.model.browserStorage = new Backbone.BrowserStorage.session(id);
                    this.occupantsview.chatroomview = this;
                    this.occupantsview.render();
                    this.occupantsview.model.fetch({add:true});
                },

                insertIntoDOM: function () {
                    var view = converse.chatboxviews.get("controlbox");
                    if (view) {
                        this.$el.insertAfter(view.$el);
                    } else {
                        $('#conversejs').prepend(this.$el);
                    }
                    return this;
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                            .html(converse.templates.chatroom());
                    this.renderHeading();
                    this.renderChatArea();
                    utils.refreshWebkit();
                    return this;
                },

                generateHeadingHTML: function () {
                    /* Pure function which returns the heading HTML to be
                     * rendered.
                     */
                    return converse.templates.chatroom_head(
                        _.extend(this.model.toJSON(), {
                            info_close: __('Close and leave this room'),
                            info_configure: __('Configure this room'),
                    }));
                },

                renderHeading: function () {
                    /* Render the heading UI of the chat room.
                     */
                    this.el.querySelector('.chat-head-chatroom').innerHTML = this.generateHeadingHTML();
                },

                renderChatArea: function () {
                    /* Render the UI container in which chat room messages will
                     * appear.
                     */
                    if (!this.$('.chat-area').length) {
                        this.$('.chatroom-body').empty()
                            .append(
                                converse.templates.chatarea({
                                    'unread_msgs': __('You have unread messages'),
                                    'show_toolbar': converse.show_toolbar,
                                    'label_message': __('Message')
                                }))
                            .append(this.occupantsview.$el);
                        this.renderToolbar(tpl_chatroom_toolbar);
                        this.$content = this.$el.find('.chat-content');
                    }
                    this.toggleOccupants(null, true);
                    return this;
                },

                getToolbarOptions: function () {
                    return _.extend(
                        converse.ChatBoxView.prototype.getToolbarOptions.apply(this, arguments),
                        {
                          label_hide_occupants: __('Hide the list of occupants'),
                          show_occupants_toggle: this.is_chatroom && converse.visible_toolbar_buttons.toggle_occupants
                        }
                    );
                },

                close: function (ev) {
                    /* Close this chat box, which implies leaving the room as
                     * well.
                     */
                    this.leave();
                },

                toggleOccupants: function (ev, preserve_state) {
                    /* Show or hide the right sidebar containing the chat
                     * occupants (and the invite widget).
                     */
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    if (preserve_state) {
                        // Bit of a hack, to make sure that the sidebar's state doesn't change
                        this.model.set({hidden_occupants: !this.model.get('hidden_occupants')});
                    }
                    if (!this.model.get('hidden_occupants')) {
                        this.model.save({hidden_occupants: true});
                        this.$('.icon-hide-users').removeClass('icon-hide-users').addClass('icon-show-users');
                        this.$('.occupants').addClass('hidden');
                        this.$('.chat-area').addClass('full');
                        this.scrollDown();
                    } else {
                        this.model.save({hidden_occupants: false});
                        this.$('.icon-show-users').removeClass('icon-show-users').addClass('icon-hide-users');
                        this.$('.chat-area').removeClass('full');
                        this.$('div.occupants').removeClass('hidden');
                        this.scrollDown();
                    }
                },

                onOccupantClicked: function (ev) {
                    /* When an occupant is clicked, insert their nickname into
                     * the chat textarea input.
                     */
                    this.insertIntoTextArea(ev.target.textContent);
                },

                requestMemberList: function (affiliation) {
                    /* Send an IQ stanza to the server, asking it for the
                     * member-list of this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (String) affiliation: The specific member list to
                     *      fetch. 'admin', 'owner' or 'member'.
                     *
                     * Returns:
                     *  A promise which resolves once the list has been
                     *  retrieved.
                     */
                    var deferred = new $.Deferred();
                    affiliation = affiliation || 'member';
                    var iq = $iq({to: this.model.get('jid'), type: "get"})
                        .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {'affiliation': affiliation});
                    converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                    return deferred.promise();
                },

                parseMemberListIQ: function (iq) {
                    /* Given an IQ stanza with a member list, create an array of member
                     * objects.
                     */
                    return _.map(
                        $(iq).find('query[xmlns="'+Strophe.NS.MUC_ADMIN+'"] item'),
                        function (item) {
                            return {
                                'jid': item.getAttribute('jid'),
                                'affiliation': item.getAttribute('affiliation'),
                            };
                        }
                    );
                },

                computeAffiliationsDelta: function (exclude_existing, remove_absentees, new_list, old_list) {
                    /* Given two lists of objects with 'jid', 'affiliation' and
                     * 'reason' properties, return a new list containing
                     * those objects that are new, changed or removed
                     * (depending on the 'remove_absentees' boolean).
                     *
                     * The affiliations for new and changed members stay the
                     * same, for removed members, the affiliation is set to 'none'.
                     *
                     * The 'reason' property is not taken into account when
                     * comparing whether affiliations have been changed.
                     *
                     * Parameters:
                     *  (Boolean) exclude_existing: Indicates whether JIDs from
                     *      the new list which are also in the old list
                     *      (regardless of affiliation) should be excluded
                     *      from the delta. One reason to do this
                     *      would be when you want to add a JID only if it
                     *      doesn't have *any* existing affiliation at all.
                     *  (Boolean) remove_absentees: Indicates whether JIDs
                     *      from the old list which are not in the new list
                     *      should be considered removed and therefore be
                     *      included in the delta with affiliation set
                     *      to 'none'.
                     *  (Array) new_list: Array containing the new affiliations
                     *  (Array) old_list: Array containing the old affiliations
                     */
                    var new_jids = _.pluck(new_list, 'jid');
                    var old_jids = _.pluck(old_list, 'jid');

                    // Get the new affiliations
                    var delta = _.map(_.difference(new_jids, old_jids), function (jid) {
                        return new_list[_.indexOf(new_jids, jid)];
                    });
                    if (!exclude_existing) {
                        // Get the changed affiliations
                        delta = delta.concat(_.filter(new_list, function (item) {
                            var idx = _.indexOf(old_jids, item.jid);
                            if (idx >= 0) {
                                return item.affiliation !== old_list[idx].affiliation;
                            }
                            return false;
                        }));
                    }
                    if (remove_absentees) {
                        // Get the removed affiliations
                        delta = delta.concat(_.map(_.difference(old_jids, new_jids), function (jid) {
                            return {'jid': jid, 'affiliation': 'none'};
                        }));
                    }
                    return delta;
                },

                setAffiliation: function (affiliation, members) {
                    /* Send IQ stanzas to the server to set an affiliation for
                     * the provided JIDs.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * XXX: Prosody doesn't accept multiple JIDs' affiliations
                     * being set in one IQ stanza, so as a workaround we send
                     * a separate stanza for each JID.
                     * Related ticket: https://prosody.im/issues/issue/795
                     *
                     * Parameters:
                     *  (Object) members: A map of jids, affiliations and
                     *      optionally reasons. Only those entries with the
                     *      same affiliation as being currently set will be
                     *      considered.
                     *
                     * Returns:
                     *  A promise which resolves and fails depending on the
                     *  XMPP server response.
                     */
                    members = _.filter(members, function (member) {
                        // We only want those members who have the right
                        // affiliation (or none, which implies the provided
                        // one).
                        return _.isUndefined(member.affiliation) ||
                                member.affiliation === affiliation;
                    });
                    var promises = _.map(members, function (member) {
                        var deferred = new $.Deferred();
                        var iq = $iq({to: this.model.get('jid'), type: "set"})
                            .c("query", {xmlns: Strophe.NS.MUC_ADMIN})
                            .c("item", {
                                'affiliation': member.affiliation || affiliation,
                                'jid': member.jid
                            });
                        if (!_.isUndefined(member.reason)) {
                            iq.c("reason", member.reason);
                        }
                        converse.connection.sendIQ(iq, deferred.resolve, deferred.reject);
                        return deferred;
                    }, this);
                    return $.when.apply($, promises);
                },

                setAffiliations: function (members, onSuccess, onError) {
                    /* Send IQ stanzas to the server to modify the
                     * affiliations in this room.
                     *
                     * See: http://xmpp.org/extensions/xep-0045.html#modifymember
                     *
                     * Parameters:
                     *  (Object) members: A map of jids, affiliations and optionally reasons
                     *  (Function) onSuccess: callback for a succesful response
                     *  (Function) onError: callback for an error response
                     */
                    if (_.isEmpty(members)) {
                        // Succesfully updated with zero affilations :)
                        onSuccess(null);
                        return;
                    }
                    var affiliations = _.uniq(_.pluck(members, 'affiliation'));
                    var promises = _.map(affiliations, _.partial(this.setAffiliation, _, members), this);
                    $.when.apply($, promises).done(onSuccess).fail(onError);
                },

                marshallAffiliationIQs: function () {
                    /* Marshall a list of IQ stanzas into a map of JIDs and
                     * affiliations.
                     *
                     * Parameters:
                     *  Any amount of XMLElement objects, representing the IQ
                     *  stanzas.
                     */
                    return _.flatten(_.map(arguments, this.parseMemberListIQ));
                },

                getJidsWithAffiliations: function (affiliations) {
                    /* Returns a map of JIDs that have the affiliations
                     * as provided.
                     */
                    if (typeof affiliations === "string") {
                        affiliations = [affiliations];
                    }
                    var that = this;
                    var deferred = new $.Deferred();
                    var promises = [];
                    _.each(affiliations, function (affiliation) {
                        promises.push(that.requestMemberList(affiliation));
                    });
                    $.when.apply($, promises).always(
                        _.compose(deferred.resolve, this.marshallAffiliationIQs.bind(this))
                    );
                    return deferred.promise();
                },

                updateMemberLists: function (members, affiliations, deltaFunc) {
                    /* Fetch the lists of users with the given affiliations.
                     * Then compute the delta between those users and
                     * the passed in members, and if it exists, send the delta
                     * to the XMPP server to update the member list.
                     *
                     * Parameters:
                     *  (Object) members: Map of member jids and affiliations.
                     *  (String|Array) affiliation: An array of affiliations or
                     *      a string if only one affiliation.
                     *  (Function) deltaFunc: The function to compute the delta
                     *      between old and new member lists.
                     *
                     * Returns:
                     *  A promise which is resolved once the list has been
                     *  updated or once it's been established there's no need
                     *  to update the list.
                     */
                    var that = this;
                    var deferred = new $.Deferred();
                    this.getJidsWithAffiliations(affiliations).then(function (old_members) {
                        that.setAffiliations(
                            deltaFunc(members, old_members),
                            deferred.resolve,
                            deferred.reject
                        );
                    });
                    return deferred.promise();
                },

                directInvite: function (recipient, reason) {
                    /* Send a direct invitation as per XEP-0249
                     *
                     * Parameters:
                     *    (String) recipient - JID of the person being invited
                     *    (String) reason - Optional reason for the invitation
                     */
                    if (this.model.get('membersonly')) {
                        // When inviting to a members-only room, we first add
                        // the person to the member list by giving them an
                        // affiliation of 'member' (if they're not affiliated
                        // already), otherwise they won't be able to join.
                        var map = {}; map[recipient] = 'member';
                        var deltaFunc = _.partial(this.computeAffiliationsDelta, true, false);
                        this.updateMemberLists(
                            [{'jid': recipient, 'affiliation': 'member', 'reason': reason}],
                            ['member', 'owner', 'admin'],
                            deltaFunc
                        );
                    }
                    var attrs = {
                        'xmlns': 'jabber:x:conference',
                        'jid': this.model.get('jid')
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

                handleChatStateMessage: function (message) {
                    /* Override the method on the ChatBoxView base class to
                     * ignore <gone/> notifications in groupchats.
                     *
                     * As laid out in the business rules in XEP-0085
                     * http://xmpp.org/extensions/xep-0085.html#bizrules-groupchat
                     */
                    if (message.get('fullname') === this.model.get('nick')) {
                        // Don't know about other servers, but OpenFire sends
                        // back to you your own chat state notifications.
                        // We ignore them here...
                        return;
                    }
                    if (message.get('chat_state') !== converse.GONE) {
                        converse.ChatBoxView.prototype.handleChatStateMessage.apply(this, arguments);
                    }
                },

                sendChatState: function () {
                    /* Sends a message with the status of the user in this chat session
                     * as taken from the 'chat_state' attribute of the chat box.
                     * See XEP-0085 Chat State Notifications.
                     */
                    var chat_state = this.model.get('chat_state');
                    if (chat_state === converse.GONE) {
                        // <gone/> is not applicable within MUC context
                        return;
                    }
                    converse.connection.send(
                        $msg({'to':this.model.get('jid'), 'type': 'groupchat'})
                            .c(chat_state, {'xmlns': Strophe.NS.CHATSTATES}).up()
                            .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                            .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS})
                    );
                },

                sendChatRoomMessage: function (text) {
                    /* Constuct a message stanza to be sent to this chat room,
                     * and send it to the server.
                     *
                     * Parameters:
                     *  (String) text: The message text to be sent.
                     */
                    var msgid = converse.connection.getUniqueId();
                    var msg = $msg({
                        to: this.model.get('jid'),
                        from: converse.connection.jid,
                        type: 'groupchat',
                        id: msgid
                    }).c("body").t(text).up()
                    .c("x", {xmlns: "jabber:x:event"}).c(converse.COMPOSING);
                    converse.connection.send(msg);
                    this.model.messages.create({
                        fullname: this.model.get('nick'),
                        sender: 'me',
                        time: moment().format(),
                        message: text,
                        msgid: msgid
                    });
                },

                modifyRole: function(room, nick, role, reason, onSuccess, onError) {
                    var item = $build("item", {nick: nick, role: role});
                    var iq = $iq({to: room, type: "set"}).c("query", {xmlns: Strophe.NS.MUC_ADMIN}).cnode(item.node);
                    if (reason !== null) { iq.c("reason", reason); }
                    return converse.connection.sendIQ(iq.tree(), onSuccess, onError);
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

                clearChatRoomMessages: function (ev) {
                    /* Remove all messages from the chat room UI.
                     */
                    if (typeof ev !== "undefined") { ev.stopPropagation(); }
                    var result = confirm(__("Are you sure you want to clear the messages from this room?"));
                    if (result === true) {
                        this.$content.empty();
                    }
                    return this;
                },

                onCommandError: function () {
                    this.showStatusNotification(__("Error: could not execute the command"), true);
                },

                onMessageSubmitted: function (text) {
                    /* Gets called when the user presses enter to send off a
                     * message in a chat room.
                     *
                     * Parameters:
                     *    (String) text - The message text.
                     */
                    if (converse.muc_disable_moderator_commands) {
                        return this.sendChatRoomMessage(text);
                    }
                    var match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''],
                        args = match[2] && match[2].splitOnce(' ') || [];
                    switch (match[1]) {
                        case 'admin':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation('admin',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'ban':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation('outcast',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
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
                            this.setAffiliation('member',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
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
                            this.setAffiliation('owner',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
                            break;
                        case 'op':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.modifyRole(
                                    this.model.get('jid'), args[0], 'moderator', args[1],
                                    undefined, this.onCommandError.bind(this));
                            break;
                        case 'revoke':
                            if (!this.validateRoleChangeCommand(match[1], args)) { break; }
                            this.setAffiliation('none',
                                    [{ 'jid': args[0],
                                       'reason': args[1]
                                    }]).fail(this.onCommandError.bind(this));
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

                handleMUCMessage: function (stanza) {
                    /* Handler for all MUC messages sent to this chat room.
                     *
                     * MAM (message archive management XEP-0313) messages are
                     * ignored, since they're handled separately.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message stanza.
                     */
                    var is_mam = $(stanza).find('[xmlns="'+Strophe.NS.MAM+'"]').length > 0;
                    if (is_mam) {
                        return true;
                    }
                    var configuration_changed = stanza.querySelector("status[code='104']");
                    var logging_enabled = stanza.querySelector("status[code='170']");
                    var logging_disabled = stanza.querySelector("status[code='171']");
                    var room_no_longer_anon = stanza.querySelector("status[code='172']");
                    var room_now_semi_anon = stanza.querySelector("status[code='173']");
                    var room_now_fully_anon = stanza.querySelector("status[code='173']");
                    if (configuration_changed || logging_enabled || logging_disabled ||
                            room_no_longer_anon || room_now_semi_anon || room_now_fully_anon) {
                        this.getRoomFeatures();
                    }
                    _.compose(this.onChatRoomMessage.bind(this), this.showStatusMessages.bind(this))(stanza);
                    return true;
                },

                getRoomJIDAndNick: function (nick) {
                    /* Utility method to construct the JID for the current user
                     * as occupant of the room.
                     *
                     * This is the room JID, with the user's nick added at the
                     * end.
                     *
                     * For example: room@conference.example.org/nickname
                     */
                    if (nick) {
                        this.model.save({'nick': nick});
                    } else {
                        nick = this.model.get('nick');
                    }
                    var room = this.model.get('jid');
                    var node = Strophe.getNodeFromJid(room);
                    var domain = Strophe.getDomainFromJid(room);
                    return node + "@" + domain + (nick !== null ? "/" + nick : "");
                },

                registerHandlers: function () {
                    /* Register presence and message handlers for this chat
                     * room
                     */
                    var room_jid = this.model.get('jid');
                    this.removeHandlers();
                    this.presence_handler = converse.connection.addHandler(
                        this.onChatRoomPresence.bind(this),
                        Strophe.NS.MUC, 'presence', null, null, room_jid,
                        {'ignoreNamespaceFragment': true, 'matchBareFromJid': true}
                    );
                    this.message_handler = converse.connection.addHandler(
                        this.handleMUCMessage.bind(this),
                        null, 'message', null, null, room_jid,
                        {'matchBareFromJid': true}
                    );
                },

                removeHandlers: function () {
                    /* Remove the presence and message handlers that were
                     * registered for this chat room.
                     */
                    if (this.message_handler) {
                        converse.connection.deleteHandler(this.message_handler);
                        delete this.message_handler;
                    }
                    if (this.presence_handler) {
                        converse.connection.deleteHandler(this.presence_handler);
                        delete this.presence_handler;
                    }
                    return this;
                },

                join: function (nick, password) {
                    /* Join the chat room.
                     *
                     * Parameters:
                     *  (String) nick: The user's nickname
                     *  (String) password: Optional password, if required by
                     *      the room.
                     */
                    nick = nick ? nick : this.model.get('nick');
                    if (!nick) {
                        return this.checkForReservedNick();
                    }
                    this.registerHandlers();
                    if (this.model.get('connection_status') ===  Strophe.Status.CONNECTED) {
                        // We have restored a chat room from session storage,
                        // so we don't send out a presence stanza again.
                        return this;
                    }
                    var stanza = $pres({
                        'from': converse.connection.jid,
                        'to': this.getRoomJIDAndNick(nick)
                    }).c("x", {'xmlns': Strophe.NS.MUC})
                      .c("history", {'maxstanzas': converse.muc_history_max_stanzas}).up();
                    if (password) {
                        stanza.cnode(Strophe.xmlElement("password", [], password));
                    }
                    this.model.save('connection_status', Strophe.Status.CONNECTING);
                    converse.connection.send(stanza);
                    return this;
                },

                cleanup: function () {
                    this.model.save('connection_status', Strophe.Status.DISCONNECTED);
                    this.removeHandlers();
                    converse.ChatBoxView.prototype.close.apply(this, arguments);
                },

                leave: function(exit_msg) {
                    /* Leave the chat room.
                     *
                     * Parameters:
                     *  (String) exit_msg: Optional message to indicate your
                     *      reason for leaving.
                     */
                    this.hide();
                    this.occupantsview.model.reset();
                    this.occupantsview.model.browserStorage._clear();
                    if (!converse.connection.connected ||
                            this.model.get('connection_status') === Strophe.Status.DISCONNECTED) {
                        // Don't send out a stanza if we're not connected.
                        this.cleanup();
                        return;
                    }
                    var presence = $pres({
                        type: "unavailable",
                        from: converse.connection.jid,
                        to: this.getRoomJIDAndNick()
                    });
                    if (exit_msg !== null) {
                        presence.c("status", exit_msg);
                    }
                    converse.connection.sendPresence(
                        presence,
                        this.cleanup.bind(this),
                        this.cleanup.bind(this),
                        2000
                    );
                },

                renderConfigurationForm: function (stanza) {
                    /* Renders a form given an IQ stanza containing the current
                     * room configuration.
                     *
                     * Returns a promise which resolves once the user has
                     * either submitted the form, or canceled it.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The IQ stanza containing the room config.
                     */
                    var that = this,
                        $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(converse.templates.chatroom_form());

                    var $form = $body.find('form.chatroom-form'),
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
                    $fieldset.find('input[type=button]').on('click', function (ev) {
                        ev.preventDefault();
                        that.cancelConfiguration();
                    });
                    $form.on('submit', function (ev) {
                        ev.preventDefault();
                        that.saveConfiguration(ev.target);
                    });
                },

                sendConfiguration: function(config, onSuccess, onError) {
                    /* Send an IQ stanza with the room configuration.
                     *
                     * Parameters:
                     *  (Array) config: The room configuration
                     *  (Function) onSuccess: Callback upon succesful IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     *  (Function) onError: Callback upon error IQ response
                     *      The first parameter passed in is IQ containing the
                     *      room configuration.
                     *      The second is the response IQ from the server.
                     */
                    var iq = $iq({to: this.model.get('jid'), type: "set"})
                        .c("query", {xmlns: Strophe.NS.MUC_OWNER})
                        .c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
                    _.each(config || [], function (node) { iq.cnode(node).up(); });
                    onSuccess = _.isUndefined(onSuccess) ? _.noop : _.partial(onSuccess, iq.nodeTree);
                    onError = _.isUndefined(onError) ? _.noop : _.partial(onError, iq.nodeTree);
                    return converse.connection.sendIQ(iq, onSuccess, onError);
                },

                saveConfiguration: function (form) {
                    /* Submit the room configuration form by sending an IQ
                     * stanza to the server.
                     *
                     * Returns a promise which resolves once the XMPP server
                     * has return a response IQ.
                     *
                     * Parameters:
                     *  (HTMLElement) form: The configuration form DOM element.
                     */
                    var that = this;
                    var $inputs = $(form).find(':input:not([type=button]):not([type=submit])'),
                        configArray = [];
                    $inputs.each(function () {
                        configArray.push(utils.webForm2xForm(this));
                    });
                    this.sendConfiguration(configArray);
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                        });
                },

                autoConfigureChatRoom: function (stanza) {
                    /* Automatically configure room based on the
                     * 'roomconfigure' data on this view's model.
                     *
                     * Returns a promise which resolves once a response IQ has
                     * been received.
                     *
                     * Parameters:
                     *  (XMLElement) stanza: IQ stanza from the server,
                     *       containing the configuration.
                     */
                    var that = this, configArray = [],
                        $fields = $(stanza).find('field'),
                        count = $fields.length,
                        config = this.model.get('roomconfig');

                    $fields.each(function () {
                        var fieldname = this.getAttribute('var').replace('muc#roomconfig_', ''),
                            type = this.getAttribute('type'),
                            value;
                        if (fieldname in config) {
                            switch (type) {
                                case 'boolean':
                                    value = config[fieldname] ? 1 : 0;
                                    break;
                                case 'list-multi':
                                    // TODO: we don't yet handle "list-multi" types
                                    value = this.innerHTML;
                                    break;
                                default:
                                    value = config[fieldname];
                            }
                            this.innerHTML = $build('value').t(value);
                        }
                        configArray.push(this);
                        if (!--count) {
                            that.sendConfiguration(configArray);
                        }
                    });
                },

                cancelConfiguration: function () {
                    /* Remove the configuration form without submitting and
                     * return to the chat view.
                     */
                    var that = this;
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                        });
                },

                fetchRoomConfiguration: function (handler) {
                    /* Send an IQ stanza to fetch the room configuration data.
                     * Returns a promise which resolves once the response IQ
                     * has been received.
                     *
                     * Parameters:
                     *  (Function) handler: The handler for the response IQ
                     */
                    var that = this;
                    var deferred = new $.Deferred();
                    converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'type': "get"
                        }).c("query", {xmlns: Strophe.NS.MUC_OWNER}),
                        function (iq) {
                            if (handler) {
                                handler.apply(that, arguments);
                            }
                            deferred.resolve(iq);
                        },
                        deferred.reject // errback
                    );
                    return deferred.promise();
                },

                getRoomFeatures: function () {
                    /* Fetch the room disco info, parse it and then
                     * save it on the Backbone.Model of this chat rooms.
                     */
                    var deferred = new $.Deferred();
                    var that = this;
                    converse.connection.disco.info(this.model.get('jid'), null,
                        function (iq) {
                            /*
                             * See http://xmpp.org/extensions/xep-0045.html#disco-roominfo
                             *
                             *  <identity
                             *      category='conference'
                             *      name='A Dark Cave'
                             *      type='text'/>
                             *  <feature var='http://jabber.org/protocol/muc'/>
                             *  <feature var='muc_passwordprotected'/>
                             *  <feature var='muc_hidden'/>
                             *  <feature var='muc_temporary'/>
                             *  <feature var='muc_open'/>
                             *  <feature var='muc_unmoderated'/>
                             *  <feature var='muc_nonanonymous'/>
                             */
                            var features = {
                                'features_fetched': true
                            };
                            _.each(iq.querySelectorAll('feature'), function (field) {
                                var fieldname = field.getAttribute('var');
                                if (!fieldname.startsWith('muc_')) {
                                    return;
                                }
                                features[fieldname.replace('muc_', '')] = true;
                            });
                            that.model.save(features);
                            return deferred.resolve();
                        },
                        deferred.reject
                    );
                    return deferred.promise();
                },

                configureChatRoom: function (ev) {
                    /* Start the process of configuring a chat room, either by
                     * rendering a configuration form, or by auto-configuring
                     * based on the "roomconfig" data stored on the
                     * Backbone.Model.
                     *
                     * Stores the new configuration on the Backbone.Model once
                     * completed.
                     *
                     * Paremeters:
                     *  (Event) ev: DOM event that might be passed in if this
                     *      method is called due to a user action. In this
                     *      case, auto-configure won't happen, regardless of
                     *      the settings.
                     */
                    var that = this;
                    if (_.isUndefined(ev) && this.model.get('auto_configure')) {
                        this.fetchRoomConfiguration().then(that.autoConfigureChatRoom.bind(that));
                    } else {
                        if (typeof ev !== 'undefined' && ev.preventDefault) {
                            ev.preventDefault();
                        }
                        this.showSpinner();
                        this.fetchRoomConfiguration().then(that.renderConfigurationForm.bind(that));
                    }
                },

                submitNickname: function (ev) {
                    /* Get the nickname value from the form and then join the
                     * chat room with it.
                     */
                    ev.preventDefault();
                    var $nick = this.$el.find('input[name=nick]');
                    var nick = $nick.val();
                    if (!nick) {
                        $nick.addClass('error');
                        return;
                    }
                    else {
                        $nick.removeClass('error');
                    }
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(nick);
                },

                checkForReservedNick: function () {
                    /* User service-discovery to ask the XMPP server whether
                     * this user has a reserved nickname for this room.
                     * If so, we'll use that, otherwise we render the nickname
                     * form.
                     */
                    this.showSpinner();
                    converse.connection.sendIQ(
                        $iq({
                            'to': this.model.get('jid'),
                            'from': converse.connection.jid,
                            'type': "get"
                        }).c("query", {
                            'xmlns': Strophe.NS.DISCO_INFO,
                            'node': 'x-roomuser-item'
                        }),
                        this.onNickNameFound.bind(this),
                        this.onNickNameNotFound.bind(this)
                    );
                    return this;
                },

                onNickNameFound: function (iq) {
                    /* We've received an IQ response from the server which
                     * might contain the user's reserved nickname.
                     * If no nickname is found we either render a form for
                     * them to specify one, or we try to join the room with the
                     * node of the user's JID.
                     *
                     * Parameters:
                     *  (XMLElement) iq: The received IQ stanza
                     */
                    var nick = $(iq)
                        .find('query[node="x-roomuser-item"] identity')
                        .attr('name');
                    if (!nick) {
                        this.onNickNameNotFound();
                    } else {
                        this.join(nick);
                    }
                },

                onNickNameNotFound: function (message) {
                    if (converse.muc_nickname_from_jid) {
                        // We try to enter the room with the node part of
                        // the user's JID.
                        this.join(Strophe.unescapeNode(Strophe.getNodeFromJid(converse.bare_jid)));
                    } else {
                        this.renderNicknameForm(message);
                    }
                },

                getDefaultNickName: function () {
                    /* The default nickname (used when muc_nickname_from_jid is true)
                     * is the node part of the user's JID.
                     * We put this in a separate method so that it can be
                     * overridden by plugins.
                     */
                    return Strophe.unescapeNode(Strophe.getNodeFromJid(converse.bare_jid));
                },

                onNicknameClash: function (presence) {
                    /* When the nickname is already taken, we either render a
                     * form for the user to choose a new nickname, or we
                     * try to make the nickname unique by adding an integer to
                     * it. So john will become john-2, and then john-3 and so on.
                     *
                     * Which option is take depends on the value of
                     * muc_nickname_from_jid.
                     */
                    if (converse.muc_nickname_from_jid) {
                        var nick = presence.getAttribute('from').split('/')[1];
                        if (nick === this.getDefaultNickName()) {
                            this.join(nick + '-2');
                        } else {
                            var del= nick.lastIndexOf("-");
                            var num = nick.substring(del+1, nick.length);
                            this.join(nick.substring(0, del+1) + String(Number(num)+1));
                        }
                    } else {
                        this.renderNicknameForm(
                            __("The nickname you chose is reserved or currently in use, please choose a different one.")
                        );
                    }
                },

                renderNicknameForm: function (message) {
                    /* Render a form which allows the user to choose their
                     * nickname.
                     */
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    if (typeof message !== "string") {
                        message = '';
                    }
                    this.$('.chatroom-body').append(
                        converse.templates.chatroom_nickname_form({
                            heading: __('Please choose your nickname'),
                            label_nickname: __('Nickname'),
                            label_join: __('Enter room'),
                            validation_message: message
                        }));
                    this.$('.chatroom-form').on('submit', this.submitNickname.bind(this));
                },

                submitPassword: function (ev) {
                    ev.preventDefault();
                    var password = this.$el.find('.chatroom-form').find('input[type=password]').val();
                    this.$el.find('.chatroom-form-container').replaceWith('<span class="spinner centered"/>');
                    this.join(this.model.get('nick'), password);
                },

                renderPasswordForm: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
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
                    this.$('.chat-area').addClass('hidden');
                    this.$('.occupants').addClass('hidden');
                    this.$('span.centered.spinner').remove();
                    this.$('.chatroom-body').append($('<p>'+msg+'</p>'));
                },

                getMessageFromStatus: function (stat, stanza, is_self) {
                    /* Parameters:
                     *  (XMLElement) stat: A <status> element.
                     *  (Boolean) is_self: Whether the element refers to the
                     *                     current user.
                     *  (XMLElement) stanza: The original stanza received.
                     */
                    var code = stat.getAttribute('code'),
                        from_nick;
                    if (is_self && code === "210") {
                        from_nick = Strophe.unescapeNode(Strophe.getResourceFromJid(stanza.getAttribute('from')));
                        return __(converse.muc.new_nickname_messages[code], from_nick);
                    } else if (is_self && code === "303") {
                        return __(
                            converse.muc.new_nickname_messages[code],
                            stanza.querySelector('x item').getAttribute('nick')
                        );
                    } else if (!is_self && (code in converse.muc.action_info_messages)) {
                        from_nick = Strophe.unescapeNode(Strophe.getResourceFromJid(stanza.getAttribute('from')));
                        return __(converse.muc.action_info_messages[code], from_nick);
                    } else if (code in converse.muc.info_messages) {
                        return converse.muc.info_messages[code];
                    } else if (code !== '110') {
                        if (stat.textContent) {
                            // Sometimes the status contains human readable text and not a code.
                            return stat.textContent;
                        }
                    }
                    return;
                },

                saveAffiliationAndRole: function (pres) {
                    /* Parse the presence stanza for the current user's
                     * affiliation.
                     *
                     * Parameters:
                     *  (XMLElement) pres: A <presence> stanza.
                     */
                    // XXX: For some inexplicable reason, the following line of
                    // code works in tests, but not with live data, even though
                    // the passed in stanza looks exactly the same to me:
                    // var item = pres.querySelector('x[xmlns="'+Strophe.NS.MUC_USER+'"] item');
                    // If we want to eventually get rid of jQuery altogether,
                    // then the Sizzle selector library might still be needed
                    // here.
                    var item = $(pres).find('x[xmlns="'+Strophe.NS.MUC_USER+'"] item').get(0);
                    if (_.isUndefined(item)) { return; }
                    var jid = item.getAttribute('jid');
                    if (Strophe.getBareJidFromJid(jid) === converse.bare_jid) {
                        var affiliation = item.getAttribute('affiliation');
                        var role = item.getAttribute('role');
                        if (affiliation) {
                            this.model.save({'affiliation': affiliation});
                        }
                        if (role) {
                            this.model.save({'role': role});
                        }
                    }
                },

                parseXUserElement: function (x, stanza, is_self) {
                    /* Parse the passed-in <x xmlns='http://jabber.org/protocol/muc#user'>
                     * element and construct a map containing relevant
                     * information.
                     */
                    // 1. Get notification messages based on the <status> elements.
                    var statuses = x.querySelectorAll('status');
                    var mapper = _.partial(this.getMessageFromStatus, _, stanza, is_self);
                    var notification = {
                        'messages': _.reject(_.map(statuses, mapper), _.isUndefined),
                    };
                    // 2. Get disconnection messages based on the <status> elements
                    var codes = _.map(statuses, function (stat) { return stat.getAttribute('code'); });
                    var disconnection_codes = _.intersection(codes, _.keys(converse.muc.disconnect_messages));
                    var disconnected = is_self && disconnection_codes.length > 0;
                    if (disconnected) {
                        notification.disconnected = true;
                        notification.disconnection_message = converse.muc.disconnect_messages[disconnection_codes[0]];
                    }
                    // 3. Find the reason and actor from the <item> element
                    var item = x.querySelector('item');
                    // By using querySelector above, we assume here there is
                    // one <item> per <x xmlns='http://jabber.org/protocol/muc#user'>
                    // element. This appears to be a safe assumption, since
                    // each <x/> element pertains to a single user.
                    if (!_.isNull(item)) {
                        var reason = item.querySelector('reason');
                        if (reason) {
                            notification.reason = reason ? reason.textContent : undefined;
                        }
                        var actor = item.querySelector('actor');
                        if (actor) {
                            notification.actor = actor ? actor.getAttribute('nick') : undefined;
                        }
                    }
                    return notification;
                },

                displayNotificationsforUser: function (notification) {
                    /* Given the notification object generated by
                     * parseXUserElement, display any relevant messages and
                     * information to the user.
                     */
                    var that = this;
                    if (notification.disconnected) {
                        this.showDisconnectMessage(notification.disconnection_message);
                        if (notification.actor) {
                            this.showDisconnectMessage(__(___('This action was done by <strong>%1$s</strong>.'), notification.actor));
                        }
                        if (notification.reason) {
                            this.showDisconnectMessage(__(___('The reason given is: <em>"%1$s"</em>.'), notification.reason));
                        }
                        this.model.save('connection_status', Strophe.Status.DISCONNECTED);
                        return;
                    }
                    _.each(notification.messages, function (message) {
                        that.$content.append(converse.templates.info({'message': message}));
                    });
                    if (notification.reason) {
                        this.showStatusNotification(__('The reason given is: "'+notification.reason+'"'), true);
                    }
                    if (notification.messages.length) {
                        this.scrollDown();
                    }
                },

                showStatusMessages: function (stanza) {
                    /* Check for status codes and communicate their purpose to the user.
                     * See: http://xmpp.org/registrar/mucstatus.html
                     *
                     * Parameters:
                     *  (XMLElement) stanza: The message or presence stanza
                     *      containing the status codes.
                     */
                    var is_self = stanza.querySelectorAll("status[code='110']").length;

                    // Unfortunately this doesn't work (returns empty list)
                    // var elements = stanza.querySelectorAll('x[xmlns="'+Strophe.NS.MUC_USER+'"]');
                    var elements = _.chain(stanza.querySelectorAll('x')).filter(function (x) {
                        return x.getAttribute('xmlns') === Strophe.NS.MUC_USER;
                    }).value();

                    var notifications = _.map(
                        elements,
                        _.partial(this.parseXUserElement.bind(this), _, stanza, is_self)
                    );
                    _.each(notifications, this.displayNotificationsforUser.bind(this));
                    return stanza;
                },

                showErrorMessage: function (presence) {
                    // We didn't enter the room, so we must remove it from the MUC
                    // add-on
                    var $error = $(presence).find('error');
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
                            this.onNicknameClash(presence);
                        } else if ($error.find('item-not-found').length) {
                            this.showDisconnectMessage(__("This room does not (yet) exist"));
                        } else if ($error.find('service-unavailable').length) {
                            this.showDisconnectMessage(__("This room has reached its maximum number of occupants"));
                        }
                    }
                },

                showSpinner: function () {
                    this.$('.chatroom-body').children().addClass('hidden');
                    this.$el.find('.chatroom-body').prepend('<span class="spinner centered"/>');
                },

                hideSpinner: function () {
                    /* Check if the spinner is being shown and if so, hide it.
                     * Also make sure then that the chat area and occupants
                     * list are both visible.
                     */
                    var that = this;
                    var $spinner = this.$el.find('.spinner');
                    if ($spinner.length) {
                        $spinner.hide(function () {
                            $(this).remove();
                            that.$el.find('.chat-area').removeClass('hidden');
                            that.$el.find('.occupants').removeClass('hidden');
                            that.scrollDown();
                        });
                    }
                    return this;
                },

                createInstantRoom: function () {
                    /* Sends an empty IQ config stanza to inform the server that the
                     * room should be created with its default configuration.
                     *
                     * See http://xmpp.org/extensions/xep-0045.html#createroom-instant
                     */
                    this.sendConfiguration().then(this.getRoomFeatures.bind(this));
                },

                onChatRoomPresence: function (pres) {
                    /* Handles all MUC presence stanzas.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The stanza
                     */
                    if (pres.getAttribute('type') === 'error') {
                        this.model.save('connection_status', Strophe.Status.DISCONNECTED);
                        this.showErrorMessage(pres);
                        return true;
                    }
                    var show_status_messages = true;
                    var is_self = pres.querySelector("status[code='110']");
                    var new_room = pres.querySelector("status[code='201']");

                    if (is_self) {
                        this.saveAffiliationAndRole(pres);
                    }
                    if (is_self && new_room) {
                        // This is a new room. It will now be configured
                        // and the configuration cached on the
                        // Backbone.Model.
                        if (converse.muc_instant_rooms) {
                            this.createInstantRoom(); // Accept default configuration
                        } else {
                            this.configureChatRoom();
                            if (!this.model.get('auto_configure')) {
                                // We don't show status messages if the
                                // configuration form is being shown.
                                show_status_messages = false;
                            }
                        }
                    } else if (!this.model.get('features_fetched') &&
                                    this.model.get('connection_status') !== Strophe.Status.CONNECTED) {
                        // The features for this room weren't fetched yet, perhaps
                        // because it's a new room without locking (in which
                        // case Prosody doesn't send a 201 status).
                        // This is the first presence received for the room, so
                        // a good time to fetch the features.
                        this.getRoomFeatures();
                    }
                    if (show_status_messages) {
                        this.hideSpinner().showStatusMessages(pres);
                    }
                    this.occupantsview.updateOccupantsOnPresence(pres);
                    if (this.model.get('role') !== 'none') {
                        this.model.save('connection_status', Strophe.Status.CONNECTED);
                    }
                    return true;
                },

                setChatRoomSubject: function (sender, subject) {
                    this.$el.find('.chatroom-topic').text(subject).attr('title', subject);
                    // For translators: the %1$s and %2$s parts will get replaced by the user and topic text respectively
                    // Example: Topic set by JC Brand to: Hello World!
                    this.$content.append(
                        converse.templates.info({
                            'message': __('Topic set by %1$s to: %2$s', sender, subject)
                        }));
                    this.scrollDown();
                },

                onChatRoomMessage: function (msg) {
                    /* Given a <message> stanza, create a message
                     * Backbone.Model if appropriate.
                     *
                     * Parameters:
                     *  (XMLElement) msg: The received message stanza
                     */
                    var $message = $(msg),
                        $forwarded = $message.find('forwarded'),
                        $delay;
                    if ($forwarded.length) {
                        $message = $forwarded.children('message');
                        $delay = $forwarded.children('delay');
                    }
                    var jid = msg.getAttribute('from'),
                        msgid = msg.getAttribute('id'),
                        resource = Strophe.getResourceFromJid(jid),
                        sender = resource && Strophe.unescapeNode(resource) || '',
                        subject = $message.children('subject').text(),
                        dupes = msgid && this.model.messages.filter(function (msg) {
                            // Find duplicates.
                            // Some bots (like HAL in the prosody chatroom)
                            // respond to commands with the same ID as the
                            // original message. So we also check the sender.
                            return msg.get('msgid') === msgid && msg.get('fullname') === sender;
                        });
                    if (dupes && dupes.length) {
                        return true;
                    }
                    if (subject) {
                        this.setChatRoomSubject(sender, subject);
                    }
                    if (sender === '') {
                        return true;
                    }
                    this.model.createMessage($message, $delay, msg);
                    if (sender !== this.model.get('nick')) {
                        // We only emit an event if it's not our own message
                        converse.emit('message', msg);
                    }
                    return true;
                },

                fetchArchivedMessages: function (options) {
                    /* Fetch archived chat messages from the XMPP server.
                     *
                     * Then, upon receiving them, call onChatRoomMessage
                     * so that they are displayed inside it.
                     */
                    var that = this;
                    if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        converse.log("Attempted to fetch archived messages but this user's server doesn't support XEP-0313");
                        return;
                    }
                    this.addSpinner();
                    converse_api.archive.query(_.extend(options, {'groupchat': true}),
                        function (messages) {
                            that.clearSpinner();
                            if (messages.length) {
                                _.map(messages, that.onChatRoomMessage.bind(that));
                            }
                        },
                        function () {
                            that.clearSpinner();
                            converse.log("Error while trying to fetch archived messages", "error");
                        }
                    );
                }
            });

            converse.ChatRoomOccupant = Backbone.Model.extend({
                initialize: function (attributes) {
                    this.set(_.extend({
                        'id': converse.connection.getUniqueId(),
                    }, attributes));
                }
            });

            converse.ChatRoomOccupantView = Backbone.View.extend({
                tagName: 'li',
                initialize: function () {
                    this.model.on('change', this.render, this);
                    this.model.on('destroy', this.destroy, this);
                },

                render: function () {
                    var new_el = converse.templates.occupant(
                        _.extend(
                            this.model.toJSON(), {
                                'hint_occupant': __('Click to mention this user in your message.'),
                                'desc_moderator': __('This user is a moderator.'),
                                'desc_occupant': __('This user can send messages in this room.'),
                                'desc_visitor': __('This user can NOT send messages in this room.')
                        })
                    );
                    var $parents = this.$el.parents();
                    if ($parents.length) {
                        this.$el.replaceWith(new_el);
                        this.setElement($parents.first().children('#'+this.model.get('id')), true);
                        this.delegateEvents();
                    } else {
                        this.$el.replaceWith(new_el);
                        this.setElement(new_el, true);
                    }
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
                            'allow_muc_invitations': converse.allow_muc_invitations,
                            'label_invitation': __('Invite'),
                            'label_occupants': __('Occupants')
                        })
                    );
                    if (converse.allow_muc_invitations) {
                        return this.initInviteWidget();
                    }
                    return this;
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

                findOccupant: function (data) {
                    /* Try to find an existing occupant based on the passed in
                     * data object.
                     *
                     * If we have a JID, we use that as lookup variable,
                     * otherwise we use the nick. We don't always have both,
                     * but should have at least one or the other.
                     */
                    var jid = Strophe.getBareJidFromJid(data.jid);
                    if (jid !== null) {
                        return this.model.where({'jid': jid}).pop();
                    } else {
                        return this.model.where({'nick': data.nick}).pop();
                    }
                },

                updateOccupantsOnPresence: function (pres) {
                    /* Given a presence stanza, update the occupant models
                     * based on its contents.
                     *
                     * Parameters:
                     *  (XMLElement) pres: The presence stanza
                     */
                    var data = this.parsePresence(pres);
                    if (data.type === 'error') {
                        return true;
                    }
                    var occupant = this.findOccupant(data);
                    switch (data.type) {
                        case 'unavailable':
                            if (occupant) { occupant.destroy(); }
                            break;
                        default:
                            var jid = Strophe.getBareJidFromJid(data.jid);
                            var attributes = _.extend(data, {
                                'jid': jid ? jid : undefined,
                                'resource': data.jid ? Strophe.getResourceFromJid(data.jid) : undefined
                            });
                            if (occupant) {
                                occupant.save(attributes);
                            } else {
                                this.model.create(attributes);
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
                    'click a.room-info': 'toggleRoomInfo',
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
                        ));
                    this.$tabs = this.$parent.parent().find('#controlbox-tabs');

                    var controlbox = converse.chatboxes.get('controlbox');
                    this.$tabs.append(converse.templates.chatrooms_tab({
                        'label_rooms': __('Rooms'),
                        'is_current': controlbox.get('active-panel') === ROOMS_PANEL_ID
                    }));
                    if (controlbox.get('active-panel') !== ROOMS_PANEL_ID) {
                        this.$el.addClass('hidden');
                    }
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

                insertRoomInfo: function (el, stanza) {
                    /* Insert room info (based on returned #disco IQ stanza)
                     *
                     * Parameters:
                     *  (HTMLElement) el: The HTML DOM element that should
                     *      contain the info.
                     *  (XMLElement) stanza: The IQ stanza containing the room
                     *      info.
                     */
                    var $stanza = $(stanza);
                    // All MUC features found here: http://xmpp.org/registrar/disco-features.html
                    $(el).find('span.spinner').replaceWith(
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
                        })
                    );
                },

                toggleRoomInfo: function (ev) {
                    /* Show/hide extra information about a room in the listing.
                     */
                    var target = ev.target,
                        $parent = $(target).parent('dd'),
                        $div = $parent.find('div.room-info');
                    if ($div.length) {
                        $div.remove();
                    } else {
                        $parent.find('span.spinner').remove();
                        $parent.append('<span class="spinner hor_centered"/>');
                        converse.connection.disco.info(
                            $(target).attr('data-room-jid'), null, _.partial(this.insertRoomInfo, $parent[0])
                        );
                    }
                },

                createChatRoom: function (ev) {
                    ev.preventDefault();
                    var name, $name, server, $server, jid;
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
                    converse.createChatRoom({
                        'id': jid,
                        'jid': jid,
                        'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                        'type': 'chatroom',
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
            /************************ End of ChatRoomView **********************/


            converse.onDirectMUCInvitation = function (message) {
                /* A direct MUC invitation to join a room has been received
                 * See XEP-0249: Direct MUC invitations.
                 *
                 * Parameters:
                 *  (XMLElement) message: The message stanza containing the
                 *        invitation.
                 */
                var $message = $(message),
                    $x = $message.children('x[xmlns="jabber:x:conference"]'),
                    from = Strophe.getBareJidFromJid($message.attr('from')),
                    room_jid = $x.attr('jid'),
                    reason = $x.attr('reason'),
                    contact = converse.roster.get(from),
                    result;

                if (converse.auto_join_on_invite) {
                    result = true;
                } else {
                    // Invite request might come from someone not your roster list
                    contact = contact? contact.get('fullname'): Strophe.getNodeFromJid(from);
                    if (!reason) {
                        result = confirm(
                            __(___("%1$s has invited you to join a chat room: %2$s"),
                                contact, room_jid)
                        );
                    } else {
                        result = confirm(
                            __(___('%1$s has invited you to join a chat room: %2$s, and left the following reason: "%3$s"'),
                                contact, room_jid, reason)
                        );
                    }
                }
                if (result === true) {
                    var chatroom = converse.createChatRoom({
                        'id': room_jid,
                        'jid': room_jid,
                        'name': Strophe.unescapeNode(Strophe.getNodeFromJid(room_jid)),
                        'nick': Strophe.unescapeNode(Strophe.getNodeFromJid(converse.connection.jid)),
                        'type': 'chatroom',
                        'box_id': b64_sha1(room_jid),
                        'password': $x.attr('password')
                    });
                    if (!_.contains(
                                [Strophe.Status.CONNECTING, Strophe.Status.CONNECTED],
                                chatroom.get('connection_status'))
                            ) {
                        converse.chatboxviews.get(room_jid).join();
                    }
                }
            };

            if (converse.allow_muc_invitations) {
                var registerDirectInvitationHandler = function () {
                    converse.connection.addHandler(
                        function (message) {
                            converse.onDirectMUCInvitation(message);
                            return true;
                        }, 'jabber:x:conference', 'message');
                };
                converse.on('connected', registerDirectInvitationHandler);
                converse.on('reconnected', registerDirectInvitationHandler);
            }

            var autoJoinRooms = function () {
                /* Automatically join chat rooms, based on the
                 * "auto_join_rooms" configuration setting, which is an array
                 * of strings (room JIDs) or objects (with room JID and other
                 * settings).
                 */
                _.each(converse.auto_join_rooms, function (room) {
                    if (typeof room === 'string') {
                        converse_api.rooms.open(room);
                    } else if (typeof room === 'object') {
                        converse_api.rooms.open(room.jid, room.nick);
                    } else {
                        converse.log('Invalid room criteria specified for "auto_join_rooms"', 'error');
                    }
                });
            };
            converse.on('chatBoxesFetched', autoJoinRooms);

            converse.getWrappedChatRoom = function (jid, attrs, fetcher) {
                jid = jid.toLowerCase();
                return converse.wrappedChatBox(fetcher(_.extend({
                    'id': jid,
                    'jid': jid,
                    'name': Strophe.unescapeNode(Strophe.getNodeFromJid(jid)),
                    'type': 'chatroom',
                    'box_id': b64_sha1(jid)
                }, attrs)));
            };


            /* We extend the default converse.js API to add methods specific to MUC
             * chat rooms.
             */
            _.extend(converse_api, {
                'rooms': {
                    'close': function (jids) {
                        if (typeof jids === "undefined") {
                            converse.chatboxviews.each(function (view) {
                                if (view.is_chatroom && view.model) {
                                    view.close();
                                }
                            });
                        } else if (typeof jids === "string") {
                            var view = converse.chatboxviews.get(jids);
                            if (view) { view.close(); }
                        } else {
                            _.map(jids, function (jid) {
                                var view = converse.chatboxviews.get(jid);
                                if (view) { view.close(); }
                            });
                        }
                    },
                    'open': function (jids, attrs) {
                        if (typeof attrs === "string") {
                            attrs = {'nick': attrs};
                        } else if (typeof attrs === "undefined") {
                            attrs = {};
                        }
                        if (_.isUndefined(attrs.maximize)) {
                            attrs.maximize = false;
                        }
                        if (!attrs.nick && converse.muc_nickname_from_jid) {
                            attrs.nick = Strophe.getNodeFromJid(converse.bare_jid);
                        }
                        if (typeof jids === "undefined") {
                            throw new TypeError('rooms.open: You need to provide at least one JID');
                        } else if (typeof jids === "string") {
                            return converse.getWrappedChatRoom(jids, attrs, converse.createChatRoom);
                        }
                        return _.map(jids, _.partial(converse.getWrappedChatRoom, _, attrs, converse.createChatRoom));
                    },
                    'get': function (jids, attrs, create) {
                        if (typeof attrs === "string") {
                            attrs = {'nick': attrs};
                        } else if (typeof attrs === "undefined") {
                            attrs = {};
                        }
                        if (typeof jids === "undefined") {
                            var result = [];
                            converse.chatboxes.each(function (chatbox) {
                                if (chatbox.get('type') === 'chatroom') {
                                    result.push(converse.wrappedChatBox(chatbox));
                                }
                            });
                            return result;
                        }
                        var fetcher = _.partial(converse.chatboxviews.getChatBox.bind(converse.chatboxviews), _, create);
                        if (!attrs.nick) {
                            attrs.nick = Strophe.getNodeFromJid(converse.bare_jid);
                        }
                        if (typeof jids === "string") {
                            return converse.getWrappedChatRoom(jids, attrs, fetcher);
                        }
                        return _.map(jids, _.partial(converse.getWrappedChatRoom, _, attrs, fetcher));
                    }
                }
            });

            var reconnectToChatRooms = function () {
                /* Upon a reconnection event from converse, join again
                 * all the open chat rooms.
                 */
                converse.chatboxviews.each(function (view) {
                    if (view.model.get('type') === 'chatroom') {
                        view.model.save('connection_status', Strophe.Status.DISCONNECTED);
                        view.join();
                    }
                });
            };
            converse.on('reconnected', reconnectToChatRooms);

            var disconnectChatRooms = function () {
                /* When disconnecting, or reconnecting, mark all chat rooms as
                 * disconnected, so that they will be properly entered again
                 * when fetched from session storage.
                 */
                converse.chatboxes.each(function (model) {
                    if (model.get('type') === 'chatroom') {
                        model.save('connection_status', Strophe.Status.DISCONNECTED);
                    }
                });
            };
            converse.on('reconnecting', disconnectChatRooms);
            converse.on('disconnecting', disconnectChatRooms);
        }
    });
}));


define('tpl!chatroom_bookmark_form', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="chatroom-form-container">\n    <form class="pure-form converse-form chatroom-form">\n        <fieldset>\n            <legend>'+
((__t=(heading))==null?'':__t)+
'</legend>\n            <label>'+
((__t=(label_name))==null?'':__t)+
'</label>\n            <input type="text" name="name" required="required"/>\n            <label>'+
((__t=(label_autojoin))==null?'':__t)+
'</label>\n            <input type="checkbox" name="autojoin"/>\n            <label>'+
((__t=(label_nick))==null?'':__t)+
'</label>\n            <input type="text" name="nick" value="'+
((__t=(default_nick))==null?'':__t)+
'"/>\n        </fieldset>\n        <fieldset>\n            <input class="pure-button button-primary" type="submit" value="'+
((__t=(label_submit))==null?'':__t)+
'"/>\n            <input class="pure-button button-cancel" type="button" value="'+
((__t=(label_cancel))==null?'':__t)+
'"/>\n        </fieldset>\n    </form>\n</div>\n';
}
return __p;
}; });


define('tpl!chatroom_bookmark_toggle', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a class="chatbox-btn toggle-bookmark icon-pushpin\n   ';
 if (bookmarked) {
__p+='\n    button-on\n   ';
 } 
__p+='" title="'+
((__t=(info_toggle_bookmark))==null?'':__t)+
'"></a>\n';
}
return __p;
}; });


define('tpl!bookmark', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<dd class="available-chatroom">\n    <a class="open-room" data-room-jid="'+
((__t=(jid))==null?'':__t)+
'" title="'+
((__t=(open_title))==null?'':__t)+
'" href="#">'+
((__t=(name))==null?'':__t)+
'</a>\n    <a class="remove-bookmark icon-close" data-room-jid="'+
((__t=(jid))==null?'':__t)+
'" data-bookmark-name="'+
((__t=(name))==null?'':__t)+
'"\n       title="'+
((__t=(info_remove))==null?'':__t)+
'" href="#">&nbsp;</a>\n    <a class="room-info icon-room-info" data-room-jid="'+
((__t=(jid))==null?'':__t)+
'"\n       title="'+
((__t=(info_title))==null?'':__t)+
'" href="#">&nbsp;</a>\n</dd>\n';
}
return __p;
}; });


define('tpl!bookmarks_list', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a href="#" class="bookmarks-toggle icon-'+
((__t=(toggle_state))==null?'':__t)+
'" title="'+
((__t=(desc_bookmarks))==null?'':__t)+
'">'+
((__t=(label_bookmarks))==null?'':__t)+
'</a>\n<dl class="bookmarks rooms-list"></dl>\n';
}
return __p;
}; });

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define */

/* This is a Converse.js plugin which add support for bookmarks specified
 * in XEP-0048.
 */
(function (root, factory) {
    define("converse-bookmarks", [
            "jquery",
            "lodash",
            "moment_with_locales",
            "strophe",
            "utils",
            "converse-core",
            "converse-api",
            "converse-muc",
            "tpl!chatroom_bookmark_form",
            "tpl!chatroom_bookmark_toggle",
            "tpl!bookmark",
            "tpl!bookmarks_list"
        ],
        factory);
}(this, function (
        $, _, moment, strophe, utils,
        converse, converse_api, muc,
        tpl_chatroom_bookmark_form,
        tpl_chatroom_bookmark_toggle,
        tpl_bookmark,
        tpl_bookmarks_list
    ) {

    var __ = utils.__.bind(converse),
        ___ = utils.___,
        Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        b64_sha1 = converse_api.env.b64_sha1;

    // Add new HTML templates.
    converse.templates.chatroom_bookmark_form = tpl_chatroom_bookmark_form;
    converse.templates.chatroom_bookmark_toggle = tpl_chatroom_bookmark_toggle;
    converse.templates.bookmark = tpl_bookmark;
    converse.templates.bookmarks_list = tpl_bookmarks_list;

    converse_api.plugins.add('converse-bookmarks', {
        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            clearSession: function () {
                this.__super__.clearSession.apply(this, arguments);
                if (!_.isUndefined(this.bookmarks)) {
                    this.bookmarks.browserStorage._clear();
                }
            },

            ChatRoomView: {
                events: {
                    'click .toggle-bookmark': 'toggleBookmark'
                },

                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    this.model.on('change:bookmarked', this.onBookmarked, this);
                    this.setBookmarkState();
                },

                generateHeadingHTML: function () {
                    var html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    if (converse.allow_bookmarks) {
                        var div = document.createElement('div');
                        div.innerHTML = html;
                        var bookmark_button = converse.templates.chatroom_bookmark_toggle(
                            _.assignIn(
                                this.model.toJSON(),
                                {
                                    info_toggle_bookmark: __('Bookmark this room'),
                                    bookmarked: this.model.get('bookmarked')
                                }
                            ));
                        var close_button = div.querySelector('.close-chatbox-button');
                        close_button.insertAdjacentHTML('afterend', bookmark_button);
                        return div.innerHTML;
                    }
                    return html;
                },

                checkForReservedNick: function () {
                    /* Check if the user has a bookmark with a saved nickanme
                     * for this room, and if so use it.
                     * Otherwise delegate to the super method.
                     */
                    if (_.isUndefined(converse.bookmarks) || !converse.allow_bookmarks) {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                    var model = converse.bookmarks.findWhere({'jid': this.model.get('jid')});
                    if (!_.isUndefined(model) && model.get('nick')) {
                        this.join(this.model.get('nick'));
                    } else {
                        return this.__super__.checkForReservedNick.apply(this, arguments);
                    }
                },

                onBookmarked: function () {
                    if (this.model.get('bookmarked')) {
                        this.$('.icon-pushpin').addClass('button-on');
                    } else {
                        this.$('.icon-pushpin').removeClass('button-on');
                    }
                },

                setBookmarkState: function () {
                    /* Set whether the room is bookmarked or not.
                     */
                    if (!_.isUndefined(converse.bookmarks)) {
                        var models = converse.bookmarks.where({'jid': this.model.get('jid')});
                        if (!models.length) {
                            this.model.save('bookmarked', false);
                        } else {
                            this.model.save('bookmarked', true);
                        }
                    }
                },

                renderBookmarkForm: function () {
                    var $body = this.$('.chatroom-body');
                    $body.children().addClass('hidden');
                    // Remove any existing forms
                    $body.find('form.chatroom-form').remove();
                    $body.append(
                        converse.templates.chatroom_bookmark_form({
                            heading: __('Bookmark this room'),
                            label_name: __('The name for this bookmark:'),
                            label_autojoin: __('Would you like this room to be automatically joined upon startup?'),
                            label_nick: __('What should your nickname for this room be?'),
                            default_nick: this.model.get('nick'),
                            label_submit: __('Save'),
                            label_cancel: __('Cancel')
                        }));
                    this.$('.chatroom-form').submit(this.onBookmarkFormSubmitted.bind(this));
                    this.$('.chatroom-form .button-cancel').on('click', this.cancelConfiguration.bind(this));
                },

                onBookmarkFormSubmitted: function (ev) {
                    ev.preventDefault();
                    var $form = $(ev.target), that = this;
                    converse.bookmarks.createBookmark({
                        'jid': this.model.get('jid'),
                        'autojoin': $form.find('input[name="autojoin"]').prop('checked'),
                        'name':  $form.find('input[name=name]').val(),
                        'nick':  $form.find('input[name=nick]').val()
                    });
                    this.$el.find('div.chatroom-form-container').hide(
                        function () {
                            $(this).remove();
                            that.$('.chatroom-body').children().removeClass('hidden');
                        });
                },

                toggleBookmark: function (ev) {
                    if (ev) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                    var models = converse.bookmarks.where({'jid': this.model.get('jid')});
                    if (!models.length) {
                        this.renderBookmarkForm();
                    } else {
                        _.forEach(models, function (model) {
                            model.destroy();
                        });
                        this.$('.icon-pushpin').removeClass('button-on');
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
            // ====================================
            // Refer to docs/source/configuration.rst for explanations of these
            // configuration settings.
            this.updateSettings({
                allow_bookmarks: true
            });

            converse.Bookmark = Backbone.Model;

            converse.BookmarksList = Backbone.Model.extend({
                defaults: {
                    "toggle-state":  converse.OPENED
                }
            });

            converse.Bookmarks = Backbone.Collection.extend({
                model: converse.Bookmark,

                initialize: function () {
                    this.on('add', _.compose(this.markRoomAsBookmarked, this.openBookmarkedRoom));
                    this.on('remove', this.markRoomAsUnbookmarked, this);
                    this.on('remove', this.sendBookmarkStanza, this);

                    var cache_key = 'converse.room-bookmarks'+converse.bare_jid;
                    this.cached_flag = b64_sha1(cache_key+'fetched');
                    this.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1(cache_key)
                    );
                },

                openBookmarkedRoom: function (bookmark) {
                    if (bookmark.get('autojoin')) {
                        converse_api.rooms.open(bookmark.get('jid'), bookmark.get('nick'));
                    }
                    return bookmark;
                },

                fetchBookmarks: function () {
                    var deferred = new $.Deferred();
                    var promise = deferred.promise();
                    if (window.sessionStorage.getItem(this.browserStorage.name)) {
                        this.fetch({
                            'success': _.bind(this.onCachedBookmarksFetched, this, deferred),
                            'error':  _.bind(this.onCachedBookmarksFetched, this, deferred)
                        });
                    } else if (! window.sessionStorage.getItem(this.cached_flag)) {
                        // There aren't any cached bookmarks, and the cache is
                        // not set to null. So we query the XMPP server.
                        // If nothing is returned from the XMPP server, we set
                        // the cache to null to avoid calling the server again.
                        this.fetchBookmarksFromServer(deferred);
                    } else {
                        deferred.resolve();
                    }
                    return promise;
                },

                onCachedBookmarksFetched: function (deferred) {
                    return deferred.resolve();
                },

                createBookmark: function (options) {
                    converse.bookmarks.create(options);
                    converse.bookmarks.sendBookmarkStanza();
                },

                sendBookmarkStanza: function () {
                    var stanza = $iq({
                            'type': 'set',
                            'from': converse.connection.jid,
                        })
                        .c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                            .c('publish', {'node': 'storage:bookmarks'})
                                .c('item', {'id': 'current'})
                                    .c('storage', {'xmlns':'storage:bookmarks'});
                    this.each(function (model) {
                        stanza = stanza.c('conference', {
                            'name': model.get('name'),
                            'autojoin': model.get('autojoin'),
                            'jid': model.get('jid'),
                        }).c('nick').t(model.get('nick')).up().up();
                    });
                    stanza.up().up().up();
                    stanza.c('publish-options')
                        .c('x', {'xmlns': Strophe.NS.XFORM, 'type':'submit'})
                            .c('field', {'var':'FORM_TYPE', 'type':'hidden'})
                                .c('value').t('http://jabber.org/protocol/pubsub#publish-options').up().up()
                            .c('field', {'var':'pubsub#persist_items'})
                                .c('value').t('true').up().up()
                            .c('field', {'var':'pubsub#access_model'})
                                .c('value').t('whitelist');
                    converse.connection.sendIQ(stanza, null, this.onBookmarkError.bind(this));
                },

                onBookmarkError: function (iq) {
                    converse.log("Error while trying to add bookmark", "error");
                    converse.log(iq);
                    // We remove all locally cached bookmarks and fetch them
                    // again from the server.
                    this.reset();
                    this.fetchBookmarksFromServer(null);
                    window.alert(__("Sorry, something went wrong while trying to save your bookmark."));
                },

                fetchBookmarksFromServer: function (deferred) {
                    var stanza = $iq({
                        'from': converse.connection.jid,
                        'type': 'get',
                    }).c('pubsub', {'xmlns': Strophe.NS.PUBSUB})
                        .c('items', {'node': 'storage:bookmarks'});
                    converse.connection.sendIQ(
                        stanza,
                        _.bind(this.onBookmarksReceived, this, deferred),
                        _.bind(this.onBookmarksReceivedError, this, deferred)
                    );
                },

                markRoomAsBookmarked: function (bookmark) {
                    var room = converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', true);
                    }
                },

                markRoomAsUnbookmarked: function (bookmark) {
                    var room = converse.chatboxes.get(bookmark.get('jid'));
                    if (!_.isUndefined(room)) {
                        room.save('bookmarked', false);
                    }
                },

                onBookmarksReceived: function (deferred, iq) {
                    var bookmarks = $(iq).find(
                        'items[node="storage:bookmarks"] item[id="current"] storage conference'
                    );
                    var that = this;
                    _.forEach(bookmarks, function (bookmark) {
                        that.create({
                            'jid': bookmark.getAttribute('jid'),
                            'name': bookmark.getAttribute('name'),
                            'autojoin': bookmark.getAttribute('autojoin') === 'true',
                            'nick': bookmark.querySelector('nick').textContent
                        });
                    });
                    if (!_.isUndefined(deferred)) {
                        return deferred.resolve();
                    }
                },

                onBookmarksReceivedError: function (deferred, iq) {
                    window.sessionStorage.setItem(this.cached_flag, true);
                    converse.log('Error while fetching bookmarks');
                    converse.log(iq);
                    if (!_.isUndefined(deferred)) {
                        return deferred.reject();
                    }
                }
            });

            converse.BookmarksView = Backbone.View.extend({
                tagName: 'div',
                className: 'bookmarks-list',
                events: {
                    'click .remove-bookmark': 'removeBookmark',
                    'click .bookmarks-toggle': 'toggleBookmarksList'
                },

                initialize: function () {
                    this.model.on('add', this.renderBookmarkListElement, this);
                    this.model.on('remove', this.removeBookmarkListElement, this);

                    var cachekey = 'converse.room-bookmarks'+converse.bare_jid+'-list-model';
                    this.list_model = new converse.BookmarksList();
                    this.list_model.id = cachekey;
                    this.list_model.browserStorage = new Backbone.BrowserStorage[converse.storage](
                        b64_sha1(cachekey)
                    );
                    this.list_model.fetch();
                    this.render();
                },

                render: function (cfg) {
                    this.$el.html(converse.templates.bookmarks_list({
                        'toggle_state': this.list_model.get('toggle-state'),
                        'desc_bookmarks': __('Click to toggle the bookmarks list'),
                        'label_bookmarks': __('Bookmarked Rooms')
                    })).hide();
                    if (this.list_model.get('toggle-state') !== converse.OPENED) {
                        this.$('.bookmarks').hide();
                    }
                    this.model.each(this.renderBookmarkListElement, this);
                    var controlboxview = converse.chatboxviews.get('controlbox');
                    if (!_.isUndefined(controlboxview)) {
                        this.$el.prependTo(controlboxview.$('#chatrooms'));
                    }
                    return this.$el;
                },

                removeBookmark: function (ev) {
                    ev.preventDefault();
                    var name = $(ev.target).data('bookmarkName');
                    var jid = $(ev.target).data('roomJid');
                    if (confirm(__(___("Are you sure you want to remove the bookmark \"%1$s\"?"), name))) {
                        _.forEach(converse.bookmarks.where({'jid': jid}), function (item) { item.destroy(); });
                    }
                },

                renderBookmarkListElement: function (item) {
                    var $bookmark = $(converse.templates.bookmark({
                            'name': item.get('name'),
                            'jid': item.get('jid'),
                            'open_title': __('Click to open this room'),
                            'info_title': __('Show more information on this room'),
                            'info_remove': __('Remove this bookmark')
                        }));
                    this.$('.bookmarks').append($bookmark);
                    if (!this.$el.is(':visible')) {
                        this.$el.show();
                    }
                },

                removeBookmarkListElement: function (item) {
                    this.$('[data-room-jid="'+item.get('jid')+'"]:first').parent().remove();
                    if (this.model.length === 0) {
                        this.$el.hide();
                    }
                },

                toggleBookmarksList: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    var $el = $(ev.target);
                    if ($el.hasClass("icon-opened")) {
                        this.$('.bookmarks').slideUp('fast');
                        this.list_model.save({'toggle-state': converse.CLOSED});
                        $el.removeClass("icon-opened").addClass("icon-closed");
                    } else {
                        $el.removeClass("icon-closed").addClass("icon-opened");
                        this.$('.bookmarks').slideDown('fast');
                        this.list_model.save({'toggle-state': converse.OPENED});
                    }
                }
            });

            var initBookmarks = function () {
                if (!converse.allow_bookmarks) {
                    return;
                }
                converse.bookmarks = new converse.Bookmarks();
                converse.bookmarks.fetchBookmarks().always(function () {
                    converse.bookmarksview = new converse.BookmarksView(
                        {'model': converse.bookmarks}
                    );
                });
            };
            converse.on('chatBoxesFetched', initBookmarks);

            var afterReconnection = function () {
                if (!converse.allow_bookmarks) {
                    return;
                }
                if (_.isUndefined(converse.bookmarksview)) {
                    initBookmarks();
                } else {
                    converse.bookmarksview.render();
                }
            };
            converse.on('reconnected', afterReconnection);
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

// XEP-0059 Result Set Management

(function (root, factory) {
    define("converse-mam", [
            "converse-core",
            "converse-api",
            "converse-chatview", // Could be made a soft dependency
            "converse-muc", // Could be made a soft dependency
            "strophe.rsm"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        Strophe = converse_api.env.Strophe,
        $iq = converse_api.env.$iq,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    var RSM_ATTRIBUTES = ['max', 'first', 'last', 'after', 'before', 'index', 'count'];
    // XEP-0313 Message Archive Management
    var MAM_ATTRIBUTES = ['with', 'start', 'end'];

    Strophe.addNamespace('MAM', 'urn:xmpp:mam:0');
    Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');


    converse_api.plugins.add('converse-mam', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    converse.connection.disco.addFeature(Strophe.NS.MAM);
                    return this.__super__.addClientFeatures.apply(this, arguments);
                }
            },

            ChatBox: {
                getMessageAttributes: function ($message, $delay, original_stanza) {
                    var attrs = this.__super__.getMessageAttributes.apply(this, arguments);
                    attrs.archive_id = $(original_stanza).find('result[xmlns="'+Strophe.NS.MAM+'"]').attr('id');
                    return attrs;
                }
            },

            ChatBoxView: {
                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

                afterMessagesFetched: function () {
                    if (this.disable_mam || !converse.features.findWhere({'var': Strophe.NS.MAM})) {
                        return this.__super__.afterMessagesFetched.apply(this, arguments);
                    }
                    if (!this.model.get('mam_initialized') &&
                            this.model.messages.length < converse.archived_messages_page_size) {

                        this.fetchArchivedMessages({
                            'before': '', // Page backwards from the most recent message
                            'with': this.model.get('jid'),
                            'max': converse.archived_messages_page_size
                        });
                        this.model.save({'mam_initialized': true});
                    }
                    return this.__super__.afterMessagesFetched.apply(this, arguments);
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
                    if (this.disable_mam) {
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
                            converse.log("Error or timeout while trying to fetch archived messages", "error");
                        }.bind(this)
                    );
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
            },

            ChatRoomView: {
                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    if (!this.disable_mam) {
                        this.$content.on('scroll', _.debounce(this.onScroll.bind(this), 100));
                    }
                    return result;
                },

            }

        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                archived_messages_page_size: '20',
                message_archiving: 'never', // Supported values are 'always', 'never', 'roster' (https://xmpp.org/extensions/xep-0313.html#prefs)
                message_archiving_timeout: 8000, // Time (in milliseconds) to wait before aborting MAM request
            });

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
                /*
                if (!converse.features.findWhere({'var': Strophe.NS.MAM})) {
                    converse.log('This server does not support XEP-0313, Message Archive Management');
                    errback(null);
                    return;
                }
                */
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

                if (typeof callback === "function") {
                    converse.connection.addHandler(function (message) {
                        var $msg = $(message), rsm,
                            $fin = $msg.find('fin[xmlns="'+Strophe.NS.MAM+'"]');
                        if ($fin.length && $fin.attr('queryid') === queryid) {
                            rsm = new Strophe.RSM({xml: $fin.find('set')[0]});
                            _.extend(rsm, _.pick(options, ['max']));
                            _.extend(rsm, _.pick(options, MAM_ATTRIBUTES));
                            callback(messages, rsm);
                            return false; // We've received all messages, decommission this handler
                        } else if (queryid === $msg.find('result').attr('queryid')) {
                            messages.push(message);
                        }
                        return true;
                    }, Strophe.NS.MAM);
                }
                converse.connection.sendIQ(stanza, null, errback, converse.message_archiving_timeout);
            };

            _.extend(converse_api, {
                /* Extend default converse.js API to add methods specific to MAM
                 */
                'archive': {
                    'query': converse.queryForArchivedMessages.bind(converse)
                }
            });

            converse.onMAMError = function (iq) {
                if ($(iq).find('feature-not-implemented').length) {
                    converse.log("Message Archive Management (XEP-0313) not supported by this browser");
                } else {
                    converse.log("An error occured while trying to set archiving preferences.");
                    converse.log(iq);
                }
            };

            converse.onMAMPreferences = function (feature, iq) {
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
                    converse.connection.sendIQ(stanza, _.partial(function (feature, iq) {
                            // XXX: Strictly speaking, the server should respond with the updated prefs
                            // (see example 18: https://xmpp.org/extensions/xep-0313.html#config)
                            // but Prosody doesn't do this, so we don't rely on it.
                            feature.save({'preferences': {'default':converse.message_archiving}});
                        }, feature),
                        converse.onMAMError
                    );
                } else {
                    feature.save({'preferences': {'default':converse.message_archiving}});
                }
            };


            var onFeatureAdded = function (evt, feature) {
                var prefs = feature.get('preferences') || {};
                if (feature.get('var') === Strophe.NS.MAM && prefs['default'] !== converse.message_archiving) {
                    // Ask the server for archiving preferences
                    converse.connection.sendIQ(
                        $iq({'type': 'get'}).c('prefs', {'xmlns': Strophe.NS.MAM}),
                        _.partial(converse.onMAMPreferences, feature),
                        _.partial(converse.onMAMError, feature)
                    );
                }
            };
            converse.on('serviceDiscovered', onFeatureAdded.bind(converse.features));
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
    define("converse-vcard", [
            "converse-core",
            "converse-api",
            "strophe.vcard",
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var Strophe = converse_api.env.Strophe,
        $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        moment = converse_api.env.moment;

    converse_api.plugins.add('converse-vcard', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            Features: {
                addClientFeatures: function () {
                    this.__super__.addClientFeatures.apply(this, arguments);
                    if (converse.use_vcards) {
                        converse.connection.disco.addFeature(Strophe.NS.VCARD);
                    }
                }
            },

            RosterContacts: {
                createRequestingContact: function (presence) {
                    var bare_jid = Strophe.getBareJidFromJid(presence.getAttribute('from'));
                    converse.getVCard(
                        bare_jid,
                        _.partial(converse.createRequestingContactFromVCard, presence),
                        function (iq, jid) {
                            converse.log("Error while retrieving vcard for "+jid);
                            converse.createRequestingContactFromVCard(presence, iq, jid);
                        }
                    );
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                use_vcards: true,
            });

            converse.createRequestingContactFromVCard = function (presence, iq, jid, fullname, img, img_type, url) {
                var bare_jid = Strophe.getBareJidFromJid(jid);
                var nick = $(presence).children('nick[xmlns="'+Strophe.NS.NICK+'"]').text();
                var user_data = {
                    jid: bare_jid,
                    subscription: 'none',
                    ask: null,
                    requesting: true,
                    fullname: fullname || nick || bare_jid,
                    image: img,
                    image_type: img_type,
                    url: url,
                    vcard_updated: moment().format()
                };
                converse.roster.create(user_data);
                converse.emit('contactRequest', user_data);
            };

            converse.onVCardError = function (jid, iq, errback) {
                var contact = converse.roster.get(jid);
                if (contact) {
                    contact.save({ 'vcard_updated': moment().format() });
                }
                if (errback) { errback(iq, jid); }
            };

            converse.onVCardData = function (jid, iq, callback) {
                var $vcard = $(iq).find('vCard'),
                    fullname = $vcard.find('FN').text(),
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
                if (callback) {
                    callback(iq, jid, fullname, img, img_type, url);
                }
            };

            converse.getVCard = function (jid, callback, errback) {
                /* Request the VCard of another user.
                 *
                 * Parameters:
                 *    (String) jid - The Jabber ID of the user whose VCard
                 *      is being requested.
                 *    (Function) callback - A function to call once the VCard is
                 *      returned.
                 *    (Function) errback - A function to call if an error occured
                 *      while trying to fetch the VCard.
                 */
                if (!converse.use_vcards) {
                    if (callback) { callback(null, jid); }
                } else {
                    converse.connection.vcard.get(
                        _.partial(converse.onVCardData, jid, _, callback),
                        jid,
                        _.partial(converse.onVCardError, jid, _, errback));
                }
            };

            var updateVCardForChatBox = function (evt, chatbox) {
                if (!converse.use_vcards) { return; }
                var jid = chatbox.model.get('jid'),
                    contact = converse.roster.get(jid);
                if ((contact) && (!contact.get('vcard_updated'))) {
                    converse.getVCard(
                        jid,
                        function (iq, jid, fullname, image, image_type, url) {
                            chatbox.model.save({
                                'fullname' : fullname || jid,
                                'url': url,
                                'image_type': image_type,
                                'image': image
                            });
                        },
                        function () {
                            converse.log(
                                "updateVCardForChatBox: Error occured while fetching vcard"
                            );
                        }
                    );
                }
            };
            converse.on('chatBoxInitialized', updateVCardForChatBox);


            var onContactAdd = function (contact) {
                if (!contact.get('vcard_updated')) {
                    // This will update the vcard, which triggers a change
                    // request which will rerender the roster contact.
                    converse.getVCard(contact.get('jid'));
                }
            };
            converse.on('initialized', function () {
                converse.roster.on("add", onContactAdd);
            });

            var fetchOwnVCard = function () {
                if (converse.xmppstatus.get('fullname') === undefined) {
                    converse.getVCard(
                        null, // No 'to' attr when getting one's own vCard
                        function (iq, jid, fullname) {
                            converse.xmppstatus.save({'fullname': fullname});
                        }
                    );
                }
            };
            converse.on('statusInitialized', fetchOwnVCard);
        }
    });
}));


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
__p+='\n            <li><a href="http://www.cypherpunks.ca/otr/help/3.2.0/levels.php" target="_blank" rel="noopener">'+
((__t=(label_whats_this))==null?'':__t)+
'</a></li>\n        </ul>\n    </li>\n';
 } 
__p+='\n';
}
return __p;
}; });

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
    define("converse-otr", [
            "otr",
            "converse-core",
            "converse-api",
            "tpl!toolbar_otr"
    ], factory);
}(this, function (otr, converse, converse_api, tpl_toolbar_otr) {
    "use strict";
    converse.templates.toolbar_otr = tpl_toolbar_otr;
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

    converse_api.plugins.add('converse-otr', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.
 
            _initialize: function () {
                this.__super__._initialize.apply(this, arguments);
                this.otr = new this.OTR();
            },

            registerGlobalEventHandlers: function () {
                this.__super__.registerGlobalEventHandlers();

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
                var wrapped_chatbox = this.__super__.wrappedChatBox.apply(this, arguments);
                if (!chatbox) { return; }
                return _.extend(wrapped_chatbox, {
                    'endOTR': chatbox.endOTR.bind(chatbox),
                    'initiateOTR': chatbox.initiateOTR.bind(chatbox),
                });
            },

            ChatBox: {
                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    if (this.get('box_id') !== 'controlbox') {
                        this.save({
                            'otr_status': this.get('otr_status') || UNENCRYPTED
                        });
                    }
                },

                shouldPlayNotification: function ($message) {
                    /* Don't play a notification if this is an OTR message but
                     * encryption is not yet set up. That would mean that the
                     * OTR session is still being established, so there are no
                     * "visible" OTR messages being exchanged.
                     */
                    return this.__super__.shouldPlayNotification.apply(this, arguments) &&
                        !(utils.isOTRMessage($message[0]) && !_.contains([UNVERIFIED, VERIFIED], this.get('otr_status')));
                },

                createMessage: function ($message, $delay, original_stanza) {
                    var converse = this.__super__.converse,
                        $body = $message.children('body'),
                        text = ($body.length > 0 ? $body.text() : undefined);

                    if ((!text) || (!converse.allow_otr)) {
                        return this.__super__.createMessage.apply(this, arguments);
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
                                return this.__super__.createMessage.apply(this, arguments);
                            }
                        }
                    }
                },
                
                getSession: function (callback) {
                    var converse = this.__super__.converse;
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
                        var converse = this.__super__.converse;
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
                    var converse = this.__super__.converse;
                    this.__super__.initialize.apply(this, arguments);
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
                    var stanza = this.__super__.createMessageStanza.apply(this, arguments);
                    if (this.model.get('otr_status') !== UNENCRYPTED || utils.isOTRMessage(stanza.nodeTree)) {
                        // OTR messages aren't carbon copied
                        stanza.c('private', {'xmlns': Strophe.NS.CARBONS}).up()
                              .c('no-store', {'xmlns': Strophe.NS.HINTS}).up()
                              .c('no-permanent-store', {'xmlns': Strophe.NS.HINTS}).up()
                              .c('no-copy', {'xmlns': Strophe.NS.HINTS});
                    }
                    return stanza;
                },

                onMessageSubmitted: function (text) {
                    var converse = this.__super__.converse;
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
                        this.__super__.onMessageSubmitted.apply(this, arguments);
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
                    var converse = this.__super__.converse;
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
                    var converse = this.__super__.converse;
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

                renderToolbar: function (toolbar, options) {
                    var converse = this.__super__.converse;
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
                    this.__super__.renderToolbar.apply(this, arguments);
                    this.$el.find('.chat-toolbar').append(
                            converse.templates.toolbar_otr(
                                _.extend(this.model.toJSON(), options || {})
                            ));
                    return this;
                }
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
'" class="url" target="_blank" rel="noopener">'+
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
            "tpl!form_username",
            "tpl!register_panel",
            "tpl!register_tab",
            "tpl!registration_form",
            "tpl!registration_request",
            "converse-controlbox"
    ], factory);
}(this, function (
            converse,
            converse_api,
            tpl_form_username,
            tpl_register_panel,
            tpl_register_tab,
            tpl_registration_form,
            tpl_registration_request) {

    "use strict";
    converse.templates.form_username = tpl_form_username;
    converse.templates.register_panel = tpl_register_panel;
    converse.templates.register_tab = tpl_register_tab;
    converse.templates.registration_form = tpl_registration_form;
    converse.templates.registration_request = tpl_registration_request;

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

    converse_api.plugins.add('converse-register', {

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
                    this.__super__.renderLoginPanel.apply(this, arguments);
                    var converse = this.__super__.converse;
                    if (converse.allow_registration) {
                        this.registerpanel = new converse.RegisterPanel({
                            '$parent': this.$el.find('.controlbox-panes'),
                            'model': this
                        });
                        this.registerpanel.render().$el.addClass('hidden');
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

            this.updateSettings({
                allow_registration: true,
                domain_placeholder: __(" e.g. conversejs.org"),  // Placeholder text shown in the domain input on the registration form
                providers_link: 'https://xmpp.net/directory.php', // Link to XMPP providers shown on registration page
            });


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
                    $form.find('button.button-cancel').on('click', this.cancelRegistration.bind(this));
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
    
    converse_api.plugins.add('converse-ping', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;

            this.updateSettings({
                ping_interval: 180 //in seconds
            });

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

            var onConnected = function () {
                // Wrapper so that we can spy on registerPingHandler in tests
                converse.registerPingHandler();
            };
            converse.on('connected', onConnected);
            converse.on('reconnected', onConnected);
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


    converse_api.plugins.add('converse-notification', {

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            converse.supports_html5_notification = "Notification" in window;

            this.updateSettings({
                notify_all_room_messages: false,
                show_desktop_notifications: true,
                chatstate_notification_blacklist: [],
                // ^ a list of JIDs to ignore concerning chat state notifications
                play_sounds: false,
                sounds_path: '/sounds/',
                notification_icon: '/logo/conversejs128.png'
            });

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

            converse.shouldNotifyOfGroupMessage = function ($message) {
                /* Is this a group message worthy of notification?
                 */
                var notify_all = converse.notify_all_room_messages,
                    jid = $message.attr('from'),
                    resource = Strophe.getResourceFromJid(jid),
                    room_jid = Strophe.getBareJidFromJid(jid),
                    sender = resource && Strophe.unescapeNode(resource) || '';
                if (sender === '' || $message.find('delay').length > 0) {
                    return false;
                }
                var room = converse.chatboxes.get(room_jid);
                var $body = $message.children('body');
                if (!$body.length) {
                    return false;
                }
                var mentioned = (new RegExp("\\b"+room.get('nick')+"\\b")).test($body.text());
                notify_all = notify_all === true || (_.isArray(notify_all) && _.contains(notify_all, room_jid));
                if (sender === room.get('nick') || (!notify_all && !mentioned)) {
                    return false;
                }
                return true;
            };

            converse.shouldNotifyOfMessage = function (message) {
                /* Is this a message worthy of notification?
                 */
                if (utils.isOTRMessage(message)) {
                    return false;
                }
                var $message = $(message),
                    $forwarded = $message.find('forwarded');
                if ($forwarded.length) {
                    return false;
                } else if ($message.attr('type') === 'groupchat') {
                    return converse.shouldNotifyOfGroupMessage($message);
                } else if (utils.isHeadlineMessage(message)) {
                    // We want to show notifications for headline messages.
                    return true;
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

            converse.areDesktopNotificationsEnabled = function (ignore_hidden) {
                var enabled = converse.supports_html5_notification &&
                    converse.show_desktop_notifications &&
                    Notification.permission === "granted";
                if (ignore_hidden) {
                    return enabled;
                } else {
                    return enabled && converse.windowState === 'hidden';
                }
            };

            converse.showMessageNotification = function ($message) {
                /* Shows an HTML5 Notification to indicate that a new chat
                 * message was received.
                 */
                var n, title, contact_jid, roster_item,
                    from_jid = $message.attr('from');
                if ($message.attr('type') === 'headline' || from_jid.indexOf('@') === -1) {
                    // XXX: 2nd check is workaround for Prosody which doesn't
                    // give type "headline"
                    title = __(___("Notification from %1$s"), from_jid);
                } else {
                    if ($message.attr('type') === 'groupchat') {
                        title = __(___("%1$s says"), Strophe.getResourceFromJid(from_jid));
                    } else {
                        if (typeof converse.roster === 'undefined') {
                            converse.log("Could not send notification, because roster is undefined", "error");
                            return;
                        }
                        contact_jid = Strophe.getBareJidFromJid($message.attr('from'));
                        roster_item = converse.roster.get(contact_jid);
                        title = __(___("%1$s says"), roster_item.get('fullname'));
                    }
                }
                n = new Notification(title, {
                        body: $message.children('body').text(),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: converse.notification_icon
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.showChatStateNotification = function (contact) {
                /* Creates an HTML5 Notification to inform of a change in a
                 * contact's chat state.
                 */
                if (_.contains(converse.chatstate_notification_blacklist, contact.jid)) {
                    // Don't notify if the user is being ignored.
                    return;
                }
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

            converse.showContactRequestNotification = function (contact) {
                var n = new Notification(contact.fullname, {
                        body: __('wants to be your contact'),
                        lang: converse.i18n.locale_data.converse[""].lang,
                        icon: 'logo/conversejs.png'
                    });
                setTimeout(n.close.bind(n), 5000);
            };

            converse.showFeedbackNotification = function (data) {
                if (data.klass === 'error' || data.klass === 'warn') {
                    var n = new Notification(data.subject, {
                            body: data.message,
                            lang: converse.i18n.locale_data.converse[""].lang,
                            icon: 'logo/conversejs.png'
                        });
                    setTimeout(n.close.bind(n), 5000);
                }
            };

            converse.handleChatStateNotification = function (evt, contact) {
                /* Event handler for on('contactStatusChanged').
                 * Will show an HTML5 notification to indicate that the chat
                 * status has changed.
                 */
                if (converse.areDesktopNotificationsEnabled()) {
                    converse.showChatStateNotification(contact);
                }
            };

            converse.handleMessageNotification = function (evt, message) {
                /* Event handler for the on('message') event. Will call methods
                 * to play sounds and show HTML5 notifications.
                 */
                var $message = $(message);
                if (!converse.shouldNotifyOfMessage(message)) {
                    return false;
                }
                converse.playSoundNotification($message);
                if (converse.areDesktopNotificationsEnabled()) {
                    converse.showMessageNotification($message);
                }
            };

            converse.handleContactRequestNotification = function (evt, contact) {
                if (converse.areDesktopNotificationsEnabled(true)) {
                    converse.showContactRequestNotification(contact);
                }
            };

            converse.handleFeedback = function (evt, data) {
                if (converse.areDesktopNotificationsEnabled(true)) {
                    converse.showFeedbackNotification(data);
                }
            };

            converse.requestPermission = function (evt) {
                if (converse.supports_html5_notification &&
                    ! _.contains(['denied', 'granted'], Notification.permission)) {
                    // Ask user to enable HTML5 notifications
                    Notification.requestPermission();
                }
            };

            converse.on('pluginsInitialized', function () {
                // We only register event handlers after all plugins are
                // registered, because other plugins might override some of our
                // handlers.
                converse.on('contactRequest',  converse.handleContactRequestNotification);
                converse.on('contactStatusChanged',  converse.handleChatStateNotification);
                converse.on('message',  converse.handleMessageNotification);
                converse.on('feedback', converse.handleFeedback);
                converse.on('connected', converse.requestPermission);
            });
        }
    });
}));


define('tpl!chatbox_minimize', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a class="chatbox-btn toggle-chatbox-button icon-minus" title="'+
((__t=(info_minimize))==null?'':__t)+
'"></a>\n';
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


define('tpl!chats_panel', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<a id="toggle-minimized-chats" href="#"></a>\n<div class="flyout minimized-chats-flyout"></div>\n';
}
return __p;
}; });

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global Backbone, define, window */

(function (root, factory) {
    define("converse-minimize", [
            "converse-core",
            "converse-api",
            "tpl!chatbox_minimize",
            "tpl!toggle_chats",
            "tpl!trimmed_chat",
            "tpl!chats_panel",
            "converse-controlbox",
            "converse-chatview",
            "converse-muc"
    ], factory);
}(this, function (
        converse,
        converse_api,
        tpl_chatbox_minimize,
        tpl_toggle_chats,
        tpl_trimmed_chat,
        tpl_chats_panel
    ) {
    "use strict";
    converse.templates.chatbox_minimize = tpl_chatbox_minimize;
    converse.templates.toggle_chats = tpl_toggle_chats;
    converse.templates.trimmed_chat = tpl_trimmed_chat;
    converse.templates.chats_panel = tpl_chats_panel;

    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        b64_sha1 = converse_api.env.b64_sha1,
        moment = converse_api.env.moment,
        utils = converse_api.env.utils,
        __ = utils.__.bind(converse);

    converse_api.plugins.add('converse-minimize', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            initChatBoxes: function () {
                var result = this.__super__.initChatBoxes.apply(this, arguments);
                converse.minimized_chats = new converse.MinimizedChats({
                    model: converse.chatboxes
                });
                return result;
            },

            registerGlobalEventHandlers: function () {
                $(window).on("resize", _.debounce(function (ev) {
                    if (converse.connection.connected) {
                        converse.chatboxviews.trimChats();
                    }
                }, 200));
                return this.__super__.registerGlobalEventHandlers.apply(this, arguments);
            },

            wrappedChatBox: function (chatbox) {
                /* Wrap a chatbox for outside consumption (i.e. so that it can be
                * returned via the API.
                */
                if (!chatbox) { return; }
                var box = this.__super__.wrappedChatBox.apply(this, arguments);
                box.maximize = chatbox.maximize.bind(chatbox);
                box.minimize = chatbox.minimize.bind(chatbox);
                return box;
            },

            ChatBox: {
                initialize: function () {
                    this.__super__.initialize.apply(this, arguments);
                    if (this.get('id') === 'controlbox') {
                        return;
                    }
                    this.save({
                        'minimized': this.get('minimized') || false,
                        'time_minimized': this.get('time_minimized') || moment(),
                    });
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
            },

            ChatBoxView: {
                events: {
                    'click .toggle-chatbox-button': 'minimize',
                },

                initialize: function () {
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    return this.__super__.initialize.apply(this, arguments);
                },

                _show: function () {
                    this.__super__._show.apply(this, arguments);
                    if (!this.model.get('minimized')) {
                        converse.chatboxviews.trimChats(this);
                    }
                },

                shouldShowOnTextMessage: function () {
                    return !this.model.get('minimized') &&
                        this.__super__.shouldShowOnTextMessage.apply(this, arguments);
                },

                setChatBoxHeight: function (height) {
                    if (!this.model.get('minimized')) {
                        return this.__super__.setChatBoxHeight.apply(this, arguments);
                    }
                },

                setChatBoxWidth: function (width) {
                    if (!this.model.get('minimized')) {
                        return this.__super__.setChatBoxWidth.apply(this, arguments);
                    }
                },

                onMinimizedChanged: function (item) {
                    if (item.get('minimized')) {
                        this.minimize();
                    } else {
                        this.maximize();
                    }
                },

                maximize: function () {
                    // Restores a minimized chat box
                    this.$el.insertAfter(converse.chatboxviews.get("controlbox").$el);
                    this.show();
                    converse.emit('chatBoxMaximized', this);
                    return this;
                },

                minimize: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    // save the scroll position to restore it on maximize
                    this.model.save({'scroll': this.$content.scrollTop()});
                    this.setChatState(converse.INACTIVE).model.minimize();
                    this.hide();
                    converse.emit('chatBoxMinimized', this);
                },
            },

            ChatRoomView: {
                events: {
                    'click .toggle-chatbox-button': 'minimize',
                },

                initialize: function () {
                    this.model.on('change:minimized', function (item) {
                        if (item.get('minimized')) {
                            this.hide();
                        } else {
                            this.maximize();
                        }
                    }, this);
                    var result = this.__super__.initialize.apply(this, arguments);
                    if (this.model.get('minimized')) {
                        this.hide();
                    }
                    return result;
                },

                generateHeadingHTML: function () {
                    var html = this.__super__.generateHeadingHTML.apply(this, arguments);
                    var div = document.createElement('div');
                    div.innerHTML = html;
                    var el = converse.templates.chatbox_minimize(
                        {info_minimize: __('Minimize this chat box')}
                    );
                    var button = div.querySelector('.close-chatbox-button');
                    button.insertAdjacentHTML('afterend', el);
                    return div.innerHTML;
                }
            },

            ChatBoxes: {
                chatBoxMayBeShown: function (chatbox) {
                    return this.__super__.chatBoxMayBeShown.apply(this, arguments) &&
                           !chatbox.get('minimized');
                },
            },

            ChatBoxViews: {
                showChat: function (attrs) {
                    /* Find the chat box and show it. If it doesn't exist, create it.
                     */
                    var chatbox = this.__super__.showChat.apply(this, arguments);
                    var maximize = _.isUndefined(attrs.maximize) ? true : attrs.maximize;
                    if (chatbox.get('minimized') && maximize) {
                        chatbox.maximize();
                    }
                    return chatbox;
                },

                getChatBoxWidth: function (view) {
                    if (!view.model.get('minimized') && view.$el.is(':visible')) {
                        return view.$el.outerWidth(true);
                    }
                    return 0;
                },

                getShownChats: function () {
                    return this.filter(function (view) {
                        // The controlbox can take a while to close,
                        // so we need to check its state. That's why we checked
                        // the 'closed' state.
                        return (
                            !view.model.get('minimized') &&
                            !view.model.get('closed') &&
                            view.$el.is(':visible')
                        );
                    });
                },

                trimChats: function (newchat) {
                    /* This method is called when a newly created chat box will
                     * be shown.
                     *
                     * It checks whether there is enough space on the page to show
                     * another chat box. Otherwise it minimizes the oldest chat box
                     * to create space.
                     */
                    var shown_chats = this.getShownChats();
                    if (converse.no_trimming || shown_chats.length <= 1) {
                        return;
                    }
                    if (this.getChatBoxWidth(shown_chats[0]) === $('body').outerWidth(true)) {
                        // If the chats shown are the same width as the body,
                        // then we're in responsive mode and the chats are
                        // fullscreen. In this case we don't trim.
                        return;
                    }
                    var oldest_chat, boxes_width, view,
                        $minimized = converse.minimized_chats.$el,
                        minimized_width = _.contains(this.model.pluck('minimized'), true) ? $minimized.outerWidth(true) : 0,
                        new_id = newchat ? newchat.model.get('id') : null;

                    boxes_width = _.reduce(this.xget(new_id), function (memo, view) {
                        return memo + this.getChatBoxWidth(view);
                    }.bind(this), newchat ? newchat.$el.outerWidth(true) : 0);

                    if ((minimized_width + boxes_width) > $('body').outerWidth(true)) {
                        oldest_chat = this.getOldestMaximizedChat([new_id]);
                        if (oldest_chat) {
                            // We hide the chat immediately, because waiting
                            // for the event to fire (and letting the
                            // ChatBoxView hide it then) causes race
                            // conditions.
                            view = this.get(oldest_chat.get('id'));
                            if (view) {
                                view.hide();
                            }
                            oldest_chat.minimize();
                        }
                    }
                },

                getOldestMaximizedChat: function (exclude_ids) {
                    // Get oldest view (if its id is not excluded)
                    exclude_ids.push('controlbox');
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
                }
            }
        },


        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            this.updateSettings({
                no_trimming: false, // Set to true for phantomjs tests (where browser apparently has no width)
            });

            converse.MinimizedChatBoxView = Backbone.View.extend({
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
                    // OTR stuff, doesn't require this module to depend on OTR.
                    this.model.on('showReceivedOTRMessage', this.updateUnreadMessagesCounter, this);
                    this.model.on('showSentOTRMessage', this.updateUnreadMessagesCounter, this);
                },

                render: function () {
                    var data = _.extend(
                        this.model.toJSON(),
                        { 'tooltip': __('Click to restore this chat') }
                    );
                    if (this.model.get('type') === 'chatroom') {
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
                    var view = converse.chatboxviews.get(this.model.get('id'));
                    if (view) {
                        // This will call model.destroy(), removing it from the
                        // collection and will also emit 'chatBoxClosed'
                        view.close();
                    } else {
                        this.model.destroy();
                        converse.emit('chatBoxClosed', this);
                    }
                    return this;
                },

                restore: _.debounce(function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.model.messages.off('add',null,this);
                    this.remove();
                    this.model.maximize();
                }, 200, true)
            });


            converse.MinimizedChats = Backbone.Overview.extend({
                tagName: 'div',
                id: "minimized-chats",
                className: 'hidden',
                events: {
                    "click #toggle-minimized-chats": "toggle"
                },

                initialize: function () {
                    this.render();
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
                    if (!this.el.parentElement) {
                        this.el.innerHTML = converse.templates.chats_panel();
                        converse.chatboxviews.el.appendChild(this.el);
                    }
                    if (this.keys().length === 0) {
                        this.el.classList.add('hidden');
                        converse.chatboxviews.trimChats.bind(converse.chatboxviews);
                    } else if (this.keys().length > 0 && !this.$el.is(':visible')) {
                        this.el.classList.remove('hidden');
                        converse.chatboxviews.trimChats();
                    }
                    return this.$el;
                },

                toggle: function (ev) {
                    if (ev && ev.preventDefault) { ev.preventDefault(); }
                    this.toggleview.model.save({'collapsed': !this.toggleview.model.get('collapsed')});
                    this.$('.minimized-chats-flyout').toggle();
                },

                onChanged: function (item) {
                    if (item.get('id') === 'controlbox')  {
                        // The ControlBox has it's own minimize toggle
                        return;
                    }
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


            converse.MinimizedChatsToggle = Backbone.Model.extend({
                initialize: function () {
                    this.set({
                        'collapsed': this.get('collapsed') || false,
                        'num_minimized': this.get('num_minimized') || 0,
                        'num_unread':  this.get('num_unread') || 0
                    });
                }
            });


            converse.MinimizedChatsToggleView = Backbone.View.extend({
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

            var renderMinimizeButton = function (evt, view) {
                // Inserts a "minimize" button in the chatview's header
                var $el = view.$el.find('.toggle-chatbox-button');
                var $new_el = converse.templates.chatbox_minimize(
                    {info_minimize: __('Minimize this chat box')}
                );
                if ($el.length) {
                    $el.replaceWith($new_el);
                } else {
                    view.$el.find('.close-chatbox-button').after($new_el);
                }
            };
            converse.on('chatBoxOpened', renderMinimizeButton);

            converse.on('controlBoxOpened', function (evt, chatbox) {
                // Wrapped in anon method because at scan time, chatboxviews
                // attr not set yet.
                if (converse.connection.connected) {
                    converse.chatboxviews.trimChats(chatbox);
                }
            });
        }
    });
}));


define('tpl!dragresize', [],function () { return function(obj){
var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};
with(obj||{}){
__p+='<div class="dragresize dragresize-top"></div>\n<div class="dragresize dragresize-topleft"></div>\n<div class="dragresize dragresize-left"></div>\n';
}
return __p;
}; });

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define("converse-dragresize", [
            "converse-core",
            "converse-api",
            "tpl!dragresize",
            "converse-chatview",
            "converse-muc", // XXX: would like to remove this
            "converse-controlbox"
    ], factory);
}(this, function (converse, converse_api, tpl_dragresize) {
    "use strict";
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._;
    converse.templates.dragresize = tpl_dragresize;

    converse_api.plugins.add('converse-dragresize', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            registerGlobalEventHandlers: function () {
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

                return this.__super__.registerGlobalEventHandlers.apply(this, arguments);
            },

            ChatBox: {
                initialize: function () {
                    var result = this.__super__.initialize.apply(this, arguments),
                        height = this.get('height'), width = this.get('width'),
                        save = this.get('id') === 'controlbox' ? this.set.bind(this) : this.save.bind(this);
                    save({
                        'height': converse.applyDragResistance(height, this.get('default_height')),
                        'width': converse.applyDragResistance(width, this.get('default_width')),
                    });
                    return result;
                }
            },

            ChatBoxView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    this.setWidth();
                    return result;
                },

                setWidth: function () {
                    // If a custom width is applied (due to drag-resizing),
                    // then we need to set the width of the .chatbox element as well.
                    if (this.model.get('width')) {
                        this.$el.css('width', this.model.get('width'));
                    }
                },

                _show: function () {
                    this.initDragResize().setDimensions();
                    this.__super__._show.apply(this, arguments);
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

                setChatBoxHeight: function (height) {
                    if (height) {
                        height = converse.applyDragResistance(height, this.model.get('default_height'))+'px';
                    } else {
                        height = "";
                    }
                    this.$el.children('.box-flyout')[0].style.height = height;
                },

                setChatBoxWidth: function (width) {
                    if (width) {
                        width = converse.applyDragResistance(width, this.model.get('default_width'))+'px';
                    } else {
                        width = "";
                    }
                    this.$el[0].style.width = width;
                    this.$el.children('.box-flyout')[0].style.width = width;
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
                }
            },

            ControlBoxView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                renderLoginPanel: function () {
                    var result = this.__super__.renderLoginPanel.apply(this, arguments);
                    this.initDragResize().setDimensions();
                    return result;
                },

                renderContactsPanel: function () {
                    var result = this.__super__.renderContactsPanel.apply(this, arguments);
                    this.initDragResize().setDimensions();
                    return result;
                }
            },

            ChatRoomView: {
                events: {
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    this.__super__.initialize.apply(this, arguments);
                },

                render: function () {
                    var result = this.__super__.render.apply(this, arguments);
                    this.renderDragResizeHandles();
                    this.setWidth();
                    return result;
                },

                renderDragResizeHandles: function () {
                    var flyout = this.el.querySelector('.box-flyout');
                    var div = document.createElement('div');
                    div.innerHTML = converse.templates.dragresize();
                    flyout.insertBefore(
                        div,
                        flyout.firstChild
                    );
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            var converse = this.converse;
            this.updateSettings({
                allow_dragresize: true,
            });
            converse.applyDragResistance = function (value, default_value) {
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
        }
    });
}));

// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2012-2016, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define, window */

(function (root, factory) {
    define("converse-headline", [
            "converse-core",
            "converse-api",
            "converse-chatview"
    ], factory);
}(this, function (converse, converse_api) {
    "use strict";
    var $ = converse_api.env.jQuery,
        _ = converse_api.env._,
        utils = converse_api.env.utils,
        __ = utils.__.bind(converse);

    var onHeadlineMessage = function (message) {
        /* Handler method for all incoming messages of type "headline".
         */
        var $message = $(message),
            from_jid = $message.attr('from');
        if (utils.isHeadlineMessage(message)) {
            converse.chatboxes.create({
                'id': from_jid,
                'jid': from_jid,
                'fullname':  from_jid,
                'type': 'headline'
            }).createMessage($message, undefined, message);
            converse.emit('message', message);
        }
        return true;
    };

    converse_api.plugins.add('converse-headline', {

        overrides: {
            // Overrides mentioned here will be picked up by converse.js's
            // plugin architecture they will replace existing methods on the
            // relevant objects or classes.
            //
            // New functions which don't exist yet can also be added.

            ChatBoxViews: {
                onChatBoxAdded: function (item) {
                    var view = this.get(item.get('id'));
                    if (!view && item.get('type') === 'headline') {
                        view = new converse.HeadlinesBoxView({model: item});
                        this.add(item.get('id'), view);
                        return view;
                    } else {
                        return this.__super__.onChatBoxAdded.apply(this, arguments);
                    }
                }
            }
        },

        initialize: function () {
            /* The initialize function gets called as soon as the plugin is
             * loaded by converse.js's plugin machinery.
             */
            converse.HeadlinesBoxView = converse.ChatBoxView.extend({
                className: 'chatbox headlines',

                events: {
                    'click .close-chatbox-button': 'close',
                    'click .toggle-chatbox-button': 'minimize',
                    'keypress textarea.chat-textarea': 'keyPressed',
                    'mousedown .dragresize-top': 'onStartVerticalResize',
                    'mousedown .dragresize-left': 'onStartHorizontalResize',
                    'mousedown .dragresize-topleft': 'onStartDiagonalResize'
                },

                initialize: function () {
                    if (typeof this.setDimensions !== "undefined") {
                        // setDimensions is defined for dragresize
                        $(window).on('resize', _.debounce(this.setDimensions.bind(this), 100));
                    }
                    this.disable_mam = true; // Don't do MAM queries for this box
                    this.model.messages.on('add', this.onMessageAdded, this);
                    this.model.on('show', this.show, this);
                    this.model.on('destroy', this.hide, this);
                    this.model.on('change:minimized', this.onMinimizedChanged, this);
                    this.render().fetchMessages().insertIntoDOM().hide();
                    converse.emit('chatBoxInitialized', this);
                },

                render: function () {
                    this.$el.attr('id', this.model.get('box_id'))
                        .html(converse.templates.chatbox(
                                _.extend(this.model.toJSON(), {
                                        show_toolbar: converse.show_toolbar,
                                        show_textarea: false,
                                        title: this.model.get('fullname'),
                                        unread_msgs: __('You have unread messages'),
                                        info_close: __('Close this box'),
                                        label_personal_message: ''
                                    }
                                )
                            )
                        );
                    if (typeof this.setWidth !== "undefined") {
                        // setWidth is defined for dragresize
                        $(window).on('resize', _.debounce(this.setWidth.bind(this), 100));
                    }
                    this.$content = this.$el.find('.chat-content');
                    converse.emit('chatBoxOpened', this);
                    utils.refreshWebkit();
                    return this;
                }
            });

            var registerHeadlineHandler = function () {
                converse.connection.addHandler(
                        onHeadlineMessage, null, 'message');
            };
            converse.on('connected', registerHeadlineHandler);
            converse.on('reconnected', registerHeadlineHandler);
        }
    });
}));

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

        "converse-chatview",    // Renders standalone chat boxes for single user chat
        "converse-controlbox",  // The control box
        "converse-bookmarks",   // XEP-0048 Bookmarks
        "converse-mam",         // XEP-0313 Message Archive Management
        "converse-muc",         // XEP-0045 Multi-user chat
        "converse-vcard",       // XEP-0054 VCard-temp
        "converse-otr",         // Off-the-record encryption for one-on-one messages
        "converse-register",    // XEP-0077 In-band registration
        "converse-ping",        // XEP-0199 XMPP Ping
        "converse-notification",// HTML5 Notifications
        "converse-minimize",    // Allows chat boxes to be minimized
        "converse-dragresize",  // Allows chat boxes to be resized by dragging them
        "converse-headline",    // Support for headline messages
        /* END: Removable components */

    ], function(converse_api) {
        converse_api.env.jQuery(window).trigger('converse-loaded', converse_api);
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
define('lodash', [], function () { return _; });
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
