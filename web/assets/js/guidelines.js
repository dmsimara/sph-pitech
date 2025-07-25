document.addEventListener("DOMContentLoaded", async () => {
  const spinnerRes = await fetch('components/spinner.html');
  const spinnerHtml = await spinnerRes.text();
  document.body.insertAdjacentHTML('beforeend', spinnerHtml);

  function showSpinner() {
    document.getElementById('spinner')?.style.setProperty('display', 'flex', 'important');
  }

  function hideSpinner() {
    document.getElementById('spinner')?.style.setProperty('display', 'none', 'important');
  }

  showSpinner();

  const sidebarRes = await fetch('components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

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

  hideSpinner();
});

window.addEventListener("beforeunload", () => {
  if (window.location.pathname.includes("guidelines.html")) {
    sessionStorage.removeItem("guidelinesFrom");
  }
});
