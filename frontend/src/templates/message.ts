export function renderWhatsAppMessage(
  templateMessage: string,
  leadName: string,
  senderName: string,
  senderMobile: string | null,
) {
  const body = templateMessage.replace(/\{name\}/gi, leadName).trim()
  const name = senderName.trim()
  const signature = senderMobile ? `${name}\n${senderMobile}` : name
  return body ? `${body}\n\n${signature}` : signature
}
