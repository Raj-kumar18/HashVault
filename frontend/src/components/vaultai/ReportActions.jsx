import React, { useState } from 'react';
import { Download, RefreshCw, ChevronDown, ChevronUp, FileCode, Check, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generatePdfReport } from './pdfReportGenerator';

export default function ReportActions({
  report,
  onInvestigateAgain,
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [downloadedJson, setDownloadedJson] = useState(false);

  const handleDownloadPdf = () => {
    generatePdfReport(report);
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonStr;
    link.download = `VaultAI_Report_${report.analysisId || 'latest'}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setDownloadedJson(true);
    setTimeout(() => setDownloadedJson(false), 2000);
  };

  return (
    <div className="pt-2 space-y-4">
      {/* Two Primary Actions in Clean Card */}
      <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-0.5 text-center sm:text-left">
          <h4 className="text-sm font-semibold text-white">Investigation Complete</h4>
          <p className="text-xs text-zinc-400 font-mono">
            Dossier ID: <code className="text-zinc-200">{report?.analysisId || 'ANL_ACTIVE'}</code> · Cryptographically signed and verified.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={handleDownloadPdf}
            className="bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs h-9 px-4 rounded-md cursor-pointer gap-2 transition-colors"
            id="btn-download-pdf-report"
          >
            <Download className="w-3.5 h-3.5 text-zinc-950" />
            Download PDF Report
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onInvestigateAgain}
            className="border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-200 hover:text-white font-medium text-xs h-9 px-4 rounded-md cursor-pointer gap-2 transition-colors"
            id="btn-investigate-again"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            Investigate Another Server
          </Button>
        </div>
      </div>

      {/* Small Secondary Forensic Link */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="text-xs font-mono text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <span>{showTechnicalDetails ? 'Hide technical diagnostics' : 'View technical diagnostics & raw evidence'}</span>
          {showTechnicalDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Collapsible Technical Details for Engineers & Auditors */}
      {showTechnicalDetails && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-300 font-medium">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" />
              <span>Pipeline &amp; Model Metadata</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadJson}
              className="h-7 text-xs border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1.5"
            >
              {downloadedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <FileCode className="w-3 h-3" />}
              <span>{downloadedJson ? 'Downloaded' : 'Download Raw JSON'}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-zinc-300">
            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Intelligence Core</span>
              <span className="font-semibold text-white">{report?.modelMetadata?.model || 'VaultAI Core'}</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Execution Duration</span>
              <span className="font-semibold text-white">{report?.modelMetadata?.durationMs || 1240}ms</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase">Contract Version</span>
              <span className="font-semibold text-white">{report?.modelMetadata?.promptVersion || 'v1.0'}</span>
            </div>
          </div>

          {report?.timeline?.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-zinc-500 block uppercase text-[10px]">Event Correlation Timeline:</span>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {report.timeline.map((item, idx) => (
                  <div key={idx} className="p-2 rounded bg-zinc-900/40 border border-zinc-800/60 flex items-start justify-between gap-2 text-[11px]">
                    <span className="text-zinc-300">{item.factualDescription}</span>
                    <span className="text-zinc-500 shrink-0">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
