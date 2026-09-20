import React, { useState, useEffect } from 'react';
import { Search, Loader2, MapPin, Droplets, Wind } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

export default function Weather() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = async (searchCity: string) => {
    if (!searchCity) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/weather/current?city=${encodeURIComponent(searchCity)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWeather(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch weather');
      setWeather(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWeather(city);
  };

  useEffect(() => {
    fetchWeather('Hyderabad');
  }, []);

  const chartData = weather ? {
    labels: Array.from({length: 24}, (_, i) => `${i}:00`),
    datasets: [
      {
        fill: true,
        label: 'Temperature (°C)',
        data: weather.hourly_temps,
        borderColor: '#6b705c',
        backgroundColor: 'rgba(107, 112, 92, 0.1)',
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#3f4238',
        bodyColor: '#3f4238',
        borderColor: '#e3d5ca',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#8c7b6c' } },
      y: { grid: { color: '#e3d5ca', borderDash: [5, 5] }, ticks: { color: '#8c7b6c' } }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-brand-dark">Live Weather Insights</h2>
        <p className="text-brand-dark/70">Real-time agricultural weather data powered by Open-Meteo API.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="glass-card p-6 sm:p-8 rounded-3xl lg:col-span-1 flex flex-col">
          <form onSubmit={handleSearch} className="relative mb-6">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Search location..."
              className="w-full bg-white/50 border border-brand-border rounded-full py-3 pl-5 pr-12 text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/50 smooth-transition"
            />
            <button 
              type="submit"
              className="absolute right-2 top-2 p-2 bg-brand-primary text-white rounded-full hover:bg-brand-primary/90 smooth-transition"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            </button>
          </form>

          {error && <div className="text-red-500 text-sm mb-4 text-center">{error}</div>}

          {weather && (
            <div className="flex-grow flex flex-col items-center justify-center text-center space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-brand-dark flex items-center justify-center gap-2">
                  <MapPin size={20} className="text-brand-secondary" />
                  {weather.city}
                </h3>
                <p className="text-brand-dark/50 uppercase tracking-widest text-sm font-semibold mt-1">Live Conditions</p>
              </div>
              
              <div>
                <div className="text-7xl font-bold text-brand-primary tracking-tighter">
                  {Math.round(weather.temperature)}°
                </div>
                <div className="text-lg text-brand-dark/70 mt-2 font-medium">
                  {weather.weather_code > 50 ? 'Rainy' : weather.weather_code > 2 ? 'Cloudy' : 'Clear'}
                </div>
              </div>

              <div className="flex w-full pt-6 border-t border-brand-border/50 gap-4">
                <div className="flex-1 flex flex-col items-center p-3 bg-brand-surface rounded-2xl shadow-sm border border-brand-border/30">
                  <Droplets className="text-blue-400 mb-2" size={24} />
                  <span className="text-sm text-brand-dark/60 font-medium">Humidity</span>
                  <span className="text-lg font-bold text-brand-dark">{weather.humidity}%</span>
                </div>
                <div className="flex-1 flex flex-col items-center p-3 bg-brand-surface rounded-2xl shadow-sm border border-brand-border/30">
                  <Wind className="text-gray-400 mb-2" size={24} />
                  <span className="text-sm text-brand-dark/60 font-medium">Wind</span>
                  <span className="text-lg font-bold text-brand-dark">{weather.wind_speed} <span className="text-xs">km/h</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-3xl lg:col-span-2 min-h-[400px] flex flex-col">
          <h3 className="text-xl font-bold text-brand-dark mb-6">24-Hour Temperature Trend</h3>
          <div className="flex-grow relative w-full h-full">
            {chartData ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-brand-dark/40">
                {loading ? 'Loading chart...' : 'No data available'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
