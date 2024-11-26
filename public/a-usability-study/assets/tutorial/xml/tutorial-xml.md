## XML tutorial
### **Syntax Rules**

---

XML (Extensible Markup Language) is a markup language designed to store and transport data in a structured and hierarchical format. It is widely used in web development, data exchange, and configuration files due to its flexibility and readability.


---
Key Features of XML
- Tags and Elements: XML uses tags to define data and organize it hierarchically.
- Attributes: Additional metadata can be provided for elements using attributes.
- Self-Descriptive: XML allows you to create custom tags to suit your data needs.
- Cross-Platform: XML is both human-readable and machine-readable, making it ideal for data exchange.


Basic Syntax Rules
- Root Element: An XML document must have a single root element that contains all other elements.
- Opening and Closing Tags: Tags must be properly opened and closed.
Case Sensitivity: XML is case-sensitive.
- Well-Formed Structure: Elements must be properly nested and follow a hierarchical structure.
- Attributes: Attribute values must always be enclosed in double or single quotes.
Comments: XML supports comments, which start with <!-- and end with -->.

Basic XML Structure：
###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_1.png" width="400px" height="auto">

---
**Tags and Elements**
Tags define the structure of an XML document. Each element has an opening tag <tag> and a closing tag </tag>.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_2.png" width="400px" height="auto">


---
**Root Element**
Every XML document must have a single root element that contains all other elements.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_3.png" width="400px" height="auto">

---
**Attributes**
Attributes provide metadata for elements and must be enclosed in quotes

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_4.png" width="400px" height="auto">

---
**Self-Closing Tags**
Empty elements can be self-closed using />.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_5.png" width="400px" height="auto">

---
**Comments**
Comments in XML are enclosed within <!-- and -->.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_6.png" width="400px" height="auto">

---
**Nesting and Hierarchy**
Elements must be properly nested and follow a hierarchical structure.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_7.png" width="400px" height="auto">

###### <u>Wrong Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_8.png" width="400px" height="auto">


---
**Prolog**
The prolog declares the XML version and encoding.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_9.png" width="400px" height="auto">

---
**CDATA Sections**
CDATA is used to include raw text that should not be parsed as XML.

###### <u>Correct Format Example</u> 
   <img src="./assets/tutorial/xml/xml_example_10.png" width="400px" height="auto">


