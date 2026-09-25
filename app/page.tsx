import Link from "next/link";

const features = [
  { number: "01", title: "Import your statement", text: "Upload a PhonePe CSV. We turn your statement into a clean, searchable transaction history." },
  { number: "02", title: "See the full picture", text: "Understand your monthly spending by category, merchant, and the little purchases that add up." },
  { number: "03", title: "Know what changed", text: "Compare months side by side and see exactly which categories moved your spending." },
];

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link href="/" className="brand"><span className="brand-mark">m.</span> money autopsy</Link>
        <nav aria-label="Main navigation"><Link href="/login">Sign in</Link><Link className="button button-dark" href="/register">Get started <span aria-hidden="true">↗</span></Link></nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR MONEY, UNDERSTOOD</div>
          <h1>Find out where<br />your money <em>goes.</em></h1>
          <p className="hero-description">Use PhonePe like you always do. At month end, bring your statement and get an honest picture of your spending.</p>
          <div className="hero-actions"><Link href="/register" className="button button-dark">Get started for free <span aria-hidden="true">↗</span></Link><span className="no-hassle">No manual expense tracking</span></div>
          <div className="privacy-note"><span aria-hidden="true">◈</span> Your transactions stay private. No AI, no guesswork.</div>
        </div>

        <div className="report-card" aria-label="Illustration of a monthly spending report">
          <div className="report-topline"><span>MONTHLY AUTOPSY</span><span className="report-period">SEP / 2026</span></div>
          <div className="report-total-label">You spent</div>
          <div className="report-total"><span>₹</span>18,420</div>
          <div className="report-change"><span>↗ 12.8%</span> compared to August</div>
          <div className="report-rule" />
          <div className="chart-heading"><span>Where it went</span><span>THIS MONTH</span></div>
          <div className="spend-row"><div><i className="spend-dot dot-coral"/>Food</div><strong>₹4,850</strong></div>
          <div className="spend-bar"><span className="bar-coral" style={{ width: "76%" }}/></div>
          <div className="spend-row"><div><i className="spend-dot dot-gold"/>Shopping</div><strong>₹3,200</strong></div>
          <div className="spend-bar"><span className="bar-gold" style={{ width: "56%" }}/></div>
          <div className="spend-row"><div><i className="spend-dot dot-blue"/>Travel</div><strong>₹2,180</strong></div>
          <div className="spend-bar"><span className="bar-blue" style={{ width: "38%" }}/></div>
          <div className="report-insight"><span className="insight-icon">✳</span><div><b>The small stuff adds up.</b><br/><span>17 purchases under ₹200</span></div><strong>₹2,340</strong></div>
          <div className="card-stamp">MA—01</div>
        </div>
        <div className="hero-scribble" aria-hidden="true">a clearer picture, every month ↗</div>
      </section>

      <section className="how-section">
        <div className="section-heading"><div><div className="eyebrow">A BETTER MONTH-END ROUTINE</div><h2>Three steps. <em>That’s it.</em></h2></div><p>Nothing to log day to day.<br/>Just the money story, when you need it.</p></div>
        <div className="feature-grid">{features.map((feature) => <article className="feature" key={feature.number}><span className="feature-number">{feature.number}</span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
      </section>

      <footer className="landing-footer"><Link href="/" className="brand"><span className="brand-mark">m.</span> money autopsy</Link><span>Built for a clearer relationship with money.</span><Link href="/register">Start your first report ↗</Link></footer>
    </main>
  );
}
