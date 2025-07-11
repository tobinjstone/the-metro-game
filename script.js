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
  if (!isMobileDevice()) {
    // Show overlay, hide everything else
    document.getElementById('desktop-warning').hidden = false;
    document.getElementById('intro').hidden = true;
    document.getElementById('game-area').hidden = true;
    return;          // skip all further setup
  }

  // Only runs on mobile:
  document.getElementById('start-btn')
          .addEventListener('click', startGame);
});
