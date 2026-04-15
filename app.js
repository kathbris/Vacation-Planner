
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
const pdfBtn = document.getElementById('pdfBtn');
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
pdfBtn.addEventListener('click', exportToPDF);

function parseISO(dateStr){
  const [y,m,d] = dateStr.split('-').map(n=>parseInt(n,10));
  return new Date(y, m-1, d);
}

function getRegionHolidaysForYear(region, year){
  if(!HOLIDAYS) return [];
  const yearStr = String(year);
  
  // Check if we have data for this year
  if(!HOLIDAYS.years || !HOLIDAYS.years[yearStr]){
    console.warn(`Holiday dataset does not include ${year}. Available years: ${Object.keys(HOLIDAYS.years || {}).join(', ')}`);
    return [];
  }

  const yearData = HOLIDAYS.years[yearStr];

  // Return Alberta holidays
  const regionList = yearData['Alberta'] || [];
  const byDate = new Map();
  regionList.forEach(h => byDate.set(h.date, {...h, scope: 'Alberta'}));

  return Array.from(byDate.values());
}

function getRegionHolidays(region){
  const year = parseInt(document.getElementById('year').value, 10);
  return getRegionHolidaysForYear(region, year);
}

// Helper function to get form input values
function getFormInputs(){
  return {
    name: document.getElementById('employeeName').value || 'Employee',
    manager: document.getElementById('managerName').value || 'Manager',
    year: document.getElementById('year').value,
    region: 'Alberta'
  };
}

// Helper function to get exclusion settings
function getExclusionSettings(){
  const container = document.getElementById('calendarContainer');
  return {
    excludeWeekends: container.dataset.excludeWeekends === '1',
    excludeHolidays: container.dataset.excludeHolidays === '1'
  };
}

// Helper function to calculate total vacation days
function calculateVacationDays(){
  const { excludeWeekends, excludeHolidays } = getExclusionSettings();
  let total = 0;
  document.querySelectorAll('.day.vacation').forEach(cell => {
    const isWeekend = cell.classList.contains('weekend');
    const isHoliday = cell.classList.contains('holiday');
    if(excludeWeekends && isWeekend) return;
    if(excludeHolidays && isHoliday) return;
    total++;
  });
  return total;
}

function buildCalendar(){
  const container = document.getElementById('calendarContainer');
  container.innerHTML = '';
  const { year, region } = getFormInputs();
  const yearNum = parseInt(year, 10);
  const excludeWeekends = document.getElementById('excludeWeekends').checked;
  const excludeHolidays = document.getElementById('excludeHolidays').checked;

  const months = Array.from(document.querySelectorAll('.month-list input:checked')).map(cb=>parseInt(cb.value,10));
  
  // Check if both December (12) and January (1) are selected
  const hasDecember = months.includes(12);
  const hasJanuary = months.includes(1);
  
  // Custom sort: if both Dec and Jan are selected, Dec comes first
  if (hasDecember && hasJanuary) {
    months.sort((a,b) => {
      if (a === 12) return -1; // December goes first
      if (b === 12) return 1;
      if (a === 1) return -1;  // January goes second
      if (b === 1) return 1;
      return a - b;            // Everything else in normal order
    });
  } else {
    months.sort((a,b)=>a-b);
  }

  const shouldUsePriorYearForDecember = hasDecember && hasJanuary;
  
  // Build holidays map - include both current year and prior year if December is selected
  const holidaysByISO = new Map();
  const holidays = getRegionHolidays(region);
  holidays.forEach(h => {
    holidaysByISO.set(h.date, h);
  });
  
  // If December is selected and we're using prior year for December, also load prior year holidays
  if(shouldUsePriorYearForDecember){
    const priorYearHolidays = getRegionHolidaysForYear(region, yearNum - 1);
    priorYearHolidays.forEach(h => {
      holidaysByISO.set(h.date, h);
    });
  }

  months.forEach(month => {
    // If this is December and both Dec/Jan are selected, use previous year
    const isDecember = month === 12;
    const displayYear = (isDecember && shouldUsePriorYearForDecember) ? yearNum - 1 : yearNum;
    
    const cal = document.createElement('section');
    cal.className = 'calendar';
    const header = document.createElement('header');
    header.innerHTML = `<div><strong>${MONTH_NAMES[month-1]} ${displayYear}</strong></div>`+
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

    const firstDay = new Date(displayYear, month-1, 1);
    const startWeekday = firstDay.getDay();
    const numDays = new Date(displayYear, month, 0).getDate();

    const workweekStart = startWeekday === 0 ? 0 : startWeekday - 1;
    
    // Build all day cells first (without checkboxes)
    const dayCells = [];
    for(let d=1; d<=numDays; d++){
      const date = new Date(displayYear, month-1, d);
      // Skip weekends
      if([0,6].includes(date.getDay())) continue;
      
      const iso = `${displayYear}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.iso = iso;
      cell.innerHTML = `<div>${d}</div>`;
      
      // Check for "School Closed" period (Dec 26-31 and Jan 1)
      const isSchoolClosed = (month === 12 && d >= 26) || (month === 1 && d === 1);
      
      const h = holidaysByISO.get(iso);
      if(h || isSchoolClosed){
        cell.classList.add('holiday');
        // Optional / civic marking
        // Statutory (cannot be selected)
        if(h && /statutory/i.test(h.type)){
          cell.classList.add('statutory');
          cell.setAttribute('aria-disabled','true');
        }
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = isSchoolClosed ? 'School Closed' : h.name;
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
      <span class="badge"><span class="swatch h"></span>Holiday/School Closed</span>
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
  const { excludeWeekends, excludeHolidays } = getExclusionSettings();

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
    const footer = document.querySelector('footer');
    if(footer && footer.parentNode === document.body){
      document.body.insertBefore(banner, footer);
    } else {
      document.body.appendChild(banner);
    }
  }
  banner.textContent = `Total vacation days: ${grand}`;

  // Update holiday budget tally (selected vs remaining)
  const hbEl = document.getElementById('holidayBudget');
  const tallyEl = document.getElementById('holidayTally');
  const errorEl = document.getElementById('budgetError');
  if(tallyEl){
    const budget = hbEl ? (parseInt(hbEl.value, 10) || 0) : 0;
    const remaining = budget - grand;
    tallyEl.textContent = `Selected: ${grand} • Remaining: ${remaining}`;
    
    // Show error if budget exceeded
    if(errorEl){
      if(remaining < 0){
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
    }
  }
}

// Export to PDF function
async function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const container = document.getElementById('calendarContainer');
  const { name, manager, year } = getFormInputs();
  const totalDays = calculateVacationDays();

  // Create PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Add header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Vacation Planner — ${year}`, margin, yPos);
  yPos += 10;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Employee: ${name}`, margin, yPos);
  yPos += 6;
  pdf.text(`Manager: ${manager}`, margin, yPos);
  yPos += 6;
  pdf.text(`Total Vacation Days Selected: ${totalDays}`, margin, yPos);
  yPos += 6;
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 10;
  pdf.setTextColor(0);

  // Get all calendar elements
  const calendars = container.querySelectorAll('.calendar');
  
  for (let i = 0; i < calendars.length; i++) {
    const calendar = calendars[i];
    
    // Convert calendar to canvas
    const canvas = await html2canvas(calendar, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Check if we need a new page
    if (yPos + imgHeight > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
    }

    // Add calendar image
    pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
    yPos += imgHeight + 5;
  }

  // Save the PDF
  const filename = `Vacation-Plan-${year}-${name.replace(/\s+/g, '-')}.pdf`;
  pdf.save(filename);
}

// Detect if running in Brightspace and get user name
function getBrightspaceUserName(){
  return new Promise((resolve) => {
    // Check if we're in an iframe
    if(window.self === window.top){
      resolve(null);
      return;
    }
    
    let resolved = false;
    const doResolve = (value) => {
      if(!resolved){
        resolved = true;
        resolve(value);
      }
    };
    
    try {
      // Method 1: Try to access user info from parent window's DOM
      const parentDoc = window.parent.document;
      if(parentDoc){
        // Look for d2l-navigation with user info
        const navUser = parentDoc.querySelector('d2l-navigation[user-name]');
        if(navUser){
          const userName = navUser.getAttribute('user-name');
          if(userName){
            doResolve(userName);
            return;
          }
        }
        
        // Look for user menu or profile elements
        const userMenu = parentDoc.querySelector('.d2l-navigation-s-profile-menu-name, .vui-heading-2');
        if(userMenu && userMenu.textContent.trim()){
          doResolve(userMenu.textContent.trim());
          return;
        }
      }
      
      // Method 2: Try accessing D2L LP User Context
      if(window.parent.D2L && window.parent.D2L.LP && window.parent.D2L.LP.Web && 
         window.parent.D2L.LP.Web.UI && window.parent.D2L.LP.Web.UI.Desktop && 
         window.parent.D2L.LP.Web.UI.Desktop.MasterPages && 
         window.parent.D2L.LP.Web.UI.Desktop.MasterPages.UserName){
        doResolve(window.parent.D2L.LP.Web.UI.Desktop.MasterPages.UserName);
        return;
      }
      
      // Method 3: Check for user context in window object
      if(window.parent.D2LPROFILE){
        const profile = window.parent.D2LPROFILE;
        if(profile.FirstName && profile.LastName){
          doResolve(`${profile.FirstName} ${profile.LastName}`);
          return;
        }
      }
      
      doResolve(null);
    } catch(e){
      // Cross-origin restrictions - this is expected if loaded from different domain
      console.log('Cannot access parent window (cross-origin restriction)');
      doResolve(null);
    }
    
    // Timeout after 1 second if nothing found
    setTimeout(() => doResolve(null), 1000);
  });
}

// Auto-build on load: set next year, check only June/July/August, set holiday budget default, and build calendar
(async function autoBuildOnLoad(){
  const yearInput = document.getElementById('year');
  if(yearInput) yearInput.value = new Date().getFullYear(); // next year
  // check only June (6), July (7), August (8)
  document.querySelectorAll('.month-list input').forEach(cb=>{
    cb.checked = ['6','7','8'].includes(cb.value);
  });
  const hb = document.getElementById('holidayBudget');
  if(hb) hb.value = 43;
  
  // Try to get user name from Brightspace
  const userName = await getBrightspaceUserName();
  if(userName){
    const nameInput = document.getElementById('employeeName');
    if(nameInput) nameInput.value = userName;
  }
  
  // Build calendars after holidays load
  holidaysReady.then(() => buildCalendar());
})();
