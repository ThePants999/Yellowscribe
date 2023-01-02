const {cleanFiles, loadModules, server} = require("./service");

const port = process.env.PORT || 3000;
const ONE_MINUTE = 60000;

// Listen on port 3000, IP defaults to 127.0.0.1
server.listen(port);
loadModules();

// Put a friendly message on the terminal
console.log('Server running at http://127.0.0.1:' + port + '/');

setInterval(cleanFiles, ONE_MINUTE);