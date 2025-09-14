import { useEffect, useState } from 'react';
import {
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from '../lib/services/friendService';
import { supabase } from '../lib/supabaseClient';

export default function FriendRequestList({ currentUserId }: { currentUserId: string }) {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await getFriendRequests(currentUserId);
      setRequests(
        data?.filter((r) => r.receiver_id === currentUserId && r.status === 'pending') || []
      );
    };
    load();
  }, [currentUserId]);

  const handleAccept = async (id: string) => {
    await acceptFriendRequest(id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    alert('友だちになりました！');
  };

  const handleReject = async (id: string) => {
    await rejectFriendRequest(id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div>
      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">There are no new applications.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between border p-3 rounded shadow-sm bg-white"
            >
              <span className="text-sm">{r.sender?.nickname || r.sender_id}</span>
              <div className="flex space-x-2">
                <button
                  className="text-xs bg-gray-500 text-white px-3 py-1 rounded"
                  onClick={() => handleAccept(r.id)}
                >
                  Approval
                </button>
                <button
                  className="text-xs bg-gray-500 text-white px-3 py-1 rounded"
                  onClick={() => handleReject(r.id)}
                >
                  Refusal
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
