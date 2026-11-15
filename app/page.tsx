import fs from "node:fs";
import path from "node:path";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Season from "@/components/Season";
import Calendar from "@/components/Calendar";
import Breakdown from "@/components/Breakdown";
import Stage from "@/components/stage/Stage";
import Handover from "@/components/Handover";
import TimingSheet from "@/components/TimingSheet";
import Rounds from "@/components/Rounds";
import DriverTags from "@/components/DriverTags";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";
import SmoothScroll from "@/components/SmoothScroll";
import { BASE, CAR_PARTS, DRIVERS, ROUNDS, WHEEL_PARTS } from "@/lib/data";

const EXT = ["jpg", "jpeg", "png", "webp"];

/** a photo dropped into public/photos/<id>.<ext> wins over the in-browser slot */
function findPhoto(id: string): string | null {
  for (const ext of EXT) {
    if (fs.existsSync(path.join(process.cwd(), "public", "photos", `${id}.${ext}`))) return `${BASE}/photos/${id}.${ext}`;
  }
  return null;
}

export default function Page() {
  const ids = ["cover", ...ROUNDS.map((r) => `week-${r.nn}`), ...DRIVERS.map((d) => `driver-${d.no}`)];
  const photos = Object.fromEntries(ids.map((id) => [id, findPhoto(id)]));

  return (
    <>
      <a className="skip" href="#main">
        ข้ามไปที่เนื้อหา
      </a>
      <Stage />
      <ProgressBar />
      <Hero>
        <Header />
      </Hero>
      <main id="main">
        <Season cover={photos.cover} />
        <Calendar photos={photos} />
        <Breakdown
          act="car"
          id="machine"
          kicker={["A10", "EXPLODED VIEW"]}
          title="ผ่ารถ A10"
          intro="หกชิ้นส่วน จับคู่กับหกสนามที่เรียน กดที่ป้ายเพื่อไปอ่านสนามนั้น"
          parts={CAR_PARTS}
          still={{ file: "car-apart.webp", width: 1280, height: 867 }}
        />
        <Handover from="poster" to="tele" clear />
        <TimingSheet />
        <Handover from="tele" to="poster" />
        <Rounds photos={photos} />
        <Breakdown
          act="wheel"
          id="wheel"
          kicker={["STEERING WHEEL", "EXPLODED VIEW"]}
          title="ในมือคนขับ"
          intro="พวงมาลัยหนึ่งวง แยกออกเป็นชั้น แต่ละชั้นมีหน้าที่ของมัน"
          parts={WHEEL_PARTS}
          still={{ file: "wheel-apart.webp", width: 800, height: 1122 }}
        />
        <DriverTags photos={photos} />
      </main>
      <Handover from="poster" to="tele" />
      <Footer />
      <SmoothScroll />
    </>
  );
}
