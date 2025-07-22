document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('/web/components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const linkPath = new URL(link.href).pathname;
    if (linkPath === currentPath ||
        (currentPath.includes("reports.html") && linkPath.includes("lost-found.html")) ||
        (currentPath.includes("guidelines.html") && linkPath.includes("lost-found.html"))
    ) {
      link.classList.add("active");
    }
  });
});