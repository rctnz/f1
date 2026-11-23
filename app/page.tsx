import fs from "node:fs";
import path from "node:path";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Season from "@/components/Season";
import Calendar from "@/components/Calendar";
import Breakdown from "@/components/Breakdown";
import Lightbox from "@/components/Lightbox";
import Stage from "@/components/stage/Stage";
import Handover from "@/components/Handover";
import TimingSheet from "@/components/TimingSheet";
import Rounds from "@/components/Rounds";
import DriverTags from "@/components/DriverTags";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";
import SmoothScroll from "@/components/SmoothScroll";
import { BASE, CAR_PARTS, DRIVERS, ROUNDS } from "@/lib/data";

const EXT = ["jpg", "jpeg", "png", "webp"];

/** a photo dropped into public/photos/<id>.<ext> wins over the in-browser slot */
function findPhoto(id: string): string | null {
  for (const ext of EXT) {
    if (fs.existsSync(path.join(process.cwd(), "public", "photos", `${id}.${ext}`))) return `${BASE}/photos/${id}.${ext}`;
  }
  return null;
}

/** the rest of a week's pictures: public/photos/week-NN-2.jpg, -3, ... shown small under the main one */
function findMore(id: string): string[] {
  const out: string[] = [];
  for (let k = 2; k <= 12; k++) {
    const src = findPhoto(`${id}-${k}`);
    if (src) out.push(src);
  }
  return out;
}

export default function Page() {
  const ids = ["cover", ...ROUNDS.map((r) => `week-${r.nn}`), ...DRIVERS.map((d) => `driver-${d.no}`)];
  const photos = Object.fromEntries(ids.map((id) => [id, findPhoto(id)]));
  const more = Object.fromEntries(ROUNDS.map((r) => [`week-${r.nn}`, findMore(`week-${r.nn}`)]));

  return (
    <>
      <a className="skip" href="#main">
        ข้ามไปที่เนื้อหา
      </a>
      <p className="motionNote">
        เครื่องนี้ปิดเอฟเฟกต์ภาพเคลื่อนไหวไว้ เว็บจึงแสดงแบบนิ่ง ไม่มีรถ 3D ถ้าอยากเห็นแบบเต็ม เปิดที่ Settings ของ Windows &gt; Accessibility &gt; Visual effects
        &gt; Animation effects แล้วโหลดหน้านี้ใหม่
      </p>
      <Stage />
      <ProgressBar />
      <Hero>
        <Header />
      </Hero>
      <main id="main">
        <Season cover={photos.cover} />
        <Calendar photos={photos} />
        <Breakdown
          id="machine"
          kicker={["A10", "EXPLODED VIEW"]}
          title="ผ่ารถ A10"
          intro="หกชิ้นส่วน จับคู่กับหกสนามที่เรียน เลื่อนเพื่ออ่านทีละชิ้น กดที่ป้ายเพื่อไปยังสนามนั้น"
          parts={CAR_PARTS}
          still={{ file: "car-apart.webp", width: 1280, height: 867 }}
        />
        <Handover from="poster" to="tele" clear />
        <TimingSheet />
        <Handover from="tele" to="poster" />
        <Rounds photos={photos} more={more} />
        <DriverTags photos={photos} />
      </main>
      <Lightbox />
      <Handover from="poster" to="tele" />
      <Footer />
      <SmoothScroll />
    </>
  );
}
