## YAML tutorial
### **Syntax Rules**

---

YAML (Yet Another Markup Language, later redefined as "YAML Ain't Markup Language") is a human-readable data serialization standard often used for configuration files. YAML is designed to be simpler and more readable than JSON, while still being able to represent complex data structures.

---
**Key-Value Pairs**
YAML represents data as key-value pairs, separated by a colon and a space (:).
Keys must be unique at the same level of nesting.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_1.png" width="400px" height="auto">

---
**Indentation**
YAML uses indentation to denote structure (e.g., nesting of objects or arrays).
Indentation must be consistent (use spaces, not tabs).
The standard recommendation is two spaces per level.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_2.png" width="400px" height="auto">



---
**Arrays**
Arrays are represented using a hyphen and space (-) at the beginning of each element.
Elements can be inline or multiline.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_3.png" width="400px" height="auto">


---
**Strings**
Strings do not need quotes unless they include special characters, line breaks, or start with reserved YAML characters ({, }, [ ], :).
Double quotes (") or single quotes (') can be used.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_4.png" width="400px" height="auto">

---
**Multiline Strings**
Use | for literal block style (preserves newlines) or > for folded block style (folds newlines into spaces).

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_5.png" width="400px" height="auto">

---
**Comments**
Comments start with # and can appear anywhere in the document.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_6.png" width="400px" height="auto">

---
**Booleans, Numbers, and Null**
Booleans: Use true/false or yes/no (case-insensitive).
Numbers: Supports integers, floats, and scientific notation.
Null values: Use null, ~, or leave blank after the colon.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_7.png" width="400px" height="auto">

---
**Anchors and Aliases**
Anchors (&) and aliases (*) allow reuse of values or structures.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_8.png" width="400px" height="auto">

---
**Reserved Characters**
Special characters (: { } [ ]) must be enclosed in quotes if used in keys or values.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/yaml/yaml_example_9.png" width="400px" height="auto">
