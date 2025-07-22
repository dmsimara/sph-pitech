import { getAllReports } from '../../utils/api.js';

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

  loadReportDetails();
});
