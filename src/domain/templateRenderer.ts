export type TemplateValues = Record<string, string | number | null | undefined>;

export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

export function unresolvedPlaceholders(template: string): string[] {
  return [...template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

