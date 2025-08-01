import { setupSidebarToggle } from './base.js';

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  setupSidebarToggle();

  const currentPath = window.location.pathname.split('/').pop();
  const previousPath = sessionStorage.getItem("guidelinesFrom")?.split('/').pop();

  document.querySelectorAll('.nav-links a').forEach(link => {
    const linkPath = link.getAttribute('href')?.split('/').pop();

    if (linkPath === currentPath) {
      link.classList.add("active");
    } else if (
      currentPath === "guidelines.html" &&
      previousPath &&
      linkPath === previousPath
    ) {
      link.classList.add("active");
    }
  });

  const backButton = document.querySelector(".back-button");
  if (previousPath && backButton) {
    backButton.setAttribute("href", previousPath);
  } else if (backButton) {
    backButton.setAttribute("href", "lost-found.html");
  }

});

window.addEventListener("beforeunload", () => {
  if (window.location.pathname.includes("guidelines.html")) {
    sessionStorage.removeItem("guidelinesFrom");
  }
});
