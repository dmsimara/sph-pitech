import { getAllReports, updateReport } from '../../utils/api.js';

async function loadReportDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('report_id');

  if (!reportId) {
    document.querySelector('.directory-header h1').textContent = "Invalid Report";
    return;
  }

  try {
    const reports = await getAllReports();
    const report = reports.find(r => r.report_id === reportId);

    if (!report) {
      document.querySelector('.directory-header h1').textContent = "Report Not Found";
      return;
    }

    const mainTitle = report.type === 'lost' ? "Lost Item" : "Found Item";
    document.querySelector('.directory-header h1').textContent = mainTitle;

    const photoUrl = (report.type === 'found' && report.is_surrendered)
      ? '/web/assets/img/HIDDEN.png'
      : (report.photo_urls?.[0] || '/web/assets/img/placeholder.png');

    const photoContainer = document.querySelector('.report-photo');
    photoContainer.innerHTML = `
      <img src="${photoUrl}" alt="Report Photo" style="width: 100%; border: 2px solid var(--color-secondary); border-radius: 6px;" />
    `;

    const infoContainer = document.querySelector('.info-details');

    const { text: statusLabel, class: statusClass } = getStatusLabel(report);

    let infoHTML = `
      <p><strong>Item Name:</strong> ${report.item_name}</p>
      <p><strong>Contact Info:</strong> ${report.contact_info}</p>
    `;

    if (report.type === 'lost') {
      infoHTML += `
        <p><strong>Description:</strong></p>
        <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; margin-bottom: 12px; font-weight: bold; color: var(--color-secondary);">
          ${report.description}
        </div>
        <p><strong>Reported On:</strong> ${new Date(report.created_at).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-pill ${statusClass}">${statusLabel}</span></p>
      `;
    } else if (report.type === 'found' && !report.is_surrendered) {
      infoHTML += `
        <p><strong>Reported On:</strong> ${new Date(report.created_at).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-pill ${statusClass}">${statusLabel}</span></p>
        <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; margin-top: 12px; font-style: italic; color: var(--color-secondary);">
          <i class="fas fa-info-circle"></i> 
          If you believe you are the rightful owner, please file a claim with the location where you lost the item and any identifying details for verification.
        </div>
      `;
    } else if (report.type === 'found' && report.is_surrendered) {
      infoHTML += `
        <p><strong>Reported On:</strong> ${new Date(report.created_at).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-pill ${statusClass}">${statusLabel}</span></p>
        <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; margin-top: 12px; font-style: italic; color: var(--color-secondary);">
          <i class="fas fa-info-circle"></i> 
          This item has been turned over to the PUP Guardhouse. You may visit in person to claim it — no need to submit a request. If you have any questions, feel free to contact the founder using the details provided in the post.
        </div>
      `;
    }

    infoContainer.innerHTML = infoHTML;

    if (
      (report.type === 'lost') ||
      (report.type === 'found' && !report.is_surrendered)
    ) {
      const btnContainer = document.createElement('div');
      btnContainer.classList.add('action-buttons');

      const btn1 = document.createElement('button');
      btn1.className = 'btn-outline-secondary';
      btn1.textContent = report.type === 'lost' ? 'See Who Found It' : 'See Claim Attempts';
      btn1.addEventListener('click', () => {
         document.getElementById('modal-1').style.display = 'flex';
      });

      const btn2 = document.createElement('button');
      btn2.className = 'btn-filled-secondary';
      btn2.textContent = 'Mark as Completed';
      btn2.addEventListener('click', () => {
            document.getElementById('modal-2').style.display = 'flex';
       });

      btnContainer.appendChild(btn1);
      btnContainer.appendChild(btn2);
      document.querySelector('.report-info').insertAdjacentElement('afterend', btnContainer);
    }


  } catch (err) {
    console.error("Failed to load report:", err);
  }
}

document.querySelectorAll('.close-modal').forEach(closeBtn => {
  closeBtn.addEventListener('click', () => {
    const modalId = closeBtn.getAttribute('data-close');
    document.getElementById(modalId).style.display = 'none';
  });
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('custom-modal')) {
    e.target.style.display = 'none';
  }
});

function setupEditIconListeners() {
  document.querySelectorAll(".edit-icon").forEach(icon => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();

      const urlParams = new URLSearchParams(window.location.search);
      const reportId = urlParams.get("report_id");

      if (!reportId) {
        console.error("No report_id found in URL.");
        return;
      }

      const codeModal = document.getElementById("code-modal");
      codeModal.setAttribute("data-mode", "edit");
      codeModal.setAttribute("data-report-id", reportId);

      document.getElementById("code-input").value = "";
      document.getElementById("code-error").style.display = "none";
      codeModal.style.display = "flex";
    });
  });

  document.getElementById("confirm-code-btn").addEventListener("click", async () => {
    const codeEntered = document.getElementById("code-input").value.trim();
    const reportId = document.getElementById("code-modal").getAttribute("data-report-id");

    if (!reportId || codeEntered.length !== 6) {
      document.getElementById("code-error").style.display = "block";
      return;
    }

    try {
      await updateReport(reportId, {}, codeEntered); 

      const reports = await getAllReports();
      const report = reports.find(r => r.report_id === reportId);
      if (!report) {
        console.error("Report not found.");
        return;
      }

      document.getElementById("edit-item-name").value = report.item_name || '';
      document.getElementById("edit-contact-info").value = report.contact_info || '';
      document.getElementById("edit-description").value = report.description || '';

      document.getElementById("code-error").style.display = "none";
      document.getElementById("code-modal").style.display = "none";
      document.getElementById("edit-report-modal").style.display = "flex";

    } catch (err) {
      console.error("Verification failed:", err);
      document.getElementById("code-error").style.display = "block";
    }
  });

  window.addEventListener("click", (e) => {
    const modal = document.getElementById("code-modal");
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  document.querySelector(".close-code-modal").addEventListener("click", () => {
    document.getElementById("code-modal").style.display = "none";
  });
}

document.getElementById("edit-report-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const reportId = document.getElementById("code-modal").getAttribute("data-report-id");
  const managementCode = document.getElementById("code-input").value.trim();

  if (!reportId || !managementCode) {
    alert("Missing report ID or code.");
    return;
  }

  const updatedData = {
    item_name: document.getElementById("edit-item-name").value.trim(),
    contact_info: document.getElementById("edit-contact-info").value.trim(),
    description: document.getElementById("edit-description").value.trim()
  };

  try {
    await updateReport(reportId, updatedData, managementCode);

    alert("Report updated successfully.");
    document.getElementById("edit-report-modal").style.display = "none";
    window.location.reload();
  } catch (err) {
    alert(`Failed to update: ${err.message}`);
  }
});


function getStatusLabel(report) {
  const { type, status, is_surrendered } = report;

  if (type === 'lost' && status === 'unclaimed') return { text: 'Not Found', class: 'status-orange' };
  if (type === 'found' && status === 'unclaimed') return { text: 'Unclaimed', class: 'status-orange' };
  if (type === 'lost' && status === 'claimed') return { text: 'Found', class: 'status-green' };
  if (type === 'found' && (status === 'claimed' || status === 'completed') && is_surrendered) return { text: 'Completed', class: 'status-green' };
  if (type === 'found' && status === 'claimed') return { text: 'Claimed', class: 'status-green' };

  return { text: status, class: 'status-default' };  
}

function formatStatus(report) {
  if (report.status === 'completed') {
    return report.type === 'lost' ? "Found" : "Claimed";
  } else {
    return report.type === 'lost' ? "Not Found" : "Unclaimed";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('/web/components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const backBtn = document.querySelector('.back-button');
  backBtn.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('from') || 'all';
    window.location.href = `/web/lost-found.html?filter=${filter}`;
  });

  await loadReportDetails(); 
  setupEditIconListeners();
});
