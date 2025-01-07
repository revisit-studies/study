## HJSON Basic Syntax Tutorial
HJSON (**Human JSON**) is a human-friendly version of JSON. Unlike standard JSON, HJSON **does not require** <strong style="color:green;">{}</strong> and <strong style="color:green;">[]</strong> to enclose objects and arrays, making it much simpler and more intuitive for configuration files.
HJSON has the same data structure as JSON, supporting objects, arrays, strings, numbers, booleans, and <strong style="color:green;">{}</strong>null</strong>.

HJSON extends standard JSON with the following unique features:
<br><br>

### 1. No Requirement for {} and []
In HJSON, **objects** and **arrays** do not require <strong style="color:green;">{}</strong> and <strong style="color:green;">[]</strong>.
- **Objects**: Key-value pairs are listed line by line, with no enclosing curly braces <strong style="color:green;">{}</strong>.
- **Arrays**: Each array item is placed on a new line, using indentation to indicate hierarchy.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_NoRequirement.png" width="450px" height="auto">
<br>


### 2. Support for Comments
HJSON supports **single-line comments** (<strong style="color:green;">#</strong> and <strong style="color:green;">//</strong>) and **multi-line comments**.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_comments.png" width="450px" height="auto">
<br>


### 3. Simplified Key-Value Pairs
In HJSON, keys do not require quotes, and values can be separated using a colon <strong style="color:green;">:</strong> or just a space.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_KVPairs.png" width="450px" height="auto">
<br>

### 4. Flexible Strings
Strings can **omit quotes** unless they contain special characters.
**Multi-line strings** are written with indentation, avoiding escape characters.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_Flexible.png" width="450px" height="auto">
<br>


### 5. Support for Trailing Commas
HJSON allows trailing commas after the last item in objects and arrays.
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_Commas.png" width="450px" height="auto">
<br>

### 6. Human-Friendly Booleans and Null
HJSON allows human-friendly booleans and null values:
- **Booleans**: use <strong style="color:green;">true</strong> /<strong style="color:green;">yes</strong>  or <strong style="color:green;">false</strong> /<strong style="color:green;">no</strong>.
- **Null**: use <strong style="color:green;">null</strong>  or <strong style="color:green;">~</strong> .
###### <u>Correct Example</u> 
   <img src="./assets/tutorial/hjson/hjson_Booleans.png" width="450px" height="auto">
<br>


### Full HJSON Example
   <img src="./assets/tutorial/hjson/hjson_example.png" width="450px" height="auto">
<br>