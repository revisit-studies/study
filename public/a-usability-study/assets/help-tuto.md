# Tutorial
In this tutorial, you will learn some basic syntax rules of the following data serialization formats:

JSON, JSONC, JSON5, HJSON, YAML, TOML, XML, CSV

<br><br>

## CSV 
**Syntax Rules**
1. **Structure**: CSV files organize data in rows and columns, where each row typically represents a record, and each value in a row is separated by a comma.
2. **Field Separator**: Fields within each row are usually separated by commas (`,`). In some cases, other delimiters (like semicolons) may be used.
3. **Line Breaks**: Each row of data ends with a line break (`\n` or `\r\n`).
4. **Quoting**: If a field contains special characters (such as commas, line breaks, or quotes), it should be enclosed in double quotes (e.g., `"value with, comma"`).
5. **Escape Character**: Double quotes within a field are escaped by using two double quotes (e.g., `She said, ""Hello!""`).
6. **Empty Values**: Empty fields are represented by omitting content between separators (e.g., `value1,,value3`).
7. **Data Types**: The CSV format does not explicitly distinguish between data types. All content is stored as text, and data types are typically inferred by the tool reading the CSV file during import or parsing. Common data types, such as integers, floating-point numbers, and boolean values, may be automatically recognized by some tools, but there is no enforced data type rule in the CSV itself. For example:
   - `123` may be interpreted as an integer.
   - `"456"` would be interpreted as a string.
   - `78.9` might be recognized as a floating-point number.
   - Boolean values like `true` / `false` may also be automatically parsed as booleans.

<br><br>

**Example**
<img src="./assets/csv_example.png" width="auto" height="100px">


<br><br>

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

<br><br>

  **Example**
<img src="./assets/json_example.png" width="auto" height="200px">