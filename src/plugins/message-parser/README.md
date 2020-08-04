# MessageParser plugin

## Filters

Filter functions transform the raw message text before middleware kicks in.

They receive a string as argument and return a transformed string. 

```javascript
function exampleFilter (message_string) {
    const transformed_message_string = doSomeMagicTo(message_string);
    return transformed_message_string;
}

api.message.addFilters(exampleMiddleware);
```

## Middleware

Middleware functions take the raw message text and return an array of reference objects to be added to the RichMessage object.

```javascript
function exampleMiddleware (message_string) {
    const matching_urls = message_string.matchAll(/https?:\/\/(\w+\.com)/gi);
    const references = Array.from(matching_urls).map(url => ({
        begin: url.index,
        end: url.index + url[0].length,
        template: `<a href="${url[0]}">${url[0]}</a>`
    }));
    return references;
}

api.message.addMiddleware(exampleMiddleware);
```
