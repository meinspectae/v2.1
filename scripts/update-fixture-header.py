from pathlib import Path
p=Path('scripts/report-fixture.tsx');s=p.read_text()
s=s.replace("import ReportDocument from '../src/components/ReportDocument';", "import ReportDocument from '../src/components/ReportDocument';\nimport { PageHeader, PageFooter } from '../src/pages/ReportPage';")
a=s.index('  const header=');b=s.index('  root.render(',a)
s=s[:a]+"  const header=<PageHeader inspection={inspection} reportHash={hash}/>;\n  const footer=<PageFooter inspection={inspection} pageNumber={1}/>;\n"+s[b:]
p.write_text(s)
