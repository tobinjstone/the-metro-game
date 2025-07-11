
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
         .test(navigator.userAgent);
}


function startGame() {
  console.log("Game initialized! 🚇");

  // Hide intro, show game container
  document.getElementById('intro').hidden = true;
  document.getElementById('game-area').hidden = false;

  // TODO: build the real game logic here
}

// attach the click handler once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const urlParams  = new URLSearchParams(location.search);
  const devBypass  = urlParams.has('dev');   // ?dev  bypasses the guard

  if (!devBypass && !isMobileDevice()) {
    // ↓ Real code that shows the overlay and stops the game
    document.getElementById('desktop-warning').hidden = false;
    document.getElementById('intro').hidden           = true;
    document.getElementById('game-area').hidden       = true;
    return;   // ⟵ prevent any further game setup
  }

  // Normal startup path (mobile device *or* ?dev present)
  document
    .getElementById('start-btn')
    .addEventListener('click', startGame);
});

