import React, { useEffect, useState } from 'react';
import { fetchAllReports, fetchReportByKey, synthesizeReports, executeResearch } from './api';
import GraphView from './components/GraphView';
import ReportModal from './components/ReportModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('research'); 
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
    setLatestSearchResult(null); 
    
    try {
      const res = await executeResearch(searchQuery);
      setLatestSearchResult(res.report);
      await loadReports(); 
    } catch (err) {
      console.error('Research execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = async (fileKey) => {
    setLoading(true);
    try {
      const data = await fetchReportByKey(fileKey);
      setActiveReport(data); 
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
        console.warn('You can only select 2 reports for comparative synthesis.');
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
    } finally {
      setLoading(false);
      setSelectedKeys([]); 
    }
  };

  const getCategoryColor = (majorCat, subCat, title) => {
      const isGeneral = (majorCat === 'General Research' || !majorCat);
      
      // 1. Calculate Base HUE from Major Category (or Title if General)
      const hueSeedStr = isGeneral ? String(title) : String(majorCat);
      const GOLDEN_ANGLE = 137.5;
      let hueSum = 0;
      for (let i = 0; i < hueSeedStr.length; i++) {
          hueSum += hueSeedStr.charCodeAt(i);
      }
      const hue = (hueSum * GOLDEN_ANGLE) % 360;
      
      // 2. Calculate SHADE (Lightness) from Sub Category
      let lightness = 60; // Default lightness is 60%
      if (!isGeneral && subCat) {
          let shadeSum = 0;
          const shadeStr = String(subCat);
          for (let i = 0; i < shadeStr.length; i++) {
              shadeSum += shadeStr.charCodeAt(i);
          }
          // Vary the lightness between 45% (darker) and 75% (lighter)
          lightness = 45 + (shadeSum % 30);
      }
      
      return `hsl(${hue}, 85%, ${lightness}%)`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#020617', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Scholarly Sage
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setActiveTab('research')}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'research' ? '#2563eb' : '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
          >
            ⚡ Fast Research
          </button>
          <button
            onClick={() => setActiveTab('library')}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'library' ? '#2563eb' : '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
          >
            📚 Library ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'graph' ? '#2563eb' : '#1e293b', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
          >
            🌐 Knowledge Graph
          </button>
        </div>
      </header>

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
                style={{ flex: 1, padding: '16px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '16px', outline: 'none' }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '16px 32px', borderRadius: '8px', border: 'none', background: loading ? '#475569' : '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: loading ? 'wait' : 'pointer' }}
              >
                {loading ? 'Analyzing...' : 'Search & Analyze'}
              </button>
            </form>

            {latestSearchResult && latestSearchResult.executive_summary_2page && (
              <div style={{ background: '#0f172a', padding: '32px', borderRadius: '12px', border: '1px solid #1e293b', animation: 'fadeIn 0.5s ease-in-out' }}>
                <div style={{ borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '20px' }}>
                    <span style={{ background: '#059669', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {latestSearchResult.taxonomy?.major_category || 'General Research'}
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
                        <li key={idx} style={{ marginBottom: '12px' }} dangerouslySetInnerHTML={{__html: finding}}></li>
                    ))}
                </ul>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: '#020617', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                    <div>
                        <h4 style={{ color: '#f8fafc', margin: '0 0 12px 0', fontSize: '16px' }}>⚙️ Mechanism / Methodology</h4>
                        <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: 0 }} dangerouslySetInnerHTML={{__html: latestSearchResult.executive_summary_2page.methodology_analysis}}></p>
                    </div>
                    <div>
                        <h4 style={{ color: '#f8fafc', margin: '0 0 12px 0', fontSize: '16px' }}>⚠️ Contrary Perspectives</h4>
                        <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: 0 }} dangerouslySetInnerHTML={{__html: latestSearchResult.executive_summary_2page.contrary_perspectives}}></p>
                    </div>
                </div>

                {latestSearchResult.executive_summary_2page.primary_link && (
                    <div style={{ textAlign: 'right', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                        <a href={latestSearchResult.executive_summary_2page.primary_link} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', background: '#0ea5e9', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px', display: 'inline-block', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = '#0284c7'} onMouseOut={(e) => e.target.style.background = '#0ea5e9'}>
                            Read Primary Source ↗
                        </a>
                    </div>
                )}
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
                    const isSynthesis = item.query_type === 'comparative_synthesis';
                    const majorCatStr = item.taxonomy?.major_category || 'General Research';
                    const subCatStr = item.taxonomy?.sub_category || 'General';
                    const title = item.executive_summary_2page?.report_title || item.original_query || item.file_key.split('/').pop().replace('.json', '');
                    const catColor = isSynthesis ? '#e056fd' : getCategoryColor(majorCatStr, subCatStr, title);
                    
                    return (
                    <div 
                        key={item.file_key} 
                        onClick={() => handleSelectReport(item.file_key)}
                        style={{ 
                            background: '#0f172a', padding: '20px', borderRadius: '10px', 
                            border: '1px solid #1e293b', borderTop: `3px solid ${catColor}`, cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = catColor; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', color: catColor, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            {isSynthesis ? '⚡ Comparative Synthesis' : majorCatStr}
                          </span>
                          {!isSynthesis && <span style={{ fontSize: '10px', color: '#64748b' }}>&gt; {subCatStr}</span>}
                        </div>
                        <h4 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '16px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {title}
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {new Date(item.last_modified).toLocaleDateString()}
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
            <div style={{ width: '340px', borderRight: '1px solid #1e293b', padding: '24px', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Comparative Synthesis</h4>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px', lineHeight: '1.5' }}>
                Select exactly 2 reports from your library below. Claude 4.6 will analyze them together and generate a glowing conceptual tether.
              </p>
              
              <button
                onClick={handleSynthesize}
                disabled={selectedKeys.length !== 2 || loading}
                style={{
                  background: selectedKeys.length === 2 ? '#10b981' : '#334155', color: selectedKeys.length === 2 ? '#fff' : '#94a3b8',
                  border: 'none', padding: '14px', borderRadius: '8px', cursor: selectedKeys.length === 2 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold', marginBottom: '24px', transition: 'all 0.2s',
                  boxShadow: selectedKeys.length === 2 ? '0 4px 6px -1px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                {loading ? 'Synthesizing Data...' : `Synthesize Selected (${selectedKeys.length}/2)`}
              </button>

              <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e8f0', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>Select Sources</h4>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                {(reports || []).filter(item => item.query_type !== 'comparative_synthesis').map((item) => {
                  const majorCatStr = item.taxonomy?.major_category || 'General Research';
                  const subCatStr = item.taxonomy?.sub_category || 'General';
                  const title = item.executive_summary_2page?.report_title || item.original_query || item.file_key.split('/').pop().replace('.json', '');
                  const catColor = getCategoryColor(majorCatStr, subCatStr, title);
                  
                  return (
                  <div
                    key={item.file_key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', marginBottom: '8px', 
                      background: selectedKeys.includes(item.file_key) ? `${catColor}22` : '#020617',
                      borderRadius: '8px', border: `1px solid ${selectedKeys.includes(item.file_key) ? catColor : '#1e293b'}`,
                      borderLeft: `3px solid ${catColor}`, transition: 'border-color 0.2s, background 0.2s'
                    }}
                  >
                    <input type="checkbox" checked={selectedKeys.includes(item.file_key)} onChange={() => toggleCheckbox(item.file_key)} style={{ marginTop: '4px', cursor: 'pointer', width: '16px', height: '16px', accentColor: catColor }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '9px', color: catColor, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>{majorCatStr}</span>
                      <p onClick={() => handleSelectReport(item.file_key)} style={{ cursor: 'pointer', fontSize: '13px', margin: '2px 0 4px 0', color: '#e2e8f0', lineHeight: '1.4', fontWeight: '500' }}>
                        {title}
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {}
            <div style={{ flex: 1, position: 'relative', height: '100%', background: '#020617' }}>
              <GraphView reports={reports || []} onSelectReport={handleSelectReport} />
            </div>
          </div>
        )}
      </div>
      
      {activeReport && <ReportModal report={activeReport} onClose={() => setActiveReport(null)} />}
    </div>
  );
}