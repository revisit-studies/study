## JSON5 Basic Syntax Tutorial
JSON5 is an extension of standard JSON, designed to improve JSON's readability and usability. JSON5 retains most of JSON's core features but adds flexibility, such as support for comments, single quotes, and trailing commas.
- JSON5 still uses **key-value** pairs, where keys and values are separated by a colon <strong style="color:green;">:</strong>.
- JSON5 supports the same data types as JSON: Strings, Numbers, Booleans, Objects, Arrays, <strong style="color:green;">null</strong>
- JSON5 uses <strong style="color:green;">{}</strong> for objects and <strong style="color:green;">[]</strong> for arrays, identical to JSON.

JSON5 extends standard JSON with the following unique features:
<br><br>

### 1. Support for Comments
JSON5 allows comments, which JSON does not.
Single-Line Comments use  <strong style="color:green;">//</strong>
Multi-Line Comments use  <strong style="color:green;">/* */</strong>
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json5/json5_comments.png" width="450px" height="auto">
<br>

### 2. Support for Single-Quoted Strings
JSON5 allows single quotes <strong style="color:green;">'</strong> for strings, in addition to double quotes <strong style="color:green;">""</strong>.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json5/json5_strings.png" width="450px" height="auto">
<br>

### 3. Support for Trailing Commas
JSON5 allows a trailing comma <strong style="color:green;">,</strong> after the last element in objects and arrays.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json5/json5_commas.png" width="450px" height="auto">
<br>

### 4. Support for Unquoted Keys
JSON5 allows unquoted keys if they are valid identifiers (e.g., letters, numbers, and underscores).
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json5/json5_unquote.png" width="450px" height="auto">
<br>

### 5. Flexible Number Formats
JSON5 supports additional number formats:
- **Hexadecimal numbers**: Example: <strong style="color:green;">0xFF</strong>
- **Leading decimals**: Example: <strong style="color:green;">.5</strong>
- **Trailing decimals**: Example: <strong style="color:green;">5.</strong>
- **Positive numbers with** <strong style="color:green;">+</strong> **sign**: Example: <strong style="color:green;">+25</strong>
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json5/json5_number.png" width="450px" height="auto">
<br>

### Full JSON5 Example
   <img src="./assets/tutorial/json5/json5_example.png" width="450px" height="auto">
<br>


