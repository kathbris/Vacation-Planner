
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Build months checklist
(function initMonths(){
  const list = document.querySelector('.month-list');
  for(let m=0;m<12;m++){
    const label = document.createElement('label');
    label.className = 'month-pill';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = (m+1);
    // Default to June, July, August
    if([6,7,8].includes(m+1)) cb.checked = true;
    label.appendChild(cb);
    const span = document.createElement('span');
    span.textContent = MONTH_NAMES[m];
    label.appendChild(span);
    list.appendChild(label);
  }
})();

let HOLIDAYS = null;
const holidaysReady = fetch('holidays-2025.json').then(r=>r.json()).then(json=>{HOLIDAYS = json; return json;});

const form = document.getElementById('plannerForm');
const buildBtn = document.getElementById('buildBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const holidayBudgetInput = document.getElementById('holidayBudget');
const holidayTallyEl = document.getElementById('holidayTally');

// Update tally when user changes the budget
if(holidayBudgetInput){
  holidayBudgetInput.addEventListener('input', updateTotals);
}

buildBtn.addEventListener('click', buildCalendar);
clearBtn.addEventListener('click', () => {
  document.querySelectorAll('.day.vacation').forEach(el=>el.classList.remove('vacation'));
  updateTotals();
});

function parseISO(dateStr){
  const [y,m,d] = dateStr.split('-').map(n=>parseInt(n,10));
  return new Date(y, m-1, d);
}

function getRegionHolidays(region){
  if(!HOLIDAYS) return [];
  const year = parseInt(document.getElementById('year').value, 10);
  const yearStr = String(year);
  
  // Check if we have data for this year
  if(!HOLIDAYS.years || !HOLIDAYS.years[yearStr]){
    console.warn(`Holiday dataset does not include ${year}. Available years: ${Object.keys(HOLIDAYS.years || {}).join(', ')}`);
    return [];
  }

  const yearData = HOLIDAYS.years[yearStr];

  // If no specific region requested, return the federal baseline
  if(!region || region === 'Canada (Federal)'){
    return (yearData['Canada (Federal)'] || []).map(h=>({...h, scope:'Federal'}));
  }

  // For a specific region (e.g., Alberta), return only holidays observed in that region
  // Start from the region's own list (prefer local definitions), keyed by ISO date
  const regionList = yearData[region] || [];
  const byDate = new Map();
  regionList.forEach(h => byDate.set(h.date, {...h, scope: region}));

  // Ensure we only include federal entries that are also observed in the region (i.e., same date)
  // This removes federal-only holidays that the region does not observe.
  (yearData['Canada (Federal)'] || []).forEach(h => {
    if(byDate.has(h.date)){
      // keep the region's version (already in map); no action needed
    }
  });

  return Array.from(byDate.values());
}

function buildCalendar(){
  const container = document.getElementById('calendarContainer');
  container.innerHTML = '';
  const year = parseInt(document.getElementById('year').value, 10);
  const region = document.getElementById('region').value;
  const excludeWeekends = document.getElementById('excludeWeekends').checked;
  const excludeHolidays = document.getElementById('excludeHolidays').checked;

  const months = Array.from(document.querySelectorAll('.month-list input:checked')).map(cb=>parseInt(cb.value,10));
  months.sort((a,b)=>a-b);

  const holidays = getRegionHolidays(region);
  const holidaysByISO = new Map();
  holidays.forEach(h => {
    holidaysByISO.set(h.date, h);
  });

  months.forEach(month => {
    const cal = document.createElement('section');
    cal.className = 'calendar';
    const header = document.createElement('header');
    header.innerHTML = `<div><strong>${MONTH_NAMES[month-1]} ${year}</strong></div>`+
      `<div class="meta">Region: ${region}</div>`;
    cal.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'grid';
    const weekdays = document.createElement('div');
    weekdays.className = 'weekdays';
    // Add header for week checkbox column
    const weekHeader = document.createElement('div');
    weekHeader.textContent = 'Wk';
    weekHeader.style.fontSize = '.75rem';
    weekdays.appendChild(weekHeader);
    // Show only Mon-Fri (indices 1-5)
    WEEKDAY_NAMES.slice(1,6).forEach(n=>{
      const el = document.createElement('div');
      el.textContent = n;
      weekdays.appendChild(el);
    });
    grid.appendChild(weekdays);

    const days = document.createElement('div');
    days.className = 'days';

    const firstDay = new Date(year, month-1, 1);
    const startWeekday = firstDay.getDay();
    const numDays = new Date(year, month, 0).getDate();

    const workweekStart = startWeekday === 0 ? 0 : startWeekday - 1;
    
    // Build all day cells first (without checkboxes)
    const dayCells = [];
    for(let d=1; d<=numDays; d++){
      const date = new Date(year, month-1, d);
      // Skip weekends
      if([0,6].includes(date.getDay())) continue;
      
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.iso = iso;
      cell.innerHTML = `<div>${d}</div>`;
      const h = holidaysByISO.get(iso);
      if(h){
        cell.classList.add('holiday');
        // Optional / civic marking
        if(/Optional|civic|Civic/i.test(h.type)){
          cell.classList.add('optional');
        }
        // Statutory (cannot be selected)
        if(/statutory/i.test(h.type)){
          cell.classList.add('statutory');
          cell.setAttribute('aria-disabled','true');
        }
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = h.name;
        cell.appendChild(label);
      }

      // Only allow selecting non-statutory days
      if(!cell.classList.contains('statutory')){
        cell.addEventListener('click', () => {
          cell.classList.toggle('vacation');
          updateTotals();
        });
      } else {
        // make sure keyboard / screen-reader users know it's disabled
        cell.setAttribute('tabindex','0');
      }
      dayCells.push(cell);
    }
    
    // Add items in correct grid order: checkbox first, then cells for each row
    let cellIndex = 0;
    
    // First week (may be incomplete if month doesn't start on Monday)
    const firstWeekCheckbox = document.createElement('input');
    firstWeekCheckbox.type = 'checkbox';
    firstWeekCheckbox.className = 'week-checkbox';
    firstWeekCheckbox.title = 'Select entire week';
    days.appendChild(firstWeekCheckbox);
    
    // Add leading empty cells for first week
    for(let i=0; i<workweekStart; i++){
      const empty = document.createElement('div');
      empty.className = 'day empty';
      days.appendChild(empty);
    }
    
    // Add day cells for first week (up to 5-workweekStart cells)
    const firstWeekCells = [];
    for(let i=0; i<Math.min(5-workweekStart, dayCells.length); i++){
      days.appendChild(dayCells[cellIndex]);
      firstWeekCells.push(dayCells[cellIndex]);
      cellIndex++;
    }
    firstWeekCheckbox.weekCells = firstWeekCells.filter(c => !c.classList.contains('statutory'));
    firstWeekCheckbox.addEventListener('change', function(){
      this.weekCells.forEach(cell => {
        cell.classList.toggle('vacation', this.checked);
      });
      updateTotals();
    });
    
    // Remaining weeks
    while(cellIndex < dayCells.length){
      const weekCheckbox = document.createElement('input');
      weekCheckbox.type = 'checkbox';
      weekCheckbox.className = 'week-checkbox';
      weekCheckbox.title = 'Select entire week';
      days.appendChild(weekCheckbox);
      
      const weekCells = [];
      for(let i=0; i<5 && cellIndex<dayCells.length; i++){
        days.appendChild(dayCells[cellIndex]);
        weekCells.push(dayCells[cellIndex]);
        cellIndex++;
      }
      weekCheckbox.weekCells = weekCells.filter(c => !c.classList.contains('statutory'));
      weekCheckbox.addEventListener('change', function(){
        this.weekCells.forEach(cell => {
          cell.classList.toggle('vacation', this.checked);
        });
        updateTotals();
      });
    }

    grid.appendChild(days);

    const totals = document.createElement('div');
    totals.className = 'totals';
    totals.innerHTML = `
      <span class="badge"><span class="swatch h"></span>Holiday</span>
      <span class="badge"><span class="swatch s"></span>Statutory</span>
      <span class="badge"><span class="swatch o"></span>Optional/civic</span>
      <span class="badge"><span class="swatch w"></span>Weekend</span>
      <strong>Days booked: <span class="monthTotal">0</span></strong>
    `;
    cal.appendChild(grid);
    cal.appendChild(totals);

    container.appendChild(cal);
  });

  // Store options for totals
  container.dataset.excludeWeekends = excludeWeekends ? '1' : '0';
  container.dataset.excludeHolidays = excludeHolidays ? '1' : '0';
  updateTotals();
}

function updateTotals(){
  const container = document.getElementById('calendarContainer');
  const excludeWeekends = container.dataset.excludeWeekends === '1';
  const excludeHolidays = container.dataset.excludeHolidays === '1';

  let grand = 0;
  document.querySelectorAll('.calendar').forEach(cal => {
    let count = 0;
    cal.querySelectorAll('.day.vacation').forEach(cell => {
      const isWeekend = cell.classList.contains('weekend');
      const isHoliday = cell.classList.contains('holiday');
      if(excludeWeekends && isWeekend) return;
      if(excludeHolidays && isHoliday) return;
      count++;
    });
    cal.querySelector('.monthTotal').textContent = count;
    grand += count;
  });
  // Add an overall total banner
  let banner = document.getElementById('grandTotal');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'grandTotal';
    banner.style.textAlign = 'right';
    banner.style.padding = '0 2rem 1rem';
    banner.style.fontWeight = '700';
    document.body.insertBefore(banner, document.querySelector('footer'));
  }
  banner.textContent = `Total vacation days: ${grand}`;

  // Update holiday budget tally (selected vs remaining)
  const hbEl = document.getElementById('holidayBudget');
  const tallyEl = document.getElementById('holidayTally');
  if(tallyEl){
    const budget = hbEl ? (parseInt(hbEl.value, 10) || 0) : 0;
    const remaining = budget - grand;
    tallyEl.textContent = `Selected: ${grand} • Remaining: ${remaining}`;
  }
}

// Print function
exportBtn.addEventListener('click', () => {
  const container = document.querySelector('.print-area');
  const name = document.getElementById('employeeName').value || 'Employee';
  const manager = document.getElementById('managerName').value || 'Manager';
  const year = document.getElementById('year').value;

  // Calculate total vacation days
  const containerEl = document.getElementById('calendarContainer');
  const excludeWeekends = containerEl.dataset.excludeWeekends === '1';
  const excludeHolidays = containerEl.dataset.excludeHolidays === '1';
  let totalDays = 0;
  document.querySelectorAll('.day.vacation').forEach(cell => {
    const isWeekend = cell.classList.contains('weekend');
    const isHoliday = cell.classList.contains('holiday');
    if(excludeWeekends && isWeekend) return;
    if(excludeHolidays && isHoliday) return;
    totalDays++;
  });

  // Add print header temporarily
  const cover = document.createElement('div');
  cover.id = 'printHeader';
  cover.style.padding = '1rem 2rem';
  cover.style.background = '#ffffff';
  cover.style.color = '#111827';
  cover.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Inter,sans-serif';
  cover.innerHTML = `<h2 style="margin:.25rem 0">Vacation Planner — ${year}</h2>
    <p style="margin:0"><strong>Employee:</strong> ${name} &nbsp; | &nbsp; <strong>Manager:</strong> ${manager}</p>
    <p style="margin:0"><strong>Total Vacation Days Selected:</strong> ${totalDays}</p>
    <p style="margin:.25rem 0 0 0;font-size:.9rem;color:#374151">Generated on ${new Date().toLocaleDateString()}</p>`;
  container.prepend(cover);

  // Trigger print dialog
  window.print();

  // Remove header after print dialog closes
  setTimeout(() => {
    cover.remove();
  }, 100);
});

// Auto-build on load: set next year, check only June/July/August, set holiday budget default, and build calendar
(function autoBuildOnLoad(){
  const yearInput = document.getElementById('year');
  if(yearInput) yearInput.value = new Date().getFullYear() + 1; // next year
  // check only June (6), July (7), August (8)
  document.querySelectorAll('.month-list input').forEach(cb=>{
    cb.checked = ['6','7','8'].includes(cb.value);
  });
  const hb = document.getElementById('holidayBudget');
  if(hb) hb.value = 43;
  // Build calendars after holidays load
  holidaysReady.then(() => buildCalendar());
})();
