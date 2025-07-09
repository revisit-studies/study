# Styling Demo Study

Welcome to the study. This study demonstrates the styling capabilities that allow study designers to customize the appearance of their research studies. To learn more about styling, please visit our [documentation](https://revisit.dev/docs/introduction/).

## Two Ways to Style Your Study

### 1. External Stylesheets (`stylesheetPath`)
Load custom CSS files to apply comprehensive styling across multiple components:
```json
{
  "stylesheetPath": "my-study/assets/styles.css"
}
```

### 2. Inline Styles (`style`)
Apply specific styling directly to individual components or responses:
```json
{
  "style": {
    "width": "600px",
    "fontSize": "18px",
    "textAlign": "center"
  }
}
```

## What Can Be Styled

**Component Types:** All major component types support styling including Markdown, Images, Videos, React Components, Vega visualizations, Websites/iframes, and Questionnaires.

**Response Types:** All response types can be styled including text inputs, dropdowns, radio buttons, checkboxes, sliders, Likert scales, and matrix questions.

**Supported Properties:** width, height, fontSize, fontWeight, textAlign, color, backgroundColor, margin, and padding.