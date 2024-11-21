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

**Example**
<img src="./assets/csv_example.png" width="auto" height="100px">