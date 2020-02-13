# You can set these variables from the command line.
BABEL			?= node_modules/.bin/babel
BOOTSTRAP		= ./node_modules/
BUILDDIR		= ./docs
CHROMIUM		?= ./node_modules/.bin/run-headless-chromium
CLEANCSS		?= ./node_modules/clean-css-cli/bin/cleancss --skip-rebase
ESLINT			?= ./node_modules/.bin/eslint
HTTPSERVE	 	?= ./node_modules/.bin/http-server
HTTPSERVE_PORT	?= 8000
INKSCAPE		?= inkscape
INSTALL			?= install
JSDOC			?=	./node_modules/.bin/jsdoc
LERNA			?= ./node_modules/.bin/lerna
OXIPNG			?= oxipng
PAPER		 	=
RJS				?= ./node_modules/.bin/r.js
NPX				?= ./node_modules/.bin/npx
SASS			?= ./node_modules/.bin/node-sass
SED				?= sed
SPHINXBUILD	 	?= ./bin/sphinx-build
SPHINXOPTS		=
UGLIFYJS		?= node_modules/.bin/uglifyjs
XGETTEXT		= xgettext


# Internal variables.
ALLSPHINXOPTS	= -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source
VERSION_FORMAT	= [0-9]+\.[0-9]+\.[0-9]+

.PHONY: all
all: stamp-npm dist

.PHONY: help
help:
	@echo "Please use \`make <target>' where <target> is one of the following:"
	@echo ""
	@echo " all         Set up dev environment and create all builds"
	@echo " build       Create minified builds of converse.js and all its dependencies."
	@echo " clean       Remove all NPM packages."
	@echo " check       Run all tests."
	@echo " dev         Set up the development environment and build unminified resources. To force a fresh start, run 'make clean' first."
	@echo " devserver   Set up the development environment and start the webpack dev server."
	@echo " doc         Make standalone HTML files of the documentation."
	@echo " po          Generate gettext PO files for each i18n language."
	@echo " pot         Generate a gettext POT file to be used for translations."
	@echo " release     Prepare a new release of converse.js. E.g. make release VERSION=0.9.5"
	@echo " serve       Serve this directory via a webserver on port 8000."
	@echo " serve_bg    Same as \"serve\", but do it in the background"
	@echo " stamp-npm   Install NPM dependencies"
	@echo " watch       Watch for changes on JS and scss files and automatically update the generated files."
	@echo " logo        Generate PNG logos of multiple sizes."


########################################################################
## Miscellaneous

.PHONY: serve
serve: stamp-npm
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1

.PHONY: serve_bg
serve_bg: stamp-npm
	$(HTTPSERVE) -p $(HTTPSERVE_PORT) -c-1 -s &

########################################################################
## Translation machinery

dist/converse-no-dependencies.js: src webpack.common.js webpack.nodeps.js stamp-npm @converse/headless
	npm run nodeps

GETTEXT = $(XGETTEXT) --from-code=UTF-8 --language=JavaScript --keyword=__ --keyword=___ --keyword=i18n_ --force-po --output=locale/converse.pot --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=6.0.0 dist/converse-no-dependencies.js -c

.PHONY: pot
pot: dist/converse-no-dependencies.js
	$(GETTEXT) 2>&1 > /dev/null; exit $$?;
	rm dist/converse-no-dependencies.js

.PHONY: po
po:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./locale/converse.pot -U \;

########################################################################
## Release management

.PHONY: release
release:
	$(SED) -i '/^_converse.VERSION_NAME =/s/=.*/= "v$(VERSION)";/' src/headless/converse-core.js
	$(SED) -i '/Version:/s/:.*/: $(VERSION)/' COPYRIGHT
	$(SED) -i '/Project-Id-Version:/s/:.*/: Converse.js $(VERSION)\n"/' locale/converse.pot
	$(SED) -i '/"version":/s/:.*/: "$(VERSION)",/' package.json
	$(SED) -i '/"version":/s/:.*/: "$(VERSION)",/' src/headless/package.json
	$(SED) -ri 's/--package-version=$(VERSION_FORMAT)/--package-version=$(VERSION)/' Makefile
	$(SED) -i -e "/version =/s/=.*/= '$(VERSION)'/" -e "/release =/s/=.*/= '$(VERSION)'/" docs/source/conf.py
	$(SED) -i "s/[Uu]nreleased/`date +%Y-%m-%d`/" CHANGES.md
	$(SED) -ri 's,cdn.conversejs.org/$(VERSION_FORMAT),cdn.conversejs.org/$(VERSION),' docs/source/quickstart.rst
	$(SED) -ri 's,cdn.conversejs.org/$(VERSION_FORMAT),cdn.conversejs.org/$(VERSION),' *.html
	$(SED) -ri 's,cdn.conversejs.org/$(VERSION_FORMAT),cdn.conversejs.org/$(VERSION),' demo/*.html
	make pot
	make po
	make build
	npm pack

.PHONY: postrelease
postrelease:
	$(SED) -i '/^_converse.VERSION_NAME =/s/=.*/= "v$(VERSION)dev";/' src/headless/converse-core.js

########################################################################
## Install dependencies

$(LERNA):
	npm install lerna

package-lock.json: package.json
	npm install

stamp-npm: $(LERNA) package.json package-lock.json src/headless/package.json
	npm run lerna
	touch stamp-npm

.PHONY: clean
clean:
	npm run clean
	rm -rf lib bin include parts

.PHONY: dev
dev: stamp-npm
	npm run dev

.PHONY: devserver
devserver: stamp-npm
	npm run serve

########################################################################
## Builds

dist/converse.js:: stamp-npm dev

dist/converse.css:: stamp-npm dev

dist/website.css:: stamp-npm sass
	$(SASS) --source-map true --include-path $(BOOTSTRAP) sass/website.scss $@

dist/website.min.css:: stamp-npm dist/website.css
	$(CLEANCSS) dist/website.css > $@

.PHONY: watch
watch: stamp-npm
	npm run watch

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

BUILDS = src/headless/dist/converse-headless.min.js

@converse/headless: src/headless

src/headless/dist/converse-headless.min.js: src webpack.common.js stamp-npm @converse/headless
	npm run headless


.PHONY: dist
dist:: build

.PHONY: build
build:: stamp-npm
	npm run dev && npm run build && make dist/website.css && make dist/website.min.css

.PHONY: cdn
cdn:: stamp-npm
	npm run cdn

########################################################################
## Tests

.PHONY: eslint
eslint: stamp-npm
	$(ESLINT) src/*.js
	$(ESLINT) src/utils/*.js
	$(ESLINT) src/headless/*.js
	$(ESLINT) src/headless/utils/*.js
	$(ESLINT) spec/

.PHONY: check
check: eslint dev
	LOG_CR_VERBOSITY=INFO $(CHROMIUM) --disable-gpu --no-sandbox http://localhost:$(HTTPSERVE_PORT)/tests/index.html

########################################################################
## Documentation

./bin/activate:
	python3.7 -m venv .

.installed.cfg: requirements.txt buildout.cfg
	./bin/pip install -r requirements.txt
	./bin/pip install --upgrade pip==19.2.1
	./bin/pip install --upgrade setuptools==41.0.1
	./bin/buildout -v

docsdev: ./bin/activate .installed.cfg

.PHONY: html
html: doc

.PHONY: doc
doc: stamp-npm docsdev apidoc
	rm -rf $(BUILDDIR)/html
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	make apidoc
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

PHONY: apidoc
apidoc:
	$(JSDOC) --private --readme docs/source/jsdoc_intro.md -c docs/source/conf.json -d docs/html/api src/*.js src/utils/*.js src/headless/*.js src/headless/utils/*.js
