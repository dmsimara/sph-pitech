export function showSpinner() {
  const spinner = document.getElementById('spinner');
  if (spinner) {
    spinner.style.display = 'flex';
  }
}

export function hideSpinner() {
  const spinner = document.getElementById('spinner');
  if (spinner) {
    spinner.style.display = 'none';
  }
}
