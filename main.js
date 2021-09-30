const {Command, Option} = require('commander');
const program = new Command('node main.js');

program
    .description('This program compares versions of PHP or JavaScript repositories using line of code using https://github.com/AlDanial/cloc and code similarity using https://github.com/danielstjules/jsinspect and https://github.com/sebastianbergmann/phpcpd.')
    .version('1.0.0')
    .addOption(new Option('--language <type>', 'The programming language that the program should analyze')
        .default('php')
        .choices(['php', 'javascript']))
    .option('--input-dir <path>', 'Input directory relative to the project root that contains all versions you want to compare', 'input')
    .option('--input-sub-dir <path>', 'Define a path relative to a version in the input directory if you only need to analyze a specific subdirectory of each version. Often times, the repositories have an "src" directory', 'input')
    .option('--output-dir <path>', 'Output directory relative to the project root that the results will be written to', 'output')
    .option('--use-cloc-cache', 'If defined, the program will load a cache file instead of running the script again')
    .option('--cloc-cache-file <path>', 'Path to a csv file containing the COLC output', 'output/cloc.csv')
    .option('--use-heatmap-cache', 'If defined, the program will load a cache file instead of running the script again')
    .option('--heatmap-cache-file <path>', 'Path to a JSON file containing the heatmap output', 'output/heatmap.json');
program.parse(process.argv);

// Allow the method to also be passed as the first argument:
const opts = {...{
    // It's always the 3rd argument (first 2 are application + file).
    method: process.argv[2] || '0',
}, ...program.opts()};

(new (require('./src/App'))(opts)).run();
