const phrases = [
  "Create Private Groups",
  "Chat in Real-Time",
  "Secured by Firebase",
  "Beautiful and Simple"
];

let currentPhrase = 0;
let currentLetter = 0;
let isDeleting = false;
const target = document.getElementById("sidebar-text");

function typePhrase() {
  const fullText = phrases[currentPhrase];
  const currentText = isDeleting
    ? fullText.substring(0, currentLetter--)
    : fullText.substring(0, currentLetter++);

  target.textContent = currentText;

  if (!isDeleting && currentLetter === fullText.length + 1) {
    isDeleting = true;
    setTimeout(typePhrase, 1200);
  } else if (isDeleting && currentLetter === 0) {
    isDeleting = false;
    currentPhrase = (currentPhrase + 1) % phrases.length;
    setTimeout(typePhrase, 500);
  } else {
    setTimeout(typePhrase, isDeleting ? 30 : 70);
  }
}

typePhrase();
