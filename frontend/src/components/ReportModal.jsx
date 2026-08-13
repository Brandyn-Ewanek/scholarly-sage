import React from 'react';

export default function ReportModal({ report, onClose }) {
  if (!report) return null;

  const summary = report.executive_summary_2page || {};

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{report.query_type === 'comparative_synthesis' ? 'Comparative Synthesis Report' : '2-Page Executive Summary'}</h2>
          <button onClick={onClose} style={closeButtonStyle}>✕ Close</button>
        </div>
        <hr style={{ borderColor: '#334155', margin: '16px 0' }} />

        <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
          <h3>Abstract Overview</h3>
          <p>{summary.abstract_overview || 'No abstract available.'}</p>

          <h3>Core Findings & Metrics</h3>
          <ul>
            {(summary.core_findings || []).map((finding, idx) => (
              <li key={idx} style={{ marginBottom: '8px' }}>{finding}</li>
            ))}
          </ul>

          <h3>Methodology Analysis</h3>
          <p>{summary.methodology_analysis || 'N/A'}</p>

          <h3>Contrary Perspectives</h3>
          <p>{summary.contrary_perspectives || 'N/A'}</p>

          <h3>Strategic Implications</h3>
          <p>{summary.strategic_implications || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalContentStyle = {
  background: '#0f172a',
  color: '#f8fafc',
  padding: '24px',
  borderRadius: '12px',
  width: '800px',
  maxWidth: '90%',
  border: '1px solid #334155',
};

const closeButtonStyle = {
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
};