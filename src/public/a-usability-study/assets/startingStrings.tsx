export const startingStringsMap: Record<string, string> = {
  modifyingjson: JSON.stringify({
    name: 'd3-hierarchy',
    version: '3.1.2',
    description: 'Layout algorithms for visualizing hierarchical data.',
    homepage: 'https://d3js.org/d3-hierarchy/',
    repository: {
      type: 'git',
      url: 'https://github.com/d3/d3-hierarchy.git',
    },
    keywords: [
      'd3',
      'd3-module',
      'layout',
      'tree',
      'treemap',
      'hierarchy',
      'infovis',
    ],
    license: 'ISC',
    author: {
      name: 'Mike Bostock',
      url: 'http://bost.ocks.org/mike',
    },
    type: 'module',
    files: [
      'dist/**/*.js',
      'src/**/*.js',
    ],
    module: 'src/index.js',
    main: 'src/index.js',
    jsdelivr: 'dist/d3-hierarchy.min.js',
    unpkg: 'dist/d3-hierarchy.min.js',
    exports: {
      umd: './dist/d3-hierarchy.min.js',
      default: './src/index.js',
    },
    sideEffects: false,
    devDependencies: {
      benchmark: '2',
      'd3-array': '1.2.0 - 3',
      'd3-dsv': '1 - 3',
      'd3-random': '1.1.0 - 3',
      eslint: '8',
      mocha: '9',
      rollup: '2',
      'rollup-plugin-terser': '7',
    },
    comments: 'd3-random is a peer dependency.',
    scripts: {
      test: "mocha 'test/**/*-test.js' && eslint src test",
      prepublishOnly: 'rm -rf dist && yarn test && rollup -c',
      postpublish: 'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -',
    },
    engines: {
      node: '>=12',
    },
  }, null, 2),
  modifyinghjson: `{
  rate: 1000
  key: value
  text: look ma, no quotes!
  commas:
  {
    one: 1
    two: 2
  }
  trailing:
  {
    one: 1
    two: 2
  }
  haiku:
    '''
    JSON I love you.
    But you strangle my expression.
    This is so much better.
    '''
  "favNumbers":
  [
    1
    2
    3
    6
    42
  ]
}`,
  modifyingxml: `<?xml version="1.0" encoding="UTF-8"?>
<package>
  <name>d3-hierarchy</name>
  <version>3.1.2</version>
  <description>Layout algorithms for visualizing hierarchical data.</description>
  <homepage>https://d3js.org/d3-hierarchy/</homepage>
  <repository>
    <type>git</type>
    <url>https://github.com/d3/d3-hierarchy.git</url>
  </repository>
  <keywords>
    <keyword>d3</keyword>
    <keyword>d3-module</keyword>
    <keyword>layout</keyword>
    <keyword>tree</keyword>
    <keyword>treemap</keyword>
    <keyword>hierarchy</keyword>
    <keyword>infovis</keyword>
  </keywords>
  <license>ISC</license>
  <author>
    <name>Mike Bostock</name>
    <url>http://bost.ocks.org/mike</url>
  </author>
  <type>module</type>
  <files>
    <file>dist/**/*.js</file>
    <file>src/**/*.js</file>
  </files>
  <module>src/index.js</module>
  <main>src/index.js</main>
  <jsdelivr>dist/d3-hierarchy.min.js</jsdelivr>
  <unpkg>dist/d3-hierarchy.min.js</unpkg>
  <exports>
    <umd>./dist/d3-hierarchy.min.js</umd>
    <default>./src/index.js</default>
  </exports>
  <sideEffects>false</sideEffects>
  <devDependencies>
    <benchmark>2</benchmark>
    <d3-array>1.2.0 - 3</d3-array>
    <d3-dsv>1 - 3</d3-dsv>
    <d3-random>1.1.0 - 3</d3-random>
    <eslint>8</eslint>
    <mocha>9</mocha>
    <rollup>2</rollup>
    <rollup-plugin-terser>7</rollup-plugin-terser>
  </devDependencies>
  <!-- d3-random is a peer dependency. -->

  <scripts>
    <test>mocha 'test/**/*-test.js' && eslint src test</test>
    <prepublishOnly>rm -rf dist && yarn test && rollup -c</prepublishOnly>
    <postpublish>git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git commit -m "$npm_package_name $npm_package_version" && git push && cd -</postpublish>
  </scripts>
  <engines>
    <node>>=12</node>
  </engines>
</package>`,
  modifyingtoml: `name = "d3-hierarchy"
version = "3.1.2"
description = "Layout algorithms for visualizing hierarchical data."
homepage = "https://d3js.org/d3-hierarchy/"
license = "ISC"
type = "module"
module = "src/index.js"
main = "src/index.js"
jsdelivr = "dist/d3-hierarchy.min.js"
unpkg = "dist/d3-hierarchy.min.js"
sideEffects = false
comments = "d3-random is a peer dependency."

[repository]
type = "git"
url = "https://github.com/d3/d3-hierarchy.git"

[author]
name = "Mike Bostock"
url = "http://bost.ocks.org/mike"

keywords = [
  "d3",
  "d3-module",
  "layout",
  "tree",
  "treemap",
  "hierarchy",
  "infovis"
]

files = [
  "dist/**/*.js",
  "src/**/*.js"
]

[exports]
umd = "./dist/d3-hierarchy.min.js"
default = "./src/index.js"

[devDependencies]
benchmark = "2"
d3-array = "1.2.0 - 3"
d3-dsv = "1 - 3"
d3-random = "1.1.0 - 3"
eslint = "8"
mocha = "9"
rollup = "2"
rollup-plugin-terser = "7"

# d3-random is a peer dependency.

[scripts]
test = "mocha 'test/**/*-test.js' && eslint src test"
prepublishOnly = "rm -rf dist && yarn test && rollup -c"
postpublish = "git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -"

[engines]
node = ">=12"`,
  modifyingjson5: JSON.stringify({
    name: 'd3-hierarchy',
    version: '3.1.2',
    description: 'Layout algorithms for visualizing hierarchical data.',
    homepage: 'https://d3js.org/d3-hierarchy/',
    repository: {
      type: 'git',
      url: 'https://github.com/d3/d3-hierarchy.git',
    },
    keywords: [
      'd3',
      'd3-module',
      'layout',
      'tree',
      'treemap',
      'hierarchy',
      'infovis',
    ],
    license: 'ISC',
    author: {
      name: 'Mike Bostock',
      url: 'http://bost.ocks.org/mike',
    },
    type: 'module',
    files: [
      'dist/**/*.js',
      'src/**/*.js',
    ],
    module: 'src/index.js',
    main: 'src/index.js',
    jsdelivr: 'dist/d3-hierarchy.min.js',
    unpkg: 'dist/d3-hierarchy.min.js',
    exports: {
      umd: './dist/d3-hierarchy.min.js',
      default: './src/index.js',
    },
    sideEffects: false,
    devDependencies: {
      benchmark: '2',
      'd3-array': '1.2.0 - 3',
      'd3-dsv': '1 - 3',
      'd3-random': '1.1.0 - 3',
      eslint: '8',
      mocha: '9',
      rollup: '2',
      'rollup-plugin-terser': '7',
    },
    comments: 'd3-random is a peer dependency.',
    scripts: {
      test: "mocha 'test/**/*-test.js' && eslint src test",
      prepublishOnly: 'rm -rf dist && yarn test && rollup -c',
      postpublish: 'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -',
    },
    engines: {
      node: '>=12',
    },
  }, null, 2),
  modifyingyaml: `name: d3-hierarchy
version: 3.1.2
description: Layout algorithms for visualizing hierarchical data.
homepage: https://d3js.org/d3-hierarchy/
repository:
  type: git
  url: https://github.com/d3/d3-hierarchy.git
keywords:
  - d3
  - d3-module
  - layout
  - tree
  - treemap
  - hierarchy
  - infovis
license: ISC
author:
  name: Mike Bostock
  url: http://bost.ocks.org/mike
type: module
files:
  - dist/**/*.js
  - src/**/*.js
module: src/index.js
main: src/index.js
jsdelivr: dist/d3-hierarchy.min.js
unpkg: dist/d3-hierarchy.min.js
exports:
  umd: ./dist/d3-hierarchy.min.js
  default: ./src/index.js
sideEffects: false
devDependencies:
  benchmark: "2"
  d3-array: "1.2.0 - 3"
  d3-dsv: "1 - 3"
  d3-random: "1.1.0 - 3"
  eslint: "8"
  mocha: "9"
  rollup: "2"
  rollup-plugin-terser: "7" 
  # d3-random is a peer dependency.
scripts:
  test: mocha 'test/**/*-test.js' && eslint src test
  prepublishOnly: rm -rf dist && yarn test && rollup -c
  postpublish: >
    git push && git push --tags && 
    cd ../d3.github.com && git pull && 
    cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && 
    cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && 
    git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && 
    git push && cd -
engines:
  node: ">=12"`,
  modifyingjsonc: JSON.stringify({
    name: 'd3-hierarchy',
    version: '3.1.2',
    description: 'Layout algorithms for visualizing hierarchical data.',
    homepage: 'https://d3js.org/d3-hierarchy/',
    repository: {
      type: 'git',
      url: 'https://github.com/d3/d3-hierarchy.git',
    },
    keywords: [
      'd3',
      'd3-module',
      'layout',
      'tree',
      'treemap',
      'hierarchy',
      'infovis',
    ],
    license: 'ISC',
    author: {
      name: 'Mike Bostock',
      url: 'http://bost.ocks.org/mike',
    },
    type: 'module',
    files: [
      'dist/**/*.js',
      'src/**/*.js',
    ],
    module: 'src/index.js',
    main: 'src/index.js',
    jsdelivr: 'dist/d3-hierarchy.min.js',
    unpkg: 'dist/d3-hierarchy.min.js',
    exports: {
      umd: './dist/d3-hierarchy.min.js',
      default: './src/index.js',
    },
    sideEffects: false,
    devDependencies: {
      benchmark: '2',
      'd3-array': '1.2.0 - 3',
      'd3-dsv': '1 - 3',
      'd3-random': '1.1.0 - 3',
      eslint: '8',
      mocha: '9',
      rollup: '2',
      'rollup-plugin-terser': '7',
    },
    comments: 'd3-random is a peer dependency.',
    scripts: {
      test: "mocha 'test/**/*-test.js' && eslint src test",
      prepublishOnly: 'rm -rf dist && yarn test && rollup -c',
      postpublish: 'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -',
    },
    engines: {
      node: '>=12',
    },
  }, null, 2),
};
