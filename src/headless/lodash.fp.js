define(['lodash', './3rdparty/lodash.fp'], function (_, lodashConverter) {
    var fp = lodashConverter(_.runInContext());
    return fp;
});
