// types/unreadCount.ts

export interface UnreadCount {
  chat_id: string;
  unread_count: number;
}

/**
 * 任意の値が UnreadCount[] かどうかを判定する型ガード
 */
export function isUnreadCountArray(data: unknown): data is UnreadCount[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as any).chat_id === 'string' &&
        typeof (item as any).unread_count === 'number'
    )
  );
}
