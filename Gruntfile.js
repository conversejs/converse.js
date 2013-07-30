module.exports = function(grunt) {
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
                        "jquery": "components/jquery/jquery",
                        "jed": "components/jed/jed",
                        "locales": "locale/locales",
                        "af": "locale/af/LC_MESSAGES/af",
                        "en": "locale/en/LC_MESSAGES/en",
                        "de": "locale/de/LC_MESSAGES/de",
                        "es": "locale/es/LC_MESSAGES/es",
                        "it": "locale/it/LC_MESSAGES/it",
                        "pt_BR": "locale/pt_BR/LC_MESSAGES/pt_BR", 
                        "sjcl": "components/sjcl/sjcl",
                        "tinysort": "components/tinysort/src/jquery.tinysort",
                        "underscore": "components/underscore/underscore",
                        "backbone": "components/backbone/backbone",
                        "localstorage": "components/backbone.localStorage/backbone.localStorage",
                        "strophe": "components/strophe/strophe",
                        "strophe.muc": "components/strophe.muc/index",
                        "strophe.roster": "components/strophe.roster/index",
                        "strophe.vcard": "components/strophe.vcard/index",
                        "strophe.disco": "components/strophe.disco/index"
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
        exec('phantomjs '+
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
        exec('bower update && cd ./components/strophe && make normal',
             function (err, stdout, stderr) {
                if (err) {
                    grunt.log.write('build failed with error code '+err.code);
                    grunt.log.write(stderr);
                }
                grunt.log.write(stdout);
                done();
        });
    });

    grunt.registerTask('minify', 'Minify JC and CSS files', ['requirejs', 'cssmin']);

    grunt.registerTask('rename', 'Rename minified files to include version number', function () {
        var cfg = require('./package.json');
        grunt.log.write('The release version is '+cfg.version);
        var done = this.async();
        var child_process = require('child_process');
        var exec = child_process.exec;
        exec('mv converse.min.js converse-'+cfg.version+'.min.js &&'+
             'mv converse.min.css converse-'+cfg.version+'.min.css',
             function (err, stdout, stderr) {
                if (err) {
                    grunt.log.write('rename failed with error code '+err.code);
                    grunt.log.write(stderr);
                }
                grunt.log.write(stdout);
                done();
        });
    });

    grunt.registerTask('release', 'Create a new release', ['minify', 'rename']);

    grunt.registerTask('check', 'Perform all checks (e.g. before releasing)', function () {
        grunt.task.run('jshint', 'test');
    });
};
