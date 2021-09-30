const {Command} = require('commander');
const program = new Command('node import.js <github-url>');

program
    .description('Load releases of a given Github repository using a list of tags')
    .version('1.0.0')
    .argument('<url>','A URL to a Git repository, e.g. "https://github.com/github/catalyst.git"')
    .option('--list-tags', 'List all the available tags')
    .option('--output-dir <path>', 'Output directory relative to the project root that the results will be written to', 'imported')
    .option('--tags <comma-separated-list>', 'A comma-separated list of tags to import, e.g. "v1.0.3,v1.0.4". Note that the "v" prefix depends on the Github repository (some use it, some do not)')
    .option('--tags-from-file <txt-file>', 'Read tags from a txt file, where each line refers to a tag')
program.parse(process.argv);

const opts = {...{
    // It's always the 3rd argument (first 2 are application + file).
    url: process.argv[2] || '0',
}, ...program.opts()};

(new (require('./src/Importer'))(opts)).run();
