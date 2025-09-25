import React, { useMemo, useRef, useState } from 'react';
import { analyzeWithGemini, type AnalysisResult } from './gemini';

type TabKey = 'results' | 'history' | 'examples' | 'reports';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('results');
  const [file, setFile] = useState<File | null>(null);
  const [age, setAge] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [thinking, setThinking] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>(() => readHistory());

  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  const resultRef = useRef<HTMLDivElement>(null);

  function onFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0] ?? null;
    setFile(f);
  }

  async function onAnalyze() {
    if (!file) { alert('Please select an image.'); return; }
    setBusy(true);
    setThinking('Uploading image…');
    try {
      const ageNum = Number(age);
      const ageGroup = toAgeGroup(ageNum);
      setThinking('Thinking… analyzing wound type and stage');
      const res = await analyzeWithGemini({ file, age: isNaN(ageNum) ? undefined : ageNum });
      const entry: AnalysisResult = {
        ...res,
        timestamp: Date.now(),
        imageUrl,
        age: isNaN(ageNum) ? undefined : ageNum,
        ageGroup
      };
      setResult(entry);
      const updated = [entry, ...history].slice(0, 25);
      setHistory(updated);
      saveHistory(updated);
      setActiveTab('results');
      setThinking('');
      // scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Analysis failed');
      setThinking('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="hero">
        <div className="container hero__content">
          <div className="hero__text">
            <h1>Welcome to <span className="brand">HealScan AI</span></h1>
            <p className="subtitle">Your intelligent wound assessment companion.</p>
            <p className="lead">Upload an image of your wound, enter your age, and let our advanced AI analyze it in seconds. Get accurate recognition, age-aware advice, precautions, and suggested medications.</p>
            <ul className="features">
              <li>📷 Upload & Analyze</li>
              <li>👨‍⚕️ Age-Based Analysis</li>
              <li>🧾 Personalized Report</li>
              <li>📊 Dashboard & History</li>
              <li>🚑 Do / Don’t Precautions</li>
              <li>💊 Medicine Suggestions</li>
            </ul>
          </div>
          <div className="hero__panel">
            <div className="upload-card">
              <label htmlFor="imageInput" className="input-label">Wound image</label>
              <input id="imageInput" type="file" accept="image/*" onChange={onFileChange} />
              <label htmlFor="ageInput" className="input-label">Your age</label>
              <input id="ageInput" type="number" min={0} max={120} placeholder="e.g., 34" value={age} onChange={(e) => setAge(e.target.value)} />
              <button className="btn-primary" onClick={onAnalyze} disabled={!file || busy}> {busy ? 'Analyzing…' : 'Analyze'}</button>
              {file ? (
                <div className="preview">
                  <img alt="Preview" src={imageUrl} />
                </div>
              ) : null}
              <p className="disclaimer">This app is not a substitute for professional medical advice. For emergencies, call your local emergency services.</p>
              {thinking && <Thinking text={thinking} />}
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <nav className="tabs">
          <button className={`tab ${activeTab==='results'?'active':''}`} onClick={() => setActiveTab('results')}>Results</button>
          <button className={`tab ${activeTab==='history'?'active':''}`} onClick={() => setActiveTab('history')}>History</button>
          <button className={`tab ${activeTab==='examples'?'active':''}`} onClick={() => setActiveTab('examples')}>Examples</button>
          <button className={`tab ${activeTab==='reports'?'active':''}`} onClick={() => setActiveTab('reports')}>Reports</button>
        </nav>

        <section id="results" className={`tab-panel ${activeTab==='results'?'active':''}`} ref={resultRef}>
          {!result ? (
            <div className="empty">No analysis yet. Upload an image and click Analyze.</div>
          ) : (
            <ResultsView res={result} />
          )}
        </section>

        <section id="history" className={`tab-panel ${activeTab==='history'?'active':''}`}>
          <HistoryView list={history} onSelect={(idx) => {
            const it = history[idx];
            if (!it) return;
            setResult(it);
            setActiveTab('results');
          }} />
        </section>

        <section id="examples" className={`tab-panel ${activeTab==='examples'?'active':''}`}>
          <Examples />
        </section>

        <section id="reports" className={`tab-panel ${activeTab==='reports'?'active':''}`}>
          <ReportsView list={history} />
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <span>© {new Date().getFullYear()} HealScan AI</span>
        </div>
      </footer>
    </>
  );
}

function Thinking({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 10, color: '#d9dffa' }}>
      <span role="img" aria-label="spark">✨</span> {text}
    </div>
  );
}

function ResultsView({ res }: { res: AnalysisResult }) {
  return (
    <div className="grid">
      <div className="card span-2">
        <h3>Wound Recognition</h3>
        <div className="row">
          <div className="row__col">
            <div className="preview small">
              <img alt="Analyzed" src={res.imageUrl} />
            </div>
          </div>
          <div className="row__col">
            <div className="kv"><span>Detected type</span><strong>{res.type}</strong></div>
            <div className="kv"><span>Healing stage</span><strong>{res.stage}</strong></div>
            <div className="kv"><span>Age group</span><strong>{res.ageGroup ?? '—'}</strong></div>
            <div className="kv"><span>Severity</span><strong>{res.severity}/100</strong></div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Precautions</h3>
        <ul className="bullets">{res.precautions.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </div>
      <div className="card">
        <h3>Suggested Care & Medicines</h3>
        <ul className="bullets">{res.meds.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </div>
    </div>
  );
}

function HistoryView({ list, onSelect }: { list: AnalysisResult[]; onSelect: (idx: number) => void; }) {
  if (!list.length) return <div className="empty">No history yet.</div>;
  return (
    <div className="list">
      {list.map((it, idx) => (
        <div className="item" key={it.timestamp}>
          <img src={it.imageUrl} alt="history" />
          <div className="meta">
            <div><strong>{it.type}</strong> · {it.severity}/100</div>
            <div className="pill">{it.age ?? '—'} yrs · {it.ageGroup ?? '—'}</div>
            <div>{new Date(it.timestamp).toLocaleString()}</div>
            <div>
              <button className="btn-secondary" onClick={() => onSelect(idx)}>View</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const EXAMPLES = [
  {
    title: 'Burn Wound (Adult)',
    img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=60',
    precautions: [
      'Do not apply ice directly on the burn.',
      'Keep the area clean and loosely covered.',
      'Avoid breaking blisters.'
    ],
    meds: [
      'Apply silver sulfadiazine cream.',
      'Keep hydrated and monitor pain.',
      'Consult a doctor if burn is deep.'
    ]
  },
  {
    title: 'Cut Wound (Child)',
    img: 'https://images.unsplash.com/photo-1531736275454-53c0b03f97b3?auto=format&fit=crop&w=600&q=60',
    precautions: [
      'Wash hands before touching the wound.',
      'Avoid strong antiseptics directly.',
      'Keep the wound dry for a few hours.'
    ],
    meds: [
      'Clean with mild antiseptic.',
      'Apply antibiotic ointment.',
      'Cover with sterile bandage.'
    ]
  },
  {
    title: 'Diabetic Foot Ulcer (Elderly)',
    img: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=600&q=60',
    precautions: [
      'Never walk barefoot.',
      'Avoid tight shoes or pressure.',
      'Monitor blood sugar closely.'
    ],
    meds: [
      'Medicated dressings as directed.',
      'Prescribed antibiotics as needed.',
      'Seek medical supervision.'
    ]
  },
  {
    title: 'Infected Wound (Any Age)',
    img: 'https://images.unsplash.com/photo-1576765608610-cb602a3d7b86?auto=format&fit=crop&w=600&q=60',
    precautions: [
      'Do not ignore pus or swelling.',
      'Avoid reusing old dressings.',
      'Do not apply powders.'
    ],
    meds: [
      'Oral antibiotics per doctor.',
      'Saline wash.',
      'Sterile gauze dressing.'
    ]
  }
];

function Examples() {
  return (
    <div className="examples grid">
      {EXAMPLES.map((ex) => (
        <div key={ex.title} className="example">
          <img src={ex.img} alt={ex.title} />
          <div className="content">
            <h4>{ex.title}</h4>
            <strong>Precautions</strong>
            <ul>{ex.precautions.map((p) => <li key={p}>{p}</li>)}</ul>
            <strong>Care & Medicines</strong>
            <ul>{ex.meds.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        </div>
      ))}
    </div>
  );
}

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function ReportsView({ list }: { list: AnalysisResult[] }) {
  const [idx, setIdx] = useState<number>(0);
  const it = list[idx];
  const areaRef = useRef<HTMLDivElement>(null);

  async function onDownloadPdf() {
    if (!areaRef.current) return;
    const canvas = await html2canvas(areaRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, 10, w, h);
    pdf.save(`healscan-report-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="row__col">
            <label htmlFor="reportSelect" className="input-label">Choose a report</label>
            <select id="reportSelect" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {list.length ? list.map((r, i) => (
                <option value={i} key={r.timestamp}>{new Date(r.timestamp).toLocaleString()} – {r.type} ({r.severity}/100)</option>
              )) : <option value={-1}>No reports available</option>}
            </select>
          </div>
          <div className="row__col right">
            <button className="btn-secondary" onClick={onDownloadPdf} disabled={!it}>Download PDF</button>
          </div>
        </div>
      </div>
      <div className="report card" ref={areaRef}>
        <h2 className="center">HealScan AI – Wound Report</h2>
        {!it ? <div className="empty">No report selected.</div> : (
          <>
            <div className="report__meta">
              <div><span>Date</span><strong>{new Date(it.timestamp).toLocaleDateString()}</strong></div>
              <div><span>Time</span><strong>{new Date(it.timestamp).toLocaleTimeString()}</strong></div>
              <div><span>Age</span><strong>{it.age ?? '—'}</strong></div>
            </div>
            <div className="row">
              <div className="row__col">
                <div className="preview small">
                  <img alt="Report" src={it.imageUrl} />
                </div>
              </div>
              <div className="row__col">
                <div className="kv"><span>Type</span><strong>{it.type}</strong></div>
                <div className="kv"><span>Stage</span><strong>{it.stage}</strong></div>
                <div className="kv"><span>Severity</span><strong>{it.severity}/100</strong></div>
              </div>
            </div>
            <div className="report__lists">
              <div>
                <h3>Precautions</h3>
                <ul className="bullets">{it.precautions.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
              <div>
                <h3>Care & Medicines</h3>
                <ul className="bullets">{it.meds.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            </div>
            <p className="report__disclaimer">This summary is generated by HealScan AI for educational purposes. Always consult a qualified healthcare professional for diagnosis and treatment.</p>
          </>
        )}
      </div>
    </>
  );
}

function toAgeGroup(age?: number) {
  if (age == null || isNaN(age)) return 'Any Age';
  if (age <= 12) return 'Child';
  if (age >= 60) return 'Elderly';
  return 'Adult';
}

function saveHistory(list: AnalysisResult[]) {
  localStorage.setItem('healscan_history', JSON.stringify(list));
}
function readHistory(): AnalysisResult[] {
  try { return JSON.parse(localStorage.getItem('healscan_history') || '[]'); } catch { return []; }
}


