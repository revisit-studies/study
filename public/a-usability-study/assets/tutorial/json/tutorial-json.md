## JSON tutorial
### **Syntax Rules**

---
**Elements**
- **Objects**: 
Objects are enclosed in {}.
- **Arrays**: 
Arrays are enclosed in [].
- **Keys**: 
Keys must be strings enclosed in double quotes.
- **Values**: 
Values can be strings (in double quotes), numbers, booleans, arrays, objects, or null.
- **Key-Value Pairs**: 
Key-value pairs and array elements are separated by ",".

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/json/json_example_1.png" width="400px" height="auto">

---

**No comments**: No comments allowed in a json file.

######   <u>Correct Format Example</u>
   <img src="./assets/tutorial/json/json_example_2.png" width="400px" height="auto">

######   <u>Wrong Format Example</u>
   <img src="./assets/tutorial/json/json_example_3.png" width="400px" height="auto">

---

**No trailing comma**：
In an object, key-value pairs within an object must be separated by commas, but there should be no trailing comma after the last key-value pair. 

######   <u>Correct Format Example</u>
   <img src="./assets/tutorial/json/json_example_4.png" width="400px" height="auto">

######   <u>Wrong Format Example</u>
   <img src="./assets/tutorial/json/json_example_5.png" width="400px" height="auto">

In an array, elements in an array must be separated by commas, but there should be no trailing comma after the last element. 

######   <u>Correct Format Example</u>
   <img src="./assets/tutorial/json/json_example_6.png" width="400px" height="auto">

######   <u>Wrong Format Example</u>
   <img src="./assets/tutorial/json/json_example_7.png" width="400px" height="auto">

---

**Numeric values**:
  - Supports integers and decimals, such as 42 or 3.14.
  - Supports positive and negative numbers. Negative numbers use a minus sign (-), while positive numbers do not require a plus sign (+).
  - Leading zeros are not allowed except for the number 0. For example, 0123 is invalid.
  - Does not support special values like NaN, Infinity, or -Infinity. It is recommended to use null to represent non-numeric values.

######   <u>Correct Format Example</u>
   <img src="./assets/tutorial/json/json_example_8.png" width="400px" height="auto">

######   <u>Wrong Format Example</u>
   <img src="./assets/tutorial/json/json_example_9.png" width="400px" height="auto">


---

**Strings**:
  - Be enclosed in double quotes (single quotes are invalid).
  - Support Unicode characters for text representation in any language.
  - Allow escape characters like \", \\, \n, and \t for special formatting.
  - Not contain direct line breaks, which must be represented using \n.

######   <u>Correct Format Example</u>
   <img src="./assets/tutorial/json/json_example_10.png" width="400px" height="auto">

######   <u>Wrong Format Example</u>
   <img src="./assets/tutorial/json/json_example_11.png" width="400px" height="auto">



