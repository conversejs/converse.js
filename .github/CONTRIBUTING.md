# Contribution Guidelines

Thanks for contributing to [Converse.js](https://conversejs.org)

## Support questions

The Github issue tracker is used for bug reports and feature requests, not for general tech support.

For support, you can join our [XMPP webchat](https://inverse.chat/#converse/room?jid=discuss@conference.conversejs.org).
Instead of the webchat, you can also open the room in your XMPP client, [click here](xmpp://discuss@conference.conversejs.org?join).

You can also ask questions on [StackOverflow](https://stackoverflow.com/questions/tagged/converse.js)

## Contributing Code

Please follow the usual Github workflow. Create a fork of this repository, make your changes and then submit a pull request.

### Before submitting a pull request

Please read the [style guide](https://conversejs.org/docs/html/style_guide.html) and make sure that your code follows it.

### Add tests for your bugfix or feature

Add a test for any bug fixed or feature added.

Tests can be found in various `./tests` folders in the Converse source code.

To run the tests, you can run `make check` on Linux and Mac, or `./node_modules/bin/karma start karma.conf` on Windows.
