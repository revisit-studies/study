# The Public Folder: Experiment Configs, Stimuli and Resources

Files that are in the `public` folder are exposed on the study website. For technical reasons, all static files (including reVISit configurations) have to be in the public folder.

If you want to create a new experiment, you should create a new subfolder in this `public` folder that contains your reVISit config.

Study folder names can include periods (`.`), spaces, and other characters, but reVISit normalizes study URLs by replacing periods/spaces/slashes with underscores. Use links generated in the app to avoid mismatched manual URLs.

Example projects that explain basic reVISit functionality are:

 * [demo-image](demo-image) is the most basic study example that uses images for study stimuli.
 * [demo-html-input](demo-html-input) demonstrates how to use an HTML/JS stimulus.
 * Check out the [Study Browser](https://revisit.dev/study/) for a full list and descriptions of the projects.

Folders that don't contain an experiment are:

* `revisitAssets` which contains logos, etc.
