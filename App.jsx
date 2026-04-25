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
        <li key={index} className="ml-5 mb-3 list-disc list-outside text-slate-900 font-medium text-lg tracking-tight leading-relaxed">
          {formatInLineStyles(content)}
        </li>
      );
    }
    return (
      <p key={index} className={line.trim() === '' ? 'h-4' : 'mb-5 last:mb-0 leading-relaxed font-medium text-lg tracking-tight text-slate-900'}>
        {formatInLineStyles(line)}
      </p>
    );
  });
};

const formatInLineStyles = (text) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-black">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-slate-800 font-semibold">{part.slice(1, -1)}</em>;
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

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@500;700&display=swap';
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
        setError("Failed to connect to data source.");
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

        // Fetch the raw data for the selected chapter
        const q = query(
          collection(db, COLLECTION_NAME),
          where('Chapter', '==', selectedChapter)
        );
        
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });

        // Perform client-side multi-level numeric sorting based on Level3Number
        results.sort((a, b) => {
          const getLevel3Part = (level3Str, index) => {
            if (!level3Str) return 0;
            const parts = String(level3Str).split('.');
            return parts.length > index ? (parseFloat(parts[index]) || 0) : 0;
          };

          // Primary Sort: Second digit of Level3Number (Subchapter)
          const subA = getLevel3Part(a.Level3Number, 1);
          const subB = getLevel3Part(b.Level3Number, 1);
          
          if (subA !== subB) {
            return subA - subB;
          }

          // Secondary Sort: Third digit of Level3Number (Sequence within subchapter)
          const seqA = getLevel3Part(a.Level3Number, 2);
          const seqB = getLevel3Part(b.Level3Number, 2);
          
          return seqA - seqB;
        });

        setContent(results);
      } catch (err) {
        console.error("Fetch Error:", err);
        setError("An error occurred while fetching content.");
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [selectedChapter]);

  const renderListView = () => (
    <div className="p-8 font-['Inter']">
      <div className="mb-10">
        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-[0.2em] font-['Roboto_Mono']">
          Chapter Selection
        </label>
        <select 
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(e.target.value)}
          className="block w-full px-6 py-5 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 transition appearance-none cursor-pointer text-slate-900 font-bold text-lg shadow-sm outline-none"
        >
          <option value="">-- Choose Chapter --</option>
          {chapters.map((chap, idx) => <option key={idx} value={chap}>{chap}</option>)}
        </select>
      </div>

      {loading && <div className="text-center py-24 text-emerald-800 animate-pulse font-bold font-['Roboto_Mono'] text-sm uppercase tracking-widest">Initialising Secure Sync...</div>}
      
      <div className="space-y-10">
        {content.map((item) => (
          <div key={item.id} className="group p-10 border-2 border-slate-100 rounded-[2.5rem] bg-white shadow-sm hover:shadow-2xl hover:border-emerald-300 transition-all duration-500">
            <div className="flex items-center space-x-5 mb-6">
              <span className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 font-['Roboto_Mono'] tracking-tight">
                ID_{item.ID || item.IDold}
              </span>
              {item.Full2Sec && <span className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 font-['Roboto_Mono'] tracking-tight">POS_{item.Full2Sec}</span>}
            </div>
            
            {item.Subchapter && (
              <p className="text-sm font-extrabold text-slate-700 uppercase tracking-widest mb-3 px-1 font-['Roboto_Mono']">
                {item.Subchapter}
              </p>
            )}
            
            <h3 
              onClick={() => setSelectedItem(item)} 
              className="text-3xl font-black text-slate-900 group-hover:text-emerald-800 cursor-pointer transition-all duration-300 leading-tight tracking-tight"
            >
              {item.Shortquestion}
            </h3>
            
            {item.Question && (
              <div className="mt-6 p-8 bg-slate-50 rounded-[1.5rem] text-slate-900 text-base font-medium leading-relaxed border border-slate-200 tracking-tight italic">
                "{item.Question}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailView = () => (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-8 duration-700 font-['Inter']">
      <button 
        onClick={() => setSelectedItem(null)} 
        className="mb-10 flex items-center text-emerald-800 font-black text-xs uppercase tracking-[0.25em] hover:text-black transition-all group font-['Roboto_Mono']"
      >
        <svg className="h-5 w-5 mr-3 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" /></svg>
        Return to Portal
      </button>

      <div className="bg-slate-950 rounded-[3rem] p-12 mb-16 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
        <div className="flex flex-wrap gap-4 mb-10 relative z-10">
          <span className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 backdrop-blur-xl text-emerald-300 border border-emerald-500/30 font-['Roboto_Mono']">RECORD_ID: {selectedItem.ID || selectedItem.IDold}</span>
          <span className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 backdrop-blur-xl text-white border border-white/20 font-['Roboto_Mono'] uppercase tracking-[0.2em]">{selectedItem.Chapter}</span>
        </div>
        <h2 className="text-5xl font-black leading-[1.1] tracking-tighter relative z-10 max-w-4xl">{selectedItem.Shortquestion}</h2>
      </div>

      <div className="flex flex-col gap-20">
        {selectedItem.Question && (
          <section>
            <div className="flex items-center gap-4 mb-8 px-2">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] font-['Roboto_Mono']">Primary Question Definition</h4>
            </div>
            <div className="text-3xl text-slate-950 leading-tight font-semibold tracking-tighter bg-emerald-50/50 p-12 rounded-[3rem] border-2 border-emerald-100 shadow-inner italic">
              {selectedItem.Question}
            </div>
          </section>
        )}

        <section className="mt-8 pt-16 border-t-2 border-slate-100">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.5em] mb-16 px-2 font-['Roboto_Mono'] text-center">Protocol & Compliance Standards</h4>
          <div className="flex flex-col gap-16">
            {METADATA_MAPPING.map(({ key, label }) => (
              <div key={key} className="w-full group">
                <dt className="text-sm font-black text-emerald-900 uppercase tracking-[0.3em] mb-6 px-4 font-['Roboto_Mono'] border-l-4 border-emerald-600">
                  {label}
                </dt>
                <dd className="w-full bg-white border-2 border-slate-100 p-12 rounded-[2.5rem] shadow-sm group-hover:shadow-xl group-hover:border-emerald-100 transition-all duration-300">
                  {selectedItem[key] ? (
                    <div className="prose prose-lg max-w-none">
                      {renderMarkdown(String(selectedItem[key]))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic font-bold text-xl tracking-tight">Data unavailable for this record.</span>
                  )}
                </dd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-12 lg:p-20">
      <div className="max-w-6xl mx-auto bg-white rounded-[4rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-200">
        <div className="bg-white border-b-2 border-slate-100 p-10 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-6">
            <div className="bg-emerald-800 p-4 rounded-3xl shadow-2xl shadow-emerald-900/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase text-slate-950 leading-none">Sire Explorer</h1>
              <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.5em] mt-2 font-['Roboto_Mono']">
                {selectedItem ? 'High-Density Documentation' : 'Operational Inspection Dataset'}
              </p>
            </div>
          </div>
          {selectedItem && (
            <button 
              onClick={() => setSelectedItem(null)} 
              className="bg-slate-100 hover:bg-slate-900 hover:text-white p-4 rounded-3xl transition-all border border-slate-200 shadow-sm"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {selectedItem ? renderDetailView() : renderListView()}
      </div>
      <footer className="max-w-6xl mx-auto mt-16 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] font-['Roboto_Mono']">Enterprise Data Portal // Version 2.4.1</p>
      </footer>
    </div>
  );
}