import { getAllReports, submitReport, uploadPhoto } from '../../utils/api.js';

let allReports = [];

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('/web/components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  try {
    allReports = await getAllReports();
    renderReports('all');
  } catch (err) {
    console.error('Failed to load reports:', err);
    renderMessage('No records yet.');
  }

  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');

      const filter = tag.textContent.trim().toLowerCase();
      renderReports(filter);
    });
  });

  setupModalListeners();
});

function setupModalListeners() {
  const modal = document.getElementById('report-modal');
  const openBtn = document.getElementById('open-report-modal');
  const closeBtn = document.getElementById('close-report-modal');

  const reportTypeRadios = document.getElementsByName("report-type");
  const surrenderedCheckbox = document.getElementById("is-surrendered");

  const descriptionRow = document.getElementById("description-row");
  const codeRow = document.getElementById("code-row");
  const confirmCodeRow = document.getElementById("confirm-code-row");
  const infoReminder = document.getElementById("code-info-reminder");

  const surrenderedRow = document.getElementById("surrendered-row");
  const foundCodeRow = document.getElementById("found-code-row");
  const foundConfirmCodeRow = document.getElementById("found-confirm-code-row");
  const foundCodeNote = document.getElementById("found-code-note");

  const codeInput = document.getElementById("management-code");
  const confirmCodeInput = document.getElementById("confirm-management-code");
  const mismatchMsg = document.getElementById("code-mismatch-msg");

  if (!modal || !openBtn || !closeBtn) return;

  openBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    const lostRadio = document.querySelector('input[name="report-type"][value="lost"]');
    if (lostRadio) {
      lostRadio.checked = true;
      lostRadio.dispatchEvent(new Event('change'));
    }
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  function validateCodeMatch() {
    const code = codeInput.value.trim();
    const confirmCode = confirmCodeInput.value.trim();
    mismatchMsg.style.display = (code && confirmCode && code !== confirmCode) ? 'block' : 'none';
  }

  codeInput.addEventListener('input', validateCodeMatch);
  confirmCodeInput.addEventListener('input', validateCodeMatch);

  reportTypeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      const isLost = radio.value === "lost";
      descriptionRow.style.display = isLost ? "flex" : "none";
      codeRow.style.display = isLost ? "flex" : "none";
      confirmCodeRow.style.display = isLost ? "flex" : "none";
      infoReminder.style.display = isLost ? "flex" : "none";

      surrenderedRow.style.display = isLost ? "none" : "flex";

      if (!isLost) {
        const showCode = !surrenderedCheckbox.checked;
        foundCodeRow.style.display = showCode ? "flex" : "none";
        foundConfirmCodeRow.style.display = showCode ? "flex" : "none";
        foundCodeNote.style.display = showCode ? "flex" : "none";
      } else {
        foundCodeRow.style.display = "none";
        foundConfirmCodeRow.style.display = "none";
        foundCodeNote.style.display = "none";
      }
    });
  });

  surrenderedCheckbox.addEventListener("change", () => {
    const showCodeFields = !surrenderedCheckbox.checked;
    foundCodeRow.style.display = showCodeFields ? "flex" : "none";
    foundConfirmCodeRow.style.display = showCodeFields ? "flex" : "none";
    foundCodeNote.style.display = showCodeFields ? "flex" : "none";
  });
}

document.getElementById('submit-report').addEventListener('click', async (e) => {
  e.preventDefault();

  const type = document.querySelector('input[name="report-type"]:checked')?.value;
  const itemName = document.getElementById("item-name")?.value.trim();
  const contactInfo = document.getElementById("contact-input")?.value.trim();
  const isSurrendered = document.getElementById("is-surrendered")?.checked || false;

  const description = document.getElementById("description")?.value.trim();
  const code = document.getElementById("management-code")?.value.trim();
  const confirmCode = document.getElementById("confirm-management-code")?.value.trim();

  const foundCode = document.getElementById("found-code")?.value.trim();
  const foundConfirmCode = document.getElementById("found-confirm-code")?.value.trim();

  const photoInput = document.getElementById("report-photo");
  const photoFile = photoInput?.files?.[0];

  if (!type || !itemName || !contactInfo) {
    alert("Please fill in all required fields.");
    return;
  }

  if (type === "lost") {
    if (!description || !code || !confirmCode) {
      alert("Please complete all required fields for lost items.");
      return;
    }
    if (code !== confirmCode) {
      alert("Codes do not match.");
      return;
    }
  }

  if (type === "found" && !isSurrendered) {
    if (!foundCode || !foundConfirmCode) {
      alert("Please complete the code fields for found item.");
      return;
    }
    if (foundCode !== foundConfirmCode) {
      alert("Codes do not match.");
      return;
    }
  }

  const formData = {
    type,
    item_name: itemName,
    contact_info: contactInfo,
    description: type === "lost" ? description : isSurrendered ? "-" : "Item found by user",
    is_surrendered: isSurrendered,
    management_code: type === "lost" ? code : isSurrendered ? "surrendered" : foundCode || ""
  };

  try {
    const response = await submitReport(formData);
    console.log("Submitted report:", response);

    if (photoFile && response.report_id) {
      try {
        const uploadResult = await uploadPhoto(response.report_id, photoFile);
        console.log("Photo uploaded:", uploadResult);
      } catch (uploadErr) {
        alert("Report submitted, but photo upload failed: " + uploadErr.message);
      }
    }

    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmationDetails = document.getElementById('confirmation-details');

    if (type === "lost") {
      confirmationMessage.textContent = "You reported a lost item.";
      confirmationDetails.textContent = "If someone finds your item, their contact info and description will appear here. Reach out directly to them and update the status once recovered.";
    } else if (type === "found" && isSurrendered) {
      confirmationMessage.textContent = "Got it!";
      confirmationDetails.textContent = "We’ve marked this report as completed since it’s been handed over to the PUP Lost & Found area.";
    } else {
      confirmationMessage.textContent = "You reported a found item.";
      confirmationDetails.textContent = "You'll see claim requests here from users who think it's theirs. Please verify carefully before marking the item as claimed.";
    }

    confirmationModal.style.display = 'flex';

    allReports = await getAllReports();
    renderReports('all');

  } catch (err) {
    alert(`Submission failed: ${err.message}`);
  }
});


document.getElementById('confirm-ok-btn').addEventListener('click', () => {
  const confirmationModal = document.getElementById('confirmation-modal');
  const reportModal = document.getElementById('report-modal');
  const form = document.getElementById('report-form'); 

  confirmationModal.style.display = 'none';
  reportModal.style.display = 'none';

  if (form) {
    form.reset();
  }
});


function renderReports(filter) {
  const container = document.getElementById('reports-container');
  container.innerHTML = '';

  let filtered = allReports;

  if (filter === 'completed') {
    filtered = allReports.filter(r => r.status.toLowerCase() === 'completed');
    if (filtered.length === 0) {
      renderMessage('No completed records yet.');
      return;
    }
  }

  if (filtered.length === 0) {
    renderMessage('No records yet.');
    return;
  }

  filtered.forEach(report => {
    const card = document.createElement('div');
    card.className = 'report-card';

    const isHidden = report.type === 'found' && report.is_surrendered;
    const photoUrl = isHidden
      ? 'assets/img/HIDDEN.png'
      : (report.photo_urls?.[0] || 'assets/img/placeholder.png');

    if (isHidden) {
      card.classList.add('found-surrendered');
    }

    const buttonText = report.type === 'lost'
      ? 'I Found This'
      : 'Claim Item';

    const isButtonDisabled = report.type === 'found' && report.is_surrendered;

    let infoContent = `
      <p><strong>Item Name:</strong> ${report.item_name}</p>
      <p><strong>Type:</strong> ${report.type}</p>
      <p><strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}</p>
    `;

    if (!isHidden) {
      const description = (report.description || '').length > 50
        ? report.description.substring(0, 47) + '...'
        : report.description || '';

      infoContent += `
        <p><strong>Description:</strong> ${description}</p>
        <p><strong>Status:</strong> ${report.status}</p>
      `;
    } else {
      infoContent += `
        <p class="surrendered-info">
          <i class="fas fa-info-circle"></i>
          <span><em>This item has been surrendered to the PUP Guardhouse...</em></span>
        </p>
      `;
    }

    card.innerHTML = `
      <div class="report-photo">
        <img src="${photoUrl}" alt="Photo of ${report.item_name || 'item'}">
        <i class="fas fa-flag flag-icon"></i>
      </div>
      <div class="report-info">
        ${infoContent}
        <button class="report-action-btn" ${isButtonDisabled ? 'disabled' : ''}>
          <strong>${buttonText}</strong>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}




function renderMessage(msg) {
  const container = document.getElementById('reports-container');
  container.innerHTML = `<p class="no-records">${msg}</p>`;
}
