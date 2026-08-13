import React, { useEffect, useState } from 'react';
import { fetchAllReports, fetchReportByKey, synthesizeReports, executeResearch } from './api';
import GraphView from './components/GraphView';
import ReportModal from './components/ReportModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('research'); // 'research', 'library', or 'graph'
  const [reports, setReports] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [latestSearchResult, setLatestSearchResult] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await fetchAllReports();
      // Safely ensure reports is always an array
      const parsedReports = data.reports || data;
      setReports(Array.isArray(parsedReports) ? parsedReports : []); 
    } catch (err) {
      console.error('Failed to load reports:', err);
      setReports([]);
    }
  };

  const handleRunResearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setLatestSearchResult(null); // Clear previous results while loading
    
    try {
      const res = await executeResearch(searchQuery);
      setLatestSearchResult(res.report);
      // We don't automatically pop open the modal anymore, we display it inline.
      await loadReports(); // Refresh library with the new report
    } catch (err) {
      console.error('Research execution failed:', err);
      alert('Failed to execute research query. Check the backend console.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = async (fileKey) => {
    setLoading(true);
    try {
      const data = await fetchReportByKey(fileKey);
      setActiveReport(data); // Opens the modal for deep reading
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheckbox = (fileKey) => {
    if (selectedKeys.includes(fileKey)) {
      setSelectedKeys(selectedKeys.filter((k) => k !== fileKey));
    } else {
      if (selectedKeys.length >= 2) {
        alert('You can only select 2 reports for comparative synthesis.');
        return;
      }
      setSelectedKeys([...selectedKeys, fileKey]);
    }
  };

  const handleSynthesize = async () => {
    if (selectedKeys.length !== 2) return;
    setLoading(true);
    try {
      const result = await synthesizeReports(selectedKeys[0], selectedKeys[1]);
      setActiveReport(result.synthesis);
      await loadReports();
    } catch (err) {
      console.error('Synthesis failed:', err);
      alert('Failed to synthesize selected reports.');
    } finally {
      setLoading(false);
      setSelectedKeys([]); // Reset selection after synthesis
    }
  };

  // Helper to sync UI colors exactly with the 3D Graph nodes using HSL Shading
  const getCategoryColor = (majorCat, subCat) => {
      const catString = majorCat || 'General Research';
      const subString = subCat || 'General';
      
      // 1. Golden Angle Hash for maximum hue separation
      let hueHash = 0;
      for (let i = 0; i < catString.length; i++) {
          hueHash = catString.charCodeAt(i) + ((hueHash << 5) - hueHash);
          hueHash = hueHash & hueHash; // Convert to 32bit integer
      }
      // Multiply by 137.5 (Golden Angle) to forcefully scatter colors across the wheel
      const hue = Math.abs(hueHash * 137.5) % 360;

      // 2. Sub-Category Lightness calculation
      let lightHash = 0;
      for (let i = 0; i < subString.length; i++) {
          lightHash = subString.charCodeAt(i) + ((lightHash << 5) - lightHash);
          lightHash = lightHash & lightHash;
      }
      const lightness = 40 + (Math.abs(lightHash) % 30); // Shade between 40% to 70%
      
      return `hsl(${hue}, 85%, ${lightness}%)`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Navigation Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Scholarly Sage
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setActiveTab('research')}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: activeTab === 'research' ? '#2563eb' : '#1e293b',
              color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s'
            }}
          >
            ⚡ Fast Research
          </button>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: activeTab === 'library' ? '#2563eb' : '#1e293b',
              color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s'
            }}
          >
            📚 Library ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: activeTab === 'graph' ? '#2563eb' : '#1e293b',
              color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s'
            }}
          >
            🌐 Knowledge Graph
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {}
        {activeTab === 'research' && (
          <div style={{ flex: 1, padding: '40px', maxWidth: '900px', margin: '0 auto', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>Query Academic Literature</h3>
            <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Enter a topic to instantly scrape recent papers and generate a concise executive summary.</p>
            
            <form onSubmit={handleRunResearch} style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
              <input
                type="text"
                placeholder="Enter topic or keywords (e.g., Cat longevity, Autophagy mechanisms)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, padding: '16px', borderRadius: '8px', border: '1px solid #334155',
                  background: '#0f172a', color: '#fff', fontSize: '16px', outline: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '16px 32px', borderRadius: '8px', border: 'none',
                  background: loading ? '#475569' : '#2563eb', color: '#fff',
                  fontWeight: 'bold', fontSize: '16px', cursor: loading ? 'wait' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {loading ? 'Analyzing...' : 'Search & Analyze'}
              </button>
            </form>

            {/* Inline Dashboard for Immediate Reading */}
            {latestSearchResult && latestSearchResult.executive_summary_2page && (
              <div style={{ 
                background: '#0f172a', padding: '32px', borderRadius: '12px', 
                border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                animation: 'fadeIn 0.5s ease-in-out'
              }}>
                <div style={{ borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '20px' }}>
                    <span style={{ background: '#059669', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {latestSearchResult.taxonomy?.assigned_category || 'General Research'}
                    </span>
                    <h2 style={{ margin: '16px 0 8px 0', color: '#38bdf8', fontSize: '28px', lineHeight: '1.3' }}>
                        {latestSearchResult.executive_summary_2page.report_title || 'Research Analysis'}
                    </h2>
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
                        ✓ Scraped {latestSearchResult.all_source_papers?.length || 0} papers &nbsp;|&nbsp; ✓ Saved to AWS S3
                    </p>
                </div>
                
                <h4 style={{ color: '#f8fafc', marginBottom: '12px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🚀 Core Findings & Hard Metrics
                </h4>
                <ul style={{ color: '#cbd5e1', paddingLeft: '24px', marginBottom: '28px', lineHeight: '1.7', fontSize: '15px' }}>
                    {latestSearchResult.executive_summary_2page.core_findings?.map((finding, idx) => (
                        <li key={idx} style={{ marginBottom: '12px' }}>{finding}</li>
                    ))}
                </ul>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: '#020617', padding: '20px', borderRadius: '8px' }}>
                    <div>
                        <h4 style={{ color: '#f8fafc', margin: '0 0 12px 0', fontSize: '16px' }}>⚙️ Mechanism / Methodology</h4>
                        <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                          {latestSearchResult.executive_summary_2page.methodology_analysis}
                        </p>
                    </div>
                    <div>
                        <h4 style={{ color: '#f8fafc', margin: '0 0 12px 0', fontSize: '16px' }}>⚠️ Contrary Perspectives</h4>
                        <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                          {latestSearchResult.executive_summary_2page.contrary_perspectives}
                        </p>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {}
        {activeTab === 'library' && (
          <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>Your Research Library</h3>
            <p style={{ color: '#94a3b8', marginBottom: '32px' }}>All previously scraped and analyzed reports permanently archived in your AWS S3 Data Lake.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {(reports || []).map((item) => {
                    const majorCatStr = item.taxonomy?.major_category || item.taxonomy?.assigned_category || 'General Research';
                    const subCatStr = item.taxonomy?.sub_category || 'General';
                    const catColor = getCategoryColor(majorCatStr, subCatStr);
                    const title = item.executive_summary_2page?.report_title || item.original_query || item.file_key.split('/').pop().replace('.json', '');
                    
                    return (
                    <div 
                        key={item.file_key} 
                        onClick={() => handleSelectReport(item.file_key)}
                        style={{ 
                            background: '#0f172a', padding: '20px', borderRadius: '10px', 
                            border: '1px solid #1e293b', borderTop: `3px solid ${catColor}`, cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = catColor; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', color: catColor, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            {majorCatStr}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>&gt; {subCatStr}</span>
                        </div>
                        <h4 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '16px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {title}
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {new Date(item.last_modified).toLocaleDateString()}
                          </span>
                          <span style={{ fontSize: '12px', color: '#059669', background: 'rgba(5, 150, 105, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            {(item.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                    </div>
                )})}
            </div>
          </div>
        )}

        {}
        {activeTab === 'graph' && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* Sidebar for Graph Actions */}
            <div style={{ width: '340px', borderRight: '1px solid #1e293b', padding: '24px', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Comparative Synthesis</h4>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5' }}>
                Select exactly 2 reports from your library below. Claude 4.6 will analyze them together and map their conceptual intersections.
              </p>
              
              <button
                onClick={handleSynthesize}
                disabled={selectedKeys.length !== 2 || loading}
                style={{
                  background: selectedKeys.length === 2 ? '#10b981' : '#334155',
                  color: selectedKeys.length === 2 ? '#fff' : '#94a3b8',
                  border: 'none', padding: '14px', borderRadius: '8px',
                  cursor: selectedKeys.length === 2 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold', marginBottom: '24px', transition: 'all 0.2s',
                  boxShadow: selectedKeys.length === 2 ? '0 4px 6px -1px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                {loading ? 'Synthesizing Data...' : `Synthesize Selected (${selectedKeys.length}/2)`}
              </button>

              <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e8f0', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>Select Sources</h4>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                {(reports || []).map((item) => {
                  const majorCatStr = item.taxonomy?.major_category || item.taxonomy?.assigned_category || 'General Research';
                  const subCatStr = item.taxonomy?.sub_category || 'General';
                  const catColor = getCategoryColor(majorCatStr, subCatStr);
                  const title = item.executive_summary_2page?.report_title || item.original_query || item.file_key.split('/').pop().replace('.json', '');
                  
                  return (
                  <div
                    key={item.file_key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px',
                      marginBottom: '8px', 
                      background: selectedKeys.includes(item.file_key) ? `${catColor}22` : '#020617',
                      borderRadius: '8px', 
                      border: `1px solid ${selectedKeys.includes(item.file_key) ? catColor : '#1e293b'}`,
                      borderLeft: `3px solid ${catColor}`, // Visually links to the node color
                      transition: 'border-color 0.2s, background 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(item.file_key)}
                      onChange={() => toggleCheckbox(item.file_key)}
                      style={{ marginTop: '4px', cursor: 'pointer', width: '16px', height: '16px', accentColor: catColor }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '9px', color: catColor, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        {catStr}
                      </span>
                      <p 
                        onClick={() => handleSelectReport(item.file_key)}
                        style={{ cursor: 'pointer', fontSize: '13px', margin: '2px 0 4px 0', color: '#e2e8f0', lineHeight: '1.4', wordBreak: 'break-word', fontWeight: '500' }}
                      >
                        {title}
                      </p>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Query: "{item.original_query || 'Unknown'}"</span>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* Main Graph View Area */}
            <div style={{ flex: 1, position: 'relative', height: '100%', background: '#020617' }}>
              <GraphView reports={reports || []} onSelectReport={handleSelectReport} />
            </div>
          </div>
        )}
      </div>

      {/* Deep-Dive Report Modal */}
      {activeReport && <ReportModal report={activeReport} onClose={() => setActiveReport(null)} />}
    </div>
  );
}