'use client'

import { useEffect, useState, useRef } from 'react'

export default function Hero() {
  const [texts, setTexts] = useState<string[]>([])
  const [displayedText, setDisplayedText] = useState<string>('')
  const isMountedRef = useRef(true)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countRef = useRef(0)
  const indexRef = useRef(0)

  useEffect(() => {
    // Fetch hero texts from the database
    fetch('/api/hero')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setTexts(data)
        }
      })
      .catch(error => {
        console.error('Failed to fetch hero texts:', error)
        // Fallback to default texts if API fails
        setTexts([
          "New, way to access PEC.UP : starBOT",
          "Ready for Mid-2?",
          "Bored with studies? Not anymore!",
          "resources that are actually useful",
          "Made for students, by students!"
        ])
      })
  }, [])

  useEffect(() => {
    if (texts.length === 0) return

    const type = () => {
      if (!isMountedRef.current) return

      if (countRef.current === texts.length) {
        countRef.current = 0
      }
      const currentText = texts[countRef.current]
      const letter = currentText.slice(0, ++indexRef.current)

      setDisplayedText(letter)

      if (letter.length === currentText.length) {
        countRef.current++
        indexRef.current = 0
        timeoutRef.current = setTimeout(type, 2000) // Pause before typing the next word
      } else {
        timeoutRef.current = setTimeout(type, 150)
      }
    }

    type()

    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [texts])

  return (
    <section id="hero">
      <div className="hero-content text-container">
        <div className="animated-text">
          <h1>{displayedText}</h1>
        </div>
        <a href="https://chat.whatsapp.com/CRA9Iy7WWKT3yPc1homLyC" className="btn-project">Whatsapp</a>
        <p className="centered-text">
          pickup by <span className="pickup">PEC.UP</span>
        </p>
      </div>
    </section>
  )
}