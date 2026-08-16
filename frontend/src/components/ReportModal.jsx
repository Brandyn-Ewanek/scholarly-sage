import React from 'react';

// Helper to strip HTML from titles so the header is always clean text
const cleanTitle = (text) => {
    if (!text) return "Untitled Report";
    return String(text)
        .replace(/&lt;\/?b&gt;/gi, "")
        .replace(/<\/?[^>]+(>|$)/g, "");
};

export default function ReportModal({ report, onClose }) {
  if (!report) return null;

  const summary = report.executive_summary_2page || {};
  const isSynthesis = report.query_type === 'comparative_synthesis';
  const reportTitle = cleanTitle(summary.report_title);

  // Un-escapes HTML brackets so the bolding actually applies!
  const safeHTML = (text) => {
      if (!text) return { __html: '' };
      return { __html: String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>') };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
      {/* REPLACED: Changed Synthesis border to Emerald Green (#10b981) */}
      <div style={{ background: '#0f172a', width: '100%', maxWidth: '900px', maxHeight: '90vh', borderRadius: '12px', border: `1px solid ${isSynthesis ? '#10b981' : '#38bdf8'}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020617' }}>
          <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px' }}>
            {isSynthesis ? '⚡ Comparative Synthesis Report' : 'Primary Research Report'}
          </h2>
          <button onClick={onClose} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            ✕ Close
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '32px', overflowY: 'auto', flex: 1, color: '#e2e8f0' }}>
          
          {/* REPLACED: Changed Synthesis Title to Emerald Green (#10b981) */}
          <h1 style={{ color: isSynthesis ? '#10b981' : '#38bdf8', marginTop: 0, marginBottom: '24px', fontSize: '32px' }}>
            {reportTitle}
          </h1>

          {/* Abstract - Using dangerouslySetInnerHTML to render bold tags */}
          {summary.abstract_overview && (
            <>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '16px' }}>Abstract Overview</h3>
              <div style={{ lineHeight: '1.7', fontSize: '15px', color: '#cbd5e1', marginBottom: '32px' }} dangerouslySetInnerHTML={safeHTML(summary.abstract_overview)}></div>
            </>
          )}

          {/* Findings - Using dangerouslySetInnerHTML to render bold tags */}
          {summary.core_findings && summary.core_findings.length > 0 && (
            <>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '16px' }}>Core Findings & Metrics</h3>
              <ul style={{ lineHeight: '1.7', fontSize: '15px', color: '#cbd5e1', marginBottom: '32px', paddingLeft: '24px' }}>
                {summary.core_findings.map((finding, idx) => (
                  <li key={idx} style={{ marginBottom: '12px' }} dangerouslySetInnerHTML={safeHTML(finding)}></li>
                ))}
              </ul>
            </>
          )}

          {/* Methodology - Using dangerouslySetInnerHTML to render bold tags */}
          {summary.methodology_analysis && (
            <>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '16px' }}>Methodology Analysis</h3>
              <p style={{ lineHeight: '1.7', fontSize: '15px', color: '#cbd5e1', marginBottom: '32px' }} dangerouslySetInnerHTML={safeHTML(summary.methodology_analysis)}></p>
            </>
          )}

          {/* Contrary Perspectives - Using dangerouslySetInnerHTML to render bold tags */}
          {summary.contrary_perspectives && (
            <>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '16px' }}>Contrary Perspectives</h3>
              <p style={{ lineHeight: '1.7', fontSize: '15px', color: '#cbd5e1', marginBottom: '32px' }} dangerouslySetInnerHTML={safeHTML(summary.contrary_perspectives)}></p>
            </>
          )}

          {/* Implications - Using dangerouslySetInnerHTML to render bold tags */}
          {summary.strategic_implications && (
            <>
              <h3 style={{ color: '#f8fafc', fontSize: '20px', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '16px' }}>Strategic Implications</h3>
              <p style={{ lineHeight: '1.7', fontSize: '15px', color: '#cbd5e1', marginBottom: '32px' }} dangerouslySetInnerHTML={safeHTML(summary.strategic_implications)}></p>
            </>
          )}
          
          {summary.primary_link && !isSynthesis && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #1e293b', textAlign: 'right' }}>
                  <a href={summary.primary_link} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', background: '#0ea5e9', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '15px', display: 'inline-block', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = '#0284c7'} onMouseOut={(e) => e.target.style.background = '#0ea5e9'}>
                      Read Primary Source ↗
                  </a>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}