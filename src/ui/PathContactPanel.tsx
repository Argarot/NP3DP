import type { MatchedRevolutionPathContactReport } from '../print/pathContact';

export function PathContactPanel({ report }: { report: MatchedRevolutionPathContactReport }) {
  if (!report.applicable) return <div className="print-readiness" aria-label="Emitted path separation">
    <span className="micro-label">EMITTED PATH GEOMETRY</span><h3>Separation analysis unavailable</h3>
    {report.reasons.map((reason) => <p key={reason}>{reason}</p>)}
    <p>The motion preview and command audit remain available.</p>
  </div>;
  const wall = report.comparisons.filter((comparison) => comparison.currentStage === 'wall');
  const least = wall.reduce((a, b) => b.contactFractionEstimate < a.contactFractionEstimate ? b : a, wall[0]!);
  const minimum = Math.min(...report.comparisons.map((comparison) => comparison.minSeparationMm));
  const maximum = Math.max(...report.comparisons.map((comparison) => comparison.maxSeparationMm));
  const points = wall.map((comparison, index) => `${20 + index / Math.max(1, wall.length - 1) * 252},${88 - comparison.contactFractionEstimate * 64}`).join(' ');
  return <div className="print-readiness" aria-label="Emitted path separation">
    <span className="micro-label">ACTUAL SEGMENTS · XYZ DISTANCE</span><h3>Separation between turns</h3>
    <p>Compares emitted segments at the same angle one turn apart. Includes sideways movement from taper and curvature.</p>
    <svg className="contact-chart" viewBox="0 0 292 110" role="img" aria-label="Fraction within nominal strand diameter by wall turn">
      <path d="M20 24H272M20 88H272" stroke="#566470" strokeDasharray="3 4" fill="none" />
      <polyline points={points} fill="none" stroke="#b8d58d" strokeWidth="2" />
      <g fill="#b0b9c3" fontSize="11"><text x="20" y="15">100% within nominal diameter</text><text x="20" y="105">Turn 1</text><text x="272" y="105" textAnchor="end">Turn {wall.length}</text></g>
    </svg>
    <dl><div><dt>Sampled XYZ separation</dt><dd>{minimum.toFixed(2)}–{maximum.toFixed(2)} mm</dd></div>
      <div><dt>Least overlap · turn {least.revolutionIndex}</dt><dd>{Math.round(least.contactFractionEstimate * 100)}%</dd></div>
      <div><dt>Nominal strand diameter</dt><dd>{report.nominalStrandDiameterMm.toFixed(2)} mm</dd></div></dl>
    <p>This samples moving strands; stationary anchor deposits are excluded. The percentage is angular coverage within the requested strand diameter, not bonding probability or predicted print success. Mesh correction, nozzle clearance and material physics are not modeled.</p>
    <details><summary>Per-turn geometry</summary><div className="contact-table"><table><thead><tr><th>Turn</th><th>XYZ gap mm</th><th>Within diameter</th></tr></thead><tbody>{report.comparisons.map((comparison) => <tr key={`${comparison.currentStage}-${comparison.revolutionIndex}`}><td>{comparison.currentStage === 'rim' ? 'Rim ' : ''}{comparison.revolutionIndex}</td><td>{comparison.minSeparationMm.toFixed(2)}–{comparison.maxSeparationMm.toFixed(2)}</td><td>{Math.round(comparison.contactFractionEstimate * 100)}%</td></tr>)}</tbody></table></div></details>
  </div>;
}
