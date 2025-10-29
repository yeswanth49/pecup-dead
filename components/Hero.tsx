'use client'

import { useEffect } from 'react'

export default function Hero() {
  useEffect(() => {
    const texts = [
      "New, way to access PEC.UP : starBOT",
      "Ready for Mid-2?",
      "Bored with studies? Not anymore!",
      "resources that are actually useful",
      "Made for students, by students!"
    ]
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
  }, [])

  return (
    <section id="hero">
      <div className="hero-content text-container">
        <div className="animated-text">
          <h1 id="typing-heading"></h1>
        </div>
        <a href="https://chat.pecup.in" className="btn-project">starBOT!</a>
        <p className="centered-text">
          pickup by <span className="pickup">PEC.UP</span>
        </p>
      </div>
    </section>
  )
}