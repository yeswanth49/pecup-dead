'use client'

import { MessageCircle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

interface ChatBubbleProps {
  href: string
  external?: boolean
  className?: string
}

export default function ChatBubble({
  href,
  external = false,
  className = '',
}: ChatBubbleProps) {
  // base styling: 48×48, fixed to bottom‑right
  const bubbleClasses = `
    fixed bottom-4 right-4 z-50
    flex items-center justify-center
    w-12 h-12 rounded-full
    bg-primary text-white
    shadow-lg hover:bg-primary/90
    transition-colors
    ${className}
  `

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Chatbot"
        className={bubbleClasses}
      >
        <MessageCircle className="w-6 h-6" />
      </a>
    )
  }

  // in Next.js 13+ app-router Link supports passing className directly
  return (
    <Link
      href={href}
      aria-label="Open Chatbot"
      className={bubbleClasses}
    >
      <MessageCircle className="w-6 h-6" />
    </Link>
  )
}