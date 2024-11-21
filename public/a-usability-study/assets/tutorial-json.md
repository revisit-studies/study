## JSON 
**Syntax Rules**

1. **Objects**: Objects are enclosed in {}.
2. **Arrays**: Arrays are enclosed in [].
3. **Keys**: Keys must be strings enclosed in double quotes.
4. **Values**: Values can be strings (in double quotes), numbers, booleans, arrays, objects, or null.
5. **Key-Value Pairs**: Key-value pairs and array elements are separated by ,.
6. **No comments**: No comments allowed.
7. **No trailing comma**：
- In an object (Object): Key-value pairs within an object must be separated by commas, but there should be no trailing comma after the last key-value pair. For example:
  - Correct: {"name": "John", "age": 30}
  - Incorrect: {"name": "John", "age": 30,}
- In an array (Array): Elements in an array must be separated by commas, but there should be no trailing comma after the last element. For example:
  - Correct: [1, 2, 3]
  - Incorrect: [1, 2, 3,]
8. **Numeric values**:
  - Supports integers and decimals, such as 42 or 3.14.
  - Supports positive and negative numbers. Negative numbers use a minus sign (-), while positive numbers do not require a plus sign (+).
  - Leading zeros are not allowed except for the number 0. For example, 0123 is invalid.
  - Does not support special values like NaN, Infinity, or -Infinity. It is recommended to use null to represent non-numeric values.
9. **Strings**:
  - Be enclosed in double quotes (single quotes are invalid).
  - Support Unicode characters for text representation in any language.
  - Allow escape characters like \", \\, \n, and \t for special formatting.
  - Not contain direct line breaks, which must be represented using \n.

  **Example**
<img src="./assets/json_example.png" width="auto" height="200px">


