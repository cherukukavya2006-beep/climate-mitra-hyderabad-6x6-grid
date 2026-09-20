import React from 'react';
import { CloudSun, Grid3X3, Sprout, BotMessageSquare, PhoneCall } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: null },
    { id: 'weather', label: 'Weather', icon: <CloudSun size={18} /> },
    { id: 'grid', label: 'Hyd Grid', icon: <Grid3X3 size={18} /> },
    { id: 'agriculture', label: 'Agriculture', icon: <Sprout size={18} /> },
    { id: 'ai', label: 'AI Assistant', icon: <BotMessageSquare size={18} /> },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 glass-card border-b border-brand-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => setActiveTab('home')}
          >
            <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-xl">
              CM
            </div>
            <span className="font-bold text-2xl tracking-tight text-brand-dark hidden sm:block">Climate Mitra</span>
          </div>

          <div className="hidden md:flex space-x-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1 px-4 py-2 rounded-full font-medium smooth-transition ${
                  activeTab === tab.id 
                    ? 'bg-brand-primary/10 text-brand-primary' 
                    : 'text-brand-dark/70 hover:bg-brand-primary/5 hover:text-brand-dark'
                }`}
              >
                {tab.icon}
                {tab.id !== 'home' && <span>{tab.label}</span>}
                {tab.id === 'home' && <span className="font-bold">Home</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center">
            <a 
              href="tel:+918000000000" 
              className="flex items-center space-x-2 px-5 py-2.5 bg-brand-accent text-brand-dark rounded-full font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 smooth-transition"
            >
              <PhoneCall size={18} />
              <span className="hidden sm:inline">Call AI</span>
            </a>
          </div>
        </div>
      </div>
      
      {/* Mobile nav indicator */}
      <div className="md:hidden flex overflow-x-auto py-2 px-4 space-x-2 border-t border-brand-border/30 bg-white">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium smooth-transition ${
              activeTab === tab.id 
                ? 'bg-brand-primary/10 text-brand-primary' 
                : 'text-brand-dark/70 hover:bg-brand-primary/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
