// This script will add an autocomplete feature for possible XMPP servers when registering a new account.

const xmppServers = ['jabber.org', 'gmail.com', 'yahoo.com', 'hotmail.com', 'aol.com'];

function getAutocompleteOptions(input) {
  const options = xmppServers.filter(server => server.includes(input));
  return options;
}

// Example usage in a form input field
const inputField = document.getElementById('xmpp-server-input');

inputField.addEventListener('input', function(event) {
  const inputValue = event.target.value;
  const suggestions = getAutocompleteOptions(inputValue);
  // Update the dropdown or suggestion list with the possible options
  // This part depends on your UI framework (e.g., using a <datalist> in HTML, updating a dropdown component)
});
