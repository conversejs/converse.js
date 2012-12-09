(function (root, factory) {
    define([
        "converse"
        ], function (xmppchat) {
            return factory(xmppchat);
        }
    );
} (this, function (xmppchat) {
    String.prototype.repeat = function(times) {
        return (new Array(times + 1)).join(this+' ').replace(/\s$/, '');
    };

    return describe("Local storage of messages and open chats", function() {

        beforeEach(function() {
            this.storage = new xmppchat.ClientStorage('dummy@localhost');
        });

        describe("open chat storage", function () {

            beforeEach(function() {
                // Removes all stored items
                this.storage.flush();
            });

            it("should by default not have any chats", function () {
                expect(this.storage.getOpenChats()).toEqual([]);
            });

            it("should be able to add chats", function () {
                this.storage.addOpenChat('chat1@localhost');
                expect(this.storage.getOpenChats()).toEqual(['chat1@localhost']);

                this.storage.addOpenChat('chat2@localhost');
                expect(this.storage.getOpenChats()).toEqual(['chat1@localhost', 'chat2@localhost']);

                this.storage.addOpenChat('chat3@localhost');
                expect(this.storage.getOpenChats()).toEqual(['chat1@localhost', 
                                                             'chat2@localhost',
                                                             'chat3@localhost']);
            });

            it("should be able to remove chats", function () {
                this.storage.removeOpenChat('non-existing@localhost');
                expect(this.storage.getOpenChats()).toEqual([]);

                this.storage.addOpenChat('chat1@localhost');
                this.storage.addOpenChat('chat2@localhost');
                this.storage.addOpenChat('chat3@localhost');
                expect(this.storage.getOpenChats()).toEqual(['chat1@localhost', 
                                                             'chat2@localhost',
                                                             'chat3@localhost']);

                this.storage.removeOpenChat('chat2@localhost');
                expect(this.storage.getOpenChats()).toEqual(['chat1@localhost', 
                                                             'chat3@localhost']);

                this.storage.removeOpenChat('chat1@localhost');
                expect(this.storage.getOpenChats()).toEqual(['chat3@localhost']);

                this.storage.removeOpenChat('chat3@localhost');
                expect(this.storage.getOpenChats()).toEqual([]);

                this.storage.removeOpenChat('non-existing@localhost');
                expect(this.storage.getOpenChats()).toEqual([]);
            });
        });

        describe("message storage", function () {

            var iso_regex = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;

            it("should by default not have any messages", function () {
                expect(this.storage.getMessages('chat@localhost')).toEqual([]);
            });

            it("should be able to add and retrieve messages", function () {
                var i, jid = 'chat@localhost';
                for (i=0; i<10; i++) {
                    var msg = 'msg'.repeat(i+1);
                    this.storage.addMessage(jid, msg, 'to');
                    // Check that message is returned
                    var msgs = this.storage.getMessages(jid);
                    expect(msgs.length).toEqual(i+1);
                    expect(msgs[i]).toEqual(jasmine.any(String));

                    // First two space separated strings are ISO date and direction 
                    var msg_arr = msgs[i].split(' ', 2);
                    // Check that first string is ISO format
                    expect(msg_arr[0]).toMatch(iso_regex);
                    expect(msg_arr[0]).toEqual(jasmine.any(String));
                    expect(msg_arr[1]).toEqual('to');
                    expect(msgs[i].replace(/(.*?\s.*?\s)/, '')).toEqual(msg);
                }
            });

            it("should be able to get last message", function () {
                var msg = this.storage.getLastMessage('chat@localhost'),
                    msg_arr = msg.split(' ', 2);

                expect(msg_arr[0]).toMatch(iso_regex);
                expect(msg_arr[0]).toEqual(jasmine.any(String));
                expect(msg_arr[1]).toEqual('to');
                expect(msg.replace(/(.*?\s.*?\s)/, '')).toEqual('msg'.repeat(10));
            });

            it("should be able to clear all messages", function () {
                this.storage.clearMessages('chat@localhost');
                expect(this.storage.getMessages('chat@localhost')).toEqual([]);
            });

            it("should not store more than 30 messages", function () {
                var i, msgs;
                for (i=0; i<100; i++) {
                    this.storage.addMessage('chat@localhost', 'msg', 'to');
                }
                msgs = this.storage.getMessages('chat@localhost');
                expect(msgs.length).toEqual(30);
            });

        });
    });
}));
