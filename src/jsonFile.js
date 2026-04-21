const fs = require('fs');
const path = require('path');

function writeJsonFileAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(
    directory,
    `.${baseName}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Keep the original write error more visible than cleanup failures.
    }

    throw error;
  }
}

module.exports = {
  writeJsonFileAtomic,
};
