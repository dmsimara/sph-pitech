import { getAllReports, updateReport, deleteReport, markReportAsCompleted, getReportResponses } from '../../utils/api.js';
import { showSpinner, hideSpinner } from './spinner.js';
import { setupSidebarToggle } from './base.js';

let verifiedCode = ""; 

async function loadReportDetails() {
  showSpinner();
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
      ? 'assets/img/HIDDEN.png'
      : (report.photo_urls?.[0] || 'assets/img/placeholder.png');

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
    } else if (report.type === 'found') {
      infoHTML += `
        <p><strong>Reported On:</strong> ${new Date(report.created_at).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-pill ${statusClass}">${statusLabel}</span></p>
        <div style="background: #f0f0f0; padding: 8px; border-radius: 4px; margin-top: 12px; font-style: italic; color: var(--color-secondary);">
          <i class="fas fa-info-circle"></i> 
          ${report.is_surrendered
            ? "This item has been turned over to the PUP Guardhouse. You may visit in person to claim it — no need to submit a request. If you have any questions, feel free to contact the founder using the details provided in the post."
            : "If you believe you are the rightful owner, please file a claim with the location where you lost the item and any identifying details for verification."
          }
        </div>
      `;
    }

    infoContainer.innerHTML = infoHTML;

    if ((report.type === 'lost') || (report.type === 'found' && !report.is_surrendered)) {
      const btnContainer = document.createElement('div');
      btnContainer.classList.add('action-buttons');

      const btn1 = document.createElement('button');
      btn1.className = 'btn-outline-secondary';
      btn1.textContent = report.type === 'lost' ? 'See Who Found It' : 'See Claim Attempts';
      btn1.addEventListener('click', async () => {
        const codeModal = document.getElementById("code-modal");
        codeModal.setAttribute("data-mode", "view");
        codeModal.setAttribute("data-report-id", report.report_id);
        codeModal.setAttribute("data-report-type", report.type); 
        document.getElementById("code-input").value = "";
        document.getElementById("code-error").style.display = "none";
        codeModal.style.display = "flex";
      });

      const btn2 = document.createElement('button');
      btn2.className = 'btn-filled-secondary';
      btn2.textContent = 'Mark as Completed';
      btn2.addEventListener('click', () => {
        const codeModal = document.getElementById("code-modal");
        codeModal.setAttribute("data-mode", "complete"); 
        codeModal.setAttribute("data-report-id", report.report_id);

        document.getElementById("code-input").value = "";
        document.getElementById("code-error").style.display = "none";
        codeModal.style.display = "flex";
      });

      btnContainer.appendChild(btn1);
      btnContainer.appendChild(btn2);
      document.querySelector('.report-info').insertAdjacentElement('afterend', btnContainer);
    }

    if (report.type === "found" && report.is_surrendered) {
      document.querySelectorAll(".edit-icon, .delete-icon").forEach(icon => {
        icon.style.display = "none";
      });
    }

    setupEditIconListeners();

  } catch (err) {
    console.error("Failed to load report:", err);
  } finally {
    hideSpinner();
  }
}

function setupEditIconListeners() {
  document.querySelectorAll(".edit-icon, .delete-icon").forEach(icon => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();

      const urlParams = new URLSearchParams(window.location.search);
      const reportId = urlParams.get("report_id");

      if (!reportId) {
        console.error("No report_id found in URL.");
        return;
      }

      const mode = icon.classList.contains("edit-icon") ? "edit" : "delete";
      const codeModal = document.getElementById("code-modal");
      codeModal.setAttribute("data-mode", mode);
      codeModal.setAttribute("data-report-id", reportId);

      document.getElementById("code-input").value = "";
      document.getElementById("code-error").style.display = "none";
      codeModal.style.display = "flex";
    });
  });

  document.getElementById("confirm-code-btn").addEventListener("click", async () => {
    showSpinner();
    const codeEntered = document.getElementById("code-input").value.trim();
    const reportId = document.getElementById("code-modal").getAttribute("data-report-id");
    const mode = document.getElementById("code-modal").getAttribute("data-mode");

    if (!reportId || codeEntered.length !== 6) {
      document.getElementById("code-error").style.display = "block";
      hideSpinner();
      return;
    }

    try {
      await updateReport(reportId, {}, codeEntered);  
      verifiedCode = codeEntered;

      if (mode === "edit") {
        const reports = await getAllReports();
        const report = reports.find(r => r.report_id === reportId);
        if (!report) throw new Error("Report not found.");

        const itemSelect = document.getElementById("edit-item-name-select");
        const customInputRow = document.getElementById("edit-custom-item-row");
        const customInput = document.getElementById("edit-custom-item-name");

        if (!itemSelect || !customInputRow || !customInput) {
          console.error("Edit item name fields not found in DOM.");
          return;
        }

        const match = [...itemSelect.options].find(opt => opt.value === report.item_name);
        if (match) {
          itemSelect.value = report.item_name;
          customInputRow.style.display = "none";
          customInput.value = "";
        } else {
          itemSelect.value = "Other";
          customInput.value = report.item_name;
          customInputRow.style.display = "flex";
        }

        document.getElementById("edit-contact-info").value = report.contact_info || '';
        document.getElementById("edit-description").value = report.description || '';

        document.getElementById("edit-report-modal").style.display = "flex";
      } else if (mode === "delete") {
        document.getElementById("delete-modal").style.display = "flex";
      } else if (mode === "complete") {
        document.getElementById("code-modal").style.display = "none";
        document.getElementById("completed-modal").style.display = "flex";
      } else if (mode === "view") {
        const reportType = document.getElementById("code-modal").getAttribute("data-report-type");

        try {
          const responses = await getReportResponses(reportId, verifiedCode);

          const title = reportType === "lost" ? "Return Attempts" : "Claim Attempts";
          document.querySelector("#view-modal .modal-title").textContent = title;

          const tbody = document.getElementById("response-table-body");
          tbody.innerHTML = "";

          if (responses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="padding: 12px; font-style: italic;">No responses yet.</td></tr>`;
          } else {
            responses.forEach(resp => {
              const tr = document.createElement("tr");
              tr.innerHTML = `
                <td>${resp.name}</td>
                <td>${resp.contact_info}</td>
                <td>${resp.message}</td>
              `;
              tbody.appendChild(tr);
            });
          }

          document.getElementById("view-modal").style.display = "flex";
        } catch (err) {
          alert(err.message);
        }
      }

      document.getElementById("code-modal").style.display = "none";
      document.getElementById("code-error").style.display = "none";

    } catch (err) {
      console.error(`${mode} failed:`, err);
      document.getElementById("code-error").style.display = "block";
    } finally {
      hideSpinner();
    }
  });

  window.addEventListener("click", (e) => {
    const modal = document.getElementById("code-modal");
    if (e.target === modal) modal.style.display = "none";
  });

  document.querySelector(".close-code-modal").addEventListener("click", () => {
    document.getElementById("code-modal").style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("edit-item-name-select");
  const customInputRow = document.getElementById("edit-custom-item-row");

  select.addEventListener("change", () => {
    if (select.value === "Other") {
      customInputRow.style.display = "flex";
    } else {
      customInputRow.style.display = "none";
    }
  });
});

document.getElementById("edit-report-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showSpinner();

  const reportId = document.getElementById("code-modal").getAttribute("data-report-id");

  if (!reportId || !verifiedCode) {
    alert("Missing report ID or verified code.");
    hideSpinner();
    return;
  }

  let itemName = document.getElementById("edit-item-name-select").value;
  if (itemName === "Other") {
    itemName = document.getElementById("edit-custom-item-name").value.trim();
  }

  const updatedData = {
    item_name: itemName,
    contact_info: document.getElementById("edit-contact-info").value.trim(),
    description: document.getElementById("edit-description").value.trim()
  };

  try {
    await updateReport(reportId, updatedData, verifiedCode);

    document.getElementById("edit-report-modal").style.display = "none";

    document.getElementById("confirmation-message").textContent = "Changes Saved!";
    document.getElementById("confirmation-details").textContent = "The report has been updated successfully.";
    document.getElementById("confirmation-modal").style.display = "flex";

  } catch (err) {
    alert(`Failed to update: ${err.message}`);
  } finally {
    hideSpinner();
  }
});

document.getElementById("cancel-delete-btn").addEventListener("click", () => {
  document.getElementById("delete-modal").style.display = "none";
});

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  showSpinner();

  const reportId = document.getElementById("code-modal").getAttribute("data-report-id");

  if (!reportId || !verifiedCode) {
    alert("Missing report ID or verified code.");
    hideSpinner();
    return;
  }

  try {
    await deleteReport(reportId, verifiedCode);

    document.getElementById("delete-modal").style.display = "none";

    document.getElementById("confirmation-message").textContent = "Report Deleted!";
    document.getElementById("confirmation-details").textContent = "The report and all its associated data have been removed.";
    document.getElementById("confirmation-modal").style.display = "flex";

  } catch (err) {
    alert(`Failed to delete: ${err.message}`);
  } finally {
    hideSpinner();
  }
});

function getStatusLabel(report) {
  const { type, status, is_surrendered } = report;

  if (type === 'lost' && status === 'unclaimed') return { text: 'Not Found', class: 'status-orange' };
  if (type === 'found' && status === 'unclaimed') return { text: 'Unclaimed', class: 'status-orange' };
  if (type === 'lost' && status === 'completed') return { text: 'Found', class: 'status-green' };
  if (type === 'found' && (status === 'claimed' || status === 'completed') && is_surrendered) return { text: 'Completed', class: 'status-green' };
  if (type === 'found' && status === 'claimed') return { text: 'Claimed', class: 'status-green' };

  return { text: status, class: 'status-default' };
}

document.querySelectorAll('.close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    document.getElementById(modalId).style.display = 'none';
  });
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('custom-modal')) {
    e.target.style.display = 'none';
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  setupSidebarToggle();

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

  document.querySelector('.back-button')?.addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('from') || 'all';
    window.location.href = `lost-found.html?filter=${filter}`;
  });

  try {
    await loadReportDetails();
  } catch (err) {
    console.error("Failed to load report details:", err);
    alert("Something went wrong while loading the report.");
  } 

  setupEditIconListeners();

  document.getElementById("confirm-ok-btn").addEventListener("click", () => {
    document.getElementById("confirmation-modal").style.display = "none";
    const currentUrl = window.location.href;
    window.location.href = currentUrl;
  });

});

document.getElementById("cancel-complete-btn").addEventListener("click", () => {
  document.getElementById("completed-modal").style.display = "none";
});

document.getElementById("confirm-complete-btn").addEventListener("click", async () => {
  showSpinner();
  const reportId = document.getElementById("code-modal").getAttribute("data-report-id");
  if (!reportId || !verifiedCode) {
    alert("Missing report ID or verified code.");
    hideSpinner();
    return;
  }

  try {
    await markReportAsCompleted(reportId, verifiedCode);

    document.getElementById("completed-modal").style.display = "none";
    document.getElementById("confirmation-message").textContent = "Marked as Completed!";
    document.getElementById("confirmation-details").textContent = "The report has been marked as completed.";
    document.getElementById("confirmation-modal").style.display = "flex";
  } catch (err) {
    alert(`Failed to mark as completed: ${err.message}`);
  } finally {
    hideSpinner();
  }
});

document.querySelectorAll('.close-modal-x').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    document.getElementById(modalId).style.display = 'none';
  });
});
