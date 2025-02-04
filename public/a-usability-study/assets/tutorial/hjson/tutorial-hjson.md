## HJSON Basic Syntax Tutorial
HJSON (**Human JSON**) is a human-friendly version of JSON. Unlike standard JSON, HJSON **does not require** <strong style="color:green;">{}</strong> and <strong style="color:green;">[]</strong> to enclose objects and arrays, making it much simpler and more intuitive for configuration files.
HJSON has the same data structure as JSON, supporting objects, arrays, strings, numbers, booleans, and <strong style="color:green;">{}</strong>null</strong>.

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

**HJSON** extends standard JSON with the following unique features:
<br><br>

### 1. Support for Missing & Trailing Commas
Never see a syntax error because of a missing or trailing comma again.A good practice is to put each value onto a new line, in this case commas are optional and should be omitted.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_Commas.png" width="450px" height="auto">
<br>

### 2. Support for Comments
HJSON supports **single-line comments** (<strong style="color:green;">#</strong> and <strong style="color:green;">//</strong>) and **multi-line comments**.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_comments.png" width="450px" height="auto">
<br>

### 3. Simplified Key-Value Pairs
In HJSON, object names can be specified without quotes.keys do not require quotes. Also, you can specify strings without quotes.(In this case only one value per line and no commas are allowed.)
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_KVPairs.png" width="450px" height="auto">
<br>

### 4. Flexible Strings
Strings can **omit quotes** unless they contain special characters.
**Multi-line strings** are written with indentation, avoiding escape characters.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_Flexible.png" width="450px" height="auto">
<br>

### 5. Data Structure
JSON and Hjson use the characters <strong style="color:green;">{}[],:</strong> as punctuators to define the structure of the data.
Punctuators and whitespace can't be used in an unquoted key or as the first character of a quoteless string. In this (rather uncommon) case you need to use quotes.The backslash is only used as an escape character in a quoted string.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_Structure.png" width="450px" height="auto">
<br>


### Full HJSON Example
   <img src="./assets/tutorial/hjson/hjson_example.png" width="450px" height="auto">
<br>