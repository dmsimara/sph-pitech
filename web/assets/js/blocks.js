import { getFinderData } from '../../utils/api.js';

document.addEventListener("DOMContentLoaded", async () => {
  const sidebarRes = await fetch('components/base.html');
  const sidebarHtml = await sidebarRes.text();
  document.getElementById('sidebar-container').innerHTML = sidebarHtml;

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (
      (href.includes('directory.html') || href.includes('blocks.html')) &&
      (currentPath.includes('directory.html') || currentPath.includes('blocks.html'))
    ) {
      link.classList.add('active');
    }
  });

  const college = localStorage.getItem('selectedCollege');
  const program = localStorage.getItem('selectedProgram');
  const year = localStorage.getItem('selectedYear');

  if (!college || !program || !year) {
    document.querySelector('.main-content').innerHTML += '<p>Please go back and complete your selections.</p>';
    return;
  }

  const data = await getFinderData();
  const selectedCollege = data.colleges.find(c => c.name === college);
  const selectedProgram = selectedCollege?.programs.find(p => p.name === program);
  const selectedYear = selectedProgram?.year_levels.find(y => y.year === year);

  const programNameMap = {
    "BSIT": "Bachelor of Science in Information Technology (BSIT)",
    "BSCS": "Bachelor of Science in Computer Science (BSCS)"
  };

  const fullProgramName = programNameMap[program] || program;

  const headerEl = document.querySelector('.directory-header');
  const programPara = document.createElement('p');
  programPara.textContent = fullProgramName;
  headerEl.appendChild(programPara);

  if (selectedYear?.sections) {
    selectedYear.sections.forEach(section => {
        const blocksContainer = document.getElementById('blocks-container');
        const sectionEl = document.createElement('p');
        sectionEl.className = 'block-text';
        sectionEl.textContent = section;
        sectionEl.style.cursor = 'pointer';

        sectionEl.addEventListener('click', () => {
            localStorage.setItem('selectedSection', section);
            window.location.href = 'representative.html';
        });

        blocksContainer.appendChild(sectionEl);
    });
  } else {
    blocksContainer.innerHTML += '<p>No blocks available for this selection.</p>';
  }
});
