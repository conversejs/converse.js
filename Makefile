# You can set these variables from the command line.
BABEL			?= node_modules/.bin/babel
BOOTSTRAP		= ./node_modules/
BOURBON 		= ./node_modules/bourbon/app/assets/stylesheets/
BUILDDIR		= ./docs
CHROMIUM		?= ./node_modules/.bin/run-headless-chromium
CLEANCSS		?= ./node_modules/clean-css-cli/bin/cleancss --skip-rebase
ESLINT		  	?= ./node_modules/.bin/eslint
HTTPSERVE	   	?= ./node_modules/.bin/http-server
HTTPSERVE_PORT	?= 8000
INKSCAPE		?= inkscape
JSDOC			?=  ./node_modules/.bin/jsdoc
LERNA			?= ./node_modules/.bin/lerna
OXIPNG			?= oxipng
PAPER		   	=
PO2JSON		 	?= ./node_modules/.bin/po2json
RJS				?= ./node_modules/.bin/r.js
NPX				?= ./node_modules/.bin/npx
SASS			?= ./node_modules/.bin/node-sass
SED				?= sed
SPHINXBUILD	 	?= ./bin/sphinx-build
SPHINXOPTS	  	=
UGLIFYJS		?= node_modules/.bin/uglifyjs


# Internal variables.
ALLSPHINXOPTS   = -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source

.PHONY: all
all: dev dist

.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of the following:"
	@echo ""
	@echo " all             A synonym for 'make dev'."
	@echo " build           Create minified builds of converse.js and all its dependencies."
	@echo " clean           Remove all NPM packages."
	@echo " check           Run all tests."
	@echo " css             Generate CSS from the Sass files."
	@echo " dev             Set up the development environment. To force a fresh start, run 'make clean' first."
	@echo " html            Make standalone HTML files of the documentation."
	@echo " po              Generate gettext PO files for each i18n language."
	@echo " po2json         Generate JSON files from the language PO files."
	@echo " pot             Generate a gettext POT file to be used for translations."
	@echo " release         Prepare a new release of converse.js. E.g. make release VERSION=0.9.5"
	@echo " serve           Serve this directory via a webserver on port 8000."
	@echo " serve_bg        Same as \"serve\", but do it in the background"
	@echo " stamp-npm       Install NPM dependencies"
	@echo " watch           Watch for changes on JS and scss files and automatically update the generated files."
	@echo " logo            Generate PNG logos of multiple sizes."


########################################################################
## Miscellaneous

.PHONY: serve
serve: dev
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1

.PHONY: serve_bg
serve_bg: dev
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1 -s &

########################################################################
## Translation machinery

GETTEXT = xgettext --language="JavaScript" --keyword=__ --keyword=___ --from-code=UTF-8 --output=locale/converse.pot dist/converse-no-dependencies.js --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=4.1.0 -c

.PHONY: pot
pot: dist/converse-no-dependencies-es2015.js
	$(GETTEXT) 2>&1 > /dev/null; exit $$?;

.PHONY: po
po:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./locale/converse.pot -U \;

.PHONY: po2json
po2json:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec $(PO2JSON) -f jed1.x -d converse {}/LC_MESSAGES/converse.po {}/LC_MESSAGES/converse.json \;

########################################################################
## Release management

.PHONY: release
release:
	$(SED) -ri 's/_converse.VERSION_NAME = "v[0-9]+\.[0-9]+\.[0-9]+";/ _converse.VERSION_NAME = "v$(VERSION)";/' src/headless/converse-core.js
	$(SED) -ri s/Version:\ [0-9]\+\.[0-9]\+\.[0-9]\+/Version:\ $(VERSION)/ COPYRIGHT
	$(SED) -ri s/Project-Id-Version:\ Converse\.js\ [0-9]\+\.[0-9]\+\.[0-9]\+/Project-Id-Version:\ Converse.js\ $(VERSION)/ locale/converse.pot
	$(SED) -ri s/\"version\":\ \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\":\ \"$(VERSION)\"/ package.json
	$(SED) -ri s/\"version\":\ \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\":\ \"$(VERSION)\"/ src/headless/package.json
	$(SED) -ri s/--package-version=[0-9]\+\.[0-9]\+\.[0-9]\+/--package-version=$(VERSION)/ Makefile
	$(SED) -ri s/v[0-9]\+\.[0-9]\+\.[0-9]\+\.zip/v$(VERSION)\.zip/ index.html
	$(SED) -ri s/v[0-9]\+\.[0-9]\+\.[0-9]\+\.tar\.gz/v$(VERSION)\.tar\.gz/ index.html
	$(SED) -ri s/version\ =\ \'[0-9]\+\.[0-9]\+\.[0-9]\+\'/version\ =\ \'$(VERSION)\'/ docs/source/conf.py
	$(SED) -ri s/release\ =\ \'[0-9]\+\.[0-9]\+\.[0-9]\+\'/release\ =\ \'$(VERSION)\'/ docs/source/conf.py
	$(SED) -ri "s/(Unreleased)/`date +%Y-%m-%d`/" CHANGES.md
	$(SED) -ri "s/cdn.conversejs.org\/[0-9]+\.[0-9]+\.[0-9]+/cdn.conversejs.org\/$(VERSION)/" docs/source/quickstart.rst
	make pot
	make po
	make po2json
	make build


########################################################################
## Install dependencies

$(LERNA):
	npm install lerna

stamp-npm: $(LERNA) package.json package-lock.json src/headless/package.json
	$(LERNA) bootstrap --hoist
	touch stamp-npm

.PHONY: clean
clean:
	rm -rf node_modules stamp-npm
	rm dist/*.min.js
	rm css/*.min.css
	rm css/*.map
	rm css/*.zip
	rm *.zip

.PHONY: dev
dev: stamp-npm

########################################################################
## Builds

.PHONY: css
css: dev sass/*.scss css/converse.css css/converse.min.css css/website.css css/website.min.css css/font-awesome.css

css/converse.css:: dev sass
	$(SASS) --source-map true --include-path $(BOURBON) --include-path $(BOOTSTRAP) sass/converse.scss css/converse.css

css/website.css:: dev sass
	$(SASS) --source-map true --include-path $(BOURBON) --include-path $(BOOTSTRAP) sass/website.scss $@

css/font-awesome.css:: dev sass
	$(SASS) --source-map true --include-path $(BOURBON) --include-path $(BOOTSTRAP) sass/font-awesome.scss $@

css/%.min.css:: css/%.css
	make dev
	$(CLEANCSS) $< > $@

.PHONY: watchcss
watchcss: dev
	$(SASS) --watch --source-map true --include-path $(BOURBON) --include-path $(BOOTSTRAP) -o ./css/ ./sass/

.PHONY: watchjs
watchjs: dev dist/converse-headless.js
	$(NPX)  webpack --mode=development  --watch

.PHONY: watchjsheadless
watchjsheadless: dev
	$(NPX)  webpack --mode=development  --watch --type=headless

.PHONY: watch
watch: dev
	make -j 3 watchcss  watchjsheadless watchjs

.PHONY: logo
logo: logo/conversejs-transparent16.png \
	  logo/conversejs-transparent19.png \
	  logo/conversejs-transparent48.png \
	  logo/conversejs-transparent128.png \
	  logo/conversejs-transparent512.png \
	  logo/conversejs-filled16.png \
	  logo/conversejs-filled19.png \
	  logo/conversejs-filled48.png \
	  logo/conversejs-filled128.png \
	  logo/conversejs-filled512.png \

logo/conversejs-transparent%.png:: logo/conversejs-transparent.svg
	$(INKSCAPE) -e $@ -w $* $<
	$(OXIPNG) $@

logo/conversejs-filled%.png:: logo/conversejs-filled.svg
	$(INKSCAPE) -e $@ -w $* $<
	$(OXIPNG) $@

BUILDS = dist/converse.js \
	dist/converse.min.js \
	dist/converse-headless.js \
	dist/converse-headless.min.js \
	dist/converse-no-dependencies.min.js \
	dist/converse-no-dependencies.js \
	dist/converse-no-dependencies-es2015.js

dist/converse.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=development
dist/converse.min.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=production
dist/converse-headless.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=development --type=headless
dist/converse-headless.min.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=production --type=headless
dist/converse-no-dependencies.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=development --type=nodeps
dist/converse-no-dependencies.min.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=production --type=nodeps
dist/converse-no-dependencies-es2015.js: src webpack.config.js stamp-npm @converse/headless
	$(NPX)  webpack --mode=development --type=nodeps --lang=es2015

@converse/headless: src/headless

.PHONY: dist
dist:: build

.PHONY: build
build:: dev css $(BUILDS) locale.zip css/webfonts.zip sounds.zip

css/webfonts.zip: css/webfonts/*
	zip -r css/webfonts.zip css/webfonts

locale.zip:
	zip -r locale.zip locale --exclude *.pot --exclude *.po --exclude *.po~

sounds.zip:
	zip -r sounds.zip sounds

########################################################################
## Tests

.PHONY: eslint
eslint: stamp-npm
	$(ESLINT) src/
	$(ESLINT) spec/

.PHONY: check
check: dist/converse.js eslint
	LOG_CR_VERBOSITY=INFO $(CHROMIUM) --disable-gpu --no-sandbox http://localhost:$(HTTPSERVE_PORT)/tests/index.html

########################################################################
## Documentation

./bin/activate:
	virtualenv .

.installed.cfg: requirements.txt buildout.cfg
	./bin/pip install -r requirements.txt
	./bin/buildout -v

docsdev: ./bin/activate .installed.cfg

.PHONY: html
html: dev docsdev apidoc
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	make apidoc
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

PHONY: apidoc
apidoc:
	$(JSDOC) --readme docs/source/jsdoc_intro.md -c docs/source/conf.json -d docs/html/api src/*.js
