export const MESSAGE_TEMPLATE_VARIABLES = [
  "first_name",
  "last_name",
  "country",
  "status",
  "document_list",
  "appointment_date",
  "appointment_location",
  "remaining_fee",
  "portal_url",
  "company_name",
] as const;

export type MessageTemplateVariable = typeof MESSAGE_TEMPLATE_VARIABLES[number];
export type MessageTemplateContext = Record<MessageTemplateVariable, string>;

const VARIABLE_PATTERN = /{{\s*([a-z_]+)\s*}}/g;

export function renderMessageTemplate(
  template: string,
  context: Partial<MessageTemplateContext>,
) {
  return template.replace(VARIABLE_PATTERN, (match, variable: string) => {
    if (!MESSAGE_TEMPLATE_VARIABLES.includes(variable as MessageTemplateVariable)) return match;
    return context[variable as MessageTemplateVariable] ?? "";
  });
}

export function unknownMessageTemplateVariables(template: string) {
  const unknown = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    if (!MESSAGE_TEMPLATE_VARIABLES.includes(match[1] as MessageTemplateVariable)) {
      unknown.add(match[1]);
    }
  }
  return [...unknown];
}
