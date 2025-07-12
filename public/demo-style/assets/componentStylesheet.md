## Component Stylesheet Demonstration

This markdown component demonstrates how external CSS can be applied to customize the appearance of components in reVISit studies.
This component uses the `stylesheetPath` property to load external CSS from `demo-style/assets/componentStylesheet.css`. The CSS file contains custom styling rules that enhance the visual presentation of this content.
This markdown component uses the following configuration:

The component is configured as follows. Every component has a `type` that becomes the `id` attribute of its wrapping `<div>`. For example, this markdown component renders inside `<div id="markdown">`.

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
  background: lightblue;
  border: 1px solid black;
  padding: 10px;
  border-radius: 10px;
  margin: 10px;
}

#markdown code {
  color: navy;
}
```
