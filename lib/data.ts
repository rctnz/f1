// เนื้อหาทั้งหมดของ Viewbook อยู่ที่ไฟล์นี้ไฟล์เดียว
// แก้หัวข้อ/บันทึกได้ที่ RAW ด้านล่าง (notes: [] = ยังไม่ได้ใส่บันทึก) และสถานะสนามที่ NOT_YET

export type NoteBlock = string | { lead: string; list: string[] };

export type Status = 'FIN' | 'NEXT';

export type Round = {
  n: number;
  nn: string; // "01"
  title: string | null;
  subtitle: string | null;
  notes: NoteBlock[];
  date: string; // "6–7 ส.ค."
  code: string; // "WED"
  status: Status; // FIN = เรียนแล้ว, NEXT = ยังไม่ถึง
  photo: string; // /photos/week-01.jpg
};

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** สนามที่ยังไม่ถึง: เปลี่ยนเป็น FIN ได้ที่นี่เมื่อเรียนผ่านแล้ว */
const NOT_YET = new Set([14, 15, 16]);

/** Week 1 = 6–7 ส.ค. 2026 แล้วบวกทีละ 7 วัน */
export function weekDate(week: number): string {
  const a = new Date(Date.UTC(2026, 7, 6 + 7 * (week - 1)));
  const b = new Date(a.getTime() + 864e5);
  const ma = MONTHS[a.getUTCMonth()];
  const mb = MONTHS[b.getUTCMonth()];
  return ma === mb
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${ma}`
    : `${a.getUTCDate()} ${ma} – ${b.getUTCDate()} ${mb}`;
}

/** ตัวแรกของแต่ละคำ ถ้าไม่ถึง 3 คำ เติมด้วยตัวอักษรถัดไปของคำสุดท้าย */
export function raceCode(title: string | null): string {
  if (!title) return 'TBA';
  const words = title.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TBA';
  let c = words.map((w) => w[0]).join('');
  const last = words[words.length - 1];
  for (let i = 1; c.length < 3 && i < last.length; i++) c += last[i];
  return c.slice(0, 3).toUpperCase();
}

const RAW: Array<[string | null, string | null, NoteBlock[]]> = [
  ['What Engineers Do?', 'Class Introduction', [
    'ในสัปดาห์แรกของการเรียนรู้ เราได้เรียนรู้ว่าวิศวะคืออะไร ได้เห็นการแก้ปัญหาของวิศวะ และการพบเจอข้อผิดพลาดที่นำมาซึ่งการเรียนรู้',
    'รวมทั้งได้เห็นบทบาทหน้าที่ของแต่ละสายงานของวิศวะ',
  ]],
  ['Working Foundation', 'DISC · การทำงานเป็นทีม', [
    'ในสัปดาห์ที่สอง เราได้เรียนรู้เกี่ยวกับ DISC เพื่อสังเกตพฤติกรรม ลักษณะนิสัย แนวคิด และลักษณะการทำงานของแต่ละบุคคล รวมถึงการทำงานร่วมกันของแต่ละลักษณะนิสัย',
    'นอกจากนี้เรายังได้ทำงานกลุ่มแก้ปัญหาการหาห้องเรียนของนักศึกษาเฟรชชี่ ซึ่งได้ฝึกการพูดคุยแก้ปัญหา และวางแผนร่วมกัน',
  ]],
  ['Computer Aided Design', 'LibreCAD / TinkerCAD', [
    'ในสัปดาห์นี้ เราได้ฝึกการมองรูปและลงมือ drawing โดยเริ่มจากการเขียน Top view, Front view, Right side view และ isometric บนกระดาษ รวมถึงการออกแบบ 3D ในโปรแกรม Onshape',
    'นอกจากนี้เรายังได้ลองออกแบบป้ายชื่อของตนเอง โดยใช้ความรู้ที่ได้จากการเรียน และได้ไปศึกษาเพิ่มเติมเกี่ยวกับ 3D Printer ที่ INNO-X',
  ]],
  ['Basic Embedded Systems', 'ESP32', [
    'ในสัปดาห์นี้ เราได้เรียนรู้การต่อวงจรต่าง ๆ เช่น วงจรไฟกระพริบ เรียนรู้การต่อ Port ของ Arduino และได้ลงมือ Run Code เพื่อควบคุมหุ่นยนต์',
    { lead: 'นอกจากนี้เราได้ฝึกทำ Challenge ตามโจทย์ คือ', list: ['เดินอัตโนมัติ 1 เมตร', 'เลี้ยวซ้าย 90 องศา', 'หมุนเป็นวงกลม 30 องศา'] },
  ]],
  ['Intelligent Systems', 'Introduction to AI and Machine Learning', [
    'ในสัปดาห์นี้ เราได้เรียนรู้ว่า AI และ ML คืออะไร ได้เรียนรู้เกี่ยวกับ Image Processing ตั้งแต่พิกเซลและระบบสี',
  ]],
  ['Natural Language Processing', 'Building Simple ChatBot', []],
  ['Programming Concept', 'Happy Coding', []],
  ['The First Project Competition', null, []],
  ['Midterm Exams', 'The Three Challenges', []],
  ['Game', 'Build a Simple Game', []],
  ['Network Security', 'Fundamental of Cyber Security/Threat', []],
  ['Operating Systems', 'Windows, Linux, Virtual Machines', []],
  ['Project Progress Presentation', 'วันพรีเซนต์ความคืบหน้าโปรเจกต์', []],
  ['Game Day', null, []],
  ['Final Exam', null, []],
  ['Final Project Presentations', null, []],
];

export const ROUNDS: Round[] = RAW.map(([title, subtitle, notes], i) => {
  const n = i + 1;
  const nn = String(n).padStart(2, '0');
  const status: Status = NOT_YET.has(n) ? 'NEXT' : 'FIN';
  return { n, nn, title, subtitle, notes, date: weekDate(n), code: raceCode(title), status, photo: `/photos/week-${nn}.jpg` };
});

export const FIN_COUNT = ROUNDS.filter((r) => r.status === 'FIN').length;

export type Driver = { id: string; first: string; last: string; firstEn: string; lastEn: string; no: string; color: string; photo: string };

const DRIVER_COLOR: Record<string, string> = { '25': '#ff3b30', '33': '#ffd60a', '40': '#a3aab3', '41': '#34d399' };

export const DRIVERS: Driver[] = [
  ['69070501025', 'นิมมิดา', 'รุณจักร', 'NIMMIDA', 'RUNNAJAK'],
  ['69070501033', 'รชต', 'นกประเสริฐ', 'RACHATA', 'NOKPRASERT'],
  ['69070501040', 'ศุภิสรา', 'ชูพรรคพานิช', 'SUPISSARA', 'CHOOPHAKPANICH'],
  ['69070501041', 'เศรษฐ์ศรุต', 'กตคุณไพศาล', 'SETSRUTT', 'KOTTAKUNPAISARN'],
].map(([id, first, last, firstEn, lastEn]) => ({
  id, first, last, firstEn, lastEn, no: id.slice(-2), color: DRIVER_COLOR[id.slice(-2)], photo: `/photos/driver-${id.slice(-2)}.jpg`,
}));

export const COVER_PHOTO = '/photos/cover.jpg';
export const titleOf = (r: Round) => r.title ?? 'ใส่หัวข้อ';
