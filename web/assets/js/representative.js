import { getRepresentative } from '../../utils/api.js';

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('/web/components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (
      (href.includes('directory.html') || href.includes('blocks.html')) || href.includes('representative.html') &&
      (currentPath.includes('directory.html') || currentPath.includes('blocks.html') || currentPath.includes('representative.html'))
    ) {
      link.classList.add('active');
    }
  });

  const sectionId = localStorage.getItem('selectedSection');
  if (!sectionId) {
    document.querySelector('.main-content').innerHTML += '<p>Please go back and select a section.</p>';
    return;
  }

  const header = document.querySelector('.directory-header');
  const selectedText = document.createElement('p');
  selectedText.textContent = sectionId;
  selectedText.style.marginTop = '0.5rem';
  selectedText.style.fontWeight = 'bold';
  header.appendChild(selectedText);

  try {
    const res = await getRepresentative(sectionId);
    const container = document.querySelector('.rep-info');

    if (res.representative) {
      const rep = res.representative;
      container.innerHTML += `
        <p>Full Name:</strong> ${rep.full_name}</p>
        <p>Email:</strong> ${rep.webmail}</p>
        <p>Facebook/ Messenger Link:</strong> <a href="${rep.messenger_link}" target="_blank">${rep.messenger_link}</a></p>
        <p>Contact Number:</strong> ${rep.contact_number}</p>
        </br>
        <p>Official GC:</strong> <a href="${rep.official_group_chat}" target="_blank">${rep.official_group_chat}</a></p>
      `;
    } else {
      container.innerHTML += `<p>${res.message}</p>`;
    }
  } catch (err) {
    console.error(err);
    document.querySelector('.rep-info').innerHTML += `<p>Error fetching representative info.</p>`;
  }
});
