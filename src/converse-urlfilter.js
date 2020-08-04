import URI from "urijs";

import { converse, api } from "@converse/headless/converse-core";

import { URL_START_REGEX } from './utils/html';


const filterUrl = (unwanted_query_params) => (url) => {
    const uri = URI(url)
    uri.removeQuery(unwanted_query_params);
    uri.hasQuery('s', 21) && uri.removeQuery('s'); // remove twitter's ?s=21
    return uri.toString();
}

const filterQueryParams = (unwanted_query_params) => (text) => 
    URI.withinString(text, filterUrl(unwanted_query_params), { start: URL_START_REGEX });

converse.plugins.add('converse-urlfilter', {
    initialize () {
        api.settings.extend({ filter_url_query_params: [] })

        const settings = api.settings.get('filter_url_query_params');
        api.message.setFilters(filterQueryParams(settings));
    }
});
