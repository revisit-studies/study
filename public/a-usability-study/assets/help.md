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


## JSON5 Basic Syntax Tutorial
JSON5 is an extension of standard JSON, designed to improve JSON's readability and usability. JSON5 retains most of JSON's core features but adds flexibility, such as support for comments, single quotes, and trailing commas.

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

**JSON5** extends standard JSON with the following unique features:
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


## YAML Basic Syntax Tutorial
YAML (**YAML Ain't Markup Language**) is a human-readable, lightweight data serialization format primarily used for configuration files and data exchange. It is concise, easy to read, and easier to manually edit compared to JSON.
<br><br>

### 1. Key-Value Pairs
Each key-value pair is separated by a colon <strong style="color:green;">:</strong>, with a space after the colon.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/yaml/yaml_KVPairs.png" width="450px" height="auto">
<br>

### 2. Indentation and Hierarchy
YAML uses spaces to represent hierarchy. **Tab characters are not allowed**.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/yaml/yaml_Indentation.png" width="450px" height="auto">
<br>

### 3. Strings
Strings can be written directly without quotes.
Use quotes(Single or double) if the string contains special characters, colons, or newlines. Or use quotes if you want to ensure the number is interpreted as a string.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/yaml/yaml_Strings.png" width="450px" height="auto">
<br>

### 4. Arrays
Array items are prefixed with <strong style="color:green;">-</strong>, one item per line.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/yaml/yaml_Arrays.png" width="450px" height="auto">
<br>

### 5. Objects
Use indentation to represent nested objects.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/yaml/yaml_Objects.png" width="450px" height="auto">
<br>

### 6. Booleans and Null
Booleans are represented using <strong style="color:green;">true</strong>/<strong style="color:green;">false</strong> or <strong style="color:green;">yes</strong>/<strong style="color:green;">no</strong>.
Null values are represented using <strong style="color:green;">null</strong> or <strong style="color:green;">~</strong>.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/yaml/yaml_Booleans.png" width="450px" height="auto">
<br>

### Full YAML Example
   <img src="./assets/tutorial/yaml/yaml_example.png" width="450px" height="auto">
<br>

## TOML Basic Syntax Tutorial
TOML (**Tom's Obvious, Minimal Language**) is a simple, easy-to-read, and easy-to-write configuration file format. It is designed to be human-friendly and easy to parse, making it ideal for configuration files.
<br><br>

### 1. Key-Value Pairs
Key-value pairs are separated by an equals sign =; keys are on the left, and values are on the right.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_KVPairs.png" width="450px" height="auto">
<br>


### 2. Strings
**Basic strings** are enclosed in double quotes <strong style="color:green;">""</strong>.
**Multi-line strings** use triple double quotes <strong style="color:green;">"""</strong> for multiple lines.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_strings.png" width="450px" height="auto">
<br>

### 3. Numbers and Booleans
Supports integers, floating-point numbers, and booleans.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_numbers.png" width="450px" height="auto">
<br>

### 4. Arrays
Arrays are defined using square brackets <strong style="color:green;">[]</strong>, with items separated by commas <strong style="color:green;">,</strong>. 
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_arrays.png" width="450px" height="auto">
<br>


### 5. Tables
Tables are defined using square brackets <strong style="color:green;">[]</strong> and create hierarchical structures.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_table.png" width="450px" height="auto">
<br>

Array of tables <strong style="color:green;">[[array]]</strong> is used to define a list of objects (tables). Each [[array]] entry represents a separate table inside an array.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_arrays2.png" width="450px" height="auto">
<br>

### 6. Inline Tables
Inline tables use <strong style="color:green;">{}</strong> and are suitable for simple objects.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_intable.png" width="450px" height="auto">
<br>

### 7. Dates and Times
TOML explicitly supports time and date formats based on the **RFC 3339** standard.
- Date (Full Date)
   Format: <strong style="color:green;">YYYY-MM-DD</strong>
- Local Date-Time (No Time Zone)
   Format: <strong style="color:green;">YYYY-MM-DDTHH:MM:SS</strong>
- Date-Time with Time Zone
   Format:
   <strong style="color:green;">YYYY-MM-DDTHH:MM:SSZ</strong> (UTC time, where Z indicates the zero offset).
   <strong style="color:green;">YYYY-MM-DDTHH:MM:SS±HH:MM</strong> (Time offset).
- Time Only (Local Time)
   Format: <strong style="color:green;">HH:MM:SS</strong>
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/toml/toml_date.png" width="450px" height="auto">
<br>

### Full TOML Example
   <img src="./assets/tutorial/toml/toml_example.png" width="450px" height="auto">
<br>

## XML Basic Syntax Tutorial
XML (**eXtensible Markup Language**) is a markup language used to store and transport data. It is a structured text format similar to HTML but more flexible because it allows for custom tags.
<br><br>

### 1. Declaration
An XML document starts with a declaration that specifies the XML version and character encoding.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_declaration.png" width="450px" height="auto">
<br>

### 2. Elements
XML uses elements to represent data, which include start tags and end tags.
Tag names are case-sensitive.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_elements.png" width="450px" height="auto">
<br>

### 3. Attributes
Elements can include attributes to provide additional information.
Attributes are written inside the start tag as key-value pairs.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_attributes.png" width="450px" height="auto">
<br>

### 4. Empty Elements
Empty elements have no content and can use self-closing tags.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_empty.png" width="450px" height="auto">
<br>

### 5. Comments
Comments in XML are enclosed in <strong style="color:green;">`<!-- comment -->`</strong>.

###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_comments.png" width="450px" height="auto">
<br>

### 6. Text Content
The content between elements can be plain text.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_text.png" width="450px" height="auto">
<br>

### 7. Nested Elements
XML supports nested elements, forming a hierarchical structure.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/xml/xml_nested.png" width="450px" height="auto">
<br>

### Full XML Example
   <img src="./assets/tutorial/xml/xml_example.png" width="450px" height="auto">
<br>
