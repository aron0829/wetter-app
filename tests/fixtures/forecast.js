// Erzeugt eine Antwort in der Form der Open-Meteo-Forecast-API.
import { addDays } from '../../public/js/time.js';

const pad = (n) => String(n).padStart(2, '0');

export function makeForecast({
  start = '2026-11-14',
  days = 9,
  timezone = 'Europe/Madrid',
  current = '2026-11-15T22:45',
  hourlyCode = () => 3,
  withSun = true,
} = {}) {
  const hourly = {
    time: [], temperature_2m: [], apparent_temperature: [], precipitation: [],
    precipitation_probability: [], wind_speed_10m: [], wind_direction_10m: [],
    weather_code: [], uv_index: [], is_day: [], relative_humidity_2m: [],
  };
  const daily = {
    time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [],
    precipitation_sum: [], precipitation_probability_max: [], uv_index_max: [],
  };
  if (withSun) {
    daily.sunrise = [];
    daily.sunset = [];
  }

  for (let d = 0; d < days; d++) {
    const date = addDays(start, d);
    daily.time.push(date);
    daily.weather_code.push(3);
    daily.temperature_2m_max.push(20 + d);
    daily.temperature_2m_min.push(10 + d);
    daily.precipitation_sum.push(d * 0.5);
    daily.precipitation_probability_max.push(d * 10);
    daily.uv_index_max.push(3.2);
    if (withSun) {
      daily.sunrise.push(`${date}T08:03`);
      daily.sunset.push(`${date}T18:13`);
    }
    for (let h = 0; h < 24; h++) {
      const time = `${date}T${pad(h)}:00`;
      hourly.time.push(time);
      hourly.temperature_2m.push(10 + d + h / 10);
      hourly.apparent_temperature.push(9 + d + h / 10);
      hourly.precipitation.push(0);
      hourly.precipitation_probability.push(5);
      hourly.wind_speed_10m.push(6);
      hourly.wind_direction_10m.push(247);
      hourly.weather_code.push(hourlyCode(time, d, h));
      hourly.uv_index.push(h > 8 && h < 18 ? 2.4 : 0);
      hourly.is_day.push(h >= 8 && h <= 18 ? 1 : 0);
      hourly.relative_humidity_2m.push(73);
    }
  }

  return {
    latitude: 36.74,
    longitude: -4.43,
    timezone,
    utc_offset_seconds: 3600,
    current: {
      time: current,
      temperature_2m: 17.4,
      apparent_temperature: 16.2,
      is_day: 0,
      weather_code: 2,
      wind_speed_10m: 6.4,
      wind_direction_10m: 247,
      wind_gusts_10m: 18.2,
      relative_humidity_2m: 73,
      precipitation: 0,
      uv_index: 0,
    },
    hourly,
    daily,
  };
}
