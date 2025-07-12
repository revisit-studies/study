# Styling Demo Study

Welcome to the study. This study demonstrates the styling capabilities that allow study designers to customize the appearance of their research studies. To learn more about styling, please visit our [documentation](https://revisit.dev/docs/introduction/).

## Styling Capabilities

### 1. External Stylesheets (`stylesheetPath`)
Load custom CSS files for comprehensive styling across components:

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
    "textAlign": "center"
  }
}
```

## Technical Implementation

**UIConfig Interface:**
```ts
export interface UIConfig {
  stylesheetPath?: string;
}
```

**BaseIndividualComponent Interface:**
```ts
export interface BaseIndividualComponent {
  stylesheetPath?: string;
  style?: React.CSSProperties;
}
```

**BaseResponse Interface:**
```ts
export interface BaseResponse {
  stylesheetPath?: string;
  style?: React.CSSProperties;
}
```

**UI Elements:** Progress bars, sidebars, logos, contact information, help text, and global stylesheets.

**Component Types:** Markdown, Images, Videos, React Components, Vega visualizations, Websites/iframes, and Questionnaires.

**Response Types:** Text inputs, dropdowns, radio buttons, checkboxes, sliders, Likert scales, and matrix questions.