## CSV tutorial
### **Syntax Rules**


**Structure**  
   CSV files organize data into rows and columns, where each row typically represents a record, and each value within a row is separated by a comma. Below is an example of the correct format:

   **Correct Format Example** 
   <img src="./assets/tutorial/csv/csv_example_1.png" width="300px" height="auto">



**Line Breaks**: Each row of data ends with a line break (\n or \r\n). Typically, you only need to press the "Return" key on your keyboard to insert a line break. However, the following example demonstrates an incorrect format:

   **Wrong Format Example** 
<img src="./assets/tutorial/csv/csv_example_2.png" width="300px" height="auto">

**Quoting and Escape Character**: If a field contains special characters (such as commas, line breaks, or quotes), it should be enclosed in double quotes. Double quotes within a field are escaped by using two double quotes. See the example below:

   **Correct Format Example** 
   <img src="./assets/tutorial/csv/csv_example_3.png" width="300px" height="auto">


**Empty Values**: Empty fields are represented by omitting content between separators. See the example below:

   **Correct Format Example** 
   <img src="./assets/tutorial/csv/csv_example_4.png" width="300px" height="auto">


**Data Types**: The CSV format does not explicitly distinguish between data types. All content is stored as text, and data types are typically inferred by the tool reading the CSV file during import or parsing. Common data types, such as integers, floating-point numbers, and boolean values, may be automatically recognized by some tools, but there is no enforced data type rule in the CSV itself. For example:
   - `123` may be interpreted as an integer.
   - `"456"` would be interpreted as a string.
   - `78.9` might be recognized as a floating-point number.
   - Boolean values like `true` / `false` may also be automatically parsed as booleans.

See the example below:

   **Correct Format Example** 
   <img src="./assets/tutorial/csv/csv_example_5.png" width="300px" height="auto">



