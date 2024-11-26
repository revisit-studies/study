## JSON5 tutorial
### **Syntax Rules**

---
Like JSONC, JSON5 is another variant of JSON that aims to enhance the readability and usability of JSON. The main differences between its syntax rules and those of JSON are as follows:

---

**Comments**
JSON5 supports single-line (//) and multi-line (/* */) comments.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json5/json5_example_1.png" width="400px" height="auto">


---

**Keys Without Quotes**
Key names can be unquoted if they are valid JavaScript identifiers.
Keys can still be enclosed in double quotes for compatibility.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json5/json5_example_2.png" width="400px" height="auto">

---

**Strings**
Strings can use single quotes (') or double quotes (").
Multi-line strings are supported using a backslash (\) as the line continuation character.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json5/json5_example_3.png" width="400px" height="auto">

---

**Numbers**
JSON5 supports:
- Leading decimal points (e.g., .5 instead of 0.5).
- Hexadecimal numbers (e.g., 0xFF).
- Special numeric values like Infinity and NaN.
- Optional + sign for positive numbers.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json5/json5_example_4.png" width="400px" height="auto">

---

**Trailing Commas and Whitespace**
Arrays and objects can have trailing commas after the last element or key-value pair.
The file can end with additional whitespace.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json5/json5_example_5.png" width="400px" height="auto">

---
**Unescaped Unicode Characters**
Unicode characters can appear directly in strings without requiring escape sequences (though escapes are still valid).

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json5/json5_example_6.png" width="400px" height="auto">