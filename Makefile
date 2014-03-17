# You can set these variables from the command line.
SPHINXOPTS    =
SPHINXBUILD = sphinx-build
PAPER         =
BUILDDIR      = ./docs

BOWER 		?= node_modules/.bin/bower

# Internal variables.
PAPEROPT_a4     = -D latex_paper_size=a4
PAPEROPT_letter = -D latex_paper_size=letter
ALLSPHINXOPTS   = -d $(BUILDDIR)/doctrees $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source
# the i18n builder cannot share the environment and doctrees with the others
I18NSPHINXOPTS  = $(PAPEROPT_$(PAPER)) $(SPHINXOPTS) ./docs/source

.PHONY: all help clean html epub changes linkcheck gettext po pot po2json merge release

all: dev

help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  changes    to make an overview of all changed/added/deprecated items"
	@echo "  devhelp    to make HTML files and a Devhelp project"
	@echo "  dirhtml    to make HTML files named index.html in directories"
	@echo "  doctest    to run all doctests embedded in the documentation (if enabled)"
	@echo "  epub       to export the documentation to epub"
	@echo "  gettext    to make PO message catalogs of the documentation"
	@echo "  html       to make standalone HTML files of the documentation"
	@echo "  htmlhelp   to make HTML files and a HTML help project from the documentation"
	@echo "  info       to make Texinfo files and run them through makeinfo"
	@echo "  json       to make JSON files"
	@echo "  latex      to make LaTeX files, you can set PAPER=a4 or PAPER=letter"
	@echo "  latexpdf   to make LaTeX files and run them through pdflatex"
	@echo "  linkcheck  to check all external links for integrity"
	@echo "  pot        generates a gettext POT file to be used for translations"
	@echo "  release    to make a new minified release"
	@echo "  linkcheck  to check all documentation external links for integrity"
	@echo "  epub       to export the documentation to epub"
	@echo "  changes    to make an overview of all changed/added/deprecated items added to the documentation"

pot: 
	xgettext --keyword=__ --keyword=___ --from-code=UTF-8 --output=locale/converse.pot converse.js --package-name=Converse.js --copyright-holder="Jan-Carel Brand" --package-version=0.7.0 -c --language="python";

merge:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec msgmerge {}/LC_MESSAGES/converse.po ./locale/converse.pot -U \;

po2json:
	find ./locale -maxdepth 1 -mindepth 1 -type d -exec po2json {}/LC_MESSAGES/converse.po {}/LC_MESSAGES/converse.json \;

release:
	sed -i s/\"version\":\ \"[0-9]\.[0-9]\.[0-9]\"/\"version\":\ \"$(VERSION)\"/ bower.json
	sed -i s/\"version\":\ \"[0-9]\.[0-9]\.[0-9]\"/\"version\":\ \"$(VERSION)\"/ package.json
	sed -i s/v[0-9]\.[0-9]\.[0-9]\.zip/v$(VERSION)\.zip/ index.html
	sed -i s/v[0-9]\.[0-9]\.[0-9]\.tar\.gz/v$(VERSION)\.tar\.gz/ index.html
	sed -i s/version\ =\ \'[0-9]\.[0-9]\.[0-9]\'/version\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -i s/release\ =\ \'[0-9]\.[0-9]\.[0-9]\'/release\ =\ \'$(VERSION)\'/ docs/source/conf.py
	sed -i "s/(Unreleased)/(`date +%Y-%m-%d`)/" docs/CHANGES.rst
	grunt minify

dev:
	npm install
	${BOWER} update;

clean:
	-rm -rf $(BUILDDIR)/*

html:
	$(SPHINXBUILD) -b html $(ALLSPHINXOPTS) $(BUILDDIR)/html
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

epub:
	$(SPHINXBUILD) -b epub $(ALLSPHINXOPTS) $(BUILDDIR)/epub
	@echo
	@echo "Build finished. The epub file is in $(BUILDDIR)/epub."

gettext:
	$(SPHINXBUILD) -b gettext $(I18NSPHINXOPTS) $(BUILDDIR)/locale
	@echo
	@echo "Build finished. The message catalogs are in $(BUILDDIR)/locale."

changes:
	$(SPHINXBUILD) -b changes $(ALLSPHINXOPTS) $(BUILDDIR)/changes
	@echo
	@echo "The overview file is in $(BUILDDIR)/changes."

linkcheck:
	$(SPHINXBUILD) -b linkcheck $(ALLSPHINXOPTS) $(BUILDDIR)/linkcheck
	@echo
	@echo "Link check complete; look for any errors in the above output " \
	      "or in $(BUILDDIR)/linkcheck/output.txt."
