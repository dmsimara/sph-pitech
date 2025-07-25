export function setupSidebarToggle() {
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.querySelector(".sidebar");

  if (!hamburger || !sidebar) {
    console.warn("Hamburger or sidebar not found.");
    return;
  }

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("active");
  });

  window.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
      sidebar.classList.remove("active");
    }
  });
}
