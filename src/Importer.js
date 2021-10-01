const fs = require("fs");
const cp = require("child_process");
const path = require("path");

class Importer {

    /** @var {String} */
    url;

    /** @var {Object} */
    options = {};

    constructor(options) {
        this.options = options;

        // Set path to project root.
        process.chdir(path.join(__dirname, '../'));

        const dir = this.options.outputDir;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }
    }

    run() {
        if (this.options.listTags) {
            return this.listTags();
        }
        this.import();
    }

    /**
     * @returns {string[]}
     */
    parseTags() {
        let cwd = process.cwd();
        const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

        if (this.options.tagsFromFile) {
            const data = fs.readFileSync(this.options.tagsFromFile, 'utf8')
            process.chdir(cwd);
            return data.split(/\n/).map(i => i.trim()).filter(i => i).sort(collator.compare);
        } else if (this.options.tags) {
            return this.options.tags.split(',').filter(i => i).sort(collator.compare);
        } else {
            throw new Error('You need to define the --tags or the --tags-from-file option.');
        }

    }

    import() {
        const tags = this.parseTags();

        // Change directory to output directory.
        process.chdir(path.join(process.cwd(), this.options.outputDir));

        tags.forEach((tag) => {
            let args = `clone --depth 1 --branch ${tag} --single-branch ${this.options.url} ${tag}`;
            cp.spawn('git', args.split(' '), {stdio: 'inherit'});
        })
    }

    /**
     * Fetch available tags.
     */
    listTags() {
        let args = `ls-remote --tags ${this.options.url}`;
        cp.spawn('git', args.split(' '), {stdio: 'inherit'});
    }
}

module.exports = Importer;
