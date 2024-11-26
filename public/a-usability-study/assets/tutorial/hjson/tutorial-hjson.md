
## HJSON tutorial
### **Syntax Rules**

---

HJSON (Human JSON) is a JSON variant designed to make JSON files more human-friendly and easier to edit. It relaxes some of JSON's strict syntax rules and introduces features to improve readability, such as comments, simplified syntax, and better support for configuration files.

---

**Comments**
HJSON supports both single-line (//) and multi-line (/* */) comments.
Comments can appear anywhere in the document.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/hjson/hjson_example_1.png" width="400px" height="auto">

---

**Keys Without Quotes**
Key names can be unquoted if they are valid JavaScript identifiers (letters, digits, _, $).
Keys can still be quoted if needed.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/hjson/hjson_example_2.png" width="400px" height="auto">


---

**Multi-Line Strings**
Multi-line strings can use triple quotes (''' or """) for easier editing.
No need for \n in multi-line strings.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/hjson/hjson_example_3.png" width="400px" height="auto">

---

**Flexible Commas**
Trailing commas are optional after the last key-value pair or array element.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/hjson/hjson_example_4.png" width="400px" height="auto">

---

**Bare Values**
HJSON allows bare values like booleans, numbers, and null without requiring them to be in quotes.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/hjson/hjson_example_5.png" width="400px" height="auto">

---

**Arrays can have a simplified format**
Elements can be written on separate lines without commas.
Commas are optional.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/hjson/hjson_example_6.png" width="400px" height="auto">

