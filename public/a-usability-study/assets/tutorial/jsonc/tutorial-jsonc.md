## JSONC Basic Syntax Tutorial

JSONC (**JSON with Comments**) is a format based on JSON but with some small features and more lenient parsing behaviors. JSON (JavaScript Object Notation) is a lightweight data-interchange format that is easy for humans to read and write, and easy for machines to parse and generate.

Let's begin with some fundamental JSON rules:

### 1.Basic Structure
JSON consists of **key-value** pairs and **data types**, and it primarily has two structures:
- **Object**: Denoted with curly braces <strong style="color:green;">{}</strong>, it contains an unordered collection of key-value pairs.
- **Array**: Denoted with square brackets <strong style="color:green;">[]</strong>, it contains an ordered list of values.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_BasicStructure.png" width="450px" height="auto">
<br>

### 2. Key-Value Pairs
- Keys and values are separated by a colon <strong style="color:green;">:</strong>.
- Keys must be strings and must be enclosed in double quotes <strong style="color:green;">""</strong>.
- Key-value pairs are separated by commas <strong style="color:green;">,</strong>.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_KVPair.png" width="450px" height="auto">
<br>

### 3. Data Types
**String**: Strings must be enclosed in double quotes <strong style="color:green;">""</strong>.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_string.png" width="450px" height="auto">

**Number**: Includes **integers** and **floating-point numbers**, but leading zeros and hexadecimal formats are not supported.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_number.png" width="450px" height="auto">

**Boolean**: The values can be <strong style="color:green;">true</strong> or <strong style="color:green;">false</strong>.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_boolean.png" width="450px" height="auto">

**Null**: Represented by <strong style="color:green;">null</strong> for empty or unknown values.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_null.png" width="450px" height="auto">

**Object**: Denoted by curly braces <strong style="color:green;">{}</strong>, it contains key-value pairs.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_object.png" width="450px" height="auto">

**Array**: Denoted by square brackets <strong style="color:green;">[]</strong>, it can contain multiple values.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_array.png" width="450px" height="auto">
<br>

### 4. Format Requirements
**Quotation Rules**: Keys and string values must be enclosed in **double quotes** <strong style="color:green;">""</strong>.
###### <strong style="color:red;"><u>Incorrect Example</u></strong>
   <img src="./assets/tutorial/json/json_quot_IC.png" width="450px" height="auto">

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_quot_C.png" width="450px" height="auto">

**Escape Characters**: JSON supports the following escape characters: 
- <span style="color:green;">`\"`</span> (Double quote)
- <span style="color:green;">`\\`</span> (Backslash)
- <span style="color:green;">`\/`</span> (Forward slash)
- <span style="color:green;">`\b`</span> (Backspace)
- <span style="color:green;">`\f`</span> (Form feed)
- <span style="color:green;">`\n`</span> (New line)
- <span style="color:green;">`\r`</span> (Carriage return)
- <span style="color:green;">`\t`</span> (Tab)

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_Escape.png" width="450px" height="auto">
<br>

### 5. Nested Structures
JSON supports nested objects and arrays, enabling the construction of complex data structures.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_nested.png" width="450px" height="auto">


<br><br>

JSONC extends standard JSON with the following unique features:
<br><br>

### 1. Support for Trailing Commas
JSONC allows **trailing commas** <strong style="color:green;">,</strong> after the last element in objects and arrays.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/jsonc/jsonc_commas.png" width="450px" height="auto">


### 2. Support for Comments

**JSONC** allows comments to be added in JSON files, including **single-line comments** and **multi-line comments**.
- **Single-line comments**: Use <strong style="color:green;">//</strong>.
- **Multi-line comments**: Use <strong style="color:green;">/* */</strong> to wrap comments.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/jsonc/jsonc_comments.png" width="450px" height="auto">
<br>

**Block comments** support in place commenting and multi-line comments. JSONC restricts their usage to outside of strings (and therefore keys). Within strings they are considered part of the string.

###### <u>Example</u> 
   <img src="./assets/tutorial/jsonc/jsonc_block_comments.png" width="450px" height="auto">
<br>