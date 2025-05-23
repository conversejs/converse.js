const http = require('http');
const port = 3000;

// Back to the Future character data
const characters = [
    {firstName: 'Marty', lastName: 'McFly', domain: 'mcfly.net'},
    {firstName: 'Emmett', lastName: 'Brown', domain: 'brown.com'},
    {firstName: 'Jennifer', lastName: 'Parker', domain: 'hillvalley.edu'},
    {firstName: 'Biff', lastName: 'Tannen', domain: 'tannen.org'},
    {firstName: 'George', lastName: 'McFly', domain: 'mcfly.net'},
    {firstName: 'Lorraine', lastName: 'Baines', domain: '1955.com'},
    {firstName: 'Strickland', lastName: 'Principal', domain: 'hillvalley.edu'},
    {firstName: 'Goldie', lastName: 'Wilson', domain: 'future.net'},
    {firstName: 'Clara', lastName: 'Clayton', domain: 'brown.com'},
    {firstName: 'Einstein', lastName: 'Dog', domain: 'brown.com'},
    {firstName: 'Dave', lastName: 'McFly', domain: 'mcfly.net'},
    {firstName: 'Linda', lastName: 'McFly', domain: 'mcfly.net'},
    {firstName: 'Marvin', lastName: 'Berry', domain: '1955.com'},
    {firstName: 'Lorraine', lastName: 'McFly', domain: 'mcfly.net'},
    {firstName: 'Match', lastName: 'Tannen', domain: 'tannen.org'},
    {firstName: 'Griff', lastName: 'Tannen', domain: 'tannen.org'},
    {firstName: 'Buford', lastName: 'Tannen', domain: 'tannen.org'},
    {firstName: 'Douglas', lastName: 'Needles', domain: 'hillvalley.edu'},
    {firstName: 'Terry', lastName: 'Needles', domain: 'hillvalley.edu'},
    {firstName: 'Betty', lastName: 'Needles', domain: 'hillvalley.edu'}
];

const users = characters.map(char => ({
    jid: `${char.firstName.toLowerCase()}@${char.domain}`,
    fullname: `${char.firstName} ${char.lastName}`,
    chat_status: Math.round(Math.random())
}));

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const searchTerm = url.searchParams.get('q') || '';
    
    const filteredUsers = searchTerm 
        ? users.filter(user => 
            user.fullname.toLowerCase().includes(searchTerm.toLowerCase()))
        : users;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS
    res.end(JSON.stringify(filteredUsers, null, 2));
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
