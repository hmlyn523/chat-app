import { useRef, useEffect, useCallback } from "react"

export function useSafeScroll() {
  const endRef = useRef<HTMLDivElement | null>(null)

  // スクロール関数
  const scrollToBottom = useCallback(() => {
    // 高さ変化が起きても確実に最後までスクロール
    requestAnimationFrame(() => {
      const container = endRef.current?.parentElement as HTMLElement
      if (container) {
        // スクロール可能な高さを計算
        const scrollableHeight = container.scrollHeight - container.clientHeight
        // キーボードの高さを考慮して、スクロール位置を調整する
        // キーボードの高さは動的に取得するのが難しいため、
        // 少なくともフッターの高さ分は表示されるように調整
        container.scrollTop = scrollableHeight
      }
    })
  }, [])

  // 画像やフォントが読み込まれた後にもスクロール
  useEffect(() => {
    const handleLoad = () => scrollToBottom()
    window.addEventListener("load", handleLoad)
    window.addEventListener("resize", handleLoad)
    return () => {
      window.removeEventListener("load", handleLoad)
      window.removeEventListener("resize", handleLoad)
    }
  }, [scrollToBottom])

  return { endRef, scrollToBottom }
}
