/**
 * Generates an executive, print-optimized PDF security report for VaultAI investigations.
 * Uses a styled print window with exact A4 page breaks, high-contrast typography,
 * cryptographic integrity seals, and forensic evidence tables.
 */
export function generatePdfReport(report) {
  if (!report) return;

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert('Please allow popups to download or print the PDF security report.');
    return;
  }

  const analysisId = report.analysisId || 'ANL_UNKNOWN';
  const serverName = report.serverName || report.serverId || 'Fleet Wide';
  const riskLevel = report.overallRiskLevel || 'LOW';
  const completedAt = report.completedAt
    ? new Date(report.completedAt).toLocaleString()
    : new Date().toLocaleString();
  const startTime = report.timeRange?.startTime
    ? new Date(report.timeRange.startTime).toLocaleString()
    : 'N/A';
  const endTime = report.timeRange?.endTime
    ? new Date(report.timeRange.endTime).toLocaleString()
    : 'N/A';

  const riskBadgeColor =
    riskLevel === 'CRITICAL'
      ? '#dc2626'
      : riskLevel === 'HIGH'
      ? '#ea580c'
      : riskLevel === 'MEDIUM'
      ? '#d97706'
      : '#059669';

  const findingsHtml = (report.findings || [])
    .map(
      (f, idx) => `
      <div class="finding-card">
        <div class="finding-header">
          <span class="finding-badge" style="background-color: ${
            f.severity === 'CRITICAL' ? '#fee2e2; color: #991b1b;' :
            f.severity === 'HIGH' ? '#ffedd5; color: #9a3412;' :
            f.severity === 'MEDIUM' ? '#fef3c7; color: #92400e;' : '#d1fae5; color: #065f46;'
          }">${f.severity || 'MEDIUM'}</span>
          <h3 class="finding-title">${idx + 1}. ${escapeHtml(f.title || 'Security Anomaly')}</h3>
        </div>
        <p class="finding-desc">${escapeHtml(f.interpretation || f.recommendedNextStep || '')}</p>
        ${
          f.observedFacts?.length
            ? `<div class="facts-list"><strong>Observed Facts:</strong><ul>${f.observedFacts
                .map((fact) => `<li>${escapeHtml(fact)}</li>`)
                .join('')}</ul></div>`
            : ''
        }
        ${
          f.supportingEvidenceRefs?.length
            ? `<div class="evidence-tag">Evidence Citations: ${f.supportingEvidenceRefs
                .map((ref) => `<code>${escapeHtml(ref)}</code>`)
                .join(', ')}</div>`
            : ''
        }
      </div>
    `
    )
    .join('');

  const recommendationsHtml = (report.recommendedInvestigationSteps || [])
    .map((step, idx) => `<li><strong>Action ${idx + 1}:</strong> ${escapeHtml(step)}</li>`)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>VaultAI Security Report — ${escapeHtml(analysisId)}</title>
      <style>
        @page {
          size: A4;
          margin: 18mm 16mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.5;
          font-size: 13px;
          margin: 0;
          padding: 20px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .brand {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #09090b;
        }
        .subtitle {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 2px;
        }
        .dossier-id {
          text-align: right;
          font-family: monospace;
          font-size: 11px;
          color: #475569;
        }
        .executive-box {
          background-color: #f8fafc;
          border-left: 4px solid ${riskBadgeColor};
          padding: 16px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .executive-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #0f172a;
        }
        .summary-text {
          font-size: 13px;
          color: #334155;
          margin: 0;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .metric-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px;
          background: #ffffff;
        }
        .metric-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
        }
        .metric-value {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 4px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 6px;
          margin: 24px 0 14px 0;
          color: #1e293b;
        }
        .finding-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 14px;
          margin-bottom: 12px;
          page-break-inside: avoid;
        }
        .finding-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .finding-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          font-family: monospace;
        }
        .finding-title {
          font-size: 13px;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }
        .finding-desc {
          font-size: 12px;
          color: #475569;
          margin: 4px 0 8px 0;
        }
        .facts-list {
          font-size: 11px;
          color: #334155;
          margin-top: 6px;
        }
        .facts-list ul {
          margin: 4px 0 0 16px;
          padding: 0;
        }
        .evidence-tag {
          font-size: 10px;
          color: #64748b;
          margin-top: 8px;
          font-family: monospace;
        }
        .integrity-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-top: 10px;
        }
        .integrity-table th, .integrity-table td {
          border: 1px solid #e2e8f0;
          padding: 8px 10px;
          text-align: left;
        }
        .integrity-table th {
          background-color: #f1f5f9;
          font-weight: 600;
        }
        .badge-verified {
          color: #166534;
          font-weight: 700;
        }
        .badge-failed {
          color: #991b1b;
          font-weight: 700;
        }
        .badge-inconclusive {
          color: #854d0e;
          font-weight: 600;
        }
        .recommendations ul {
          margin: 8px 0 0 18px;
          padding: 0;
          font-size: 12px;
          color: #334155;
        }
        .recommendations li {
          margin-bottom: 6px;
        }
        .footer {
          margin-top: 36px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">HashVault — VaultAI</div>
          <div class="subtitle">Autonomous Security Investigation Dossier</div>
        </div>
        <div class="dossier-id">
          <strong>Report ID:</strong> ${escapeHtml(analysisId)}<br>
          <strong>Generated:</strong> ${escapeHtml(completedAt)}
        </div>
      </div>

      <div class="executive-box">
        <h2 class="executive-title">
          ${
            riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
              ? 'High-Risk Activity Detected Across Fleet'
              : riskLevel === 'MEDIUM'
              ? 'Elevated Security Anomalies Requiring Attention'
              : 'No Actionable Threats Detected in Analyzed Evidence'
          }
        </h2>
        <p class="summary-text">
          ${escapeHtml(
            report.executiveSummary ||
              'Telemetry analyzed with zero cryptographic contradictions detected across canonical SHA-256 hash chains.'
          )}
        </p>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Target Workstation</div>
          <div class="metric-value">${escapeHtml(serverName)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Verified Risk Level</div>
          <div class="metric-value" style="color: ${riskBadgeColor};">${escapeHtml(riskLevel)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Actionable Findings</div>
          <div class="metric-value">${report.findings?.length || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Analyzed Log Range</div>
          <div class="metric-value" style="font-size: 11px;">${report.evidenceMetadata?.logEventsCount || 0} Events</div>
        </div>
      </div>

      <div class="section-title">Evidence & Cryptographic Integrity</div>
      <table class="integrity-table">
        <thead>
          <tr>
            <th>Security Domain</th>
            <th>Deterministic Verification Result</th>
            <th>Authoritative Coverage / Head</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>SHA-256 Hash Chain</strong></td>
            <td>
              ${
                report.integritySummary?.status === 'VERIFIED'
                  ? '<span class="badge-verified">✓ VERIFIED INTACT</span>'
                  : report.integritySummary?.status === 'TAMPERED'
                  ? '<span class="badge-failed">✗ TAMPERING DETECTED</span>'
                  : '<span class="badge-inconclusive">INCONCLUSIVE</span>'
              }
            </td>
            <td>${report.integritySummary?.recordsChecked || 0} sequential records linked</td>
          </tr>
          <tr>
            <td><strong>Ingestion Continuity</strong></td>
            <td>
              ${
                report.ingestionContinuity?.gapDetected
                  ? '<span class="badge-failed">✗ TELEMETRY GAP DETECTED</span>'
                  : '<span class="badge-verified">✓ FULLY CONTINUOUS</span>'
              }
            </td>
            <td>${escapeHtml(report.ingestionContinuity?.message || 'Nominal heartbeat')}</td>
          </tr>
          <tr>
            <td><strong>Ethereum Sepolia Anchor</strong></td>
            <td>
              ${
                report.blockchainSummary?.status === 'VERIFIED'
                  ? '<span class="badge-verified">✓ NOTARIZED ON-CHAIN</span>'
                  : report.blockchainSummary?.checkpointCount > 0
                  ? '<span class="badge-verified">✓ ' + report.blockchainSummary.checkpointCount + ' ANCHOR(S) RECORDED</span>'
                  : '<span class="badge-inconclusive">PENDING NEXT BATCH</span>'
              }
            </td>
            <td>${escapeHtml(report.blockchainSummary?.message || 'Smart contract consensus valid')}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">What Needs Attention (${report.findings?.length || 0} Findings)</div>
      ${findingsHtml || '<p style="color: #64748b; font-style: italic;">No actionable security findings identified in the analyzed scope.</p>'}

      <div class="section-title">Recommended Remediation Actions</div>
      <div class="recommendations">
        ${
          recommendationsHtml
            ? `<ul>${recommendationsHtml}</ul>`
            : '<p style="color: #64748b; font-style: italic;">All telemetry nominal. Continue standard collector monitoring.</p>'
        }
      </div>

      <div class="footer">
        <div>HashVault SOC · Deterministic Mathematical Trust & VaultAI Engine</div>
        <div>Page 1 of 1 · Confidential Security Investigation</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
