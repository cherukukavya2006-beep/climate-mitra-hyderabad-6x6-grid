import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Weather from './components/Weather';
import Grid from './components/Grid';
import Agriculture from './components/Agriculture';
import AIAssistant from './components/AIAssistant';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-grow pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {activeTab === 'home' && (
          <div className="flex flex-col items-center justify-center text-center space-y-8 py-12 animate-in fade-in zoom-in duration-500">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-brand-dark">
              Understand Weather.<br />
              <span className="text-brand-secondary">Predict Climate.</span><br />
              Protect Agriculture.
            </h1>
            <p className="text-xl text-brand-dark/70 max-w-2xl">
              AI-powered weather, climate and agriculture intelligence for everyone. Explore hyper-local grids and smart farming advisories.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-8">
              <button 
                onClick={() => setActiveTab('weather')}
                className="px-8 py-4 bg-brand-primary text-white rounded-full font-semibold shadow-lg hover:bg-brand-primary/90 smooth-transition"
              >
                Check Weather
              </button>
              <button 
                onClick={() => setActiveTab('grid')}
                className="px-8 py-4 bg-white text-brand-primary border-2 border-brand-primary/20 rounded-full font-semibold shadow-sm hover:border-brand-primary smooth-transition"
              >
                Hyderabad Grid
              </button>
              <button 
                onClick={() => setActiveTab('agriculture')}
                className="px-8 py-4 bg-brand-secondary text-white rounded-full font-semibold shadow-lg hover:bg-brand-secondary/90 smooth-transition"
              >
                Explore Farming
              </button>
            </div>
          </div>
        )}

        {activeTab === 'weather' && <Weather />}
        {activeTab === 'grid' && <Grid />}
        {activeTab === 'agriculture' && <Agriculture />}
        {activeTab === 'ai' && <AIAssistant />}
      </main>

      <footer className="py-6 text-center text-sm text-brand-dark/60 bg-brand-surface/50 border-t border-brand-border">
        &copy; 2026 Climate Mitra. Decision-support information only.
      </footer>
    </div>
  );
}
