# Release checklist

1. Run `make check` to check that all tests pass.
2. Decide on a version number, e.g. 1.0.5
3. Run `make release VERSION=1.0.5`
4. Update `index.html` to point to that version of the CDN (could perhaps be put in Makefile)
4. Do a `git diff` to check if things look sane.
4. Do a quick manual test with the `dist` files (via `index.html`)
5. `git commit -am "New release 1.0.5"`
6. `git tag -s v1.0.5
7. Run `git push && git push --tags`
8. Update http://conversejs.org
    * Create a new version for the CDN by copying
    * Check out the correct tag
    * Run `make dist`
    * Do the same for the root dir
9. Create `1.0.5` directory for the CDN.
10. Run `npm publish`
