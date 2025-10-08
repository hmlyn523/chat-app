import { useRouter } from 'next/router';
import Link from 'next/link';

interface FooterProps {
  pathname: string;
  // isLoading を削除: New Chat を常に有効に
}

export default function Footer({ pathname }: FooterProps) {
  const router = useRouter();
  const isNewChatActive = pathname === '/new-chat';
  const isHomeActive = pathname === '/';
  const isFriendsActive = pathname === '/friends';

  const handleNewChat = () => router.push('/new-chat');

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-0 flex flex-row justify-around items-center space-x-2 z-10">
      <button
        className={`flex flex-col items-center justify-center transition-colors flex-1 py-2 ${
          isNewChatActive ? 'text-blue-500' : 'text-gray-700 hover:text-gray-900'
        }`}
        onClick={handleNewChat}
        aria-label="チャット作成"
      >
        <span className="text-2xl mb-1">💬</span>
        <span className="text-xs">チャット作成</span>
      </button>
      <Link
        href="/"
        className={`flex flex-col items-center justify-center transition-colors flex-1 py-2 ${
          isHomeActive ? 'text-blue-500' : 'text-gray-700 hover:text-gray-900'
        }`}
        aria-label="チャット一覧"
      >
        <span className="text-2xl mb-1">🏠</span>
        <span className="text-xs">チャット一覧</span>
      </Link>
      <Link
        href="/friends"
        className={`flex flex-col items-center justify-center transition-colors flex-1 py-2 ${
          isFriendsActive ? 'text-blue-500' : 'text-gray-700 hover:text-gray-900'
        }`}
        aria-label="友達一覧"
      >
        <span className="text-2xl mb-1">👥</span>
        <span className="text-xs">友達一覧</span>
      </Link>
    </div>
  );
}
