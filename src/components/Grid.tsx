import React, { useState, useEffect } from 'react';
import { MapPin, CloudRain, Cloud, Sun, Loader2 } from 'lucide-react';

interface GridCell {
  id: number;
  lat: number;
  lon: number;
  temperature: number;
  code: number;
  description: string;
}

export default function Grid() {
  const [gridData, setGridData] = useState<GridCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch('/api/weather/grid')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setGridData(data.grid);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleHighlightLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        let closest: GridCell | null = null;
        let minDist = Infinity;

        gridData.forEach(cell => {
          const dLat = cell.lat - latitude;
          const dLon = cell.lon - longitude;
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          if (dist < minDist) {
            minDist = dist;
            closest = cell;
          }
        });

        if (closest) {
          if (minDist > 0.3) {
            alert("You appear to be outside Hyderabad, but we highlighted the closest point.");
          }
          setHighlightId(closest.id);
        }
      },
      (err) => {
        setLocating(false);
        alert("Geolocation failed. Please check your permissions.");
      }
    );
  };

  const getIcon = (code: number) => {
    if (code > 50) return <CloudRain className="text-brand-primary" size={24} />;
    if (code > 2) return <Cloud className="text-brand-dark/50" size={24} />;
    return <Sun className="text-brand-secondary" size={24} />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-brand-dark">Hyderabad 6×6 Weather Grid</h2>
        <p className="text-brand-dark/70">
          Hyperlocal geographic weather module with batch telemetry. View real-time temperature gradients across the city.
        </p>
        <button 
          onClick={handleHighlightLocation}
          disabled={locating || loading}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-surface border border-brand-border rounded-full font-medium shadow-sm hover:shadow hover:border-brand-primary smooth-transition disabled:opacity-50"
        >
          {locating ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />}
          <span>Highlight My Location</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-brand-primary">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p>Fetching grid telemetry...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-center border border-red-100">
          {error}
        </div>
      ) : (
        <div className="glass-card p-4 sm:p-8 rounded-3xl max-w-4xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {gridData.map(cell => (
              <div 
                key={cell.id}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl smooth-transition ${
                  highlightId === cell.id 
                    ? 'bg-brand-accent/30 border-2 border-brand-secondary shadow-lg scale-110 z-10' 
                    : 'bg-brand-surface shadow-sm border border-brand-border/50 hover:shadow-md hover:-translate-y-1'
                }`}
                title={`Lat: ${cell.lat}, Lon: ${cell.lon}`}
              >
                {getIcon(cell.code)}
                <span className="text-xl font-bold mt-2 text-brand-dark">{cell.temperature}°</span>
                <span className="text-[10px] uppercase font-bold text-brand-dark/50 mt-1 tracking-wider">{cell.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
