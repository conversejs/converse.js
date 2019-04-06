(function (root, factory) {
    define([
        "jasmine",
        "converse-core",
        "mock",
        "test-utils",
        "utils",
        "transcripts"
        ], factory
    );
} (this, function (jasmine, converse, mock, test_utils, utils, transcripts) {
    var Strophe = converse.env.Strophe;
    var _ = converse.env._;
    var IGNORED_TAGS = [
        'stream:features',
        'auth',
        'challenge',
        'success',
        'stream:features',
        'response'
    ];

    function traverseElement (el, _stanza) {
        if (typeof _stanza !== 'undefined') {
            if (el.nodeType === 3) {
                _stanza.t(el.nodeValue);
                return _stanza;
            } else {
                _stanza = _stanza.c(el.nodeName.toLowerCase(), getAttributes(el));
            }
        } else {
            _stanza = new Strophe.Builder(
                el.nodeName.toLowerCase(),
                getAttributes(el)
            );
        }
        _.each(el.childNodes, _.partial(traverseElement, _, _stanza));
        return _stanza.up();
    }

    function getAttributes (el) {
        var attributes = {};
        _.each(el.attributes, function (att) {
            attributes[att.nodeName] = att.nodeValue;
        });
        return attributes;
    }

    return describe("Transcripts of chat logs", function () {

        it("can be used to replay conversations",
                mock.initConverse(
                    null, ['rosterGroupsFetched'], {},
                    function (done, _converse) {

            _converse.allow_non_roster_messaging = true;

            test_utils.openAndEnterChatRoom(_converse, 'discuss', 'conference.conversejs.org', 'dummy').then(function () {
                spyOn(_converse, 'areDesktopNotificationsEnabled').and.returnValue(true);
                _.each(transcripts, function (transcript) {
                    var text = transcript();
                    var xml = Strophe.xmlHtmlNode(text);
                    _.each(xml.firstElementChild.children, function (el) {
                        _.each(el.children, function (el) {
                            if (el.nodeType === 3) {
                                return;  // Ignore text
                            }
                            if (_.includes(IGNORED_TAGS, el.nodeName.toLowerCase())) {
                                return;
                            }
                            var _stanza = traverseElement(el);
                            _converse.connection._dataRecv(test_utils.createRequest(_stanza));
                        });
                    });
                });
                done();
            });
        }));
    });
}));
