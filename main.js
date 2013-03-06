require(["jquery", "converse"], function($) {
    $(function() {
        $('#login_dialog').dialog({
            autoOpen: true,
            draggable: false,
            modal: true,
            title: 'Connect to XMPP',
            buttons: {
                "Connect": function () {
                    $(document).trigger('connect', {
                        jid: $('#jid').val(),
                        password: $('#password').val(),
                        bosh_service_url: $('#bosh_service_url').val()
                    });
                    $('#password').val('');
                    $(this).dialog('close');
                }
            }
        });

        $(document).bind('connect', function (ev, data) {
            var connection = new Strophe.Connection(data.bosh_service_url);

            connection.connect(data.jid, data.password, function (status) {
                if (status === Strophe.Status.CONNECTED) {
                    console.log('Connected');
                    $(document).trigger('jarnxmpp.connected', connection);
                } else if (status === Strophe.Status.DISCONNECTED) {
                    console.log('Disconnected');
                    $(document).trigger('jarnxmpp.disconnected');
                } else if (status === Strophe.Status.Error) {
                    console.log('Error');
                } else if (status === Strophe.Status.CONNECTING) {
                    console.log('Connecting');
                } else if (status === Strophe.Status.CONNFAIL) {
                    console.log('Connection Failed');
                } else if (status === Strophe.Status.AUTHENTICATING) {
                    console.log('Authenticating');
                } else if (status === Strophe.Status.AUTHFAIL) {
                    console.log('Authenticating Failed');
                } else if (status === Strophe.Status.DISCONNECTING) {
                    console.log('Disconnecting');
                } else if (status === Strophe.Status.ATTACHED) {
                    console.log('Attached');
                }
            });
        });

    });
});
