## Component Stylesheet Demonstration

This markdown component demonstrates how external CSS can be applied to customize the appearance of components in reVISit studies.
This component uses the `stylesheetPath` property to load external CSS from `demo-style/assets/componentStylesheet.css`. The CSS file contains custom styling rules that enhance the visual presentation of this content.

You can select the component by its type using a class selector, or by its name using an ID selector.

This markdown component uses the following configuration:

#### `config.json`
```ts
"markdown-styling": {
  "type": "markdown",
  "path": "demo-style/assets/componentStylesheet.md",
  "stylesheetPath": "demo-style/assets/style/ componentStylesheet.css",
  "response": []
},
```

#### `componentStylesheet.md`
```css
.markdown {
  background-color: #f1f1f1;
  padding: 30px;
  border-radius: 10px;
}
#markdown-styling h2 {
  font-family: "Gill Sans", sans-serif;
  font-weight: 700;
  text-align: center;
}
#markdown-styling code {
  color: #0079cd;
}
```