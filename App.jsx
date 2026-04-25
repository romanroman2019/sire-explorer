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
const firebaseConfig = {
  apiKey: "AIzaSyB2LRoHyvyMR7YhX7pKOOhMtBdlc3nwkj0",
  authDomain: "my-sire2.firebaseapp.com",
  projectId: "my-sire2",
  storageBucket: "my-sire2.firebasestorage.app",
  messagingSenderId: "630273310341",
  appId: "1:630273310341:web:4c398761c44ce86dd273ec"
};

// --- CUSTOMIZATION: Predefined order and Informative Labels ---
const METADATA_MAPPING = [
  { key: 'IndustryNew', label: 'Industry Standards & Regulations' },
  { key: 'Inspection', label: 'Inspection Guidance & Procedure' },
  { key: 'Suggested', label: 'Suggested Inspector Actions' },
  { key: 'Potential', label: 'Potential Grounds for Observation' }
];

/**
 * Basic Markdown-to-React Formatter
 */
const renderMarkdown = (text) => {
  if (!text || typeof text !== 'string') return text;
  let cleanText = text.replace(/<[^>]*>?/gm, '');
  const lines = cleanText.split('\n');
  
  return lines.map((line, index) => {
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.trim().substring(2);
      return (
        <li key={index} className="ml-4 mb-1 list-disc list-outside text-gray-700">
          {formatInLineStyles(content)}
        </li>
      );
    }
    return (
      <p key={index} className={line.trim() === '' ? 'h-4' : 'mb-3 last:mb-0'}>
        {formatInLineStyles(line)}
      </p>
    );
  });
};

const formatInLineStyles = (text) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-gray-600">{part.slice(1, -1)}</em>;
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
      } catch (err) {
        setError("Failed to load chapters.");
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
    <div className="p-6">
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Select Chapter</label>
        <select 
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(e.target.value)}
          className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 transition appearance-none cursor-pointer text-gray-800"
        >
          <option value="">-- Choose Chapter --</option>
          {chapters.map((chap, idx) => <option key={idx} value={chap}>{chap}</option>)}
        </select>
      </div>

      {loading && <div className="text-center py-12 text-emerald-600 animate-pulse font-medium">Syncing with database...</div>}

      <div className="space-y-6">
        {content.map((item) => (
          <div key={item.id} className="p-6 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-md hover:border-emerald-100 transition-all">
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 uppercase">ID: {item.IDold}</span>
              {item.Full2Sec && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-500 uppercase">Pos: {item.Full2Sec}</span>}
            </div>
            {item.Subchapter && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.Subchapter}</p>}
            <h3 onClick={() => setSelectedItem(item)} className="text-xl font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer transition-colors hover:underline underline-offset-4">{item.Shortquestion}</h3>
            {item.Question && <div className="mt-3 p-4 bg-gray-50/50 rounded-xl text-gray-700 text-sm italic border-l-4 border-emerald-200">{item.Question}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailView = () => (
    <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button onClick={() => setSelectedItem(null)} className="mb-6 flex items-center text-emerald-600 font-bold text-sm hover:text-emerald-800 transition-colors group">
        <svg className="h-4 w-4 mr-1.5 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        Return to Selection
      </button>

      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-8 mb-10 text-white shadow-xl">
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-white/20 backdrop-blur-md uppercase">ID: {selectedItem.IDold}</span>
          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-400/30 backdrop-blur-md uppercase">{selectedItem.Chapter}</span>
        </div>
        <h2 className="text-3xl font-black leading-tight drop-shadow-md">{selectedItem.Shortquestion}</h2>
      </div>

      <div className="flex flex-col gap-12">
        {selectedItem.Question && (
          <section>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Inquiry Details</h4>
            <div className="text-xl text-gray-800 leading-relaxed font-semibold bg-emerald-50/40 p-8 rounded-[2rem] border-l-8 border-emerald-600 shadow-sm">{selectedItem.Question}</div>
          </section>
        )}

        <section className="mt-4 pt-10 border-t border-gray-100">
          <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] mb-8 px-2">Inspection Metadata</h4>
          <div className="flex flex-col gap-8">
            {METADATA_MAPPING.map(({ key, label }) => (
              <div key={key} className="w-full">
                <dt className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.2em] mb-2 px-1">{label}</dt>
                <dd className="w-full bg-white border border-gray-100 p-8 rounded-[1.5rem] shadow-sm text-base font-normal text-gray-700 leading-relaxed prose prose-emerald max-w-none">
                  {selectedItem[key] ? renderMarkdown(String(selectedItem[key])) : <span className="text-gray-300 italic">Not specified</span>}
                </dd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-emerald-600 p-8 text-white flex justify-between items-center shadow-lg">
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Sire Explorer</h1>
          {selectedItem && (
            <button onClick={() => setSelectedItem(null)} className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        {selectedItem ? renderDetailView() : renderListView()}
      </div>
    </div>
  );
}