import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  where 
} from 'firebase/firestore';

// --- CONFIGURATION ---
const getEnv = (key) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return "";
  }
};

// Hardcoded fallback for the preview environment
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || "AIzaSyB2LRoHyvyMR7YhX7pKOOhMtBdlc3nwkj0",
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || "my-sire2.firebaseapp.com",
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || "my-sire2",
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || "my-sire2.firebasestorage.app",
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || "630273310341",
  appId: getEnv('VITE_FIREBASE_APP_ID') || "1:630273310341:web:4c398761c44ce86dd273ec"
};

const METADATA_MAPPING = [
  { key: 'IndustryNew', label: 'Industry Standards & Regulations' },
  { key: 'Inspection', label: 'Inspection Guidance & Procedure' },
  { key: 'Suggested', label: 'Suggested Inspector Actions' },
  { key: 'Potential', label: 'Potential Grounds for Observation' }
];

const renderMarkdown = (text) => {
  if (!text || typeof text !== 'string') return text;
  let cleanText = text.replace(/<[^>]*>?/gm, '');
  const lines = cleanText.split('\n');
  
  return lines.map((line, index) => {
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.trim().substring(2);
      return (
        <li key={index} className="ml-4 mb-2 list-disc list-outside text-slate-700 font-light tracking-tight">
          {formatInLineStyles(content)}
        </li>
      );
    }
    return (
      <p key={index} className={line.trim() === '' ? 'h-4' : 'mb-4 last:mb-0 leading-relaxed font-light tracking-tight text-slate-700'}>
        {formatInLineStyles(line)}
      </p>
    );
  });
};

const formatInLineStyles = (text) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-slate-600">{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COLLECTION_NAME = "sire_collection";

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [content, setContent] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexMissing, setIndexMissing] = useState(false);

  useEffect(() => {
    // Add external fonts to document head
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Roboto+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    const fetchChapters = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, COLLECTION_NAME), orderBy('IDold', 'asc'));
        const querySnapshot = await getDocs(q);
        const uniqueChapters = [];
        const seen = new Set();
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.Chapter && !seen.has(data.Chapter)) {
            seen.add(data.Chapter);
            uniqueChapters.push(data.Chapter);
          }
        });
        setChapters(uniqueChapters);
        setError(null);
      } catch (err) {
        console.error("Firebase Error:", err);
        setError("Failed to connect to data source. Check your Firestore connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchChapters();
  }, []);

  useEffect(() => {
    if (!selectedChapter) {
      setContent([]);
      return;
    }
    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        setIndexMissing(false);
        const q = query(
          collection(db, COLLECTION_NAME),
          where('Chapter', '==', selectedChapter),
          orderBy('Full2Sec', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        setContent(results);
      } catch (err) {
        if (err.code === 'failed-precondition' || (err.message && err.message.includes("requires an index"))) {
          setIndexMissing(true);
          try {
            const qFallback = query(collection(db, COLLECTION_NAME));
            const snapshot = await getDocs(qFallback);
            const filtered = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              if (data.Chapter === selectedChapter) filtered.push({ id: doc.id, ...data });
            });
            filtered.sort((a, b) => String(a.Full2Sec || "").localeCompare(String(b.Full2Sec || ""), undefined, { numeric: true }));
            setContent(filtered);
          } catch (fallbackErr) {
            setError("Could not load data. Check index status.");
          }
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [selectedChapter]);

  const renderListView = () => (
    <div className="p-8 font-['Inter']">
      <div className="mb-10">
        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.25em] font-['Roboto_Mono']">
          Chapter Selection
        </label>
        <select 
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(e.target.value)}
          className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition appearance-none cursor-pointer text-slate-900 font-medium shadow-sm outline-none"
        >
          <option value="">-- Choose Chapter --</option>
          {chapters.map((chap, idx) => <option key={idx} value={chap}>{chap}</option>)}
        </select>
      </div>

      {loading && <div className="text-center py-20 text-emerald-600 animate-pulse font-medium font-['Roboto_Mono'] text-xs uppercase tracking-widest">Initialising Secure Sync...</div>}
      
      {error && (
        <div className="p-5 mb-10 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-['Roboto_Mono'] uppercase tracking-wider leading-relaxed">
          [Error]: {error}
        </div>
      )}

      <div className="space-y-8">
        {content.map((item) => (
          <div key={item.id} className="group p-8 border border-slate-100 rounded-[2rem] bg-white shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-500">
            <div className="flex items-center space-x-4 mb-5">
              <span className="px-3 py-1 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100/50 font-['Roboto_Mono'] tracking-tighter">
                ID_{item.IDold}
              </span>
              {item.Full2Sec && <span className="px-3 py-1 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-100 font-['Roboto_Mono'] tracking-tighter">POS_{item.Full2Sec}</span>}
            </div>
            
            {item.Subchapter && (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1 font-['Roboto_Mono']">
                {item.Subchapter}
              </p>
            )}
            
            <h3 
              onClick={() => setSelectedItem(item)} 
              className="text-2xl font-bold text-slate-900 group-hover:text-emerald-700 cursor-pointer transition-all duration-300 leading-snug tracking-tight"
            >
              {item.Shortquestion}
            </h3>
            
            {item.Question && (
              <div className="mt-5 p-6 bg-slate-50/50 rounded-2xl text-slate-600 text-sm font-light leading-relaxed border border-slate-100/50 tracking-tight italic">
                "{item.Question}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailView = () => (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-6 duration-700 font-['Inter']">
      <button 
        onClick={() => setSelectedItem(null)} 
        className="mb-8 flex items-center text-emerald-600 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-emerald-800 transition-all group font-['Roboto_Mono']"
      >
        <svg className="h-4 w-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
        Return to Portal
      </button>

      <div className="bg-slate-900 rounded-[2.5rem] p-10 mb-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="flex flex-wrap gap-3 mb-8 relative z-10">
          <span className="px-3 py-1 rounded-md text-[10px] font-medium bg-emerald-500/20 backdrop-blur-md text-emerald-400 border border-emerald-500/20 font-['Roboto_Mono']">DOC_ID: {selectedItem.IDold}</span>
          <span className="px-3 py-1 rounded-md text-[10px] font-medium bg-white/5 backdrop-blur-md text-white/60 border border-white/10 font-['Roboto_Mono'] uppercase tracking-widest">{selectedItem.Chapter}</span>
        </div>
        <h2 className="text-4xl font-black leading-tight tracking-tighter relative z-10">{selectedItem.Shortquestion}</h2>
      </div>

      <div className="flex flex-col gap-16">
        {selectedItem.Question && (
          <section>
            <div className="flex items-center gap-3 mb-6 px-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['Roboto_Mono']">Question Definition</h4>
            </div>
            <div className="text-2xl text-slate-900 leading-tight font-light tracking-tighter bg-emerald-50/30 p-10 rounded-[2.5rem] border border-emerald-100/50 shadow-sm italic">
              {selectedItem.Question}
            </div>
          </section>
        )}

        <section className="mt-4 pt-12 border-t border-slate-100">
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] mb-12 px-2 font-['Roboto_Mono'] text-center">Protocol & Standards</h4>
          <div className="flex flex-col gap-12">
            {METADATA_MAPPING.map(({ key, label }) => (
              <div key={key} className="w-full">
                <dt className="text-[9px] font-bold text-emerald-700 uppercase tracking-[0.35em] mb-4 px-2 font-['Roboto_Mono']">{label}</dt>
                <dd className="w-full bg-white border border-slate-100 p-10 rounded-[2rem] shadow-sm hover:shadow-md transition-shadow duration-300">
                  {selectedItem[key] ? renderMarkdown(String(selectedItem[key])) : <span className="text-slate-300 italic font-light tracking-tight">Standard data not provided for this entry.</span>}
                </dd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-10">
      <div className="max-w-5xl mx-auto bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200/50">
        <div className="bg-white border-b border-slate-100 p-8 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-600/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase text-slate-900 leading-none">Sire Explorer</h1>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.4em] mt-1.5 font-['Roboto_Mono']">
                {selectedItem ? 'Documentation Insight' : 'Inspection Dataset'}
              </p>
            </div>
          </div>
          {selectedItem && (
            <button 
              onClick={() => setSelectedItem(null)} 
              className="bg-slate-50 hover:bg-slate-100 p-3 rounded-2xl transition-all border border-slate-100 text-slate-400 hover:text-slate-600 shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {selectedItem ? renderDetailView() : renderListView()}
      </div>
      <footer className="max-w-5xl mx-auto mt-10 text-center">
        <p className="text-[9px] font-semibold text-slate-300 uppercase tracking-[0.5em] font-['Roboto_Mono']">Operational Data Access Portal v2.1</p>
      </footer>
    </div>
  );
}