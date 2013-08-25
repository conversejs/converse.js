module.exports = function(grunt) {
    var cfg = require('./package.json');
    grunt.initConfig({
        jshint: {
            options: {
                trailing: true
            },
            target: {
                src : [
                    'converse.js',
                    'mock.js',
                    'main.js',
                    'tests_main.js',
                    'spec/*.js'
                ]
            }
        },
        cssmin: {
            options: {
                banner: "/*"+
                        "* Converse.js (Web-based XMPP instant messaging client) \n"+
                        "* http://conversejs.org \n"+
                        "* Copyright (c) 2012, Jan-Carel Brand <jc@opkode.com> \n"+
                        "* Dual licensed under the MIT and GPL Licenses \n"+
                        "*/"
            },
            minify: {
                dest: 'converse.min.css',
                src: ['converse.css']
            }
        },
        requirejs: {
            compile: {
                options: {
                    baseUrl: ".",
                    name: "main",
                    out: "converse.min.js",
                    paths: {
                        "require": "components/requirejs/require",
                        "jquery": "components/jquery/jquery",
                        "jed": "components/jed/jed",
                        "locales": "locale/locales",
                        "af": "locale/af/LC_MESSAGES/af",
                        "en": "locale/en/LC_MESSAGES/en",
                        "de": "locale/de/LC_MESSAGES/de",
                        "es": "locale/es/LC_MESSAGES/es",
                        "it": "locale/it/LC_MESSAGES/it",
                        "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR", 
                        "tinysort": "components/tinysort/src/jquery.tinysort",
                        "underscore": "components/underscore/underscore",
                        "backbone": "components/backbone/backbone",
                        "localstorage": "components/backbone.localStorage/backbone.localStorage",
                        "strophe": "components/strophe/strophe",
                        "strophe.muc": "components/strophe.muc/index",
                        "strophe.roster": "components/strophe.roster/index",
                        "strophe.vcard": "components/strophe.vcard/index",
                        "strophe.disco": "components/strophe.disco/index"
                    },
                    done: function(done, output) {
                        var duplicates = require('rjs-build-analysis').duplicates(output);
                        if (duplicates.length > 0) {
                            grunt.log.subhead('Duplicates found in requirejs build:');
                            grunt.log.warn(duplicates);
                            done(new Error('r.js built duplicate modules, please check the excludes option.'));
                        }
                        done();
                    }
                }
            }
        }
    });
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-requirejs');

    grunt.registerTask('test', 'Run Tests', function () {
        var done = this.async();
        var child_process = require('child_process');
        var exec = child_process.exec;
        exec('./node_modules/.bin/phantomjs '+
             'node_modules/jasmine-reporters/test/phantomjs-testrunner.js '+
             __dirname+'/tests.html',
             function (err, stdout, stderr) {
                if (err) {
                    grunt.log.write('Tests failed with error code '+err.code);
                    grunt.log.write(stderr);
                }
                grunt.log.write(stdout);
                done();
        });
    });

    grunt.registerTask('fetch', 'Set up the development environment', function () {
        var done = this.async();
        var child_process = require('child_process');
        var exec = child_process.exec;
        exec('./node_modules/.bin/bower update && cd ./components/strophe && make normal',
             function (err, stdout, stderr) {
                if (err) {
                    grunt.log.write('build failed with error code '+err.code);
                    grunt.log.write(stderr);
                }
                grunt.log.write(stdout);
                done();
        });
    });

    grunt.registerTask('minify', 'Create a new release', ['cssmin', 'requirejs']);

    grunt.registerTask('check', 'Perform all checks (e.g. before releasing)', function () {
        grunt.task.run('jshint', 'test');
    });
};
