import React, { useState } from 'react';
import { Sprout, Loader2, ThermometerSun, Droplets, Wind, Info } from 'lucide-react';

export default function Agriculture() {
  const [crop, setCrop] = useState('Cotton');
  const [activity, setActivity] = useState('Sowing');
  const [location, setLocation] = useState('Hyderabad');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/farming/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop, activity, location })
      });
      const data = await res.json();
      setResult(data.recommendation);
    } catch (err) {
      setResult("Could not generate advisory. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center p-3 bg-brand-secondary/10 text-brand-secondary rounded-full mb-2">
          <Sprout size={32} />
        </div>
        <h2 className="text-3xl font-bold text-brand-dark">Smart Agriculture</h2>
        <p className="text-brand-dark/70">Weather-based farming guidance tailored for your crop and location.</p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="glass-card p-6 sm:p-8 rounded-3xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-brand-dark/80">Crop Type</label>
                <select 
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full bg-white border border-brand-border rounded-xl py-3 px-4 text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50 smooth-transition"
                >
                  <option>Cotton</option>
                  <option>Rice</option>
                  <option>Maize</option>
                  <option>Groundnut</option>
                  <option>Chilli</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-brand-dark/80">Farming Activity</label>
                <select 
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="w-full bg-white border border-brand-border rounded-xl py-3 px-4 text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50 smooth-transition"
                >
                  <option>Sowing</option>
                  <option>Irrigation</option>
                  <option>Pesticide spraying</option>
                  <option>Harvesting</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-dark/80">Location</label>
              <input 
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter district or city..."
                className="w-full bg-white border border-brand-border rounded-xl py-3 px-4 text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50 smooth-transition"
              />
            </div>

            <div className="pt-4 text-center">
              <button 
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-10 py-4 bg-brand-primary text-white rounded-full font-bold shadow-md hover:shadow-lg hover:bg-brand-primary/90 smooth-transition disabled:opacity-70 flex items-center justify-center gap-2 mx-auto"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Sprout size={20} />}
                Generate Advisory
              </button>
            </div>
          </form>

          {result && (
            <div className="mt-8 p-6 bg-brand-surface border border-brand-primary/20 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <h4 className="flex items-center gap-2 font-bold text-brand-primary mb-4 text-lg">
                <Info size={20} />
                Official Advisory
              </h4>
              <div className="prose prose-sm max-w-none text-brand-dark/80 font-medium whitespace-pre-wrap leading-relaxed">
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
