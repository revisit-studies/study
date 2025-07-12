## Response Stylesheet Demonstration

This demonstration showcases how external CSS stylesheets can be integrated into reVISit studies to customize component appearance and enhance user experience. 

Each response has an `id` that you can use to target it in your stylesheet. For instance, this response renders inside `<div id="rate-styling">`.

#### `config.json`
```ts
{
  "type": "markdown",
  "path": "demo-style/assets/markdownComponent.md",
  "response": [
    {
      "id": "rate-styling",
      "stylesheetPath": "demo-style/assets/responseStylesheet.css"
    },
    {
      "id": "final-feedback",
      "stylesheetPath": "demo-style/assets/responseStylesheet.css"
    }
  ]
}
```

#### `responseStylesheet.md`
```css
#rate-styling {
  border: 1px solid black;
  padding: 10px;
  border-radius: 10px;
  margin: 10px;
}

#final-feedback {
  width: 80%;
  border: 1px solid black;
  padding: 10px;
  border-radius: 10px;
  margin: 10px;
}
```
