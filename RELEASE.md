# Release checklist

1. Run `make check` to check that all tests pass.
2. Run `make release VERSION=6.0.1`
3. Do a `git diff` to check if things look sane.
4. Do a quick manual test with the `dist` files (via `index.html`)
5. `git commit -am "Release 6.0.1"`
6. `git tag -s v6.0.1 -m "Release 6.0.1"`
7. Run `git push && git push --tags`
8. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `git clone --branch v6.0.1 git@github.com:conversejs/converse.js.git 6.0.1`
    * `cd 6.0.1 && ASSET_PATH=https://cdn.conversejs.org/6.0.1/dist/ make dist`
    * `cd .. && git pull && ASSET_PATH=https://cdn.conversejs.org/dist/ make dist`
9. Update release page on Github
11. Run `npm publish && cd src/headless/ && npm publish`
12. Update the repository on weblate
13. Decide on next release number and run `make postrelease VERSION=6.0.2`
