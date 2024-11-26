## TOML tutorial
### **Syntax Rules**

---
TOML (Tom's Obvious, Minimal Language) is a configuration file format designed to be easy to read and write. It is often used for software configuration due to its simplicity and structure.

---
**Key-Value Pairs**
Key-value pairs are the foundation of TOML.
Keys are case-sensitive and must be unique within a table.
Values can be strings, numbers, booleans, arrays, dates, or inline tables.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_1.png" width="400px" height="auto">

---
**Strings**
Strings must be enclosed in double quotes (").
Multi-line strings use triple double quotes (""").
Escape sequences (e.g., \n, \", \\) are supported in basic strings.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_2.png" width="400px" height="auto">

---
**Numbers**
Numbers can be integers, floating-point, or hexadecimal.
Underscores (_) are allowed for readability (e.g., 1_000).

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_3.png" width="400px" height="auto">

---
**Booleans**
Booleans are true or false (case-sensitive).

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_4.png" width="400px" height="auto">

---
**Dates and Times**
TOML supports:
Local dates (YYYY-MM-DD)
Local times (HH:MM:SS)
Datetimes with offsets (YYYY-MM-DDTHH:MM:SSZ).

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_5.png" width="400px" height="auto">

---
**Arrays**
Arrays are enclosed in square brackets ([]) and can contain values of the same type.
Inline arrays are separated by commas, while multi-line arrays are allowed for readability.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_6.png" width="400px" height="auto">

---
**Tables**
Tables group related key-value pairs.
They are defined using square brackets ([]).
Nested tables are created using dot notation or additional brackets.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_7.png" width="400px" height="auto">

---
**Inline Tables**
Inline tables are enclosed in curly braces ({}) and must be written on a single line.
Use them for small tables.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_8.png" width="400px" height="auto">

---
**Comments**
Comments start with # and can be placed anywhere in the file.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/toml/toml_example_9.png" width="400px" height="auto">
