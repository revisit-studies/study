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
Use quotes if the string contains special characters, colons, or newlines.
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
