import axios from 'axios';

// Uses the Vercel environment variable if available, otherwise defaults to localhost for local testing
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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

export const synthesizeReports = async (reportAKey, reportBKey) => {
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