const CURRENT_YEAR = new Date().getFullYear();
const API_URLS = [
  '/api/holidays',
  'https://api-colombia.com/api/v1/Holiday',
  'https://api-colombia.com/api/v1/holiday',
  'https://api-colombia.com/api/v1/holidays',
  `https://date.nager.at/api/v3/PublicHolidays/${CURRENT_YEAR}/CO`,
  `https://date.nager.at/api/v3/PublicHolidays/${CURRENT_YEAR + 1}/CO`,
];
const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const totalHolidaysEl = document.getElementById('totalHolidays');
const yearSpanEl = document.getElementById('yearSpan');
const nextHolidayEl = document.getElementById('nextHoliday');
const monthChartEl = document.getElementById('monthChart');
const weekdayChartEl = document.getElementById('weekdayChart');
const tableBodyEl = document.getElementById('holidayTableBody');
const loadingStateEl = document.getElementById('loadingState');
const messageBoxEl = document.getElementById('messageBox');
const reloadButtonEl = document.getElementById('reloadButton');

reloadButtonEl.addEventListener('click', () => {
  loadDashboard();
});

loadDashboard();

async function loadDashboard() {
  setMessage('', true);
  loadingStateEl.textContent = 'Cargando datos desde la API...';
  loadingStateEl.hidden = false;

  try {
    const rawData = await fetchHolidaysWithFallback();
    const holidays = normalizeHolidays(rawData);

    if (holidays.length === 0) {
      throw new Error('La API no devolvió feriados válidos.');
    }

    const sortedHolidays = sortByDate(holidays);
    renderStats(sortedHolidays);
    renderTable(sortedHolidays);
    renderCharts(sortedHolidays);
    loadingStateEl.hidden = true;
  } catch (error) {
    loadingStateEl.textContent = 'No se pudieron cargar los datos.';
    setMessage(
      `No fue posible consumir la API en este momento. ${error instanceof Error ? error.message : 'Error desconocido.'} Abre la app con npm start para usar el proxy local.`,
      false,
    );
  }
}

async function fetchHolidaysWithFallback() {
  const failures = [];

  for (const apiUrl of API_URLS) {
    try {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorDetail = await readErrorDetail(response);
        throw new Error(`La API respondió con ${response.status}${errorDetail ? `: ${errorDetail}` : ''}`);
      }

      const rawData = await response.json();
      const extracted = extractHolidayArray(rawData);

      if (extracted.length === 0) {
        throw new Error('La respuesta no contiene un arreglo de feriados.');
      }

      return extracted;
    } catch (error) {
      failures.push(`${apiUrl}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  throw new Error(`No se pudo obtener respuesta válida. ${failures.join(' | ')}`);
}

function extractHolidayArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidateKeys = ['data', 'items', 'results', 'holidays', 'response'];

  for (const key of candidateKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return [];
}

async function readErrorDetail(response) {
  try {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return payload?.error || payload?.detail || '';
    }

    const text = await response.text();
    return text.slice(0, 180);
  } catch {
    return '';
  }
}

function normalizeHolidays(data) {
  const items = extractHolidayArray(data);

  return items
    .map((item) => {
      const dateValue = item?.date ?? item?.Date ?? item?.holidayDate ?? item?.day;
      const parsedDate = new Date(dateValue);

      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }

      const name = item?.name ?? item?.holidayName ?? item?.localName ?? item?.description ?? 'Feriado';

      return {
        name,
        date: parsedDate,
        dayIndex: parsedDate.getDay(),
        monthIndex: parsedDate.getMonth(),
        year: parsedDate.getFullYear(),
      };
    })
    .filter(Boolean);
}

function sortByDate(holidays) {
  return [...holidays].sort((left, right) => left.date - right.date);
}

function renderStats(holidays) {
  totalHolidaysEl.textContent = String(holidays.length);

  const years = [...new Set(holidays.map((holiday) => holiday.year))].sort((left, right) => left - right);
  yearSpanEl.textContent = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : String(years[0]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextHoliday = holidays.find((holiday) => holiday.date >= today);
  nextHolidayEl.textContent = nextHoliday
    ? `${formatDate(nextHoliday.date)} · ${nextHoliday.name}`
    : 'No hay fechas futuras en el conjunto';
}

function renderTable(holidays) {
  const previewRows = holidays.slice(0, 12);

  tableBodyEl.innerHTML = previewRows
    .map((holiday) => {
      return `
        <tr>
          <td>${formatDate(holiday.date)}</td>
          <td>${escapeHtml(holiday.name)}</td>
          <td>${DAY_NAMES[holiday.dayIndex]}</td>
        </tr>
      `;
    })
    .join('');
}

function renderCharts(holidays) {
  if (typeof Plotly === 'undefined') {
    setMessage('No se pudo cargar Plotly (CDN). Revisa tu conexión o bloqueadores de scripts.', false);
    return;
  }

  const monthCounts = countBy(holidays, 'monthIndex', 12);
  const weekdayCounts = countBy(holidays, 'dayIndex', 7);

  Plotly.react(
    monthChartEl,
    [
      {
        type: 'bar',
        x: MONTH_NAMES,
        y: monthCounts,
        marker: {
          color: MONTH_NAMES.map((_, index) => `rgba(15, 118, 110, ${0.38 + index * 0.04})`),
        },
        hovertemplate: '%{x}: %{y} feriados<extra></extra>',
      },
    ],
    chartLayout('Feriados por mes', 'Mes', 'Cantidad'),
    chartConfig(),
  );

  Plotly.react(
    weekdayChartEl,
    [
      {
        type: 'scatterpolar',
        r: weekdayCounts,
        theta: DAY_NAMES,
        fill: 'toself',
        line: { color: '#b45309', width: 3 },
        fillcolor: 'rgba(180, 83, 9, 0.18)',
        hovertemplate: '%{theta}: %{r} feriados<extra></extra>',
      },
    ],
    {
      ...chartLayout('Feriados por día', '', ''),
      polar: {
        radialaxis: { visible: true, gridcolor: 'rgba(42, 38, 30, 0.1)' },
        angularaxis: { direction: 'clockwise' },
      },
    },
    chartConfig(),
  );
}

function countBy(items, key, size) {
  return items.reduce((accumulator, item) => {
    accumulator[item[key]] += 1;
    return accumulator;
  }, Array.from({ length: size }, () => 0));
}

function chartLayout(title, xAxisTitle, yAxisTitle) {
  return {
    title: {
      text: title,
      font: { family: 'Space Grotesk, sans-serif', size: 18, color: '#1d1a17' },
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    margin: { l: 45, r: 24, t: 54, b: 52 },
    font: { family: 'Inter, sans-serif', color: '#1d1a17' },
    xaxis: {
      title: xAxisTitle ? { text: xAxisTitle } : undefined,
      gridcolor: 'rgba(42, 38, 30, 0.08)',
      zerolinecolor: 'rgba(42, 38, 30, 0.12)',
    },
    yaxis: {
      title: yAxisTitle ? { text: yAxisTitle } : undefined,
      gridcolor: 'rgba(42, 38, 30, 0.08)',
      zerolinecolor: 'rgba(42, 38, 30, 0.12)',
    },
    showlegend: false,
  };
}

function chartConfig() {
  return {
    responsive: true,
    displayModeBar: false,
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function escapeHtml(value) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value).replace(/[&<>"']/g, (character) => entityMap[character]);
}

function setMessage(text, hidden) {
  messageBoxEl.textContent = text;
  messageBoxEl.classList.toggle('message--hidden', hidden);
}
