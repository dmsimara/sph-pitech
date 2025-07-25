import { getAllReports, submitReport, uploadPhoto, submitFlag, submitResponse } from '../../utils/api.js';
import { showSpinner, hideSpinner } from './spinner.js';

let allReports = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", async () => {
  showSpinner();

  const sidebarRes = await fetch('components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (
      (href.includes('lost-found.html') || href.includes('reports.html')) &&
      (currentPath.includes('lost-found.html') || currentPath.includes('reports.html'))
    ) {
      link.classList.add('active');
    }
  });

  const params = new URLSearchParams(window.location.search);
  const urlFilter = params.get("filter") || "all";
  currentFilter = urlFilter;

  const activeBtn = document.querySelector(`[data-filter="${urlFilter}"]`);
  if (activeBtn) {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    activeBtn.classList.add("active");
  }

  try {
    allReports = await getAllReports();
    renderReports('all');
    setupFlagModalListeners();
    setupReportActionModalListeners();
  } catch (err) {
    console.error('Failed to load reports:', err);
    renderMessage('No records yet.');
  } finally {
    hideSpinner();  
  }

  document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');

      const filter = tag.textContent.trim().toLowerCase();
      currentFilter = filter;
      renderReports(filter);
    });
  });

  setupModalListeners();
  setupFlagSubmission();

  document.getElementById('response-ok-btn')?.addEventListener('click', () => {
    document.getElementById('response-confirmation-modal').style.display = 'none';
  });

  document.getElementById("search-input").addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();

    let filtered = [...allReports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (currentFilter === 'completed') {
     filtered = filtered.filter(r => r.status.toLowerCase() === 'completed');
    }

    if (query) {
     filtered = filtered.filter(report =>
        report.item_name.toLowerCase().includes(query) ||
        report.contact_info.toLowerCase().includes(query)
     );
   }

   if (filtered.length === 0) {
     renderMessage("No records found.");
   } else {
      renderReportsFromData(filtered);
      setupFlagModalListeners();
      setupReportActionModalListeners();
   }
  });

  setupFlagSubmission();

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
  const foundCodeInput = document.getElementById("found-code");
  const foundConfirmCodeInput = document.getElementById("found-confirm-code");
  const mismatchMsg = document.getElementById("code-mismatch-msg");

  if (!modal || !openBtn || !closeBtn) return;

  openBtn.addEventListener('click', () => {
    modal.style.display = 'flex';

    const selectedRadio = document.querySelector('input[name="report-type"]:checked');
    if (selectedRadio) {
      selectedRadio.dispatchEvent(new Event('change'));
    } else {
      const lostRadio = document.querySelector('input[name="report-type"][value="lost"]');
      if (lostRadio) {
        lostRadio.checked = true;
        lostRadio.dispatchEvent(new Event('change'));
      }
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
    const selectedType = document.querySelector('input[name="report-type"]:checked')?.value;

    const code = codeInput?.value.trim();
    const confirmCode = confirmCodeInput?.value.trim();
    const foundCode = foundCodeInput?.value.trim();
    const foundConfirmCode = foundConfirmCodeInput?.value.trim();

    let mismatch = false;

    if (selectedType === "lost") {
      mismatch = code && confirmCode && code !== confirmCode;
    } else if (selectedType === "found" && !surrenderedCheckbox.checked) {
      mismatch = foundCode && foundConfirmCode && foundCode !== foundConfirmCode;
    }

    mismatchMsg.style.display = mismatch ? "block" : "none";
  }

  codeInput.addEventListener('input', validateCodeMatch);
  confirmCodeInput.addEventListener('input', validateCodeMatch);
  foundCodeInput.addEventListener('input', validateCodeMatch);
  foundConfirmCodeInput.addEventListener('input', validateCodeMatch);

  reportTypeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      const selectedType = document.querySelector('input[name="report-type"]:checked')?.value;
      const isLost = selectedType === "lost";

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

      mismatchMsg.style.display = "none";

      codeInput.value = "";
      confirmCodeInput.value = "";
      foundCodeInput.value = "";
      foundConfirmCodeInput.value = "";
    });
  });

  surrenderedCheckbox.addEventListener("change", () => {
    const showCodeFields = !surrenderedCheckbox.checked;
    foundCodeRow.style.display = showCodeFields ? "flex" : "none";
    foundConfirmCodeRow.style.display = showCodeFields ? "flex" : "none";
    foundCodeNote.style.display = showCodeFields ? "flex" : "none";

    mismatchMsg.style.display = "none";
    foundCodeInput.value = "";
    foundConfirmCodeInput.value = "";
  });
}

function setupFlagSubmission() {
  const submitBtn = document.getElementById("submit-flag-btn");
  const flagModal = document.getElementById("flag-modal");
  const confirmationModal = document.getElementById("flag-confirmation-modal");
  const closeConfirmationBtn = document.querySelector(".close-confirmation");

  submitBtn.addEventListener("click", async () => {
    const selectedReason = document.getElementById("report-reason").value;
    const reportId = flagModal.getAttribute("data-report-id");

    if (!selectedReason) {
      alert("Please select a reason.");
      return;
    }

    showSpinner();
    try {
      await submitFlag(reportId, selectedReason);

      flagModal.style.display = "none";
      confirmationModal.style.display = "flex";
    } catch (err) {
      console.error("Error submitting flag:", err);
      alert("Something went wrong while reporting.");
    } finally {
      hideSpinner(); 
    }
  });

  closeConfirmationBtn.addEventListener("click", () => {
    confirmationModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === confirmationModal) {
      confirmationModal.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const itemSelect = document.getElementById("item-name-select");
  const customItemRow = document.getElementById("custom-item-row");

  itemSelect.addEventListener("change", () => {
    if (itemSelect.value === "Other") {
      customItemRow.style.display = "flex";
    } else {
      customItemRow.style.display = "none";
    }
  });
});

document.getElementById('submit-report').addEventListener('click', async (e) => {
  e.preventDefault();

  const form = e.target.closest('form');
  if (!form) return alert("Form not found!");

  const type = form.querySelector('input[name="report-type"]:checked')?.value;
  let itemName = form.querySelector("#item-name-select")?.value;
  if (itemName === "Other") {
    itemName = form.querySelector("#custom-item-name")?.value.trim();
  }

  const contactInfo = form.querySelector("#contact-input")?.value.trim();
  const isSurrendered = form.querySelector("#is-surrendered")?.checked;

  const description = form.querySelector("#description")?.value.trim();
  const code = form.querySelector("#management-code")?.value.trim();
  const confirmCode = form.querySelector("#confirm-management-code")?.value.trim();

  const foundCode = form.querySelector("#found-code")?.value.trim();
  const foundConfirmCode = form.querySelector("#found-confirm-code")?.value.trim();

  console.log("type:", type);
  console.log("isSurrendered:", isSurrendered);
  console.log("foundCode:", `"${foundCode}"`);
  console.log("foundConfirmCode:", `"${foundConfirmCode}"`);

  if (!type || !itemName || !contactInfo) {
    alert("Please fill in all required fields.");
    return;
  }

  if (type === "lost") {
    if (!description || !code || !confirmCode) {
      alert("Please complete all required fields for lost items.");
      return;
    }
    if (code.length !== 6 || confirmCode.length !== 6) {
      alert("Your code must be exactly 6 characters.");
      return;
    }
    if (code !== confirmCode) {
      alert("Codes do not match.");
      form.querySelector("#code-mismatch-msg").style.display = "block";
      return;
    }
  }

  if (type === "found" && !isSurrendered) {
    if (!foundCode || !foundConfirmCode) {
      alert("Please complete the code fields for found item.");
      return;
    }
    if (foundCode.length !== 6 || foundConfirmCode.length !== 6) {
      alert("Your code must be exactly 6 characters.");
      return;
    }
    if (foundCode !== foundConfirmCode) {
      alert("Codes do not match.");
      form.querySelector("#code-mismatch-msg").style.display = "block";
      return;
    }
  }

  const photoInput = form.querySelector("#report-photo");
  const photoFile = photoInput?.files?.[0];

  const formData = {
    type,
    item_name: itemName,
    contact_info: contactInfo,
    description: type === "lost" ? description : isSurrendered ? "-" : "Item found by user",
    is_surrendered: isSurrendered,
    management_code: type === "lost" ? code : isSurrendered ? "surrendered" : foundCode || ""
  };

  showSpinner();
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
      confirmationDetails.textContent = "If someone finds your item, their contact info and description will appear here.";
    } else if (type === "found" && isSurrendered) {
      confirmationMessage.textContent = "Got it!";
      confirmationDetails.textContent = "We’ve marked this report as completed since it’s been handed over to the PUP Guardhouse.";
    } else {
      confirmationMessage.textContent = "You reported a found item.";
      confirmationDetails.textContent = "You'll see claim requests here from users who think it's theirs.";
    }


    confirmationModal.style.display = 'flex';
    document.getElementById('report-modal').style.display = 'none';

    allReports = await getAllReports();
    renderReports('all');
    setupFlagModalListeners();

  } catch (err) {
    alert(`Submission failed: ${err.message}`);
  } finally {
    hideSpinner();  
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

document.getElementById('submit-action-btn').addEventListener('click', async () => {
  const name = document.getElementById('response-name')?.value.trim();
  const contact = document.getElementById('response-contact')?.value.trim();
  const message = document.getElementById('response-message')?.value.trim();
  const reportId = document.getElementById("action-modal").getAttribute("data-report-id");

  if (!name || !contact || !message) {
    alert("Please fill out all fields.");
    return;
  }

  if (message.length > 20) {
    alert("Message must be under 20 characters.");
    return;
  }

  showSpinner();
  try {
    await submitResponse(reportId, {
      name,
      contact_info: contact,
      message
    });


    const modalTitle = document.querySelector("#action-modal h2")?.textContent?.trim();

    if (modalTitle === "Claim Form") {
      document.getElementById("response-confirmation-message").textContent = "Thank You!";
      document.getElementById("response-confirmation-details").textContent =
        "The uploader will review your claim. If it's urgent, feel free to contact them directly using the information provided in the post.";
    } else if (modalTitle === "Item Return Form") {
      document.getElementById("response-confirmation-message").textContent = "Thanks for reaching out!";
      document.getElementById("response-confirmation-details").textContent =
        "The original reporter will review your message and may contact you if your description matches the lost item.";
    }

    document.getElementById("response-confirmation-modal").style.display = "flex";
    document.getElementById("action-modal").style.display = "none";
    document.getElementById("action-form").reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error("Error submitting response:", err);
    alert("Failed to send response. Please try again.");
  }  finally {
    hideSpinner();  
  }
});

function renderReports(filter) {
  sessionStorage.setItem('lastFilter', filter);
  const container = document.getElementById('reports-container');
  container.innerHTML = '';

  let filtered = [...allReports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

    card.addEventListener('click', () => {
      window.location.href = `reports.html?report_id=${report.report_id}`;
    });

    const isHidden = report.type === 'found' && report.is_surrendered;
    const photoUrl = isHidden
      ? 'assets/img/HIDDEN.png'
      : (report.photo_urls?.[0] || 'assets/img/placeholder.png');

    if (isHidden) card.classList.add('found-surrendered');

    const buttonText = report.type === 'lost'
      ? 'I Found This'
      : 'Claim Item';

    let statusLabel = '';
    let statusClass = '';

    if (report.type === 'lost' && report.status === 'unclaimed') {
      statusLabel = 'Not Found';
      statusClass = 'status-pill lost-status';
    } else if (report.type === 'found' && report.status === 'unclaimed') {
      statusLabel = 'Unclaimed';
      statusClass = 'status-pill lost-status';
    } else if (report.type === 'lost' && report.status === 'completed') {
      statusLabel = 'Found';
      statusClass = 'status-pill found-status';
    } else if (report.type === 'found' && report.status === 'completed') {
      statusLabel = 'Claimed';
      statusClass = 'status-pill found-status';
    }

    const isButtonDisabled = report.status === 'completed' || (report.type === 'found' && report.is_surrendered);

    let infoContent = `
      <p><strong>Item Name:</strong> ${report.item_name}</p>
      <p>
        <strong>Type:</strong> 
        <span class="type-pill ${report.type.toLowerCase()}">${report.type.charAt(0).toUpperCase() + report.type.slice(1)}</span>
      </p>
      <p><strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}</p>
    `;

    if (!isHidden) {
      const description = (report.description || '').length > 50
        ? report.description.substring(0, 47) + '...'
        : report.description || '';

      infoContent += `
        <p><strong>Description:</strong> ${description}</p>
        <p>
          <strong>Status:</strong> 
          <span class="${statusClass}">${statusLabel}</span>
        </p>
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
        <i class="fas fa-flag flag-icon" data-report-id="${report.report_id}"></i>
      </div>
      <div class="report-info">
        ${infoContent}
        <button class="report-action-btn" data-report-id="${report.report_id}" ${isButtonDisabled ? 'disabled' : ''}>
          <strong>${buttonText}</strong>
        </button>
      </div>
    `;

    container.appendChild(card);

    card.querySelector('.flag-icon')?.addEventListener('click', (e) => {
      e.stopPropagation();  
      document.getElementById('flag-modal').style.display = 'flex';  
      document.getElementById('flag-modal').setAttribute('data-report-id', report.report_id);
    });
  });
}

function setupReportActionModalListeners() {
  const actionModal = document.getElementById("action-modal");
  const modalTitle = document.getElementById("action-modal-title");
  const messageField = document.getElementById("response-message");
  const closeModalBtn = document.querySelector(".close-action-modal");

  document.querySelectorAll(".report-action-btn").forEach(button => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();

      const btnText = button.textContent.trim();
      if (btnText === "I Found This") {
        modalTitle.textContent = "Item Return Form";
        messageField.placeholder = "Leave a message for the owner — feel free to share where you found the item or how they can contact you.";
      } else if (btnText === "Claim Item") {
        modalTitle.textContent = "Claim Form";
        messageField.placeholder = "Include the location you lost it and a unique characteristic (e.g. color, tag, mark) to help confirm it's yours.";
      } else {
        modalTitle.textContent = "Action Form";
        messageField.placeholder = "";
      }

      const reportId = button.getAttribute("data-report-id");
      actionModal.setAttribute("data-report-id", reportId);
      actionModal.style.display = "flex";
    });
  });

  closeModalBtn.addEventListener("click", () => {
    actionModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === actionModal) {
      actionModal.style.display = "none";
    }
  });
}

function setupFlagModalListeners() {
  const flagModal = document.getElementById("flag-modal");
  const closeBtn = document.querySelector(".close-flag-modal");

  document.querySelectorAll(".flag-icon").forEach(icon => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation(); 
      const reportId = icon.getAttribute("data-report-id");
      const flagModal = document.getElementById("flag-modal");
      flagModal.setAttribute("data-report-id", reportId);
      flagModal.style.display = "flex";
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      flagModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === flagModal) {
      flagModal.style.display = "none";
    }
  });
}

function renderReportsFromData(data) {
  const container = document.getElementById('reports-container');
  container.innerHTML = '';

  data.forEach(report => {
    const card = document.createElement('div');
    card.className = 'report-card';

    card.addEventListener('click', () => {
      window.location.href = `reports.html?report_id=${report.report_id}`;
    });

    const isHidden = report.type === 'found' && report.is_surrendered;
    const photoUrl = isHidden
      ? 'assets/img/HIDDEN.png'
      : (report.photo_urls?.[0] || 'assets/img/placeholder.png');

    if (isHidden) card.classList.add('found-surrendered');

    const buttonText = report.type === 'lost'
      ? 'I Found This'
      : 'Claim Item';

    let statusLabel = '';
    let statusClass = '';

    if (report.type === 'lost' && report.status === 'unclaimed') {
      statusLabel = 'Not Found';
      statusClass = 'status-pill lost-status';
    } else if (report.type === 'found' && report.status === 'unclaimed') {
      statusLabel = 'Unclaimed';
      statusClass = 'status-pill lost-status';
    } else if (report.type === 'lost' && report.status === 'completed') {
      statusLabel = 'Found';
      statusClass = 'status-pill found-status';
    } else if (report.type === 'found' && report.status === 'completed') {
      statusLabel = 'Claimed';
      statusClass = 'status-pill found-status';
    }

    const isButtonDisabled = report.status === 'completed' || (report.type === 'found' && report.is_surrendered);

    let infoContent = `
      <p><strong>Item Name:</strong> ${report.item_name}</p>
      <p>
        <strong>Type:</strong> 
        <span class="type-pill ${report.type.toLowerCase()}">${report.type.charAt(0).toUpperCase() + report.type.slice(1)}</span>
      </p>
      <p><strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}</p>
    `;

    if (!isHidden) {
      const description = (report.description || '').length > 50
        ? report.description.substring(0, 47) + '...'
        : report.description || '';

      infoContent += `
        <p><strong>Description:</strong> ${description}</p>
        <p>
          <strong>Status:</strong> 
          <span class="${statusClass}">${statusLabel}</span>
        </p>
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
        <button class="report-action-btn" data-report-id="${report.report_id}" ${isButtonDisabled ? 'disabled' : ''}>
          <strong>${buttonText}</strong>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderMessage(msg) {
  const container = document.getElementById('reports-container');
  container.innerHTML = `
    <div class="no-records-wrapper">
      <p class="no-records">${msg}</p>
    </div>
  `;
}
