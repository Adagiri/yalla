const shell = require('shelljs');
const path = require('path');

// Function to copy .gql files from src to dist
function copyGQLFiles(sourceDir, targetDir) {
  // Ensure the target directory exists
  shell.mkdir('-p', targetDir);

  // Copy each .gql file found in the source directory to the target directory
  shell.find(sourceDir).forEach(function (file) {
    if (file.match(/\.gql$/)) {
      const targetPath = path.join(targetDir, path.relative(sourceDir, file));
      shell.cp('-R', file, targetPath);
    }
  });
}

// Specific path adjustments can be made here if the structure differs
const srcFeaturesPath = 'src/features';
const distFeaturesPath = 'dist/features';

// Iterate over each subdirectory in features
shell.ls('-R', srcFeaturesPath).forEach(function (subdir) {
  const fullSrcPath = path.join(srcFeaturesPath, subdir);
  if (shell.test('-d', fullSrcPath)) {
    // It's a directory; prepare the corresponding dist directory path
    const fullDistPath = path.join(distFeaturesPath, subdir);
    copyGQLFiles(fullSrcPath, fullDistPath);
  }
});
