const PREFIX = '/';
const fetchedStylesheets = new Set<string>();

export function fetchStylesheet(stylesheetPath: string): void {
  const url = `${PREFIX}${stylesheetPath}`;

  const link = document.createElement('link');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  link.href = url;

  link.onload = () => {
    fetchedStylesheets.add(stylesheetPath);
  };

  document.head.appendChild(link);
}
