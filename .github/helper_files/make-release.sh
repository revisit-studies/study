# Read in release name from the command line
release_name=$1

# Replace "main" in the following URLs with the release name
#/reVISit-studies/study/main/src
#/revisit-studies/study/blob/main
#/revisit-studies/study/tree/main

LANG=C sed -i '' -e "s/\/reVISit-studies\/study\/main\/src/\/reVISit-studies\/study\/$release_name\/src/g" src/**/*.* public/**/*.*
LANG=C sed -i '' -e "s/\/revisit-studies\/study\/blob\/main/\/revisit-studies\/study\/blob\/$release_name/g" src/**/*.* public/**/*.*
LANG=C sed -i '' -e "s/\/revisit-studies\/study\/blob\/main/\/revisit-studies\/study\/tree\/$release_name/g" src/**/*.* public/**/*.*
