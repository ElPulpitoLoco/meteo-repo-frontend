// --- CONFIGURATION ---
const API_BASE_URL = "https://meteo-repo-backend.onrender.com"; // <--- TON URL RENDER ICI

// --- DOM ELEMENTS ---
const searchInput = document.getElementById('city-search');
const searchBtn = document.getElementById('btn-search');
const suggestionsBox = document.getElementById('suggestions-container');
const weatherContent = document.getElementById('weather-content');
const errorDiv = document.getElementById('error-message');
const mainTitle = document.getElementById('main-title');

// Variables globales pour Map et Chart
let myMap = null;
let myChart = null;

// --- EVENT LISTENERS ---
searchBtn.addEventListener('click', () => fetchWeather(searchInput.value));

// Gestion de la touche "Entrée"
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchWeather(searchInput.value);
});

// Autocomplete
searchInput.addEventListener('input', async (e) => {
    const query = e.target.value;
    if (query.length < 3) {
        suggestionsBox.innerHTML = '';
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/city-autocomplete?q=${query}`);
        const suggestions = await res.json();
        
        suggestionsBox.innerHTML = '';
        suggestions.forEach(city => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action';
            item.textContent = city;
            item.onclick = () => {
                searchInput.value = city;
                suggestionsBox.innerHTML = '';
                fetchWeather(city);
            };
            suggestionsBox.appendChild(item);
        });
    } catch (err) {
        console.error("Erreur autocomplete", err);
    }
});

// Cacher les suggestions si on clique ailleurs
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        suggestionsBox.innerHTML = '';
    }
});

// --- FONCTION PRINCIPALE ---
async function fetchWeather(city) {
    if (!city) return;

    // Reset UI
    errorDiv.style.display = 'none';
    weatherContent.style.display = 'none';
    mainTitle.textContent = "Chargement en cours...";
    suggestionsBox.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/meteo?city=${encodeURIComponent(city)}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        updateUI(data);

    } catch (error) {
        mainTitle.textContent = "Erreur";
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

// --- MISE A JOUR DE L'INTERFACE ---
function updateUI(data) {
    const current = data.current;
    const location = data.location;
    const forecast = data.forecast.forecastday;
    const todayForecast = forecast[0];

    // 1. Titre et Infos de base
    mainTitle.textContent = `🌤️ Météo pour ${location.name}`;
    document.getElementById('loc-name').textContent = location.name;
    document.getElementById('loc-country').textContent = location.country;
    document.getElementById('loc-region').textContent = location.region;
    document.getElementById('loc-tz').textContent = location.tz_id;
    document.getElementById('loc-lat').textContent = location.lat;
    document.getElementById('loc-lon').textContent = location.lon;

    document.getElementById('weather-icon').src = "https:" + current.condition.icon;
    document.getElementById('weather-text').textContent = current.condition.text;
    document.getElementById('temp-c').textContent = current.temp_c;
    document.getElementById('feelslike-c').textContent = current.feelslike_c;

    document.getElementById('astro-sunrise').textContent = todayForecast.astro.sunrise;
    document.getElementById('astro-sunset').textContent = todayForecast.astro.sunset;

    // 2. Détails complets
    document.getElementById('wind-kph').textContent = current.wind_kph;
    document.getElementById('wind-dir').textContent = current.wind_dir;
    document.getElementById('gust-kph').textContent = current.gust_kph;
    document.getElementById('humidity').textContent = current.humidity;
    document.getElementById('pressure').textContent = current.pressure_mb;
    document.getElementById('precip').textContent = current.precip_mm;
    document.getElementById('dewpoint').textContent = current.dewpoint_c;
    document.getElementById('vis-km').textContent = current.vis_km;
    document.getElementById('uv').textContent = current.uv;
    document.getElementById('last-updated').textContent = current.last_updated;

    // 3. Carte Leaflet
    if (myMap) {
        myMap.remove();
    }
    myMap = L.map('map').setView([location.lat, location.lon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(myMap);
    L.marker([location.lat, location.lon]).addTo(myMap)
        .bindPopup(`<b>${location.name}</b><br>${current.condition.text}`)
        .openPopup();

    // 4. Graphique Chart.js
    updateChart(todayForecast.hour);

    // 5. Tableau Heure par Heure
    updateHourlyTable(todayForecast.hour);

    // 6. Prévisions Jours Suivants
    updateForecastCards(forecast);

    // Afficher le tout
    weatherContent.style.display = 'block';
}

function updateChart(hoursData) {
    const ctx = document.getElementById('hourlyWeatherChart').getContext('2d');
    
    if (myChart) {
        myChart.destroy();
    }

    const labels = hoursData.map(h => h.time.split(' ')[1]); // Extrait l'heure "14:00"
    const temps = hoursData.map(h => h.temp_c);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Température (°C)',
                data: temps,
                borderColor: 'rgba(13, 110, 253, 1)',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 3,
                pointRadius: 2,
                fill: true,
                tension: 0.4 // Courbe lissée
            }]
        },
        options: { 
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Température sur 24h' }
            },
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}

function updateHourlyTable(hours) {
    const thead = document.getElementById('table-head-row');
    const tbody = document.getElementById('table-body');
    
    // Vider
    thead.innerHTML = '<th class="sticky-column p-3">Heure</th>';
    tbody.innerHTML = '';

    // Préparation des lignes
    let rowTemp = '<td class="sticky-column p-3">Temp (°C)</td>';
    let rowWind = '<td class="sticky-column p-3">Vent (km/h)</td>';
    let rowGust = '<td class="sticky-column p-3">Rafales</td>';
    let rowDir = '<td class="sticky-column p-3">Direction</td>';
    let rowPress = '<td class="sticky-column p-3">Pression</td>';
    let rowHum = '<td class="sticky-column p-3">Humidité</td>';
    let rowRain = '<td class="sticky-column p-3">Pluie (mm)</td>';
    let rowCloud = '<td class="sticky-column p-3">Nuages</td>';

    hours.forEach(h => {
        const time = h.time.split(' ')[1];
        thead.innerHTML += `<th class="p-3">${time}</th>`;
        
        // Calculs conversions (comme dans ton Twig)
        const windKnots = (h.wind_kph / 1.852).toFixed(1);
        const windMs = (h.wind_kph / 3.6).toFixed(1);
        const gustKnots = (h.gust_kph / 1.852).toFixed(1);
        const gustMs = (h.gust_kph / 3.6).toFixed(1);

        rowTemp += `<td><strong>${h.temp_c}°</strong></td>`;
        rowWind += `<td>${h.wind_kph}<br><small class="text-muted">(${windKnots} nds, ${windMs} m/s)</small></td>`;
        rowGust += `<td>${h.gust_kph}<br><small class="text-muted">(${gustKnots} nds, ${gustMs} m/s)</small></td>`;
        rowDir += `<td>${h.wind_dir}<br>(${h.wind_degree}°)</td>`;
        rowPress += `<td>${h.pressure_mb}</td>`;
        rowHum += `<td>${h.humidity}%</td>`;
        rowRain += `<td>${h.precip_mm}</td>`;
        rowCloud += `<td>${h.cloud}%</td>`;
    });

    tbody.innerHTML += `
        <tr>${rowTemp}</tr>
        <tr>${rowWind}</tr>
        <tr>${rowGust}</tr>
        <tr>${rowDir}</tr>
        <tr>${rowPress}</tr>
        <tr>${rowHum}</tr>
        <tr>${rowRain}</tr>
        <tr>${rowCloud}</tr>
    `;
}

function updateForecastCards(forecastDays) {
    const container = document.getElementById('forecast-container');
    container.innerHTML = '';

    forecastDays.forEach(day => {
        // Formatage de la date en français
        const dateObj = new Date(day.date);
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const dateStr = dateObj.toLocaleDateString('fr-FR', options);
        // Majuscule première lettre
        const dateFinal = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4';
        col.innerHTML = `
            <div class="card h-100 shadow-sm border-0">
                <div class="card-body text-center">
                    <h5 class="card-title text-primary">${dateFinal}</h5>
                    <img src="https:${day.day.condition.icon}" alt="icon" class="my-2" width="64">
                    <p class="fw-bold mb-1">${day.day.condition.text}</p>
                    <div class="d-flex justify-content-center gap-3 my-3">
                        <span class="badge bg-info text-dark">Min: ${day.day.mintemp_c}°C</span>
                        <span class="badge bg-danger">Max: ${day.day.maxtemp_c}°C</span>
                    </div>
                    <p class="text-muted mb-0">☔ Pluie: ${day.day.daily_chance_of_rain}%</p>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}