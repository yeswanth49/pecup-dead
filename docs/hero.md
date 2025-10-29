# Hero Section Code

This document contains all the code related to the hero section from the PEC.UP website, including HTML, CSS, and JavaScript. The hero section features an animated typing heading, a call-to-action button for starBOT, and branding text.

## HTML Structure

```html
<section id="hero">
    <div class="hero-content text-container">
        <div class="animated-text">
            <h1 id="typing-heading"></h1>
        </div>
        <a href="https://chat.pecup.in" class="btn-project">starBOT!</a>
        <p class="centered-text">pickup by
            <span class="pickup">PEC.UP</span>
        </p>
    </div>
</section>
```

## CSS Styles

```css
#hero {
    background-color: #f4f4f4;
    font-family: monospace;
    padding: 50px 20px;
    padding-bottom: 5px;
    text-align: center;
    min-height: 320px; /* Adjust this value as needed */
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}

.hero-content h1 {
    font-size: 48px;
    margin-bottom: 20px;
}

.hero-content p {
    font-size: 24px;
    margin-bottom: 20px;
}

.hero-content h1 span, .hero-content p .pickup {
    display: inline-block;
    transition: color 0.3s ease;
}

.hero-content h1 span:hover, .hero-content p .pickup :hover{
    color: #ff5733;
    cursor: default;
}

.btn-project {
    /* here i have set new project button to hide */
    /* display: none; */
    background-color: #ff5733;
    color: white;
    padding: 10px 20px;
    text-decoration: none;
    border-radius: 5px;
}

@keyframes typing {
    from { width: 0; }
    to { width: 100%; }
}

@keyframes blink {
    from, to { border-color: transparent; }
    50% { border-color: black; }
}

.text-container {
    background-color: #f4f4f4; /* Background color slightly different from white */
    padding: 10px; /* Adjust padding as needed */
    max-width: 100%; /* Ensure container doesn't overflow */
    box-sizing: content-box; /* Include padding in width calculation */
    overflow: hidden; /* Prevent horizontal overflow */
    word-wrap: break-word; /* Break long words to fit within the container */
    text-align: left; /* Align text to the left */
}

.animated-text {
    font-size: 24px;
    font-weight: bold;
    justify-content: center;
    color: black;
    display: inline-block;
    border-right: 2px solid;
    overflow: hidden; /* Prevent horizontal overflow */
    white-space: normal; /* Allow text to wrap to the next line */
}

.typing-effect {
    width: 100%; /* Ensure it uses the full width of the container */
    animation: typing 2s steps(20) infinite alternate, blink 0.75s step-end infinite;
}

.centered-text {
    text-align: center; /* Center the text horizontally within the <p> tag */
    margin-top: 50px; /* Remove default margin */
    padding-top: 2%;
}

.pickup{
    color: #ff5733;
    font-size: 2rem;
}

/* Responsive Styles for Hero */
@media (max-width: 768px) {
    .hero-content h1 {
        font-size: 32px;
    }

    .hero-content p {
        font-size: 18px;
    }
}

@media (max-width: 480px) {
    .hero-content h1 {
        font-size: 24px;
    }

    .hero-content p {
        font-size: 16px;
    }

    .btn-contact, .btn-project {
        padding: 8px 16px;
        font-size: 14px;
    }
}
```

## JavaScript for Typing Effect

```javascript
const texts = [ "New, way to access PEC.UP : starBOT","Ready for Mid-2?","Bored with studies? Not anymore!","resources that are actually useful", "Made for students, by students!"];
let count = 0;
let index = 0;
let currentText = '';
let letter = '';

(function type() {
    if (count === texts.length) {
        count = 0;
    }
    currentText = texts[count];
    letter = currentText.slice(0, ++index);

    document.getElementById('typing-heading').textContent = letter;
    if (letter.length === currentText.length) {
        count++;
        index = 0;
        setTimeout(type, 2000); // Pause before typing the next word
    } else {
        setTimeout(type, 150);
    }
})();
```

## Instructions

- **HTML**: Place this section in your HTML file where you want the hero to appear. Ensure the scripts are included at the bottom for the typing effect to work.

- **CSS**: Add these styles to your main CSS file. The hero uses flexbox for centering and has responsive adjustments for mobile devices.

- **JavaScript**: Include this script in your HTML file, preferably before the closing `</body>` tag. It cycles through the predefined texts in the `texts` array.

- **Customization**: 
  - Change the `texts` array to customize the typing messages.
  - Adjust font sizes, colors, and padding in CSS to match your design.
  - The button links to `https://chat.pecup.in`; update the href if needed.
  - For the typing animation, modify the `setTimeout` values for speed and pause duration.

- **Dependencies**: This code assumes a monospace font is available. If not, add `font-family: monospace;` to the #hero selector.

- **Testing**: Open the page in a browser to ensure the typing effect works. Check responsiveness on different screen sizes.