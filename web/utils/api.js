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
