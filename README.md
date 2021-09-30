<p align="center">
    <a href="https://github.com/bert-w/version-comparison-heatmap"><img src="https://raw.githubusercontent.com/bert-w/version-comparison-heatmap/master/art/logo.png" width="430" height="404"></a>
</p>
<h1 align="center">version-comparison-heatmap</h1>

Compare releases from a JavaScript or PHP Github repository and show their similarities in a heatmap. The heatmap should
show segmentations between major and minor versions.

## Requirements
- Required at all times: `node.js >= 10`, `npm >= 5.6`.
- Required only if checking PHP scripts: `php >= 7.3`, `composer`.
- Required if importing releases using the helper script: `git`.
- Install the required dependencies using `npm install` and run `composer install` if you use this with PHP repositories.
- A copy of `CLOC` from https://github.com/AlDanial/cloc or from SourceForge. Make sure it is in your PATH, or
executable from the project root as `cloc ...`.

## Importing releases
Use the `import.js` helper script to load releases from a given Github repository. This requires `git`.
```
node import.js <url>

Arguments:
  url                            A URL to a Git repository, e.g. "https://github.com/github/catalyst.git"

Options:
  -V, --version                  output the version number
  --list-tags                    List all the available tags
  --output-dir <path>            Output directory relative to the project root that the results will be written to
                                 (default: "imported")
  --tags <comma-separated-list>  A comma-separated list of tags to import, e.g. "v1.0.3,v1.0.4". Note that the "v"
                                 prefix depends on the Github repository (some use it, some do not)
  --tags-from-file <txt-file>    Read tags from a txt file, where each line refers to a tag
  -h, --help                     display help for command
```
#### Examples
Example of retrieving jQuery versions where the tags are defined in a `jquery_tags.txt` file (newline separated):
```
node import.js https://github.com/jquery/jquery --tags-from-file=jquery_tags.txt --output-dir=imported_jquery
```
**jquery_tags.txt**:
```
1.5
1.7.0
2.0.2
3.2.1
3.6.0
```

Alternatively, you can pass a comma-separated list in the `--tags` argument:
```
node import.js https://github.com/jquery/jquery --tags=1.5,1.7.0,2.0.2,3.2.1,3.6.0 --output-dir=imported_jquery
```

## Executing the tool
```
node main.js

Options:
  -V, --version                output the version number
  --language <type>            The programming language that the program should analyze (choices: "php", "javascript",
                               default: "php")
  --input-dir <path>           Input directory relative to the project root that contains all versions you want to
                               compare (default: "input")
  --input-sub-dir <path>       Define a path relative to a version in the input directory if you only need to analyze a
                               specific subdirectory of each version. Often times, the repositories have an "src"
                               directory (default: "input")
  --output-dir <path>          Output directory relative to the project root that the results will be written to
                               (default: "output")
  --use-cloc-cache             If defined, the program will load a cache file instead of running the script again
  --cloc-cache-file <path>     Path to a csv file containing the COLC output (default: "output/cloc.csv")
  --use-heatmap-cache          If defined, the program will load a cache file instead of running the script again
  --heatmap-cache-file <path>  Path to a JSON file containing the heatmap output (default: "output/heatmap.json")
  -h, --help                   display help for command
```
#### Examples
Run the version comparison for the `imported_jquery` directory:
```
node main.js --language=javascript --input-dir=imported_jquery --output-dir=output_jquery --input-sub-dir=src
```
Each set of versions is compared, so in this case the program will make `(5*(5-1))/2 = 10` comparions since `5` jQuery
versions were given. Note that this number will become large quickly if you provide a lot of versions.

The script will generate a heatmap consisting of a lower triangular matrix (`5x5` in this case), as seen above
in the readme image.

#### Output
```
[app]            Firing up
[app]            Running
[app]            Planned version comparisons: 10
[cloc]           --force-lang=Javascript,js imported_jquery/**/src/** --skip-uniqueness --csv --out output_jquery\cloc.csv --by-file
     279 text files.
     279 unique files.
      44 files ignored.
Wrote output_jquery\cloc.csv
[jsinspect]      npx jsinspect -r json -m 2 -t 30 --ignore "test|dist" --no-identifiers --no-literals --truncate 0 imported_jquery\1.7.0\src imported_jquery\1.5\src
[jsinspect]      npx jsinspect -r json -m 2 -t 30 --ignore "test|dist" --no-identifiers --no-literals --truncate 0 imported_jquery\2.0.2\src imported_jquery\1.5\src
[jsinspect]      npx jsinspect -r json -m 2 -t 30 --ignore "test|dist" --no-identifiers --no-literals --truncate 0 imported_jquery\2.0.2\src imported_jquery\1.7.0\src
[jsinspect]      npx jsinspect -r json -m 2 -t 30 --ignore "test|dist" --no-identifiers --no-literals --truncate 0 imported_jquery\3.2.1\src imported_jquery\1.5\src
...
```
#### Output files
- `output_jquery/heatmap.html` - Interactive heatmap
- `output_jquery/barchart.html` - Barchart showing the lines of code from earliest to latest versions
- `output_jquery/cloc.csv` - Cache file from CLOC (to be used in development)
- `output_jquery/heatmap.json` - Cache file for creating the heatmap (to be used in development)


## Alternative execution: Docker
```
docker build -t version-comparison-heatmap .
```

#### Example
Execution using local volume bindings (Windows PowerShell example with `$(pwd)`):
```
docker run --rm -it -v "$(pwd)/imported_jquery:/usr/app/input" -v "$(pwd)/output_jquery:/usr/app/output" version-comparison-heatmap
$ node main.js --language=javascript
```
