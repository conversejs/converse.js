# Release checklist

1. Check that weblate translations are all merged in
2. Run `make check` to check that all tests pass.
3. Run `make release VERSION=10.1.3`
4. Do a `git diff` to check if things look sane.
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "Release 10.1.3"`
7. `git tag -s v10.1.3 -m "Release 10.1.3"`
8. Run `git push && git push origin v10.1.3`
9. Update https://conversejs.org
    * `cd /home/conversejs/converse.js`
    * `make deploy VERSION=10.1.3`
10. Update release page on Github
11. `cd release && git fetch && git co v10.1.3`
12. Run `npm publish && cd src/headless/ && npm publish`
13. Update the repository on weblate
14. Decide on next release number and run `make postrelease VERSION=10.1.4`
