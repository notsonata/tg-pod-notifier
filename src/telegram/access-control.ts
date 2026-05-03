export function isAuthorizedGroupChat(
  chatId: number | string | undefined,
  authorizedChatId: number | string
): boolean {
  if (chatId === undefined || chatId === null) {
    return false;
  }

  return String(chatId) === String(authorizedChatId) && String(chatId).startsWith("-");
}
