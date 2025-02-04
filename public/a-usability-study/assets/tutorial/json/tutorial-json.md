## JSON Basic Syntax Tutorial
JSON (JavaScript Object Notation) is a lightweight data-interchange format that is easy for humans to read and write, and easy for machines to parse and generate.
<br><br>

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
**Comma Rules**: There must be **no trailing commas** after the last key-value pair or array item.
###### <strong style="color:red;"><u>Incorrect Example</u></strong>
   <img src="./assets/tutorial/json/json_comma_IC.png" width="450px" height="auto">

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/json/json_comma_C.png" width="450px" height="auto">

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
<br>

### 6.Does Not Support Comments
JSON doesn't support comments.
###### <strong style="color:red;"><u>Incorrect Example</u></strong> 
   <img src="./assets/tutorial/json/json_comments.png" width="450px" height="auto">
