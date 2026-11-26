export function renderWhatsAppMessage(templateMessage: string, leadName: string) {
  return templateMessage.replace(/\{name\}/gi, leadName).trim()
}
