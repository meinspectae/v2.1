from pathlib import Path
p = Path('src/pages/ReportPage.tsx')
s = p.read_text()
s = s.replace("import { renderReportPDF } from '../utils/reportPdf';", "import { renderReportPDF } from '../utils/reportPdf';\nimport ReportDocument from '../components/ReportDocument';")
s = s.replace("<div style={{\n      borderBottom: '1.5px solid #2563eb',", "<div data-report-header style={{\n      borderBottom: '1.5px solid #2563eb',", 1)
start = s.index('          {/* Cover Page */}')
end = s.index('\n        </div>\n      </div>\n\n      {/* Modals */}', start)
s = s[:start] + '          <ReportDocument inspection={inspection} reportHash={reportHash} qrCode={qrCode} header={hdr} footer={ftr(1)} />' + s[end:]
s = s.replace("width: `${A4_WIDTH_PX}px`,\n            background:", "width: `${A4_WIDTH_PX}px`,\n            padding: '56.69px',\n            boxSizing: 'border-box',\n            background:", 1)
p.write_text(s)
