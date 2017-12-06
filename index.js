const _ = require('lodash');
const Git = require('nodegit');
const tmp = require('tmp-promise');

const { getMisspellings } = require('./lib/spellcheck');

const [user, repo] = process.argv[2].split('/');

console.log('Creating a temporary directory...');
tmp.dir({ unsafeCleanup: true })
  .then(({ path }) => {
    const url = `https://github.com/${user}/${repo}.git`;
    console.log(`Cloning ${url} into the temporary directory...`);
    return Git.Clone(url, path);
  }).then(repo => {
    console.log('Getting the last commit from the master branch...');
    return repo.getMasterCommit();
  }).then(masterCommit => {
    console.log('Getting the state of the working tree...');
    return masterCommit.getTree();
  }).then(tree => {
    console.log('Getting a list of files in the working tree...');
    return new Promise((resolve, reject) => {
      const walker = tree.walk(true);
      walker.on('end', resolve);
      walker.on('error', reject);
      walker.start();
    });
  }).then(treeEntries => {
    console.log('Filtering the list of files to only include Markdown and text files...');
    return _.filter(treeEntries, treeEntry => /\.(md|txt)$/.test(treeEntry.path()))
  }).then(matchedTreeEntries => {
    console.log('Spell-checking the remaining files...');
    return Promise.all(_.map(matchedTreeEntries, entry => {
      return entry.getBlob()
        .then(blob => getMisspellings(blob.toString()));
    }));
  }).then(result => console.log(result))
  .catch(error => console.error(error));
