'use client'

import { useEffect, useState } from 'react'

export default function Hero() {
  const [texts, setTexts] = useState<string[]>([])

  useEffect(() => {
    // Fetch hero texts from the database
    fetch('/api/hero')
      .then(response => response.json())
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

    let count = 0
    let index = 0
    let currentText = ''
    let letter = ''

    const type = () => {
      if (count === texts.length) {
        count = 0
      }
      currentText = texts[count]
      letter = currentText.slice(0, ++index)

      const heading = document.getElementById('typing-heading')
      if (heading) {
        heading.textContent = letter
      }
      if (letter.length === currentText.length) {
        count++
        index = 0
        setTimeout(type, 2000) // Pause before typing the next word
      } else {
        setTimeout(type, 150)
      }
    }

    type()
  }, [texts])

  return (
    <section id="hero">
      <div className="hero-content text-container">
        <div className="animated-text">
          <h1 id="typing-heading"></h1>
        </div>
        <a href="https://chat.whatsapp.com/CRA9Iy7WWKT3yPc1homLyC" className="btn-project">Whatsapp</a>
        <p className="centered-text">
          pickup by <span className="pickup">PEC.UP</span>
        </p>
      </div>
    </section>
  )
}