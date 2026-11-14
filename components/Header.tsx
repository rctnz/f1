import s from "./Header.module.css";

const LINKS = [
  ["#calendar", "ปฏิทิน"],
  ["#timing", "Timing"],
  ["#rounds", "ทุกสนาม"],
  ["#drivers", "Driver Tags"],
] as const;

export default function Header() {
  return (
    <>
      <div className="flag" aria-hidden="true" />
      <header className={`wrap ${s.header}`}>
        <a className={s.brand} href="#top" aria-label="A10/CPE102 กลับขึ้นด้านบน">
          A10<span>/</span>CPE102
        </a>
        <nav aria-label="เมนูหลัก">
          <ul className={s.menu}>
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <a className={s.link} href={href}>
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}
