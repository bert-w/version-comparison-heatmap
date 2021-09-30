/** @var {Object} process */

process.chdir(__dirname);

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const util = require('util');
const parse = require('csv-parse/lib/sync');
const pug = require('pug');
const tmp = require('tmp');
const _helpers = require('./helpers');


class App {
    /**
     * @param {String} options.inputDir
     * @param {String} options.outputDir
     * @param {Boolean} options.useClocCache
     * @param {String} options.clocCacheFile
     * @param {Boolean} options.useHeatmapCache
     * @param {String} options.heatmapCacheFile
     * @param {String} options.inputSubDir
     */
    options = {};

    versions = [];

    /** Map of jquery versions to directories */
    version_dir_map = {};

    /** Map of jquery versions and their lines of code */
    version_loc_map = {};

    /** Current number of done comparisons */
    processed = 0;


    total_comparisons = 0;

    /**
     * @param {Object} options
     */
    constructor(options) {
        this.debug('app', 'Firing up');
        this.options = options;

        // Set path to project root.
        process.chdir(path.join(__dirname, '../'));
    }

    async run() {
        this.debug('app', `Running`);

        const dir = this.options.outputDir;
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        this.versions = await this.getVersions();
        this.versions.forEach((version) => {
            // Map to proper paths.
            this.version_dir_map[version] = path.join(this.options.inputDir, version, this.options.inputSubDir);
        });

        this.total_comparisons = (this.versions.length * (this.versions.length - 1)) / 2;
        this.debug('app', `Planned version comparisons: ${this.total_comparisons}`)
        if (this.options.useClocCache) {
            // Load from a `cloc` csv cache file.
            this.version_loc_map = this.parseClocCsv(this.options.clocCacheFile);
        } else {
            // Use `cloc` package.
            const srcPath = this.options.inputDir + (this.options.inputSubDir ? `/**/${this.options.inputSubDir}/**` : '');
            this.version_loc_map = await this.calculateLinesOfCode(srcPath);
        }

        this.viewBarchart(this.versions, 'src/barchart.pug', path.join(this.options.outputDir, 'barchart.html'));

        let matrix;
        if (this.options.useHeatmapCache) {
            // Load from `output/heatmap.json`.
            matrix = JSON.parse(fs.readFileSync(this.options.heatmapCacheFile).toString());
        } else {
            // Use `jsinspect` package.
            matrix = await this.augmentComparisonMatrix(this.createRichMatrix(this.versions));
            fs.writeFileSync(path.join(this.options.outputDir, 'heatmap.json'), JSON.stringify(matrix));
        }
        matrix = this.augmentHeatmapMatrix(matrix);

        this.viewHeatmap(
            matrix,
            this.versions,
            'src/heatmap.pug',
            path.join(this.options.outputDir, 'heatmap.html')
        );

        this.debug('app', 'Done!');
    }


    /**
     * @returns {Promise<Array>}
     */
    async getVersions() {
        const versions = (await util.promisify(fs.readdir)(path.join('./', this.options.inputDir)));
        if (versions[0] === '.gitkeep') {
            // Remove .gitkeep
            versions.shift();
        }

        // Sort so that versions appear in proper semver order.
        const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
        return versions.sort(collator.compare);
    }

    /**
     * @param {Array} versions
     * @param {String} pugFile
     * @param {String} outputFile
     */
    viewBarchart(versions, pugFile, outputFile) {
        const chartData = [['jQuery version', 'Lines of Code']];
        for (let version of versions) {
            chartData.push([version, this.version_loc_map[version]]);
        }
        // Create barchart using html.
        fs.writeFileSync(outputFile, pug.compileFile(pugFile)({
            chart: {
                data: chartData,
                options: {
                    height: 400
                },
            },
        }));
    }

    /**
     * @param {Array} matrix
     * @param {Array} versions
     * @param {String} pugFile
     * @param {String} outputFile
     */
    viewHeatmap(matrix, versions, pugFile, outputFile) {
        // Create heatmap using html.
        /** ignore **/
        fs.writeFileSync(outputFile, pug.compileFile(pugFile)({
            matrix: matrix,
            versions: versions,
        }));
    }

    /**
     * Calculate lines of code for all jquery versions inside a specific directory.
     * @returns {Object} key = jquery version, value = lines of code.
     */
    calculateLinesOfCode(directory) {
        return new Promise((resolve, reject) => {
            const clocArgs = [
                this.options.language === 'php' ? '--force-lang=PHP,php' : '--force-lang=Javascript,js',
                directory,
                '--skip-uniqueness',
                '--csv', '--out', path.join(this.options.outputDir, 'cloc.csv'),
                '--by-file',
            ];
            this.debug('cloc', clocArgs.join(' '));
            cp.spawn('cloc', clocArgs, {stdio: 'inherit', shell: true})
                .once('exit', (code, signal) => {
                    return resolve(this.parseClocCsv(path.join(this.options.outputDir, 'cloc.csv')));
                });
        })
    }

    /**
     * @param {String} file
     * @returns {Object}
     */
    parseClocCsv(file) {
        const parsed = parse(fs.readFileSync(file), {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
        });

        const map = {};
        parsed.forEach((row) => {
            // Extract version from file path using regex.
            let matches;
            if(/^win/.test(process.platform)) {
                // Use backward slashes.
                matches = row.filename.match(/\\([^\\]+)\\/);
            } else {
                // Use forward slashes.
                matches = row.filename.match(/\/([^\/]+)\//);
            }
            if (matches && matches.length >= 2) {
                const key = matches[1];
                map[key] = (map[key] || 0) + parseInt(row.code) + parseInt(row.comment) + parseInt(row.blank);
            }
        })

        return map;
    }

    /**
     * @param {String} left
     * @param {String} right
     * @param {Object} spawn Spawned process by cp.spawn
     * @param {Function} callback
     * @returns {Promise<Number>}
     */
    compareVersions(left, right, spawn, callback) {
        return new Promise((resolve, reject) => {
            const tmpFile = tmp.fileSync();

            const logStream = fs.createWriteStream(tmpFile.name, {flags: 'a'});

            spawn.stdout.pipe(logStream)
            // spawn.stderr.pipe(process.stdout);
            spawn.once('exit', (code, signal) => {
                callback(resolve, tmpFile, ...arguments);
            });
        });
    }

    compareVersionsJavaScript(left, right) {
        const args = [
            'jsinspect',
            '-r', 'json',
            '-m', '2',
            '-t', '30',
            '--ignore', '"test|dist"',
            '--no-identifiers',
            '--no-literals',
            '--truncate', '0',
            left, right,
        ];

        this.debug('jsinspect', `npx ${args.join(' ')}`);

        const spawn = cp.spawn(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', args, {
            cwd: './',
            // Prevent erroring because of pipe symbol in --ignore.
            windowsVerbatimArguments: true,
        });
        return this.compareVersions(left, right, spawn, (resolve, tmpFile, code, signal) => {
            const parsed = JSON.parse(fs.readFileSync(tmpFile.name));
            let count = 0;
            parsed.forEach((match) => {
                match.instances.forEach((instance) => {
                    count += (instance.lines[1] - instance.lines[0] + 1);
                })
            });
            tmpFile.removeCallback();
            return resolve(count);
        });
    }

    compareVersionsPHP(left, right) {
        const args = [
            '-d', 'memory_limit=512M',
            'vendor/bin/phpcpd',
            '--min-lines', '5',
            '--min-tokens', '70',
            left, right,
        ];

        this.debug('phpcpd', `php ${args.join(' ')}`);
        const spawn = cp.spawn('php', args, {
            // Prevent erroring because of pipe symbol in --ignore.
            windowsVerbatimArguments: true,
        });
        return this.compareVersions(left, right, spawn, (resolve, tmpFile, code, signal) => {
            const content = fs.readFileSync(tmpFile.name).toString();
            // Fetch the total number of duplicated lines using a regex.
            const match = content.match(/(.*?)% duplicated lines.*?(\d+)/);
            let count;
            if (match && match.length >= 3) {
                count = Math.round(match[2] / 100 * match[1]);
            } else {
                console.error(content);
                count = 0;
            }

            tmpFile.removeCallback();
            return resolve(count);
        });
    }


    /**
     * Create a matrix for all the versions, where each cell has the properties:
     * - `left` (left jQuery version)
     * - `right` (right jQuery version)
     * - `loc_left` (lines of code for the left jQuery version)
     * - `loc_right` (lines of code for the right jQuery version)
     * @param {Array} versions
     * @returns {Array}
     */
    createRichMatrix(versions) {
        const matrix = [];
        versions.forEach((left, m) => {
            const vector = [];
            versions.forEach((right, n) => {
                if (n < m) {
                    vector.push({
                        left: left,
                        right: right,
                        loc_left: this.version_loc_map[left],
                        loc_right: this.version_loc_map[right],
                    });
                } else {
                    vector.push(null);
                }
            })
            matrix.push(vector);
        })
        return matrix;
    }

    /**
     * Create a comparison matrix where each cell is added the property:
     * - `matches` (number of lines of code that match between the given versions)
     * - `ratio` (ratio of matches against the total lines of code)
     * @param {Array} matrix
     * @returns {Promise<Array>}
     */
    async augmentComparisonMatrix(matrix) {
        let promises = [];
        const fn = (this.options.language === 'php' ? this.compareVersionsPHP : this.compareVersionsJavaScript).bind(this);
        for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
            for (let columnIndex = 0; columnIndex < matrix[rowIndex].length; columnIndex++) {
                const column = matrix[rowIndex][columnIndex];
                if (column) {
                    // Push to promises array to start simultaneously.
                    promises.push(fn(
                        this.version_dir_map[column.left],
                        this.version_dir_map[column.right],
                    ).then((count) => {
                        column.matches = count;
                        matrix[rowIndex][columnIndex] = column;

                        this.processed++;
                        this.debug('app', `Processed: ${this.processed}/${this.total_comparisons}`);
                    }));
                    if (promises.length >= 10) {
                        // Batch process the current list.
                        await Promise.all(promises);
                        promises = [];
                    }
                }
            }
        }

        // Wait for final batch.
        await Promise.all(promises);

        return matrix;
    }

    /**
     * Find min max values of a certain property.
     * @param {Array} matrix
     * @param {Function} fn Pass a function that receives the column and returns the property to min-max.
     * @returns {{min: number, max: number}}
     */
    findMinMaxMatrix(matrix, fn) {
        let min = 0;
        let max = 0;
        // Loop to find min/max.
        matrix.forEach((row) => {
            row.forEach((column) => {
                if (column) {
                    let el = fn(column);
                    // Normalize min-max.
                    min = (!min || el < min) ? el : min;
                    max = (!max || el > max) ? el : max;
                }
            })
        });
        return {min: min, max: max};
    }

    findMeanMatrix(matrix, fn) {
        let sum = 0;
        let count = 0;
        matrix.forEach((row) => {
            row.forEach((column) => {
                if (column) {
                    sum += fn(column);
                    count++;
                }
            })
        });
        return sum / count;
    }

    /**
     * Add additional properties to each cell in the given heatmap matrix that we use for displaying:
     * - `ratio` (scaled version of the `matches` property.
     * - `color` (color code based on the ratio)
     * - `size` (cell size based on lines of code)
     * @returns {Promise<void>}
     */
    augmentHeatmapMatrix(matrix) {
        // Calculate ratio first.
        matrix.forEach((row) => {
            row.forEach((column) => {
                if (column) {
                    column.ratio = (column.matches / (column.loc_left + column.loc_right) || 0);
                }
            })
        });

        const minMaxRatio = this.findMinMaxMatrix(matrix, (column) => column.ratio);
        const minMaxLocL = this.findMinMaxMatrix(matrix, (column) => column.loc_left);
        const minMaxLocR = this.findMinMaxMatrix(matrix, (column) => column.loc_right);
        // Find mean of ratio.
        const mean = this.findMeanMatrix(matrix, (column) => column.ratio);

        // Augment other properties.
        matrix.forEach((row) => {
            row.forEach((column) => {
                if (column) {
                    column.ratio = _helpers.minmax(column.ratio, minMaxRatio.min, minMaxRatio.max);
                    column.color = _helpers.percentageToColor(column.ratio);
                    // Calculate width/height for table cells.
                    const width = _helpers.minmax(column.loc_right, minMaxLocR.min, minMaxLocR.max);
                    const height = _helpers.minmax(column.loc_left, minMaxLocL.min, minMaxLocL.max);
                    // Scale to range [10px, 30px].
                    column.width = _helpers.round(width * 20 + 10, 3);
                    column.height = _helpers.round(height * 20 + 10, 3);
                }
            });
        });
        return matrix;
    }

    debug(type, message) {
        const title = ('[' + type + ']').padEnd(16, ' ');
        console.log(`${title} ${message}`);
    }
}

module.exports = App;
