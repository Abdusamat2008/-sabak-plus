// /updates: клавиши ← → листают карточки; плавное появление
export default function init({ $, $$ }) {
  const row = $('.cards'); if (!row) return;
  const step = () => (row.querySelector('li')?.offsetWidth || 320) + 18;
  row.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { row.scrollBy({ left: step(), behavior: 'smooth' }); } else if (e.key === 'ArrowLeft') { row.scrollBy({ left: -step(), behavior: 'smooth' }); } });
  row.tabIndex = 0; row.setAttribute('role', 'region'); row.setAttribute('aria-label', 'Карточки глав: листайте стрелками');
}
