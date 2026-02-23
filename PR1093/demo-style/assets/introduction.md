# Styling Demo Study

Welcome to the study. This study demonstrates the styling capabilities that allow study designers to customize the appearance of their research studies.

To learn more about styling, please visit our [documentation](https://revisit.dev/docs/designing-studies/applying-style).

## Styling Capabilities

### 1. External Stylesheets (`stylesheetPath`)
Load custom CSS files for comprehensive styling:

```ts
"uiConfig": {
 "stylesheetPath": "my-study/assets/styles.css"
}
```

### 2. Inline Styles (`style`)
Apply specific styling directly to components or responses:

```ts
{
 "style": {
 "width": "600px",
 "fontSize": "18px",
 }
}
```

**UI Elements:** Progress bar, sidebar, logo, background color, etc.

**Component Types:** Markdown, Images, Videos, React Components, Vega visualizations, Websites, and Questionnaires.

**Response Types:** Text inputs, dropdowns, radio buttons, checkboxes, sliders, Likert scales, and matrix responses.

## Relevant files:
 * [The Config](https://github.com/revisit-studies/study/blob/main/public/demo-style/config.json)
 * [componentStylesheet.md](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/componentStylesheet.md)
 * [markdownComponent.md](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/markdownComponent.md)
 * [responseStylesheet.md](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/responseStylesheet.md)
 * [style/componentStylesheet.css](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/style/componentStylesheet.css)
 * [style/form.css](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/style/form.css)
 * [style/largeText.css](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/style/largeText.css)
 * [style/layout.css](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/style/layout.css)
 * [style/responseStylesheet.css](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/style/responseStylesheet.css)
 * [style/uiStylesheet.css](https://github.com/revisit-studies/study/blob/main/public/demo-style/assets/style/uiStylesheet.css)

## Relevant documentation:

 * [Applying Styles](https://revisit.dev/docs/designing-studies/applying-style/)
