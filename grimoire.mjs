import http from 'node:http';

const hostname = '127.0.0.1';
const port = 21727;

const server = http.createServer((request, response) => {
    console.log(`Hit! ${request.headers['user-agent']}`);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    response.write('Hello World\n');
    response.write(`It's currently ${new Date()}\n`);
    response.end(request.headers['user-agent']);
});

server.listen(port, hostname, () => console.log(`Server running at http://${hostname}:${port}`));