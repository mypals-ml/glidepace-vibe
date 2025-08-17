const express = require('express');
const app = express();
const port = 3000;

const github = require('./api/github');
const project = require('./api/project');

app.use(express.json());

app.use('/api/github', github);
app.use('/api/project', project);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
