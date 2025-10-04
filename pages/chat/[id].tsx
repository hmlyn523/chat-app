import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from 'lib/supabaseClient';
import { useRef } from 'react';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import 'dayjs/locale/ja';
import { onMessageListener } from '@/lib/firebase-messaging';

import { fetchMessagesAndMarkRead, fetchMembers, fetchUsers } from 'lib/services/userService';
import { useSafeScroll } from 'lib/hooks/safeScrollToBottom';

dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.locale('ja');

export default function ChatRoom() {
  const router = useRouter();

  // router.query.id: URLの chat/[id] に対応するチャットIDを取得

  // URLの /chat/[id]の 'id' を取得
  const chatIdRaw = router.query.id;
  const chatId = Array.isArray(chatIdRaw) ? chatIdRaw[0] : chatIdRaw;

  // useState: 状態を管理。チャット、入力、参加者などを保存

  const [messages, setMessages] = useState<any[]>([]); // チャットメッセージ一覧
  const [input, setInput] = useState(''); // 入力中のメッセージ
  const [members, setMembers] = useState<any[]>([]); // 参加メンバー一覧
  const [allUsers, setAllUsers] = useState<any[]>([]); // 全ユーザー（招待用）

  // useRef: DOM要素（スクロール位置）や変数（ユーザーID）の最新値の保持に使用

  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // 自分のユーザーID
  const currentUserIdRef = useRef<string | null>(null); // 常に最新のユーザーIDを保持
  const inputRef = useRef<HTMLInputElement>(null); // ★この行を追加★

  // 初回のみフラグ
  const didInitialScrollRef = useRef(false);

  const isAtBottomRef = useRef(true);

  const { endRef, scrollToBottom } = useSafeScroll();

  const [isActive, setIsActive] = useState(true);

  // const forceScrollToBottom = () => {
  //   const container = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
  //   if (container) {
  //     container.scrollTop = container.scrollHeight;
  //   }
  // };

  // 既読登録用関数（渡されたメッセージIDの配列を既読登録）
  const markMessagesAsRead = async (messageIds: string[], userId: string) => {
    if (messageIds.length === 0) return;

    const inserts = messageIds.map((messageId) => ({
      message_id: messageId,
      user_id: userId,
    }));

    // 重複があるとinsert失敗するので upsert を使う
    const { error } = await supabase.from('message_reads').upsert(inserts, {
      onConflict: 'message_id,user_id',
    });

    if (error) {
      console.error('既読登録失敗:', error);
    }
  };

  // 画像アップロード処理
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    const { data: userResponse } = await supabase.auth.getUser();
    const user = userResponse.user;
    if (!user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${user.id}.${fileExt}`;
      const filePath = `${chatId}/${fileName}`;

      // 1. ファイルをアップロード
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file);

      if (uploadError) {
        alert('Image upload failed.');
        return;
      }

      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(filePath);

      const imageUrl = urlData?.publicUrl;
      if (!imageUrl) return;

      // 2. メッセージをDBに保存
      const { error: insertError } = await supabase
        .from('messages')
        .insert([{ chat_id: chatId, user_id: user.id, image_url: imageUrl }]);

      if (insertError) {
        alert('Failed to send message with image.');
        return;
      }

      // 3. 送信者の情報を取得（通知用）
      const { data: senderData } = await supabase
        .from('users')
        .select(
          `
                    email,
                    user_profiles ( nickname )
                `
        )
        .eq('id', user.id)
        .single();

      const senderName =
        (senderData?.user_profiles as unknown as { nickname: string })?.nickname ?? null;

      // 4. チャット参加者の中から自分以外のユーザーにプッシュ通知を送信
      const otherMembers = members.filter((member) => member.user_profiles.user_id !== user.id);

      const pushPromises = otherMembers.map(async (member) => {
        try {
          const response = await fetch('/api/sendPush', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: member.user_id,
              title: senderName,
              body: '📷 画像を送信しました',
              chatId: chatId,
              data: {
                senderId: user.id,
              },
            }),
          });

          if (!response.ok) {
            console.error(`Failed to send push to ${member.user_id}:`, await response.text());
          }
        } catch (pushError) {
          console.error(`Error sending push to ${member.user_id}:`, pushError);
        }
      });

      await Promise.allSettled(pushPromises);

      didInitialScrollRef.current = false;
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      alert('画像の送信に失敗しました。');
    }
  }

  // メッセージ一覧取得＋リアルタイム購読
  //   useEffect は、React のフックの一つで、コンポーネントのレンダリング後に副作用
  //   （データの取得、DOMの操作、タイマーなど）を実行するために使用される
  useEffect(() => {
    // チャットIDチェック
    //   URLから取得した chatId がまだ undefined のときは処理を止める
    //   これは Next.js の router.query が初期は undefined になることがあるため
    if (!chatId) return;

    // Service Worker が現在のチャットIDを知っていれば、
    // 通知が来たときに「このチャットをすでに開いているから通知不要」と判断できる。
    // そこで、今開いているチャットのIDを Service Worker に渡す。
    // if (navigator.serviceWorker.controller) {
    //   // Service Worker にメッセージを送る
    //   navigator.serviceWorker.controller.postMessage({
    //     type: 'ACTIVE_CHAT', // メッセージの種類を識別するためのキー
    //     chatId: chatId, // 現在開いているチャット画面のID
    //   });
    // }
    navigator.serviceWorker.ready.then((registration) => {
      // if (registration.active) {
      // alert('Service Worker に chatId を送ります: ' + chatId);
      registration.active?.postMessage({
        type: 'ACTIVE_CHAT',
        chatId,
      });
      // }
    });

    if (messages.length > 0 && !didInitialScrollRef.current) {
      setTimeout(() => {
        scrollToBottom();
        didInitialScrollRef.current = true;
      }, 100);
    }

    // 現在のユーザーIDの同期
    //   urrentUserId は React の状態管理なので非同期レンダリングでタイミングがズレる可能性がある
    //   そのため、常に最新の値を useRef で保持し、リアルタイム処理内でも使えるようにしている
    if (currentUserId !== null) {
      currentUserIdRef.current = currentUserId;
    }

    fetchMessagesAndMarkRead(chatId, setMessages, setCurrentUserId);
    fetchMembers(chatId).then(setMembers).catch(console.error);
    fetchUsers().then(setAllUsers).catch(console.error);

    // リアルタイム購読
    const messageChannel = supabase
      // Supabaseの realtime 機能で messages テーブルに新しい行（INSERT）が
      // 追加されたときに発火する
      .channel('public:messages')
      // チャットIDでフィルターされているので、自分がいるルームのメッセージのみが対象
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const newMessage = payload.new;

          // emailを取得してスクロール制御
          // user_id → email を再取得: メッセージには user_id しか入ってないので表示名にするために email を取得
          // setMessages: 受信メッセージ一覧に新しいメッセージを追加
          // scrollToBottom():	自分の投稿だったら下まで自動スクロールする
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select(
              `
                            email,
                            user_profiles ( nickname )
                        `
            )
            .eq('id', newMessage.user_id)
            .single();

          if (userError) {
            console.error('ユーザー情報取得失敗:', userError.message);
          }

          const nickname =
            (userData?.user_profiles as unknown as { nickname: string })?.nickname ?? null;

          const shouldScroll =
            newMessage.user_id === currentUserIdRef.current || isAtBottomRef.current;

          // setMessages: 受信メッセージ一覧に新しいメッセージを追加
          setMessages((current) => {
            const updated = [
              ...current,
              {
                ...newMessage,
                users: {
                  email: userData?.email,
                  user_profiles: {
                    nickname: nickname ?? null,
                  },
                },
              },
            ];

            if (shouldScroll) {
              // 自分のメッセージ or 画面下にいるときだけスクロール
              requestAnimationFrame(() => {
                scrollToBottom();
              });
            }

            // 自分の投稿ならスクロール
            if (
              newMessage.user_id === currentUserId ||
              newMessage.user_id === currentUserIdRef.current
            ) {
              setTimeout(() => scrollToBottom(), 100);
            }

            return updated;
          });

          const currentUserId = currentUserIdRef.current;
          if (
            currentUserId &&
            newMessage.user_id !== currentUserId &&
            isAtBottomRef.current &&
            isActive
          ) {
            await markMessagesAsRead([newMessage.id], currentUserId);
          }
        }
      )
      .subscribe();

    // alter publication supabase_realtime add table public.message_reads;
    const readsChannel = supabase
      // Supabaseの realtime 機能で message_reads テーブルに新しい行（INSERT）が
      // 追加されたときに発火する
      .channel('public:message_reads')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        async (payload) => {
          const read = payload.new;

          // read.message_id に対して該当する message を更新
          setMessages((current) => {
            return current.map((msg) => {
              if (msg.id === read.message_id) {
                const alreadyExists = msg.message_reads?.some(
                  (r: any) => r.user_id === read.user_id
                );
                if (!alreadyExists) {
                  return {
                    ...msg,
                    message_reads: [...(msg.message_reads || []), { user_id: read.user_id }],
                  };
                }
              }
              return msg;
            });
          });
        }
      )
      .subscribe();

    // 購読解除
    // コンポーネントがアンマウントされた時（例：チャットを抜けたとき）に、リアルタイム購読を解除
    // これにより、メモリリークや不要なリアルタイム更新を防ぐ
    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(readsChannel);
    };
  }, [chatId, isActive]);

  // messagesが更新されるたびに実行される。
  // 初回スクロール処理や、スクロール位置によって未読メッセージを既読にする処理を行う。
  // --
  // 前回のmessagesの値と今回のmessagesの値が違うとき
  // かつ、再レンダリング後（DOMの更新が終わったあと）
  useEffect(() => {
    const container = document.querySelector('.flex-1.overflow-y-auto') as HTMLElement;
    if (!container) return;

    if (messages.length > 0 && !didInitialScrollRef.current) {
      // レンダリング完了後のタイミングでスクロール（DOM準備が確実になる）
      requestAnimationFrame(() => {
        scrollToBottom();
        didInitialScrollRef.current = true;
      });
    }

    const handleScroll = () => {
      const sum = container.scrollHeight - container.scrollTop - container.clientHeight;
      // console.log(
      //   'スクロール位置:',
      //   sum,
      //   '高さ:',
      //   container.scrollHeight,
      //   'クライアント高さ:',
      //   container.clientHeight,
      //   'ddd',
      //   container.scrollTop
      // );
      const isAtBottom = sum < 20;

      isAtBottomRef.current = isAtBottom;

      // 👇 スクロールで下に着いたら未読メッセージを既読にする（オプション）
      if (isAtBottom && currentUserIdRef.current && messages.length > 0 && isActive) {
        const unreadMessageIds = messages
          .filter(
            (m) =>
              m.user_id !== currentUserIdRef.current &&
              !(m.message_reads || []).some((r: any) => r.user_id === currentUserIdRef.current)
          )
          .map((m) => m.id);

        if (unreadMessageIds.length > 0) {
          markMessagesAsRead(unreadMessageIds, currentUserIdRef.current);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages, scrollToBottom, isActive]);

  // 初回のみ呼ばれる
  useEffect(() => {
    // ユーザID設定
    const fetchUser = async () => {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse?.user;
      if (user) {
        setCurrentUserId(user.id);
        currentUserIdRef.current = user.id;
      }
    };

    fetchUser();
    scrollToBottom();
  }, []);

  // FCMのメッセージ受信リスナー登録
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handler = (payload: any) => {
        const msgChatId = payload.data?.chat_id; // sendPush.ts と揃える
        // const isVisible = document.visibilityState === 'visible';
        const isFrontTab = document.visibilityState === 'visible' && document.hasFocus();
        console.log('[FCM] メッセージ受信:', payload, 'アクティブ状態:', isFrontTab);

        // 同じチャットを開いていて、ページが表示中なら通知しない
        if (isFrontTab && msgChatId === chatId) {
          console.log('[FCM] 同じチャットなので通知スキップ:', msgChatId);
          return;
        }
        var body = '[id].tsxのFCM受信';
        // それ以外は通知を表示
        new Notification(payload.data?.title || '新着メッセージ', {
          // body: payload.data?.body || '',
          body: body,
          icon: '/icons/icon-192.png',
        });
      };

      onMessageListener(handler);
    }
  }, [chatId]);

  // // ★FCM メッセージ受信リスナー（現在のチャットなら通知を出さない）
  // useEffect(() => {
  //   if (typeof window === 'undefined') return;

  //   const messageHandler = (payload: any) => {
  //     const msgChatId = payload.data?.chatId;
  //     const isCurrentChat = window.location.pathname.includes(`/chat/${msgChatId}`);

  //     if (!isCurrentChat) {
  //       new Notification(payload.notification?.title || '新着メッセージ', {
  //         body: payload.notification?.body || '',
  //         icon: '/icons/icon-192.png',
  //       });
  //     }
  //   };

  //   onMessageListener(messageHandler);
  // }, []);

  // visibilitychange でアクティブ状態を更新
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // チャット画面 (chatIdが変わるたびに呼ぶ)
  useEffect(() => {
    if (navigator.serviceWorker.controller) {
      // alert('チャット画面が変わったので Service Worker に chatId を送ります: ' + chatId);
      navigator.serviceWorker.controller.postMessage({
        type: 'ACTIVE_CHAT',
        chatId,
      });
      console.log('Sent chatId to SW:', chatId);
    }
    return () => {
      // 画面離脱時は null を送る
      if (navigator.serviceWorker.controller) {
        // alert('チャット画面を離れたので Service Worker に null を送ります');
        navigator.serviceWorker.controller.postMessage({
          type: 'ACTIVE_CHAT',
          chatId: 'no-chat-id',
        });
      }
    };
  }, [chatId]);

  // // ★現在開いているチャットIDを Service Worker に送信
  // useEffect(() => {
  //   if (!chatId) return;

  //   if (navigator.serviceWorker.controller) {
  //     navigator.serviceWorker.controller.postMessage({
  //       type: 'ACTIVE_CHAT',
  //       chatId: chatId,
  //     });
  //   }
  // }, [chatId]);

  // メッセージ送信
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userResponse = await supabase.auth.getUser();
    const user = userResponse.data?.user;
    if (!user) return;

    try {
      // 1. メッセージをDBに保存
      const { error } = await supabase
        .from('messages')
        .insert([{ chat_id: chatId, user_id: user.id, content: input }]);

      if (error) {
        alert('Message sending failed.');
        return;
      }

      // 2. 送信者の情報を取得（通知用）
      const { data: senderData } = await supabase
        .from('users')
        .select(
          `
                    email,
                    user_profiles ( nickname )
                `
        )
        .eq('id', user.id)
        .single();
      setInput(''); // DBに書き込んだら入力欄をクリア

      const senderName =
        (senderData?.user_profiles as unknown as { nickname: string })?.nickname ?? null;

      // 3. チャット参加者の中から自分以外のユーザーにプッシュ通知を送信
      const otherMembers = members.filter((member) => member.user_profiles.user_id !== user.id);

      // 各メンバーに並行してプッシュ通知を送信
      const pushPromises = otherMembers.map(async (member) => {
        try {
          const response = await fetch('/api/sendPush', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: member.user_profiles.user_id,
              title: senderName,
              body: input.length > 50 ? input.substring(0, 50) + '...' : input,
              chatId: chatId, // 通知クリック時にこのチャットルームに遷移
              data: {
                senderId: user.id,
              },
            }),
          });

          if (!response.ok) {
            console.error(
              `Failed to send push to ${member.user_profiles.user_id}:`,
              await response.text()
            );
          } else {
            console.log(`Push notification sent to ${member.user_profiles.user_id}`);
          }
        } catch (pushError) {
          console.error(`Error sending push to ${member.user_profiles.user_id}:`, pushError);
        }
      });

      // プッシュ通知の結果を待つ（エラーがあっても続行）
      await Promise.allSettled(pushPromises);

      // 4. UI処理（従来通り）
      didInitialScrollRef.current = false;

      // メッセージが正常に送信された後、すぐにフォーカスを戻す
      // これにより、キーボードが閉じられずに次の入力を受け付けられる
      if (inputRef.current) {
        inputRef.current.focus();
      }

      // スクロール処理を次のフレームにずらす
      // フォーカスが戻った後、キーボードが完全に表示された状態でスクロール
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    } catch (error) {
      console.error('Error in sendMessage:', error);
      alert('メッセージの送信に失敗しました。');
    }
  };

  const unjoinedUsers = allUsers.filter(
    (u) => !members.find((m) => m.user_profiles.user_id === u.id)
  );

  return (
    <div
      className="pt-16 pb-16 flex flex-col overflow-hidden bg-gray-200"
      style={{ height: '100dvh' }}
    >
      {/* メッセージ一覧：スクロール対象 */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2 bg-gray-100"
        style={{ overflowY: 'auto' }}
      >
        {messages.map((msg, index) => {
          const isMine = msg.user_id === currentUserId;
          const name = msg.users?.user_profiles?.nickname ?? msg.users?.email ?? msg.user_id;
          const timeText = dayjs(msg.created_at).format('HH:mm');

          const readByUserIds = msg.message_reads?.map((r: any) => r.user_id) || [];
          const otherMembers = members.filter((m) => m.user_profiles.user_id !== currentUserId);
          const readCount = readByUserIds.filter((id: any) =>
            otherMembers.some((m) => m.user_profiles.user_id === id)
          ).length;
          const totalOtherMembers = otherMembers.length;

          const currentDate = dayjs(msg.created_at).format('YYYY-MM-DD');

          const prev = index > 0 ? messages[index - 1] : null;
          const prevDate = prev ? dayjs(prev.created_at).format('YYYY-MM-DD') : null;
          const showDate = currentDate !== prevDate;
          const showTime =
            !prev ||
            dayjs(msg.created_at).format('YYYY-MM-DD HH:mm') !==
              dayjs(prev.created_at).format('YYYY-MM-DD HH:mm');

          return (
            <div key={msg.id}>
              {/* ✅ 日付が変わったら中央に年月日（曜日）を表示 */}
              {showDate && (
                <div className="text-center text-xs text-gray-500 my-4">
                  {dayjs(msg.created_at).format('YYYY年M月D日（ddd）')}
                </div>
              )}
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[75%]">
                  {!isMine && <div className="text-xs text-gray-600 mb-1 ml-2">{name}</div>}
                  <div
                    className={`
                                        px-4 py-2 text-sm break-words
                                        ${
                                          isMine
                                            ? 'bg-sky-100 text-gray-800 rounded-2xl rounded-br-none border-2 border-black shadow-2xl'
                                            : 'bg-yellow-100 text-gray-800 rounded-2xl rounded-tl-none border-2 border-black shadow-2xl'
                                        }
                                        `}
                  >
                    {/* テキストがある場合は表示 */}
                    {msg.content && <p>{msg.content}</p>}

                    {/* 画像がある場合は表示 */}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="uploaded"
                        className="mt-2 rounded max-w-full h-auto max-h-40"
                      />
                    )}
                  </div>

                  {/* 追加: 時間表示 + 既読表示（自分の投稿のみ）を1行で */}
                  <div
                    className={`flex items-center text-[10px] mt-1 ${isMine ? 'justify-end text-gray-500' : 'justify-start text-gray-500 ml-2'}`}
                  >
                    <div>{timeText}</div>
                    {isMine && (
                      <div className="ml-2 text-gray-500">
                        {readCount === totalOtherMembers ? '既読' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* 固定フッター(入力欄 + 送信ボタン) */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-gray-200 border-t z-10 touch-none overscroll-contain">
        <div className="flex items-center gap-2">
          {/* 画像選択ボタン */}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="image-upload"
          />
          <label
            htmlFor="image-upload"
            className="bg-gray-200 text-white rounded-full px-2  hover:bg-gray-600"
          >
            📸
          </label>
          {/* 入力フォーム */}
          <input
            type="text"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            className="flex-1 border bg-gray-100 rounded-full px-4 py-2 focus:outline-none"
          />
          {/* 送信ボタン */}
          <input
            // type="button"
            tabIndex={-1}
            value="🖋️"
            onClick={sendMessage}
            className="bg-gray-300 text-white rounded-full px-4 py-2 cursor-pointer hover:bg-gray-400 w-12"
          />
        </div>
      </div>
    </div>
  );
}
