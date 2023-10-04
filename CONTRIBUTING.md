# Contributing

The developer docs are here:
https://conversejs.org/docs/html/development.html

## Quickstart

### With GNU Make:

```
make serve_bg
make watch
```

Go to http://localhost:8000/dev.html

Then modify `dev.html` so that `converse.initialize()` is called with relevant settings.


### Without GNU Make:

```
npm install
npm run serve &
npm run watch
```

Webpack will "watch" the source files and automatically recreate the build if they
are modified. So you don't have to do anything to rebuild whenever you've
change something in a file but you will have to manually reload the browser tab
to see the changes in the browser.


## Live reloading

If you want to have live reloading whenever any of the source files change, you
can run ``make devserver`` (or ``npm run devserver``).

Then go to http://localhost:8080

Then modify `webpack.html` so that `converse.initialize()` is called with relevant settings.
