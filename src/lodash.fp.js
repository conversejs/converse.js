define(['lodash', 'lodash.converter', 'converse-core'], function (_, lodashConverter, converse) {
    const fp = lodashConverter(_.runInContext());
    converse.env.fp = fp;
    return fp;
});
