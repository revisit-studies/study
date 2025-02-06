export const startingStringsMap: Record<string, string> = {
  readingconfigjson: JSON.stringify({
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
  readingtabularjson: JSON.stringify({
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }, null, 2),
  modifyingconfigjson: JSON.stringify({
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
  modifyingtabularjson: JSON.stringify({
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }, null, 2),
  modifyingconfigxml: `<?xml version="1.0" encoding="UTF-8" ?>
 <root>
     <name>d3-hierarchy</name>
     <version>3.1.2</version>
     <description>Layout algorithms for visualizing hierarchical data.</description>
     <homepage>https://d3js.org/d3-hierarchy/</homepage>
     <repository>
         <type>git</type>
         <url>https://github.com/d3/d3-hierarchy.git</url>
     </repository>
     <keywords>d3</keywords>
     <keywords>d3-module</keywords>
     <keywords>layout</keywords>
     <keywords>tree</keywords>
     <keywords>treemap</keywords>
     <keywords>hierarchy</keywords>
     <keywords>infovis</keywords>
     <license>ISC</license>
     <author>
         <name>Mike Bostock</name>
         <url>http://bost.ocks.org/mike</url>
     </author>
     <type>module</type>
     <files>dist/**/*.js</files>
     <files>src/**/*.js</files>
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
         <postpublish>git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -</postpublish>
     </scripts>
     <engines>
         <node>>=12</node>
     </engines>
 </root>`,
  modifyingtabularxml: `<?xml version="1.0" encoding="UTF-8" ?>
 <root>
     <name>student-data</name>
     <version>1.0.0</version>
     <description>Student information with grades and extracurricular activities.</description>
     <homepage>https://example.com/student-data</homepage>
     <repository>
         <type>git</type>
         <url>https://github.com/example/student-data.git</url>
     </repository>
     <keywords>student</keywords>
     <keywords>grades</keywords>
     <keywords>courses</keywords>
     <keywords>extracurricular</keywords>
     <keywords>attendance</keywords>
     <students>
         <name>Bob</name>
         <age>12</age>
         <contact>
             <email>bob@example.com</email>
             <phone>+123456789</phone>
             <address>123 Bob St, Some City</address>
         </contact>
         <courses>
             <course_name>Math 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>8</grade>
                 <weight>0.1</weight>
             </quizzes>
             <quizzes>
                 <quiz>2</quiz>
                 <grade>9</grade>
                 <weight>0.1</weight>
             </quizzes>
             <midterm>
                 <grade>77</grade>
                 <weight>0.3</weight>
             </midterm>
             <final>
                 <grade>87</grade>
                 <weight>0.5</weight>
             </final>
             <total_score>82.3</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>28</attended_classes>
                 <absent_classes>2</absent_classes>
             </attendance>
         </courses>
         <courses>
             <course_name>History 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>7</grade>
                 <weight>0.2</weight>
             </quizzes>
             <quizzes>
                 <quiz>2</quiz>
                 <grade>8</grade>
                 <weight>0.2</weight>
             </quizzes>
             <midterm>
                 <grade>80</grade>
                 <weight>0.4</weight>
             </midterm>
             <final>
                 <grade>85</grade>
                 <weight>0.3</weight>
             </final>
             <total_score>81.3</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>30</attended_classes>
                 <absent_classes>0</absent_classes>
             </attendance>
         </courses>
         <extra_curricular>
             <sports>
                 <sport_name>Soccer</sport_name>
                 <position>Forward</position>
                 <team>The Tigers</team>
             </sports>
             <sports>
                 <sport_name>Basketball</sport_name>
                 <position>Guard</position>
                 <team>The Eagles</team>
             </sports>
             <clubs>
                 <club_name>Science Club</club_name>
                 <role>President</role>
             </clubs>
             <clubs>
                 <club_name>Drama Club</club_name>
                 <role>Member</role>
             </clubs>
         </extra_curricular>
     </students>
     <students>
         <name>Eve</name>
         <age>13</age>
         <contact>
             <email>eve@example.com</email>
             <phone>+987654321</phone>
             <address>456 Eve St, Other City</address>
         </contact>
         <courses>
             <course_name>Math 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>9</grade>
                 <weight>0.15</weight>
             </quizzes>
             <quizzes>
                 <quiz>2</quiz>
                 <grade>10</grade>
                 <weight>0.15</weight>
             </quizzes>
              <!-- Student data including grades and extracurricular activities. AB stands for absent. -->
             <midterm>
                 <grade>AB</grade>
                 <weight>0.3</weight>
             </midterm>
             <final>
                 <grade>77</grade>
                 <weight>0.4</weight>
             </final>
             <total_score>78.3</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>27</attended_classes>
                 <absent_classes>3</absent_classes>
             </attendance>
         </courses>
         <extra_curricular>
             <sports>
                 <sport_name>Tennis</sport_name>
                 <position>Singles</position>
                 <team>The Champions</team>
             </sports>
             <clubs>
                 <club_name>Art Club</club_name>
                 <role>Vice President</role>
             </clubs>
         </extra_curricular>
     </students>
     <students>
         <name>Alice</name>
         <age>17</age>
         <contact>
             <email>alice@example.com</email>
             <phone>+112233445</phone>
             <address>789 Alice St, Another City</address>
         </contact>
         <courses>
             <course_name>Math 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>6</grade>
                 <weight>0.2</weight>
             </quizzes>
             <midterm>
                 <grade>88</grade>
                 <weight>0.4</weight>
             </midterm>
             <final>
                 <grade>AB</grade>
                 <weight>0.4</weight>
             </final>
             <total_score>83.2</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>25</attended_classes>
                 <absent_classes>5</absent_classes>
             </attendance>
         </courses>
         <extra_curricular>
             <clubs>
                 <club_name>Music Club</club_name>
                 <role>Member</role>
             </clubs>
         </extra_curricular>
     </students>
 </root>`,
  readingconfigxml: `<?xml version="1.0" encoding="UTF-8" ?>
 <root>
     <name>d3-hierarchy</name>
     <version>3.1.2</version>
     <description>Layout algorithms for visualizing hierarchical data.</description>
     <homepage>https://d3js.org/d3-hierarchy/</homepage>
     <repository>
         <type>git</type>
         <url>https://github.com/d3/d3-hierarchy.git</url>
     </repository>
     <keywords>d3</keywords>
     <keywords>d3-module</keywords>
     <keywords>layout</keywords>
     <keywords>tree</keywords>
     <keywords>treemap</keywords>
     <keywords>hierarchy</keywords>
     <keywords>infovis</keywords>
     <license>ISC</license>
     <author>
         <name>Mike Bostock</name>
         <url>http://bost.ocks.org/mike</url>
     </author>
     <type>module</type>
     <files>dist/**/*.js</files>
     <files>src/**/*.js</files>
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
         <postpublish>git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -</postpublish>
     </scripts>
     <engines>
         <node>>=12</node>
     </engines>
 </root>`,
  readingtabularxml: `<?xml version="1.0" encoding="UTF-8" ?>
 <root>
     <name>student-data</name>
     <version>1.0.0</version>
     <description>Student information with grades and extracurricular activities.</description>
     <homepage>https://example.com/student-data</homepage>
     <repository>
         <type>git</type>
         <url>https://github.com/example/student-data.git</url>
     </repository>
     <keywords>student</keywords>
     <keywords>grades</keywords>
     <keywords>courses</keywords>
     <keywords>extracurricular</keywords>
     <keywords>attendance</keywords>
     <students>
         <name>Bob</name>
         <age>12</age>
         <contact>
             <email>bob@example.com</email>
             <phone>+123456789</phone>
             <address>123 Bob St, Some City</address>
         </contact>
         <courses>
             <course_name>Math 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>8</grade>
                 <weight>0.1</weight>
             </quizzes>
             <quizzes>
                 <quiz>2</quiz>
                 <grade>9</grade>
                 <weight>0.1</weight>
             </quizzes>
             <midterm>
                 <grade>77</grade>
                 <weight>0.3</weight>
             </midterm>
             <final>
                 <grade>87</grade>
                 <weight>0.5</weight>
             </final>
             <total_score>82.3</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>28</attended_classes>
                 <absent_classes>2</absent_classes>
             </attendance>
         </courses>
         <courses>
             <course_name>History 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>7</grade>
                 <weight>0.2</weight>
             </quizzes>
             <quizzes>
                 <quiz>2</quiz>
                 <grade>8</grade>
                 <weight>0.2</weight>
             </quizzes>
             <midterm>
                 <grade>80</grade>
                 <weight>0.4</weight>
             </midterm>
             <final>
                 <grade>85</grade>
                 <weight>0.3</weight>
             </final>
             <total_score>81.3</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>30</attended_classes>
                 <absent_classes>0</absent_classes>
             </attendance>
         </courses>
         <extra_curricular>
             <sports>
                 <sport_name>Soccer</sport_name>
                 <position>Forward</position>
                 <team>The Tigers</team>
             </sports>
             <sports>
                 <sport_name>Basketball</sport_name>
                 <position>Guard</position>
                 <team>The Eagles</team>
             </sports>
             <clubs>
                 <club_name>Science Club</club_name>
                 <role>President</role>
             </clubs>
             <clubs>
                 <club_name>Drama Club</club_name>
                 <role>Member</role>
             </clubs>
         </extra_curricular>
     </students>
     <students>
         <name>Eve</name>
         <age>13</age>
         <contact>
             <email>eve@example.com</email>
             <phone>+987654321</phone>
             <address>456 Eve St, Other City</address>
         </contact>
         <courses>
             <course_name>Math 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>9</grade>
                 <weight>0.15</weight>
             </quizzes>
             <quizzes>
                 <quiz>2</quiz>
                 <grade>10</grade>
                 <weight>0.15</weight>
             </quizzes>
              <!-- Student data including grades and extracurricular activities. AB stands for absent. -->
             <midterm>
                 <grade>AB</grade>
                 <weight>0.3</weight>
             </midterm>
             <final>
                 <grade>77</grade>
                 <weight>0.4</weight>
             </final>
             <total_score>78.3</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>27</attended_classes>
                 <absent_classes>3</absent_classes>
             </attendance>
         </courses>
         <extra_curricular>
             <sports>
                 <sport_name>Tennis</sport_name>
                 <position>Singles</position>
                 <team>The Champions</team>
             </sports>
             <clubs>
                 <club_name>Art Club</club_name>
                 <role>Vice President</role>
             </clubs>
         </extra_curricular>
     </students>
     <students>
         <name>Alice</name>
         <age>17</age>
         <contact>
             <email>alice@example.com</email>
             <phone>+112233445</phone>
             <address>789 Alice St, Another City</address>
         </contact>
         <courses>
             <course_name>Math 101</course_name>
             <quizzes>
                 <quiz>1</quiz>
                 <grade>6</grade>
                 <weight>0.2</weight>
             </quizzes>
             <midterm>
                 <grade>88</grade>
                 <weight>0.4</weight>
             </midterm>
             <final>
                 <grade>AB</grade>
                 <weight>0.4</weight>
             </final>
             <total_score>83.2</total_score>
             <attendance>
                 <total_classes>30</total_classes>
                 <attended_classes>25</attended_classes>
                 <absent_classes>5</absent_classes>
             </attendance>
         </courses>
         <extra_curricular>
             <clubs>
                 <club_name>Music Club</club_name>
                 <role>Member</role>
             </clubs>
         </extra_curricular>
     </students>
 </root>`,
  modifyingconfigtoml: `name = "d3-hierarchy"
version = "3.1.2"
description = "Layout algorithms for visualizing hierarchical data."
homepage = "https://d3js.org/d3-hierarchy/"
keywords = [
  "d3",
  "d3-module",
  "layout",
  "tree",
  "treemap",
  "hierarchy",
  "infovis"
]
license = "ISC"
type = "module"
files = [ "dist/**/*.js", "src/**/*.js" ]
module = "src/index.js"
main = "src/index.js"
jsdelivr = "dist/d3-hierarchy.min.js"
unpkg = "dist/d3-hierarchy.min.js"
sideEffects = false

[repository]
type = "git"
url = "https://github.com/d3/d3-hierarchy.git"

[author]
name = "Mike Bostock"
url = "http://bost.ocks.org/mike"

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
node = ">=12""`,
  readingconfigtoml: `name = "d3-hierarchy"
version = "3.1.2"
description = "Layout algorithms for visualizing hierarchical data."
homepage = "https://d3js.org/d3-hierarchy/"
keywords = [
  "d3",
  "d3-module",
  "layout",
  "tree",
  "treemap",
  "hierarchy",
  "infovis"
]
license = "ISC"
type = "module"
files = [ "dist/**/*.js", "src/**/*.js" ]
module = "src/index.js"
main = "src/index.js"
jsdelivr = "dist/d3-hierarchy.min.js"
unpkg = "dist/d3-hierarchy.min.js"
sideEffects = false

[repository]
type = "git"
url = "https://github.com/d3/d3-hierarchy.git"

[author]
name = "Mike Bostock"
url = "http://bost.ocks.org/mike"

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
  modifyingtabulartoml: `name = "student-data"
version = "1.0.0"
description = "Student information with grades and extracurricular activities."
homepage = "https://example.com/student-data"
keywords = [
  "student",
  "grades",
  "courses",
  "extracurricular",
  "attendance"
]

[repository]
type = "git"
url = "https://github.com/example/student-data.git"

[[students]]
name = "Bob"
age = 12

[students.contact]
email = "bob@example.com"
phone = "+123456789"
address = "123 Bob St, Some City"

[[students.courses]]
course_name = "Math 101"
total_score = 82.3

[[students.courses.quizzes]]
quiz = 1
grade = 8
weight = 0.1

[[students.courses.quizzes]]
quiz = 2
grade = 9
weight = 0.1

[students.courses.midterm]
grade = 77
weight = 0.3

[students.courses.final]
grade = 87
weight = 0.5

[students.courses.attendance]
total_classes = 30
attended_classes = 28
absent_classes = 2

[[students.courses]]
course_name = "History 101"
total_score = 81.3

[[students.courses.quizzes]]
quiz = 1
grade = 7
weight = 0.2

[[students.courses.quizzes]]
quiz = 2
grade = 8
weight = 0.2

[students.courses.midterm]
grade = 80
weight = 0.4

[students.courses.final]
grade = 85
weight = 0.3

[students.courses.attendance]
total_classes = 30
attended_classes = 30
absent_classes = 0

[[students.extra_curricular.sports]]
sport_name = "Soccer"
position = "Forward"
team = "The Tigers"

[[students.extra_curricular.sports]]
sport_name = "Basketball"
position = "Guard"
team = "The Eagles"

[[students.extra_curricular.clubs]]
club_name = "Science Club"
role = "President"

[[students.extra_curricular.clubs]]
club_name = "Drama Club"
role = "Member"

[[students]]
name = "Eve"
age = 13

[students.contact]
email = "eve@example.com"
phone = "+987654321"
address = "456 Eve St, Other City"

[[students.courses]]
course_name = "Math 101"
total_score = 78.3

[[students.courses.quizzes]]
quiz = 1
grade = 9
weight = 0.15

[[students.courses.quizzes]]
quiz = 2
grade = 10
weight = 0.15

[students.courses.midterm]
grade = "AB"
weight = 0.3

[students.courses.final]
grade = 77
weight = 0.4

[students.courses.attendance]
total_classes = 30
attended_classes = 27
absent_classes = 3

[[students.extra_curricular.sports]]
sport_name = "Tennis"
position = "Singles"
team = "The Champions"

[[students.extra_curricular.clubs]]
club_name = "Art Club"
role = "Vice President"

[[students]]
name = "Alice"
age = 17

[students.contact]
email = "alice@example.com"
phone = "+112233445"
address = "789 Alice St, Another City"

[[students.courses]]
course_name = "Math 101"
total_score = 83.2

[[students.courses.quizzes]]
quiz = 1
grade = 6
weight = 0.2

[students.courses.midterm]
grade = 88
weight = 0.4

[students.courses.final]
grade = "AB"
weight = 0.4

# Student data including grades and extracurricular activities. AB stands for absent.

[students.courses.attendance]
total_classes = 30
attended_classes = 25
absent_classes = 5

[students.extra_curricular]
sports = [ ]

[[students.extra_curricular.clubs]]
club_name = "Music Club"
role = "Member"`,
  readingtabulartoml: `name = "student-data"
version = "1.0.0"
description = "Student information with grades and extracurricular activities."
homepage = "https://example.com/student-data"
keywords = [
  "student",
  "grades",
  "courses",
  "extracurricular",
  "attendance"
]

[repository]
type = "git"
url = "https://github.com/example/student-data.git"

[[students]]
name = "Bob"
age = 12

[students.contact]
email = "bob@example.com"
phone = "+123456789"
address = "123 Bob St, Some City"

[[students.courses]]
course_name = "Math 101"
total_score = 82.3

[[students.courses.quizzes]]
quiz = 1
grade = 8
weight = 0.1

[[students.courses.quizzes]]
quiz = 2
grade = 9
weight = 0.1

[students.courses.midterm]
grade = 77
weight = 0.3

[students.courses.final]
grade = 87
weight = 0.5

[students.courses.attendance]
total_classes = 30
attended_classes = 28
absent_classes = 2

[[students.courses]]
course_name = "History 101"
total_score = 81.3

[[students.courses.quizzes]]
quiz = 1
grade = 7
weight = 0.2

[[students.courses.quizzes]]
quiz = 2
grade = 8
weight = 0.2

[students.courses.midterm]
grade = 80
weight = 0.4

[students.courses.final]
grade = 85
weight = 0.3

[students.courses.attendance]
total_classes = 30
attended_classes = 30
absent_classes = 0

[[students.extra_curricular.sports]]
sport_name = "Soccer"
position = "Forward"
team = "The Tigers"

[[students.extra_curricular.sports]]
sport_name = "Basketball"
position = "Guard"
team = "The Eagles"

[[students.extra_curricular.clubs]]
club_name = "Science Club"
role = "President"

[[students.extra_curricular.clubs]]
club_name = "Drama Club"
role = "Member"

[[students]]
name = "Eve"
age = 13

[students.contact]
email = "eve@example.com"
phone = "+987654321"
address = "456 Eve St, Other City"

[[students.courses]]
course_name = "Math 101"
total_score = 78.3

[[students.courses.quizzes]]
quiz = 1
grade = 9
weight = 0.15

[[students.courses.quizzes]]
quiz = 2
grade = 10
weight = 0.15

[students.courses.midterm]
grade = "AB"
weight = 0.3

[students.courses.final]
grade = 77
weight = 0.4

[students.courses.attendance]
total_classes = 30
attended_classes = 27
absent_classes = 3

[[students.extra_curricular.sports]]
sport_name = "Tennis"
position = "Singles"
team = "The Champions"

[[students.extra_curricular.clubs]]
club_name = "Art Club"
role = "Vice President"

[[students]]
name = "Alice"
age = 17

[students.contact]
email = "alice@example.com"
phone = "+112233445"
address = "789 Alice St, Another City"

[[students.courses]]
course_name = "Math 101"
total_score = 83.2

[[students.courses.quizzes]]
quiz = 1
grade = 6
weight = 0.2

[students.courses.midterm]
grade = 88
weight = 0.4

[students.courses.final]
grade = "AB"
weight = 0.4

# Student data including grades and extracurricular activities. AB stands for absent.

[students.courses.attendance]
total_classes = 30
attended_classes = 25
absent_classes = 5

[students.extra_curricular]
sports = [ ]

[[students.extra_curricular.clubs]]
club_name = "Music Club"
role = "Member"`,
  modifyingconfigyaml: `
name: 'd3-hierarchy'
version: '3.1.2'
description: 'Layout algorithms for visualizing hierarchical data.'
homepage: 'https://d3js.org/d3-hierarchy/'
repository:
  type: 'git'
  url: 'https://github.com/d3/d3-hierarchy.git'
keywords:
  - 'd3'
  - 'd3-module'
  - 'layout'
  - 'tree'
  - 'treemap'
  - 'hierarchy'
  - 'infovis'
license: 'ISC'
author:
  name: 'Mike Bostock'
  url: 'http://bost.ocks.org/mike'
type: 'module'
files:
  - 'dist/**/*.js'
  - 'src/**/*.js'
module: 'src/index.js'
main: 'src/index.js'
jsdelivr: 'dist/d3-hierarchy.min.js'
unpkg: 'dist/d3-hierarchy.min.js'
exports:
  umd: './dist/d3-hierarchy.min.js'
  default: './src/index.js'
sideEffects: false
devDependencies:
  benchmark: 2
  d3-array: '1.2.0 - 3'
  d3-dsv: '1 - 3'
  d3-random: '1.1.0 - 3'
  eslint: 8
  mocha: 9
  rollup: 2
  rollup-plugin-terser: 7
  # d3-random is a peer dependency.
scripts:
  test: 'mocha ''test/**/*-test.js'' && eslint src test'
  prepublishOnly: 'rm -rf dist && yarn test && rollup -c'
  postpublish: 'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -'
engines:
  node: '>=12'`,
  readingconfigyaml: `
name: 'd3-hierarchy'
version: '3.1.2'
description: 'Layout algorithms for visualizing hierarchical data.'
homepage: 'https://d3js.org/d3-hierarchy/'
repository:
  type: 'git'
  url: 'https://github.com/d3/d3-hierarchy.git'
keywords:
  - 'd3'
  - 'd3-module'
  - 'layout'
  - 'tree'
  - 'treemap'
  - 'hierarchy'
  - 'infovis'
license: 'ISC'
author:
  name: 'Mike Bostock'
  url: 'http://bost.ocks.org/mike'
type: 'module'
files:
  - 'dist/**/*.js'
  - 'src/**/*.js'
module: 'src/index.js'
main: 'src/index.js'
jsdelivr: 'dist/d3-hierarchy.min.js'
unpkg: 'dist/d3-hierarchy.min.js'
exports:
  umd: './dist/d3-hierarchy.min.js'
  default: './src/index.js'
sideEffects: false
devDependencies:
  benchmark: 2
  d3-array: '1.2.0 - 3'
  d3-dsv: '1 - 3'
  d3-random: '1.1.0 - 3'
  eslint: 8
  mocha: 9
  rollup: 2
  rollup-plugin-terser: 7
  # d3-random is a peer dependency.
scripts:
  test: 'mocha ''test/**/*-test.js'' && eslint src test'
  prepublishOnly: 'rm -rf dist && yarn test && rollup -c'
  postpublish: 'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -'
engines:
  node: '>=12'`,
  modifyingtabularyaml: `
name: 'student-data'
version: '1.0.0'
description: 'Student information with grades and extracurricular activities.'
homepage: 'https://example.com/student-data'
repository:
  type: 'git'
  url: 'https://github.com/example/student-data.git'
keywords:
  - 'student'
  - 'grades'
  - 'courses'
  - 'extracurricular'
  - 'attendance'
students:
  - name: 'Bob'
    age: 12
    contact:
      email: 'bob@example.com'
      phone: 123456789
      address: '123 Bob St, Some City'
    courses:
      - course_name: 'Math 101'
        quizzes:
          - quiz: 1
            grade: 8
            weight: 0.1
          - quiz: 2
            grade: 9
            weight: 0.1
        midterm:
          grade: 77
          weight: 0.3
        final:
          grade: 87
          weight: 0.5
        total_score: 82.3
        attendance:
          total_classes: 30
          attended_classes: 28
          absent_classes: 2
      - course_name: 'History 101'
        quizzes:
          - quiz: 1
            grade: 7
            weight: 0.2
          - quiz: 2
            grade: 8
            weight: 0.2
        midterm:
          grade: 80
          weight: 0.4
        final:
          grade: 85
          weight: 0.3
        total_score: 81.3
        attendance:
          total_classes: 30
          attended_classes: 30
          absent_classes: 0
    extra_curricular:
      sports:
        - sport_name: 'Soccer'
          position: 'Forward'
          team: 'The Tigers'
        - sport_name: 'Basketball'
          position: 'Guard'
          team: 'The Eagles'
      clubs:
        - club_name: 'Science Club'
          role: 'President'
        - club_name: 'Drama Club'
          role: 'Member'
  - name: 'Eve'
    age: 13
    contact:
      email: 'eve@example.com'
      phone: 987654321
      address: '456 Eve St, Other City'
    courses:
      course_name: 'Math 101'
      quizzes:
        - quiz: 1
          grade: 9
          weight: 0.15
        - quiz: 2
          grade: 10
          weight: 0.15
      midterm:
        grade: 'AB'  # Student data including grades and extracurricular activities. AB stands for absent.
        weight: 0.3
      final:
        grade: 77
        weight: 0.4
      total_score: 78.3
      attendance:
        total_classes: 30
        attended_classes: 27
        absent_classes: 3
    extra_curricular:
      sports:
        sport_name: 'Tennis'
        position: 'Singles'
        team: 'The Champions'
      clubs:
        club_name: 'Art Club'
        role: 'Vice President'
  - name: 'Alice'
    age: 17
    contact:
      email: 'alice@example.com'
      phone: 112233445
      address: '789 Alice St, Another City'
    courses:
      course_name: 'Math 101'
      quizzes:
        quiz: 1
        grade: 6
        weight: 0.2
      midterm:
        grade: 88
        weight: 0.4
      final:
        grade: 'AB'
        weight: 0.4
      total_score: 83.2
      attendance:
        total_classes: 30
        attended_classes: 25
        absent_classes: 5
    extra_curricular:
      clubs:
        club_name: 'Music Club'
        role: 'Member'`,
  readingtabularyaml: `
name: 'student-data'
version: '1.0.0'
description: 'Student information with grades and extracurricular activities.'
homepage: 'https://example.com/student-data'
repository:
  type: 'git'
  url: 'https://github.com/example/student-data.git'
keywords:
  - 'student'
  - 'grades'
  - 'courses'
  - 'extracurricular'
  - 'attendance'
students:
  - name: 'Bob'
    age: 12
    contact:
      email: 'bob@example.com'
      phone: 123456789
      address: '123 Bob St, Some City'
    courses:
      - course_name: 'Math 101'
        quizzes:
          - quiz: 1
            grade: 8
            weight: 0.1
          - quiz: 2
            grade: 9
            weight: 0.1
        midterm:
          grade: 77
          weight: 0.3
        final:
          grade: 87
          weight: 0.5
        total_score: 82.3
        attendance:
          total_classes: 30
          attended_classes: 28
          absent_classes: 2
      - course_name: 'History 101'
        quizzes:
          - quiz: 1
            grade: 7
            weight: 0.2
          - quiz: 2
            grade: 8
            weight: 0.2
        midterm:
          grade: 80
          weight: 0.4
        final:
          grade: 85
          weight: 0.3
        total_score: 81.3
        attendance:
          total_classes: 30
          attended_classes: 30
          absent_classes: 0
    extra_curricular:
      sports:
        - sport_name: 'Soccer'
          position: 'Forward'
          team: 'The Tigers'
        - sport_name: 'Basketball'
          position: 'Guard'
          team: 'The Eagles'
      clubs:
        - club_name: 'Science Club'
          role: 'President'
        - club_name: 'Drama Club'
          role: 'Member'
  - name: 'Eve'
    age: 13
    contact:
      email: 'eve@example.com'
      phone: 987654321
      address: '456 Eve St, Other City'
    courses:
      course_name: 'Math 101'
      quizzes:
        - quiz: 1
          grade: 9
          weight: 0.15
        - quiz: 2
          grade: 10
          weight: 0.15
      midterm:
        grade: 'AB'  # Student data including grades and extracurricular activities. AB stands for absent.
        weight: 0.3
      final:
        grade: 77
        weight: 0.4
      total_score: 78.3
      attendance:
        total_classes: 30
        attended_classes: 27
        absent_classes: 3
    extra_curricular:
      sports:
        sport_name: 'Tennis'
        position: 'Singles'
        team: 'The Champions'
      clubs:
        club_name: 'Art Club'
        role: 'Vice President'
  - name: 'Alice'
    age: 17
    contact:
      email: 'alice@example.com'
      phone: 112233445
      address: '789 Alice St, Another City'
    courses:
      course_name: 'Math 101'
      quizzes:
        quiz: 1
        grade: 6
        weight: 0.2
      midterm:
        grade: 88
        weight: 0.4
      final:
        grade: 'AB'
        weight: 0.4
      total_score: 83.2
      attendance:
        total_classes: 30
        attended_classes: 25
        absent_classes: 5
    extra_curricular:
      clubs:
        club_name: 'Music Club'
        role: 'Member'`,
  modifyingconfigjsonc: JSON.stringify({
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
  readingconfigjsonc: JSON.stringify({
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
  modifyingtabularjsonc: JSON.stringify({
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }, null, 2),
  readingtabularjsonc: JSON.stringify({
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }, null, 2),
  readingconfigjson5: JSON.stringify({
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
  readingtabularjson5: JSON.stringify({
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }, null, 2),
  modifyingconfigjson5: JSON.stringify({
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
  modifyingtabularjson5: JSON.stringify({
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }, null, 2),
  modifyingconfighjson: `{
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
  }`,
  modifyingtabularhjson: `{
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }`,
  readingconfighjson: `{
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
  }`,
  readingtabularhjson: `{
    name: 'student-data',
    version: '1.0.0',
    description: 'Student information with grades and extracurricular activities.',
    homepage: 'https://example.com/student-data',
    repository: {
      type: 'git',
      url: 'https://github.com/example/student-data.git',
    },
    keywords: [
      'student',
      'grades',
      'courses',
      'extracurricular',
      'attendance',
    ],
    comments: 'Student data including grades and extracurricular activities. AB stands for absent.',
    students: [
      {
        name: 'Bob',
        age: 12,
        contact: {
          email: 'bob@example.com',
          phone: '+123456789',
          address: '123 Bob St, Some City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 8, weight: 0.1 },
              { quiz: 2, grade: 9, weight: 0.1 },
            ],
            midterm: {
              grade: 77,
              weight: 0.3,
            },
            final: {
              grade: 87,
              weight: 0.5,
            },
            total_score: 82.3,
            attendance: {
              total_classes: 30,
              attended_classes: 28,
              absent_classes: 2,
            },
          },
          {
            course_name: 'History 101',
            quizzes: [
              { quiz: 1, grade: 7, weight: 0.2 },
              { quiz: 2, grade: 8, weight: 0.2 },
            ],
            midterm: {
              grade: 80,
              weight: 0.4,
            },
            final: {
              grade: 85,
              weight: 0.3,
            },
            total_score: 81.3,
            attendance: {
              total_classes: 30,
              attended_classes: 30,
              absent_classes: 0,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Soccer', position: 'Forward', team: 'The Tigers' },
            { sport_name: 'Basketball', position: 'Guard', team: 'The Eagles' },
          ],
          clubs: [
            { club_name: 'Science Club', role: 'President' },
            { club_name: 'Drama Club', role: 'Member' },
          ],
        },
      },
      {
        name: 'Eve',
        age: 13,
        contact: {
          email: 'eve@example.com',
          phone: '+987654321',
          address: '456 Eve St, Other City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 9, weight: 0.15 },
              { quiz: 2, grade: 10, weight: 0.15 },
            ],
            midterm: {
              grade: 'AB',
              weight: 0.3,
            },
            final: {
              grade: 77,
              weight: 0.4,
            },
            total_score: 78.3,
            attendance: {
              total_classes: 30,
              attended_classes: 27,
              absent_classes: 3,
            },
          },
        ],
        extra_curricular: {
          sports: [
            { sport_name: 'Tennis', position: 'Singles', team: 'The Champions' },
          ],
          clubs: [
            { club_name: 'Art Club', role: 'Vice President' },
          ],
        },
      },
      {
        name: 'Alice',
        age: 17,
        contact: {
          email: 'alice@example.com',
          phone: '+112233445',
          address: '789 Alice St, Another City',
        },
        courses: [
          {
            course_name: 'Math 101',
            quizzes: [
              { quiz: 1, grade: 6, weight: 0.2 },
            ],
            midterm: {
              grade: 88,
              weight: 0.4,
            },
            final: {
              grade: 'AB',
              weight: 0.4,
            },
            total_score: 83.2,
            attendance: {
              total_classes: 30,
              attended_classes: 25,
              absent_classes: 5,
            },
          },
        ],
        extra_curricular: {
          sports: [],
          clubs: [
            { club_name: 'Music Club', role: 'Member' },
          ],
        },
      },
    ],
  }`,
};
