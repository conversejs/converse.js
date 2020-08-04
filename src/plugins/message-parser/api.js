import MessageParser from './MessageParser';

const parser = new MessageParser();
const {
  filters,
  middleware,
  addFilters,
  addMiddleware
} = parser;

const api = {
    message: {
        parser,
        filters,
        middleware,
        addFilters: addFilters.bind(parser),
        addFilter: addFilters.bind(parser), // Alias of `addFilters`
        addMiddleware: addMiddleware.bind(parser)
    }
};

export default api;
