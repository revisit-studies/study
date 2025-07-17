## Component Stylesheet Demonstration

This markdown component demonstrates how external CSS can be applied to customize the appearance of components in reVISit studies.
This component uses the `stylesheetPath` property to load external CSS from `demo-style/assets/componentStylesheet.css`. The CSS file contains custom styling rules that enhance the visual presentation of this content.
This markdown component uses the following configuration:

#### `config.json`
```ts
{
  "type": "markdown",
  "path": "demo-style/assets/componentStylesheet.md",
  "stylesheetPath": "demo-style/assets/componentStylesheet.css",
}
```

#### `componentStylesheet.md`
```css
#markdown {
  background: #e8f4f8;
  border: 2px solid #999;
  padding: 10px;
  border-radius: 10px;
  margin: 10px auto;
}
#markdown h2 {
  font-family: "Gill Sans", sans-serif;
  font-weight: 700;
}
#markdown code {
  color: #1a166c;
}
```
