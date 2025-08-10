import { useRef, useEffect, useCallback } from "react"

export function useSafeScroll() {
  const endRef = useRef<HTMLDivElement | null>(null)

  // スクロール関数
  const scrollToBottom = useCallback(() => {
    // 高さ変化が起きても確実に最後までスクロール
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
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
