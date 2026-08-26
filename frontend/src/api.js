import axios from 'axios';

// We are hardcoding this to the exact, correct Render URL.
// No environment variables, no "-backend". Just the pure URL.
const API_BASE_URL = 'https://scholarly-sage.onrender.com';

export const fetchAllReports = async () => {
  const response = await fetch(`${API_BASE_URL}/api/reports`);
  if (!response.ok) {
    throw new Error(`Failed to fetch reports: ${response.statusText}`);
  }
  return response.json();
};

export const fetchReportByKey = async (fileKey) => {
  // Using encodeURIComponent safely passes file paths with slashes in the URL
  const response = await axios.get(`${API_BASE_URL}/api/reports/${encodeURIComponent(fileKey)}`);
  return response.data;
};

export const deleteReportByKey = async (fileKey) => {
  const response = await fetch(`${API_BASE_URL}/api/reports/${encodeURIComponent(fileKey)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete report: ${response.statusText}`);
  }
  return response.json();
};

export const executeResearch = async (query) => {
  const response = await fetch(`${API_BASE_URL}/api/research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to execute research: ${response.statusText}`);
  }
  return response.json();
};

export const synthesizeReports = async (report_a_key, report_b_key) => {
  const response = await fetch(`${API_BASE_URL}/api/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ report_a_key, report_b_key }),
  });

  if (!response.ok) {
    throw new Error(`Failed to synthesize reports: ${response.statusText}`);
  }
  return response.json();
};