import React from 'react';
import HandGestureCanvas from './components/HandGestureCanvas';
import { Sparkles } from 'lucide-react';

export default function App() {
  return (
    <div className="h-screen w-full bg-[#0A0A0B] text-slate-300 font-sans flex flex-col overflow-hidden select-none">
      <header className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-[#0F0F12] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
          <h1 className="text-xs font-mono font-bold tracking-widest text-slate-100 uppercase flex items-center gap-2">
            HANDY SYSTEM <Sparkles className="w-3 h-3 text-emerald-400" /> // GESTURE RECOGNITION
          </h1>
        </div>
        <div className="hidden sm:flex gap-6 text-[10px] font-mono text-slate-500">
          <span>CAMERA_FEED: <span className="text-emerald-400 uppercase">Active (FHD)</span></span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-slate-800 flex-col bg-[#0C0C0E] hidden lg:flex">
          <div className="p-3 border-b border-slate-800 flex justify-between items-end">
            <span className="text-[10px] uppercase tracking-tighter text-slate-500 font-bold">Event Stream</span>
            <span className="text-[9px] text-emerald-500 opacity-70">LIVE_DATA</span>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col font-mono text-[10px] p-2 space-y-1">
            <div className="bg-slate-800/20 p-2 border-l-2 border-emerald-500">
              <div className="flex justify-between text-emerald-400 mb-1">
                <span>[OK]</span>
              </div>
              <p className="text-slate-300">SYSTEM_READY</p>
              <p className="text-slate-500 mt-2 font-sans text-xs">AI-powered gesture control. Step back and use your hands to interact.</p>
            </div>
            <div className="p-2 border-l-2 border-slate-700 opacity-60">
              <p className="text-emerald-400/80 text-[10px] font-sans">হাত দিয়ে স্ক্রিনে আঁকুন বা টুলবার থেকে কালার সিলেক্ট করুন।</p>
            </div>
          </div>
        </aside>

        <section className="flex-1 relative bg-black flex items-center justify-center p-4">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_transparent_70%)] pointer-events-none"></div>
          
          <div className="relative w-full h-full flex-grow flex flex-col items-center justify-center z-10 max-h-[85vh]">
            <HandGestureCanvas />
          </div>

          <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-slate-700 pointer-events-none hidden sm:block"></div>
          <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-slate-700 pointer-events-none hidden sm:block"></div>
          <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-slate-700 pointer-events-none hidden sm:block"></div>
          <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-slate-700 pointer-events-none hidden sm:block"></div>
        </section>
      </main>

      <footer className="h-8 border-t border-slate-800 bg-[#0F0F12] flex items-center px-4 justify-between shrink-0">
        <div className="flex gap-4 font-mono text-[9px] text-slate-600">
          <span className="hidden sm:inline">COORDS: X_AUTO Y_AUTO</span>
          <span className="hidden sm:inline">SENSOR: INTERACTIVE</span>
          <span className="text-emerald-500/60">SYSTEM_HEALTH: OPTIMAL</span>
        </div>
        <div className="text-[9px] text-slate-500 font-mono">
          &copy; 2026 HANDY AI. SECURED INTERFACE.
        </div>
      </footer>
    </div>
  );
}
