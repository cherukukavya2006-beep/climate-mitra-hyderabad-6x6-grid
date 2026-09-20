# Climate Mitra

Climate Mitra is a complete, professional, dynamic Climate Prediction + Weather + Agriculture + AI Voice Assistant website.

## Architecture
- **Backend:** Python 3.7+ (Flask)
- **Frontend:** HTML5, CSS3, JS, Bootstrap 5
- **AI/Voice:** Sarvam AI, OpenAI
- **Database:** MongoDB
- **Weather API:** Open-Meteo

## Installation

### Prerequisites
- Python 3.7+
- MongoDB

### Setup

```bash
# Clone the repository
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Copy .env.example to .env and configure your keys
cp .env.example .env

# Run the backend (which also serves the frontend on port 3000)
python backend/app.py
```

## Features
- 🌦️ Live Weather Dashboard
- 🌱 Smart Agriculture Advisory
- 🤖 AI Assistant (English & Telugu)
- 📞 Sarvam AI Voice Calling
- 📈 Climate Trends & Predictions
