document.getElementById("menu-button").addEventListener("click", function () {
  const menu = document.getElementById("mobile-menu");
  const hamburgerIcon = document.getElementById("hamburger-icon");
  const closeIcon = document.getElementById("close-icon");

  menu.classList.toggle("hidden"); // Show/hide menu
  hamburgerIcon.classList.toggle("hidden"); // Swap icons
  closeIcon.classList.toggle("hidden"); // Swap icons
});
