# Release checklist

1. Run `make check` to check that all tests pass.
2. Decide on a version number, e.g. 5.0.0
3. Run `make release VERSION=5.0.0`
4. Do a `git diff` to check if things look sane.
5. Do a quick manual test with the `dist` files (via `index.html`)
6. `git commit -am "New release 5.0.0"`
7. `git tag -s v5.0.0
8. Run `git push && git push --tags`
9. Update https://conversejs.org
10. Create `5.0.0` directory for the CDN.
    * Create a new version for the CDN by copying
    * Check out the correct tag
    * Update `index.html` to point to that version of the CDN
    * Run `make dist`
    * Do the same for the root dir
11. Run `npm publish && cd src/headless/ && npm publish`
12. Update the repository on weblate
