// Демо-сценарий для жюри: ведёт по главному пути продукта за ~2 минуты.
// Шаги сами переключают роли и делают действия в демо-данных. «Сбросить демо-данные» возвращает всё как было.
let ctx = null, i = 0, el = null, done = {};

const STEPS = [
  { t: '1 · Ученик: «что делать дальше»', d: 'Вместо сухого среднего — приоритеты: слабые предметы наверху, «до оценки 4 нужна ещё 1 пятёрка», просроченные ДЗ.',
    run: c => { c.S.login('student'); c.go('student'); } },
  { t: '2 · Прозрачная оценка', d: 'Ученик видит, как получена оценка: правила, вес контрольной, динамика. Внизу — калькулятор «а что если?».',
    run: c => { c.go('student/subject/math'); setTimeout(() => { const w = document.querySelector('.whatif'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250); } },
  { t: '3 · Учитель: оценка за 2 касания', d: 'Выбираем «за что» (контрольная) и ставим оценку. Данные сохраняются сами, ошибку можно отменить.',
    run: c => { c.S.login('teacher'); c.ui.cls = '9А'; c.ui.subj = 'math'; c.ui.type = 'test'; c.go('teacher'); } },
  { t: '4 · Оценка поставлена', d: 'Айдане выставлена «5» за контрольную. Вверху страницы — «СОХРАНЕНО» и кнопка «Отменить». Запись появилась в журнале изменений.',
    run: c => { if (!done.g) { c.S.addGrade({ sid: 's1', subj: 'math', value: 5, type: 'test' }); c.ui.lastSave = Date.now(); done.g = 1; } c.render(); } },
  { t: '5 · ЖАРДАМЧЫ AI', d: 'ИИ объясняет расчёт четвертной, динамику и возможные ошибки ввода. Он только советует — оценки не меняет.',
    run: c => { c.ui.sheet = 's1'; c.render(); } },
  { t: '6 · Нет интернета', d: 'Связь пропала — система сама это заметила (никаких кнопок). Оценка всё равно вносится и ждёт в очереди.',
    run: c => { c.ui.sheet = null; if (!done.o) { c.Net.force(true); c.S.addGrade({ sid: 's2', subj: 'math', value: 4, type: 'hw' }); done.o = 1; } c.render(); } },
  { t: '7 · Сеть вернулась', d: 'Система сама увидела, что интернет вернулся, и отправила очередь. Данные не потеряны.',
    run: c => { c.Net.force(false); setTimeout(c.scheduleFlush, 400); } },
  { t: '8 · Ученик получает награду', d: 'Пятёрка за контрольную открыла достижение. Награды — за действия, а не только за оценки.',
    run: c => { c.S.login('student'); c.go('student/ach'); } },
  { t: '9 · Родитель: одно важное, не 20 уведомлений', d: 'Короткий дайджест: что нового, где просрочено и резкое падение по предмету — с понятными действиями.',
    run: c => { c.S.login('parent'); c.go('parent'); } },
  { t: '10 · Администрация: аналитика', d: 'Показатели (успеваемость, качество знаний, СОУ), корреляция посещаемости и оценок, тренд, выбросы, выводы словами. Отчёт скачивается в Excel, Word и PDF.',
    run: c => { c.S.login('admin'); c.go('admin'); } },
  { t: '11 · Педагоги: мониторинг', d: 'Директор видит, кто заполняет журнал, а у кого оценки заметно выше или ниже средних по школе.',
    run: c => { c.go('admin/teachers'); } },
  { t: '12 · «Дело» ученика и фото', d: 'Характеристика и госдокументы (свидетельство о рождении, форма 026/у, прививки…). Администрация читает, родители и классный руководитель редактируют, ученик не видит.',
    run: c => { c.go('dossier/s1'); } },
  { t: '13 · Закрытая школа', d: 'Администрация подключается цепочкой: ключ школы → директор → приглашения с подтверждением. Случайный человек в систему не попадёт.',
    run: c => { c.go('admin/access'); } },
  { t: 'Готово', d: 'Это работающий прототип. Следующий этап: настоящий вход и общая база (Supabase), затем интеграция со школьными системами.',
    run: c => { c.S.login('student'); c.go('student'); } },
];

function panel() {
  if (!el) { el = document.createElement('div'); el.id = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Демо-сценарий'); document.body.appendChild(el); }
  const s = STEPS[i];
  el.innerHTML = `<div class="tour-h"><span>ДЕМО ${i + 1}/${STEPS.length}</span><button class="tx" data-tour="close" aria-label="Закрыть">✕</button></div>
    <b>${s.t}</b><p>${s.d}</p>
    <div class="tour-b"><button class="tbtn" data-tour="prev" ${i === 0 ? 'disabled' : ''}>←</button><button class="tbtn main" data-tour="${i === STEPS.length - 1 ? 'close' : 'next'}">${i === STEPS.length - 1 ? 'Завершить' : 'Дальше →'}</button></div>`;
}
function go(n) { i = Math.max(0, Math.min(STEPS.length - 1, n)); STEPS[i].run(ctx); panel(); }
export function init(c) {
  ctx = c;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tour]'); if (!b) return;
    const a = b.dataset.tour;
    if (a === 'next') go(i + 1); else if (a === 'prev') go(i - 1); else if (a === 'close') stop();
  });
}
export function start() { done = {}; i = 0; ctx.S.resetDemo(); go(0); document.body.classList.add('touring'); }
export function stop() { try { ctx.Net.force(false); } catch {}  if (el) { el.remove(); el = null; } document.body.classList.remove('touring'); }
