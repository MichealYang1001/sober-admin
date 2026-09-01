import type { StudentChatMessage, StudentConversationEntry } from '@/lib/types'

function isChatMessage(entry: StudentConversationEntry): entry is StudentChatMessage {
  return 'sender' in entry
}

export function normalizeStudentChatMessages(entries?: StudentConversationEntry[] | null): StudentChatMessage[] {
  return (entries || []).flatMap((entry) => {
    if (isChatMessage(entry)) {
      return [{
        sender: entry.sender,
        content: entry.content || '',
        attachments: entry.attachments || [],
      }]
    }

    return [
      {
        sender: 'student' as const,
        content: entry.question || '',
        attachments: entry.attachments || [],
      },
      {
        sender: 'teacher' as const,
        content: entry.answer || '',
        attachments: [],
      },
    ]
  })
}
