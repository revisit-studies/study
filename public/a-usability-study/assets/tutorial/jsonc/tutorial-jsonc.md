## JSONC Basic Syntax Tutorial

JSONC (**JSON with Comments**) fully adheres to the standard JSON syntax rules, including:
- Keys must use **double quotes** <strong style="color:green;">""</strong>.
- Supported data types: strings, numbers, booleans, objects, arrays, and <strong style="color:green;">null</strong>.
- Objects are represented with curly braces <strong style="color:green;">{}</strong>.
- Arrays are represented with square brackets <strong style="color:green;">[]</strong>.
- Key-value pairs are separated by a colon <strong style="color:green;">:</strong>, and elements are separated by a comma <strong style="color:green;">,</strong>.

JSONC extends standard JSON with the following unique features:
<br><br>

### 1. Support for Comments

JSONC allows comments to be added in JSON files, including **single-line comments** and **multi-line comments**.
- **Single-line comments**: Use <strong style="color:green;">//</strong>.
- **Multi-line comments**: Use <strong style="color:green;">/* */</strong> to wrap comments.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/jsonc/jsonc_comments.png" width="450px" height="auto">
<br>

### 2. Support for Trailing Commas
JSONC allows **trailing commas** <strong style="color:green;">,</strong> after the last element in objects and arrays.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/jsonc/jsonc_commas.png" width="450px" height="auto">