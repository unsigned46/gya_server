const fs = require('fs');
const path = require('path');

const testFiles = fs
  .readdirSync(__dirname)
  .filter((name) => name.endsWith('.test.js'))
  .sort();

for (const testFile of testFiles) {
  require(path.join(__dirname, testFile));
}
