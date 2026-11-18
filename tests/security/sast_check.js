/**
 * BioAge Pro — Node.js / JavaScript Static Application Security Testing (SAST)
 * Scans backend and frontend JS files for syntax integrity, dangerous sinks, and hardcoded credentials.
 * Generates JSON, HTML, and SARIF reports in reports/security/.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR = path.join(ROOT, 'reports', 'security');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const TARGET_DIRS = ['backend', 'js', 'frontend/js'];

const RULES = [
  {
    id: 'JS-SAST-001',
    severity: 'HIGH',
    title: 'Hardcoded Cloud/API Secret',
    pattern: /(?:AIza[0-9A-Za-z_-]{35}|AQ\.Ab8RN[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z]{36}|sk-[0-9A-Za-z]{20,})/g,
    message: 'Potential hardcoded API key or access token found in source file.'
  },
  {
    id: 'JS-SAST-002',
    severity: 'HIGH',
    title: 'Dynamic Code Execution (eval / Function)',
    pattern: /\b(?:eval\s*\(|new\s+Function\s*\()/g,
    message: 'Avoid dynamic code execution via eval() or new Function().'
  },
  {
    id: 'JS-SAST-003',
    severity: 'HIGH',
    title: 'Unsafe Child Process Shell Execution',
    pattern: /\bchild_process\b.*\bexec\s*\(/g,
    message: 'Potential OS command injection sink via child_process.exec().'
  }
];

function walkJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...walkJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = TARGET_DIRS.flatMap(d => walkJsFiles(path.join(ROOT, d)));
const findings = [];

for (const file of files) {
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');

  // 1. Syntax check for backend Node.js files
  if (relPath.startsWith('backend/')) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      findings.push({
        ruleId: 'JS-SYNTAX-001',
        severity: 'HIGH',
        file: relPath,
        line: 1,
        message: `JavaScript syntax check failed: ${err.stderr?.toString().trim() || err.message}`
      });
    }
  }

  // 2. Pattern-based SAST checks
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((lineText, idx) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(lineText)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          file: relPath,
          line: idx + 1,
          message: rule.message
        });
      }
    }
  });
}

const summary = {
  tool: 'BioAge Pro JS SAST Scanner',
  scannedFiles: files.length,
  totalFindings: findings.length,
  highSeverityCount: findings.filter(f => f.severity === 'HIGH').length,
  findings
};

// Write JSON report
fs.writeFileSync(
  path.join(REPORT_DIR, 'sast-report.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

// Write SARIF report
const sarif = {
  version: '2.1.0',
  $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
  runs: [
    {
      tool: {
        driver: {
          name: 'BioAge Pro JS SAST',
          version: '1.0.0'
        }
      },
      results: findings.map(f => ({
        ruleId: f.ruleId,
        level: f.severity === 'HIGH' ? 'error' : 'warning',
        message: { text: f.message },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: f.file },
              region: { startLine: f.line }
            }
          }
        ]
      }))
    }
  ]
};
fs.writeFileSync(
  path.join(REPORT_DIR, 'sast-report.sarif'),
  JSON.stringify(sarif, null, 2),
  'utf8'
);

// Write HTML report
const rows = findings.length
  ? findings.map(f => `<tr><td>${f.ruleId}</td><td>${f.severity}</td><td>${f.file}:${f.line}</td><td>${f.message}</td></tr>`).join('')
  : '<tr><td colspan="4">No high-severity security issues detected.</td></tr>';

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>BioAge Pro SAST Report</title></head>
<body style="font-family:sans-serif;padding:24px;">
  <h1>BioAge Pro — JavaScript SAST Report</h1>
  <p>Files scanned: <strong>${files.length}</strong> | High-severity findings: <strong>${summary.highSeverityCount}</strong></p>
  <table border="1" cellpadding="8" cellspacing="0">
    <thead><tr><th>Rule</th><th>Severity</th><th>Location</th><th>Message</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
fs.writeFileSync(path.join(REPORT_DIR, 'sast-report.html'), html, 'utf8');

console.log(`SAST scan complete: ${files.length} JS files scanned, ${summary.highSeverityCount} high-severity findings.`);
if (summary.highSeverityCount > 0) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}
