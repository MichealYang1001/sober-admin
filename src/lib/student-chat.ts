import type { StudentChatMessage, StudentConversationEntry } from '@/lib/types'

function isChatMessage(entry: StudentConversationEntry): entry is StudentChatMessage {
  return 'sender' in entry
}

export function normalizeStudentChatMessages(entries?: StudentConversationEntry[] | null): StudentChatMessage[] {
  return (entries || []).flatMap<StudentChatMessage>((entry) => {
    if (isChatMessage(entry)) {
      return [{
        id: entry.id,
        sender: entry.sender,
        content: entry.content || '',
        attachments: entry.attachments || [],
        sort_order: entry.sort_order,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
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
