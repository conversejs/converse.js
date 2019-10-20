# Release checklist

1. Run `make check` to check that all tests pass.
2. Decide on a version number, e.g. 6.0.0
3. Run `make release VERSION=6.0.0`
4. Do a `git diff` to check if things look sane.
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "Release 6.0.0"`
7. `git tag -s v6.0.0 m "Release 6.0.0"`
8. Run `git push && git push --tags`
9. Update https://conversejs.org
10. Create `6.0.0` directory for the CDN.
    * `cd /home/conversejs/converse.js`
    * `git clone --branch v6.0.0 git@github.com:conversejs/converse.js.git 6.0.0`
    * `cd 6.0.0 && ASSET_PATH=https://cdn.conversejs.org/6.0.0/dist/ make dist`
    * `cd .. && git pull && ASSET_PATH=https://cdn.conversejs.org/dist/ make dist`
11. Run `npm publish && cd src/headless/ && npm publish`
12. Update the repository on weblate
13. Decide on next release number and run `make postrelease VERSION=6.0.1`
