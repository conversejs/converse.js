# A TODO app for Converse

We would like to support having multiple todo lists.
The planned approach is to have a "master" index node which contains a list of todo lists.
An XMPP client should subscribe to this node to get the list of todo lists, and then it should subscribe to each of the todo lists themselves.

 1 “Master” index node                                                                                                                       
   • Create a well-known PubSub node (e.g. “lists.index@server”) whose items each represent one TODO-list.                                   
   • The payload of each item can simply contain the node-ID and title of the list.                              
   • Your client subscribes to the index node and watches for adds/removals.                                                                 
 2 Individual list nodes                                                                                                                     
   • Each TODO list is its own PubSub node (e.g. “lists/user@example.net/work”).                                                             
   • When you see a new index-item, you subscribe to that node; when the index-item is retracted, you unsubscribe.                           
   • List items (the actual TODO entries) are published/retracted on those per-list nodes.                                                   
