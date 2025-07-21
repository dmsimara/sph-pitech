import { getFinderData } from '../../utils/api.js';

const collegeNameMap = {
  "CCIS": "College of Computer and Information Sciences",
  "COC": "College of Communication",
  "CAL": "College of Arts and Letters"
};

const programNameMap = {
  "BSIT": "Bachelor of Science in Information Technology",
  "BSCS": "Bachelor of Science in Computer Science"
};

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('/web/components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  initDropdowns();
});

let academicData = null;

async function initDropdowns() {
  const collegeDropdown = document.getElementById('college-dropdown');
  const programDropdown = document.getElementById('program-dropdown');
  const yearDropdown = document.getElementById('year-dropdown');

  try {
    academicData = await getFinderData();

    // Populate College dropdown
    academicData.colleges.forEach(college => {
      const option = document.createElement('option');
      option.value = college.name;
      option.textContent = collegeNameMap[college.name] || college.name;
      collegeDropdown.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading finder data:', err);
  }

  // College → Program
  collegeDropdown.addEventListener('change', () => {
    const selectedCollege = academicData.colleges.find(c => c.name === collegeDropdown.value);

    programDropdown.innerHTML = '<option value="">Program</option>';
    yearDropdown.innerHTML = '<option value="">Year Level</option>';
    programDropdown.disabled = true;
    yearDropdown.disabled = true;

    if (selectedCollege?.programs?.length) {
      selectedCollege.programs.forEach(program => {
        const option = document.createElement('option');
        option.value = program.name;
        option.textContent = programNameMap[program.name] || program.name;
        programDropdown.appendChild(option);
      });
      programDropdown.disabled = false;
    }
  });

  programDropdown.addEventListener('change', () => {
    const selectedCollege = academicData.colleges.find(c => c.name === collegeDropdown.value);
    const selectedProgram = selectedCollege?.programs.find(p => p.name === programDropdown.value);

    yearDropdown.innerHTML = '<option value="">Year Level</option>';
    yearDropdown.disabled = true;

    if (selectedProgram?.year_levels?.length) {
      selectedProgram.year_levels.forEach(level => {
        const option = document.createElement('option');
        option.value = level.year;
        option.textContent = level.year;
        yearDropdown.appendChild(option);
      });
      yearDropdown.disabled = false;
    }
  });
}

// Handle Proceed Button
const proceedBtn = document.querySelector('.proceed-btn');

proceedBtn.addEventListener('click', () => {
  const college = document.getElementById('college-dropdown');
  const program = document.getElementById('program-dropdown');
  const year = document.getElementById('year-dropdown');

  const selectedCollege = college.value;
  const selectedProgram = program.value;
  const selectedYear = year.value;

  if (!selectedCollege || !selectedProgram || !selectedYear) {
    alert('Please complete all selections before proceeding.');
    return;
  }

  localStorage.setItem('selectedCollege', selectedCollege);
  localStorage.setItem('selectedProgram', selectedProgram);
  localStorage.setItem('selectedYear', selectedYear);

  window.location.href = '/web/blocks.html';
});
