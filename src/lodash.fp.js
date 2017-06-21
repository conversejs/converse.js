define(['lodash', 'lodash.fpConverter'], function (_, lodashBrowserConvert) {
    return lodashBrowserConvert(_.runInContext());
});
