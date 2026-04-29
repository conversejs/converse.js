---
title: Security Considerations
description: Security threat model and mitigating measures in Converse.
---

:::note
Converse comes with no warranty of any kind and the authors are not liable for any damages.
:::

Converse handles sensitive user data such as XMPP account credentials (when using manual login) and personal conversations. When integrating Converse into your website or application, it's important to understand the security implications and take appropriate measures to protect user data.

## Threat Model

We consider the following security threats:

### Malicious Third-Party Scripts
Malicious scripts served through compromised channels (such as ad networks or compromised CDNs) that attempt to access Converse's API or data structures to:
- Steal user credentials or session data
- Impersonate users
- Access private conversations
- Send unauthorized messages

### Data Exposure
Sensitive data stored in browser storage mechanisms that could be accessed by malicious scripts:
- Chat message history
- Contact lists (roster)
- User preferences and settings

### Network-Level Attacks
While Converse uses secure XMPP connections (TLS), network-level attacks could potentially intercept:
- Authentication credentials
- Message content
- Presence information

## Security Measures

### Code and Data Architecture

Converse implements several security measures to protect user data:

1. **Private Data Encapsulation**: Sensitive data structures are encapsulated within a private closure (the `_converse` object) that is not directly accessible from the global scope.

2. **API Segregation**: The API is split into public and private components:
   - Public API: Limited functionality exposed via the global `converse` object
   - Private API: Full functionality available only to authorized plugins

3. **Plugin Access Control**: Only registered plugins can access the private API and `_converse` object.

4. **Plugin Registration Security**: 
   - Plugin names must be unique to prevent override attacks
   - Already registered plugins are protected from removal
   - Plugin integrity is verified during registration

### Data Storage Security

Converse stores different types of data with varying security considerations:

#### In-Memory Data
Active chat sessions, contacts, and settings are stored in memory within the `_converse` closure, making them inaccessible to external scripts.

#### Browser Storage
Some data is persisted in browser storage for user convenience:

- **Session Storage**: Cleared when the browser tab/window is closed
  - Active chat messages
  - Current session information
  - Temporary UI state

- **Local Storage**: Persists between browser sessions
  - User preferences
  - UI configuration
  - Offline message queue (if enabled)

:::caution
Browser storage is not encrypted and can potentially be accessed by malicious scripts on the same origin. For maximum security, avoid storing highly sensitive information in browser storage.
:::

## Best Practices for Integrators

To maximize security when integrating Converse into your website or application:

### 1. Minimize Third-Party Scripts
The most effective security measure is to avoid loading untrusted third-party JavaScript, especially:
- Advertising scripts
- Analytics trackers
- Social media widgets
- Unverified CDN resources

### 2. Content Security Policy (CSP)
Implement a strong Content Security Policy to restrict script execution:

```http
Content-Security-Policy: script-src 'self' 'unsafe-inline' https://cdn.conversejs.org;
```

### 3. Secure Configuration
When initializing Converse, consider these security-focused settings:

```javascript
converse.initialize({
    // Disable features that may expose additional attack surfaces
    allow_adhoc_commands: false,
    allow_contact_requests: false,
    allow_muc_invites: false,
    
    // Use secure connection settings
    websocket_url: 'wss://your-xmpp-server.example.com/websocket',
    
    // Clear session data on logout
    clear_cache_on_logout: true,
    
    // Set appropriate authentication options
    authentication: 'login', // or 'anonymous' based on your needs
});
```

### 4. Private API Access
If you need to extend Converse functionality:
- Create custom plugins rather than accessing internal APIs directly
- Avoid exposing the global `_converse` object
- Use the public API whenever possible

### 5. Regular Updates
Keep Converse updated to the latest version to benefit from security patches and improvements.

## Future Security Enhancements

The Converse development team is considering these additional security features:

### Encryption at Rest
Encrypting cached data in browser storage to protect against malicious script access.

### Enhanced Authentication
Support for more secure authentication mechanisms:
- OAuth2 integration
- Certificate-based authentication
- Two-factor authentication support

### Isolated Execution Context
Running Converse in a more isolated context (such as a Web Worker or iframe sandbox) to further limit access from other page scripts.

## Reporting Security Issues

If you discover a security vulnerability in Converse, please report it responsibly by:

1. Contacting the maintainer directly at jc@opkode.com
2. Providing a detailed description of the vulnerability
3. Including steps to reproduce the issue
4. Allowing time for a fix before public disclosure

:::note
Please do not report security issues through public channels like GitHub issues or mailing lists.
:::

## Additional Resources

- [XMPP Security Considerations](https://xmpp.org/extensions/xep-0185.html)
- [OWASP JavaScript Security](https://owasp.org/www-community/attacks/JavaScript_Injection)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
