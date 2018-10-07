define(['lodash', 'lodash.converter'], function (_, lodashConverter) {
    var fp = lodashConverter(_.runInContext());
    return fp;
});
