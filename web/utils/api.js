let config = null;

async function loadConfig() {
  if (!config) {
    const res = await fetch('/web/config.json');
    config = await res.json();
  }
  return config;
}

export async function getFinderData() {
  const response = await fetch('/web/config.json');
  const config = await response.json();
  const baseUrl = config.API_BASE_URL;

  const dataRes = await fetch(`${baseUrl}/finder/data`);
  if (!dataRes.ok) {
    throw new Error('Failed to fetch finder data');
  }
  return await dataRes.json();
}

export async function getRepresentative(sectionId) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const res = await fetch(`${baseUrl}/finder/representative/${encodeURIComponent(sectionId)}`);
  if (!res.ok) throw new Error('Failed to fetch representative');
  return await res.json();
}

export async function getAllReports() {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const response = await fetch(`${baseUrl}/reports`);
  if (!response.ok) throw new Error('Failed to fetch reports');

  let data;
  try {
    data = await response.json();
  } catch (err) {
    console.error("Failed to parse JSON from /reports:", err);
    throw new Error('Invalid JSON response from server');
  }

  const safeReports = Array.isArray(data) ? data.filter(report => {
    const isValid =
      report.report_id &&
      report.type &&
      report.item_name &&
      typeof report.description === 'string' &&
      report.contact_info &&
      report.status &&
      typeof report.is_surrendered === 'boolean' &&
      typeof report.management_code === 'string' &&
      report.created_at &&
      report.updated_at;

    if (!isValid) console.warn("Skipping malformed report:", report);
    return isValid;
  }) : [];

  return safeReports;
}

export async function submitReport(reportData) {
  const baseUrl = config.API_BASE_URL;
  console.log('Base URL:', baseUrl);

  const validData = {
    type: reportData.type,
    item_name: reportData.item_name,
    description: reportData.description,
    contact_info: reportData.contact_info,
    is_surrendered: reportData.is_surrendered,
    management_code: reportData.management_code
  };

  const response = await fetch(`${baseUrl}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(validData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Error response from API:", errorData);
    throw new Error(errorData.detail?.[0]?.msg || 'Failed to submit report.');
  }

  return await response.json();
}

export async function uploadPhoto(reportId, file) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;
  const formData = new FormData();
  formData.append("photo", file);

  const res = await fetch(`${baseUrl}/reports/${reportId}/upload_photo`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to upload photo.");
  }

  return await res.json();  
}

export async function submitFlag(reportId, reason) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const response = await fetch(`${baseUrl}/reports/${reportId}/flags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to flag report");
  }

  return await response.json();  
}

export async function submitResponse(reportId, responseData) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const res = await fetch(`${baseUrl}/reports/${reportId}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(responseData)
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to submit response');
  }

  return await res.json();
}

export async function updateReport(reportId, reportUpdate, managementCode) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const response = await fetch(
    `${baseUrl}/reports/${reportId}?management_code=${encodeURIComponent(managementCode)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportUpdate),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to update report.");
  }

  return await response.json();
}

export async function deleteReport(reportId, managementCode) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const response = await fetch(
    `${baseUrl}/reports/${reportId}?management_code=${encodeURIComponent(managementCode)}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to delete report.");
  }

  return await response.json(); 
}

export async function markReportAsCompleted(reportId, managementCode) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const url = new URL(`${baseUrl}/reports/${reportId}/status`);
  if (managementCode) url.searchParams.append('management_code', managementCode);

  const response = await fetch(url.toString(), {
    method: 'PATCH'
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to mark report as completed');
  }

  return await response.json();
}

export async function getReportResponses(reportId, managementCode) {
  const config = await loadConfig();
  const baseUrl = config.API_BASE_URL;

  const url = new URL(`${baseUrl}/reports/${reportId}/responses`);
  url.searchParams.append('management_code', managementCode);

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to fetch report responses');
  }

  return await res.json();  
}
