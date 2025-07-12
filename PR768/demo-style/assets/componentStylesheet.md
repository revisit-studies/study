# Component Stylesheet Demonstration

This markdown component demonstrates how external CSS can be applied to customize the appearance of components in reVISit studies.
This component uses the `stylesheetPath` property to load external CSS from `demo-style/assets/componentStylesheet.css`. The CSS file contains custom styling rules that enhance the visual presentation of this content.
This markdown component uses the following configuration:

```ts
{
  "type": "markdown",
  "path": "demo-style/assets/componentStylesheet.md",
  "stylesheetPath": "demo-style/assets/componentStylesheet.css",
  "instruction": "This is a markdown component using external CSS (stylesheetPath).",
  "instructionLocation": "aboveStimulus"
}
```
```css
.markdown-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

```
