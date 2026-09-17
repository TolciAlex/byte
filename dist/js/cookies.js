(function() {
  const cookieBanner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  const declineBtn = document.getElementById('cookie-decline');
  const cookieName = 'byte-cookies-accepted';

  // Check if user has already made a choice
  function checkCookieConsent() {
    const accepted = localStorage.getItem(cookieName);
    if (!accepted) {
      // Show banner after a short delay
      setTimeout(() => {
        cookieBanner.classList.remove('hidden');
      }, 500);
    }
  }

  // Handle accept
  if (acceptBtn) {
    acceptBtn.addEventListener('click', function() {
      localStorage.setItem(cookieName, 'true');
      cookieBanner.classList.add('hidden');
      // You can add analytics tracking here
    });
  }

  // Handle decline
  if (declineBtn) {
    declineBtn.addEventListener('click', function() {
      localStorage.setItem(cookieName, 'false');
      cookieBanner.classList.add('hidden');
    });
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', checkCookieConsent);
})();
